// Cliente de la API para las pantallas.
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

  get needsSession(): boolean {
    return this.status === 401;
  }
}

export interface RequestOptions {
  readonly method?: "GET" | "POST" | "PATCH" | "DELETE";
  readonly body?: unknown;
  readonly as?: ViewRole;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
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
  const timeout = AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS);
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

export function createApiRequest(fetchImpl: typeof fetch): ApiRequest {
  return async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
    if (!path.startsWith("/api/"))
      throw new ApiError({ status: 0, code: "ruta_invalida", message: UNEXPECTED_MESSAGE });
    let response: Response;
    try {
      response = await fetchImpl(path, buildInit(options));
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new ApiError({ status: 0, code: "sin_conexion", message: OFFLINE_MESSAGE });
    }
    const payload = await readJson(response);
    if (!response.ok) throw toApiError(response.status, payload);
    return payload as T;
  };
}

export const apiRequest: ApiRequest = (path, options) => createApiRequest(fetch)(path, options);

export function errorMessage(error: unknown): string {
  const friendly = error instanceof ApiError || (error instanceof Error && error.name === "LocationError");
  return friendly ? (error as Error).message : UNEXPECTED_MESSAGE;
}
