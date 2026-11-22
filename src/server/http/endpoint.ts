import { randomUUID } from "node:crypto";

import type { z } from "zod";
import { ZodError } from "zod";

import { DomainValidationError } from "@/lib/errors";

import type { Actor, Role, Sessions } from "../actor";
import { ConfigError } from "../config/env";
import type { AppContext } from "../context";
import {
  AppError,
  ForbiddenError,
  PayloadTooLargeError,
  RateLimitedError,
  UnauthorizedError,
  UnsupportedMediaTypeError,
} from "../errors";
import { log } from "../log";
import {
  decodeSession,
  encodeSession,
  parseCookies,
  secretMatches,
  sessionCookie,
  sessionCookieName,
} from "./session";

/**
 * Envoltorio común de todas las rutas de la API: autenticación en servidor
 * (denegada por defecto), validación del cuerpo con zod, protección CSRF,
 * límite de tamaño, errores uniformes y un log por petición con correlation ID.
 * No depende de Next.js: recibe un `Request` estándar y devuelve un `Response`.
 */

export const MAX_BODY_BYTES = 64 * 1024;
/** Con varias personas activas en el mismo navegador, indica con cuál se hace la petición. */
export const ROLE_HEADER = "x-nivel-role";
export const DEMO_KEY_HEADER = "x-demo-key";

const ROLES = ["worker", "company", "academy", "admin"] as const satisfies readonly Role[];
const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Quién puede llamar la ruta:
 * - un rol o una lista de roles: exige la cookie firmada de uno de ellos;
 * - si incluye "admin": también vale la clave de demo en `x-demo-key`;
 * - "public": cualquiera (solo para datos no sensibles).
 */
export type Access = "public" | Role | readonly [Role, ...Role[]];

type RolesOf<A extends Access> = A extends Role ? A : A extends readonly Role[] ? A[number] : never;

/** Actor que recibe el manejador: indefinido solo en rutas públicas. */
export type ActorOf<A extends Access> = A extends "public" ? undefined : Extract<Actor, { role: RolesOf<A> }>;

export interface Runtime {
  readonly context: AppContext;
  readonly sessionSecret: string;
  readonly demoKey: string | undefined;
  /** Marca las cookies como `Secure` (todo despliegue por https). */
  readonly secureCookies: boolean;
}

export type RuntimeProvider = () => Promise<Runtime>;

export interface EndpointInput<Body, RequestActor> {
  readonly actor: RequestActor;
  readonly body: Body;
  readonly params: Readonly<Record<string, string>>;
  readonly url: URL;
  readonly context: AppContext;
  /** Personas con sesión válida en este navegador, por rol. */
  readonly sessions: Sessions;
  /** Cabecera `Set-Cookie` que abre la sesión del actor indicado. */
  readonly issueSession: (actor: Actor) => string;
  /** ¿Coincide el valor con la clave de demo del servidor? Falso si no está configurada. */
  readonly isDemoKey: (candidate: string | null) => boolean;
}

/** Resultado con cabeceras extra (por ejemplo `Set-Cookie`) o un código distinto de 200. */
export class ApiResponse {
  constructor(
    readonly data: unknown,
    readonly init: { readonly status?: number; readonly headers?: Readonly<Record<string, string>> } = {},
  ) {}
}

interface EndpointOptions<A extends Access, Schema extends z.ZodType | undefined> {
  readonly access: A;
  readonly body?: Schema;
}

type BodyOf<Schema> = Schema extends z.ZodType ? z.infer<Schema> : undefined;

export type RouteParams = { readonly params: Promise<Readonly<Record<string, string>>> };
export type RouteHandler = (request: Request, route?: RouteParams) => Promise<Response>;

function readSessions(request: Request, runtime: Runtime): Sessions {
  const cookies = parseCookies(request.headers.get("cookie"));
  const now = runtime.context.now();
  const sessions: Partial<Record<Role, Actor>> = {};
  for (const role of ROLES) {
    const actor = decodeSession(cookies.get(sessionCookieName(role)), runtime.sessionSecret, now);
    // Una cookie válida de un rol no sirve bajo el nombre de otro.
    if (actor?.role === role) sessions[role] = actor;
  }
  return sessions;
}

const isDemoKey = (runtime: Runtime, candidate: string | null): boolean =>
  runtime.demoKey !== undefined && secretMatches(candidate, runtime.demoKey);

function authenticate(request: Request, access: Access, found: { runtime: Runtime; sessions: Sessions }) {
  if (access === "public") return undefined;
  const allowed: readonly Role[] = typeof access === "string" ? [access] : access;
  if (allowed.includes("admin") && isDemoKey(found.runtime, request.headers.get(DEMO_KEY_HEADER))) {
    return { role: "admin" } as const;
  }
  const preferred = request.headers.get(ROLE_HEADER);
  const candidates = preferred ? allowed.filter((role) => role === preferred) : allowed;
  for (const role of candidates) {
    const actor = found.sessions[role];
    if (actor) return actor;
  }
  throw new UnauthorizedError();
}

