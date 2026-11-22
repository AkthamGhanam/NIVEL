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
  readonly upload?: Blob;
}

export type ApiRequest = <T>(path: string, options?: RequestOptions) => Promise<T>;

export const REQUEST_TIMEOUT_MS = 15_000;
/** Subir y transcribir una nota de 60 s tarda más que una petición corriente. */
export const UPLOAD_TIMEOUT_MS = 30_000;
const UNKNOWN_UPLOAD_TYPE = "application/octet-stream";
const OFFLINE_MESSAGE = "No pudimos conectar. Revisa tu conexión e intenta de nuevo.";
const UNEXPECTED_MESSAGE = "Algo falló de nuestro lado. Intenta de nuevo.";

function bodyOf(options: RequestOptions, method: string): { body: BodyInit | null; type?: string } {
  if (options.upload) return { body: options.upload, type: options.upload.type || UNKNOWN_UPLOAD_TYPE };
  if (method === "GET") return { body: null };
  return { body: JSON.stringify(options.body ?? {}), type: "application/json" };
}

function buildInit(options: RequestOptions): RequestInit {
  const method = options.upload ? "POST" : (options.method ?? "GET");
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.as) headers["x-nivel-role"] = options.as;
  const { body, type } = bodyOf(options, method);
  if (type) headers["content-type"] = type;
  const timeout = AbortSignal.timeout(
    options.timeoutMs ?? (options.upload ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS),
  );
  return {
    method,
    headers,
    body,
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

const FRIENDLY_ERROR_NAMES: readonly string[] = ["LocationError", "MicrophoneError"];

export function errorMessage(error: unknown): string {
  const friendly =
    error instanceof ApiError || (error instanceof Error && FRIENDLY_ERROR_NAMES.includes(error.name));
  return friendly ? (error as Error).message : UNEXPECTED_MESSAGE;
}
