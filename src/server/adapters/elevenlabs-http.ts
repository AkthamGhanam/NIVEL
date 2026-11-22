/**
 * Transporte HTTP común para la API de ElevenLabs: tiempo límite en cada
 * intento y un solo reintento ante fallos transitorios (red, 408, 429, 5xx).
 * La clave viaja solo en la cabecera `xi-api-key`: nunca entra en un error.
 */

export const ELEVENLABS_API_BASE = "https://api.elevenlabs.io";
/** Sección 12 de la especificación: 8 s en TTS y STT, con un reintento. */
export const DEFAULT_TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 2;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
/** Lo justo del detalle de un error para diagnosticar en un script, sin volcar respuestas enteras. */
const MAX_DETAIL_LENGTH = 300;

export interface ElevenLabsHttpOptions {
  readonly apiKey: string;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
}

export interface ElevenLabsRequest {
  readonly method?: "GET" | "POST" | "PATCH" | "DELETE";
  readonly query?: Readonly<Record<string, string>>;
  /** Cuerpo JSON. Excluyente con `form`. */
  readonly json?: unknown;
  /** Cuerpo multipart (por ejemplo, un audio). Excluyente con `json`. */
  readonly form?: FormData;
  readonly timeoutMs?: number;
}

/** La API respondió con error, o no respondió tras el reintento (`status` indefinido). */
export class ElevenLabsRequestError extends Error {
  override readonly name = "ElevenLabsRequestError";
  constructor(
    readonly status: number | undefined,
    readonly detail: string,
  ) {
    super(status === undefined ? `ElevenLabs no respondió: ${detail}` : `ElevenLabs ${status}: ${detail}`);
  }
}

export type ElevenLabsSend = (path: string, request?: ElevenLabsRequest) => Promise<Response>;

function buildBody(request: ElevenLabsRequest): { body?: BodyInit; headers: Record<string, string> } {
  if (request.json !== undefined) {
    return { body: JSON.stringify(request.json), headers: { "Content-Type": "application/json" } };
  }
  if (request.form) return { body: request.form, headers: {} };
  return { headers: {} };
}

async function readDetail(response: Response, apiKey: string): Promise<string> {
  const text = await response.text().catch(() => "");
  // Por si la API repitiera la clave en su mensaje: nunca sale de aquí.
  return text.replaceAll(apiKey, "[clave]").slice(0, MAX_DETAIL_LENGTH);
}

/** Devuelve la respuesta correcta o lanza `ElevenLabsRequestError`. */
export function createElevenLabsHttp(options: ElevenLabsHttpOptions): ElevenLabsSend {
  const send = options.fetch ?? fetch;

  return async (path, request = {}) => {
    const url = new URL(path, ELEVENLABS_API_BASE);
    for (const [name, value] of Object.entries(request.query ?? {})) url.searchParams.set(name, value);
    const { body, headers } = buildBody(request);
    const init = {
      method: request.method ?? "GET",
      headers: { "xi-api-key": options.apiKey, ...headers },
      body,
    };
    let lastProblem = "sin respuesta";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      let response: Response;
      try {
        response = await send(url, {
          ...init,
          signal: AbortSignal.timeout(request.timeoutMs ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        });
      } catch (error) {
        lastProblem = error instanceof Error ? error.name : "error de red";
        continue; // Sin red o tiempo agotado: se reintenta una vez.
      }
      if (response.ok) return response;
      const detail = await readDetail(response, options.apiKey);
      // Un error definitivo (401, 404, 422…) no mejora reintentando.
      if (!RETRYABLE_STATUS.has(response.status) || attempt === MAX_ATTEMPTS) {
        throw new ElevenLabsRequestError(response.status, detail);
      }
    }
    throw new ElevenLabsRequestError(undefined, lastProblem);
  };
}
