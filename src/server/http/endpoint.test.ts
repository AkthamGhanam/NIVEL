import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { DomainValidationError } from "@/lib/errors";

import type { Actor } from "../actor";
import { ConfigError } from "../config/env";
import { ConflictError, RateLimitedError } from "../errors";
import { workers } from "../db/schema";
import { createTestApp, DEMO_NOW, type TestApp, TEST_SECRET } from "../testing/test-app";
import { ApiResponse, endpoint, MAX_BODY_BYTES, type Runtime } from "./endpoint";
import { createRateLimiter } from "./rate-limit";
import { encodeSession, sessionCookieName } from "./session";

const DEMO_KEY = randomBytes(32).toString("hex");
const TOOL_SECRET = randomBytes(32).toString("hex");
const URL_BASE = "http://localhost:3000/api/prueba";
const CARLOS: Actor = { role: "worker", workerId: "w-carlos" };
const COMPANY: Actor = { role: "company", companyId: "co-guayos" };

let app: TestApp;
let runtime: Runtime;
let errorLog: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  app = await createTestApp();
  runtime = {
    context: app.context,
    sessionSecret: TEST_SECRET,
    demoKey: DEMO_KEY,
    toolSecret: TOOL_SECRET,
    limiter: createRateLimiter(),
    services: { conversationToken: async (agent) => `token-${agent}` },
    secureCookies: true,
  };
});

afterAll(() => app.close());

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const provide = async () => runtime;
const cookieOf = (actor: Actor, name = sessionCookieName(actor.role)) =>
  `${name}=${encodeSession(actor, TEST_SECRET, DEMO_NOW)}`;

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request(URL_BASE, {
    method: "POST",
    body,
    headers: { "content-type": "application/json", cookie: cookieOf(CARLOS), ...headers },
  });

const whoAmI = endpoint({ access: "worker" }, async ({ actor }) => ({ workerId: actor.workerId }), provide);
const echo = endpoint(
  { access: "worker", body: z.strictObject({ quantity: z.int().min(1) }) },
  async ({ body }) => body,
  provide,
);

