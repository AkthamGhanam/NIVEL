/**
 * Cliente de la API para las pantallas. Habla JSON con nuestro propio origen,
 * manda la cookie de sesión y convierte todo fallo en un `ApiError` con un
 * mensaje que se le puede mostrar a la persona.
 */

/** Vista desde la que se hace la petición: decide qué sesión usa el servidor. */
export type ViewRole = "worker" | "company" | "academy" | "admin";

export interface FieldProblem {
  readonly field: string;
  readonly problem: string;
}

interface ApiFailure {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly details?: readonly FieldProblem[];
  readonly requestId?: string | undefined;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: readonly FieldProblem[];
  readonly requestId: string | undefined;

  constructor(failure: ApiFailure) {
    super(failure.message);
    this.name = "ApiError";
    this.status = failure.status;
    this.code = failure.code;
    this.details = failure.details ?? [];
    this.requestId = failure.requestId;
  }

  /** La sesión no existe o venció: toca elegir de nuevo con qué persona entrar. */
  get needsSession(): boolean {
    return this.status === 401;
  }
}

export interface RequestOptions {
  readonly method?: "GET" | "POST" | "PATCH" | "DELETE";
  readonly body?: unknown;
  readonly as?: ViewRole;
  readonly signal?: AbortSignal;
}

export type ApiRequest = <T>(path: string, options?: RequestOptions) => Promise<T>;

export const REQUEST_TIMEOUT_MS = 15_000;
const OFFLINE_MESSAGE = "No pudimos conectar. Revisa tu conexión e intenta de nuevo.";
const UNEXPECTED_MESSAGE = "Algo falló de nuestro lado. Intenta de nuevo.";

function buildInit(options: RequestOptions): RequestInit {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.as) headers["x-nivel-role"] = options.as;
  const hasBody = method !== "GET";
  if (hasBody) headers["content-type"] = "application/json";
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return {
    method,
    headers,
    body: hasBody ? JSON.stringify(options.body ?? {}) : null,
    credentials: "same-origin",
    cache: "no-store",
    signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
  };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function toApiError(status: number, payload: unknown): ApiError {
  const error = (payload as { error?: Record<string, unknown> } | undefined)?.error;
  const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined);
  const details = Array.isArray(error?.details) ? (error.details as FieldProblem[]) : [];
  return new ApiError({
    status,
    code: text(error?.code) ?? "desconocido",
    message: text(error?.message) ?? UNEXPECTED_MESSAGE,
    details,
    requestId: text(error?.requestId),
  });
}

/** Crea el cliente sobre un `fetch` dado. Las pruebas inyectan uno falso. */
export function createApiRequest(fetchImpl: typeof fetch): ApiRequest {
  return async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
    // Solo rutas propias: nunca se manda la sesión ni datos a otro origen.
    if (!path.startsWith("/api/"))
      throw new ApiError({ status: 0, code: "ruta_invalida", message: UNEXPECTED_MESSAGE });
    let response: Response;
    try {
      response = await fetchImpl(path, buildInit(options));
    } catch (error) {
      // Si quien llamó canceló la petición (cambió de pantalla), se respeta su cancelación.
      if (options.signal?.aborted) throw error;
      throw new ApiError({ status: 0, code: "sin_conexion", message: OFFLINE_MESSAGE });
    }
    const payload = await readJson(response);
    if (!response.ok) throw toApiError(response.status, payload);
    return payload as T;
  };
}

/** Cliente del navegador. */
export const apiRequest: ApiRequest = (path, options) => createApiRequest(fetch)(path, options);

/** Mensaje para mostrar, venga el error de donde venga. */
export function errorMessage(error: unknown): string {
  // Los errores propios del cliente (API, ubicación) ya traen un texto pensado para la persona.
  const friendly = error instanceof ApiError || (error instanceof Error && error.name === "LocationError");
  return friendly ? (error as Error).message : UNEXPECTED_MESSAGE;
}