/** CSRF: una petición de navegador que cambia datos debe venir de nuestro propio origen. */
function assertSameOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method)) return;
  const origin = request.headers.get("origin");
  if (origin === null) return; // No es un navegador (script smoke, herramientas de los agentes).
  const expected = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost: string | undefined;
  try {
    originHost = new URL(origin).host;
  } catch {
    originHost = undefined;
  }
  if (!originHost || originHost !== expected) throw new ForbiddenError("Origen no permitido.");
}

/** Lee el cuerpo sin cargar en memoria más de `MAX_BODY_BYTES`, venga o no con Content-Length. */
async function readLimitedText(request: Request): Promise<string> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new PayloadTooLargeError();
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new PayloadTooLargeError();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readBody<Schema extends z.ZodType | undefined>(
  request: Request,
  schema: Schema,
): Promise<BodyOf<Schema>> {
  if (!schema) return undefined as BodyOf<Schema>;
  const text = await readLimitedText(request);
  if (text === "") return schema.parse({}) as BodyOf<Schema>;
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) throw new UnsupportedMediaTypeError();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new DomainValidationError("El cuerpo debe ser JSON válido");
  }
  return schema.parse(json) as BodyOf<Schema>;
}

interface ErrorBody {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly details?: ReadonlyArray<{ field: string; problem: string }>;
  readonly headers?: Readonly<Record<string, string>>;
}

function describeError(error: unknown): ErrorBody {
  if (error instanceof RateLimitedError) {
    const headers = { "Retry-After": String(error.retryAfterSeconds) };
    return { status: error.status, code: error.code, message: error.message, headers };
  }
  if (error instanceof AppError) return { status: error.status, code: error.code, message: error.message };
  if (error instanceof DomainValidationError) {
    return { status: 422, code: "dato_invalido", message: error.message };
  }
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({ field: issue.path.join("."), problem: issue.message }));
    return { status: 422, code: "dato_invalido", message: "Revisa los datos enviados.", details };
  }
  if (error instanceof ConfigError) {
    return { status: 503, code: "sin_configurar", message: "El servidor aún no está configurado." };
  }
  return { status: 500, code: "error_interno", message: "Algo falló de nuestro lado. Intenta de nuevo." };
}

function jsonResponse(data: unknown, status: number, headers: Readonly<Record<string, string>>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

function requestIdOf(request: Request): string {
  const incoming = request.headers.get("x-request-id");
  return incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
}

function errorResponse(error: unknown, requestId: string): Response {
  const described = describeError(error);
  if (described.status >= 500) {
    // El detalle va al log del servidor, nunca al cliente.
    log("error", "request_failed", {
      requestId,
      error: error instanceof Error ? `${error.name}: ${error.message}` : "desconocido",
    });
  }
  const { status, headers, ...body } = described;
  return jsonResponse({ error: { ...body, requestId } }, status, { "X-Request-ID": requestId, ...headers });
}

function successResponse(result: unknown, requestId: string): Response {
  if (result instanceof ApiResponse) {
    const headers = { "X-Request-ID": requestId, ...result.init.headers };
    return jsonResponse(result.data, result.init.status ?? 200, headers);
  }
  return jsonResponse(result, 200, { "X-Request-ID": requestId });
}

/** Crea el manejador de una ruta. `runtime` se resuelve por petición para poder inyectarlo en pruebas. */
export function endpoint<A extends Access, Schema extends z.ZodType | undefined = undefined>(
  options: EndpointOptions<A, Schema>,
  handler: (input: EndpointInput<BodyOf<Schema>, ActorOf<A>>) => Promise<unknown>,
  runtime: RuntimeProvider,
): RouteHandler {
  const respond = async (request: Request, route: RouteParams | undefined): Promise<unknown> => {
    const resolved = await runtime();
    assertSameOrigin(request);
    const sessions = readSessions(request, resolved);
    const actor = authenticate(request, options.access, { runtime: resolved, sessions }) as ActorOf<A>;
    const body = await readBody(request, options.body as Schema);
    return handler({
      actor,
      body,
      params: (await route?.params) ?? {},
      url: new URL(request.url),
      context: resolved.context,
      sessions,
      issueSession: (next) => {
        const token = encodeSession(next, resolved.sessionSecret, resolved.context.now());
        return sessionCookie(next.role, token, resolved.secureCookies);
      },
      isDemoKey: (candidate) => isDemoKey(resolved, candidate),
    });
  };
  return async (request, route) => {
    const requestId = requestIdOf(request);
    const startedAt = performance.now();
    let response: Response;
    try {
      response = successResponse(await respond(request, route), requestId);
    } catch (error) {
      response = errorResponse(error, requestId);
    }
    log("info", "http_request", {
      requestId,
      method: request.method,
      path: new URL(request.url).pathname,
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
    });
    return response;
  };
}
