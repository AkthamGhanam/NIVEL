// Registro real desde la web.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "../../../../scripts/smoke/client";
import { dispatch, type InProcessApi, startInProcessApi } from "../../testing/in-process-api";
import type { DemoState } from "../../use-cases/personas";
import { normalizeRif } from "../../use-cases/registration";

let api: InProcessApi;
let ipCounter = 0;

function newClient() {
  ipCounter += 1;
  const ip = `203.0.113.${ipCounter}`;
  return new ApiClient(
    api.baseUrl,
    (request) => {
      request.headers.set("x-forwarded-for", ip);
      return dispatch(request);
    },
    api.demoKey,
  );
}

const WORKER = {
  name: "María Fernanda Rojas",
  isAdult: true,
  trade: "electricista",
  yearsExp: 6,
  skills: ["tableros", "cableado industrial"],
  zone: "vivo en San Diego",
  availability: "Inmediata",
  consent: true,
} as const;

const COMPANY = {
  name: "Montajes Carabobo C.A.",
  rif: "j 41234567 8",
  zone: "Valencia",
  kind: "contratista",
  consent: true,
} as const;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

beforeAll(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  api = startInProcessApi();
  await newClient().post("/api/demo/reset", { as: "admin" });
});

afterAll(() => api.dispose());

describe("normalizeRif", () => {
  it.each([
    ["J-12345678-9", "J-12345678-9"],
    ["j123456789", "J-12345678-9"],
    [" g 20000000 1 ", "G-20000000-1"],
  ])("acepta %j como %s", (raw, expected) => {
    expect(normalizeRif(raw)).toBe(expected);
  });

  it.each(["", "12345678", "J-1234-5", "X-12345678-9"])("rechaza %j", (raw) => {
    expect(() => normalizeRif(raw)).toThrow(/J-12345678-9/);
  });
});

describe("registro del trabajador escribiendo", () => {
  it("crea el perfil en Nivel 1, abre su sesión y no lo muestra entre las cuentas de prueba", async () => {
    const client = newClient();
    const created = await client.call<{ profile: { firstName: string; level: number } }>(
      "POST",
      "/api/workers/register",
      { body: WORKER },
    );

    expect(created.status).toBe(201);
    expect(created.data.profile).toMatchObject({ firstName: "María", level: 1 });
    const me = await client.get<{ firstName: string; zone: string }>("/api/me", { as: "worker" });
    expect(me).toMatchObject({ firstName: "María", zone: "San Diego" });
    const state = await client.get<DemoState>("/api/state");
    expect(state.active.workerId).not.toBeNull();
    expect(state.personas.workers.find((worker) => worker.registered)).toMatchObject({ name: "María F." });
  });

  it("sin el permiso o siendo menor de edad no crea nada", async () => {
    const client = newClient();
    const noConsent = await client.call("POST", "/api/workers/register", {
      body: { ...WORKER, consent: false },
    });
    const minor = await client.call("POST", "/api/workers/register", { body: { ...WORKER, isAdult: false } });

    expect(noConsent.status).toBe(422);
    expect(minor.status).toBe(422);
    expect((await client.get<DemoState>("/api/state")).active.workerId).toBeNull();
  });
});

describe("registro de empresa", () => {
  it("crea la empresa sin verificar, abre su sesión y la identifica aunque no sea de prueba", async () => {
    const client = newClient();
    const created = await client.call<{ company: { rif: string; verified: boolean } }>(
      "POST",
      "/api/companies/register",
      { body: COMPANY },
    );

    expect(created.status).toBe(201);
    expect(created.data.company).toMatchObject({ rif: "J-41234567-8", verified: false });
    const state = await client.get<DemoState>("/api/state");
    expect(state.activeCompany).toMatchObject({ name: COMPANY.name, verified: false, zone: "Valencia" });
    expect(state.personas.companies.find((company) => company.registered)?.name).toBe(COMPANY.name);

    await client.get("/api/requests/active", { as: "company" });
  });

  it("una empresa registrada aparece en la lista y se puede volver a entrar a ella", async () => {
    const owner = newClient();
    await owner.post("/api/companies/register", {
      body: { ...COMPANY, rif: "J-41234567-0", name: "Taller Real" },
    });
    const companyId = (await owner.get<DemoState>("/api/state")).active.companyId;

    const visitor = newClient();
    const entry = await visitor.call("POST", "/api/state", { body: { role: "company", id: companyId } });

    expect(entry.status).toBe(200);
    expect((await visitor.get<DemoState>("/api/state")).activeCompany?.name).toBe("Taller Real");
  });

  it("rechaza un RIF repetido o mal escrito", async () => {
    const client = newClient();
    const repeated = await client.call("POST", "/api/companies/register", { body: COMPANY });
    const malformed = await client.call("POST", "/api/companies/register", {
      body: { ...COMPANY, rif: "123-ABC-4567" },
    });

    expect(repeated.status).toBe(409);
    expect(malformed.status).toBe(422);
  });

  it("el reinicio de la demo conserva a las empresas y personas reales", async () => {
    const client = newClient();
    await client.post("/api/companies/register", {
      body: { ...COMPANY, rif: "J-49999999-1", name: "Sobrevive C.A." },
    });
    await client.post("/api/workers/register", { body: { ...WORKER, name: "Pedro Sobrevive" } });

    await newClient().post("/api/demo/reset", { as: "admin" });

    const state = await client.get<DemoState>("/api/state");
    expect(state.activeCompany?.name).toBe("Sobrevive C.A.");
    expect(await client.get<{ firstName: string }>("/api/me", { as: "worker" })).toMatchObject({
      firstName: "Pedro",
    });
    // De ejemplo queda una sola empresa, recién creada.
    expect(state.personas.companies.filter((company) => !company.registered)).toHaveLength(1);
  });

  it("borrar todo también se lleva a las empresas y personas reales", async () => {
    const client = newClient();
    await client.post("/api/companies/register", {
      body: { ...COMPANY, rif: "J-48888888-2", name: "Se Va C.A." },
    });

    await newClient().post("/api/demo/reset?all=1", { as: "admin" });

    const state = await client.get<DemoState>("/api/state");
    expect(state.activeCompany).toBeNull();
    expect(state.personas.companies).toHaveLength(1);
    expect(state.personas.workers.length).toBeGreaterThan(0);
  });
});