describe("respuesta", () => {
  it("una ruta pública responde JSON sin caché y con un correlation ID nuevo", async () => {
    const handler = endpoint(
      { access: "public" },
      async ({ actor }) => ({ anonymous: actor === undefined }),
      provide,
    );

    const response = await handler(new Request(URL_BASE, { headers: { "x-request-id": "<script>" } }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ anonymous: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("conserva el correlation ID entrante si tiene un formato seguro", async () => {
    const response = await whoAmI(
      new Request(URL_BASE, { headers: { cookie: cookieOf(CARLOS), "x-request-id": "abc-12345" } }),
    );

    expect(response.headers.get("x-request-id")).toBe("abc-12345");
  });

  it("admite código, cabeceras y parámetros de ruta propios", async () => {
    const handler = endpoint(
      { access: "public" },
      async ({ params, issueSession }) =>
        new ApiResponse({ id: params.id }, { status: 201, headers: { "Set-Cookie": issueSession(CARLOS) } }),
      provide,
    );

    const response = await handler(new Request(URL_BASE), { params: Promise.resolve({ id: "ct-1" }) });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "ct-1" });
    expect(response.headers.get("set-cookie")).toMatch(
      /^nivel_worker=.+; Path=\/; HttpOnly; SameSite=Lax; .*Secure$/,
    );
  });
});

describe("autenticación (denegada por defecto)", () => {
  it("sin cookie, con cookie alterada o vencida responde 401", async () => {
    const tampered = `${cookieOf(CARLOS).slice(0, -2)}xx`;
    const expired = `nivel_worker=${encodeSession(CARLOS, TEST_SECRET, new Date("2026-11-20T00:00:00Z"))}`;

    for (const cookie of ["", tampered, expired]) {
      const response = await whoAmI(new Request(URL_BASE, { headers: { cookie } }));
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe("no_autenticado");
    }
  });

  it("una sesión de empresa no vale bajo el nombre de la cookie de trabajador", async () => {
    const response = await whoAmI(
      new Request(URL_BASE, { headers: { cookie: cookieOf(COMPANY, sessionCookieName("worker")) } }),
    );

    expect(response.status).toBe(401);
  });

  it("con varias personas activas usa la que indica x-nivel-role, si la ruta la admite", async () => {
    const handler = endpoint(
      { access: ["worker", "company"] },
      async ({ actor }) => ({ role: actor.role }),
      provide,
    );
    const cookie = `${cookieOf(CARLOS)}; ${cookieOf(COMPANY)}`;
    const as = (role?: string) =>
      handler(new Request(URL_BASE, { headers: role ? { cookie, "x-nivel-role": role } : { cookie } }));

    expect(await (await as()).json()).toEqual({ role: "worker" });
    expect(await (await as("company")).json()).toEqual({ role: "company" });
    expect((await as("admin")).status).toBe(401);
  });

  it("el equipo entra con la clave de demo; una clave errada o sin configurar no entra", async () => {
    const admin = endpoint({ access: "admin" }, async ({ actor }) => ({ role: actor.role }), provide);
    const withKey = (key: string) => new Request(URL_BASE, { headers: { "x-demo-key": key } });
    const unconfigured = endpoint(
      { access: "admin" },
      async () => ({}),
      async () => ({ ...runtime, demoKey: undefined }),
    );

    expect(await (await admin(withKey(DEMO_KEY))).json()).toEqual({ role: "admin" });
    expect((await admin(withKey(`${DEMO_KEY}x`))).status).toBe(401);
    expect((await unconfigured(withKey(DEMO_KEY))).status).toBe(401);
    expect((await whoAmI(withKey(DEMO_KEY))).status).toBe(401);
  });
});

describe("la sesión muere con la cuenta", () => {
  it("una cookie bien firmada de alguien que ya no existe o borró su cuenta responde 401", async () => {
    const ghost: Actor = { role: "worker", workerId: "w-fantasma" };
    const deleted: Actor = { role: "worker", workerId: "w-014" };
    await app.context.db
      .update(workers)
      .set({ deletedAt: DEMO_NOW.toISOString() })
      .where(eq(workers.id, deleted.workerId));
    const call = (actor: Actor) => whoAmI(new Request(URL_BASE, { headers: { cookie: cookieOf(actor) } }));

    expect((await call(ghost)).status).toBe(401);
    expect((await call(deleted)).status).toBe(401);
    expect((await call(CARLOS)).status).toBe(200);
  });
});

describe("CSRF", () => {
  it("acepta el mismo origen (también detrás de un proxy) y rechaza otro o uno ilegible", async () => {
    const from = (headers: Record<string, string>) => echo(post('{"quantity":1}', headers));

    expect((await from({ origin: "http://localhost:3000", host: "localhost:3000" })).status).toBe(200);
    expect(
      (
        await from({
          origin: "https://nivel.example",
          host: "interno:3000",
          "x-forwarded-host": "nivel.example",
        })
      ).status,
    ).toBe(200);
    expect((await from({ origin: "https://otro.example", host: "localhost:3000" })).status).toBe(403);
    expect((await from({ origin: "null", host: "localhost:3000" })).status).toBe(403);
  });

  it("no exige origen en lecturas", async () => {
    const response = await whoAmI(
      new Request(URL_BASE, { headers: { cookie: cookieOf(CARLOS), origin: "https://otro.example" } }),
    );

    expect(response.status).toBe(200);
  });
});

describe("cuerpo", () => {
  it("valida con el esquema y señala el campo que falla", async () => {
    const response = await echo(post('{"quantity":0,"extra":true}'));
    const { error } = await response.json();

    expect(response.status).toBe(422);
    expect(error.details.map((detail: { field: string }) => detail.field)).toContain("quantity");
  });

  it("rechaza JSON mal formado (422) y otros formatos (415); un cuerpo vacío se valida como {}", async () => {
    expect((await echo(post("{no es json"))).status).toBe(422);
    expect(
      (await echo(post("quantity=1", { "content-type": "application/x-www-form-urlencoded" }))).status,
    ).toBe(415);
    expect((await echo(post(""))).status).toBe(422);
  });

  it("corta los cuerpos de más de 64 KB, declaren o no su tamaño", async () => {
    const big = JSON.stringify({ quantity: 1, padding: "x".repeat(MAX_BODY_BYTES) });
    const streamed = new Request(URL_BASE, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieOf(CARLOS) },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(big));
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit);

    expect((await echo(post(big, { "content-length": String(big.length) }))).status).toBe(413);
    expect((await echo(streamed)).status).toBe(413);
  });
});

describe("errores", () => {
  const failing = (error: unknown) =>
    endpoint(
      { access: "public" },
      async () => {
        throw error;
      },
      provide,
    )(new Request(URL_BASE));

  it("traduce los errores conocidos a su código HTTP", async () => {
    const limited = await failing(new RateLimitedError(7));

    expect((await failing(new ConflictError("Ya existe."))).status).toBe(409);
    expect((await failing(new DomainValidationError("Monto inválido"))).status).toBe(422);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("7");
  });

  it("un fallo inesperado responde 500 genérico y deja el detalle solo en el log", async () => {
    const response = await failing(new Error("SQLITE_ERROR: no such table: workers"));
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toContain("SQLITE");
    expect(text).toContain("error_interno");
    expect(String(errorLog.mock.calls[0]?.[0])).toContain("SQLITE_ERROR");
  });

  it("sin configuración responde 503 sin revelar qué variable falta", async () => {
    const handler = endpoint(
      { access: "public" },
      async () => ({}),
      async () => {
        throw new ConfigError("Falta la variable de entorno SESSION_SECRET");
      },
    );
    const response = await handler(new Request(URL_BASE));

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("SESSION_SECRET");
  });

  it("un valor lanzado que no es Error también se registra", async () => {
    expect((await failing("texto suelto")).status).toBe(500);
    expect(String(errorLog.mock.calls[0]?.[0])).toContain("desconocido");
  });
});
