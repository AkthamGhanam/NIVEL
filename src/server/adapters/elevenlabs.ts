import { AppError } from "../errors";

/**
 * Cliente mínimo de ElevenLabs. Toda llamada tiene tiempo límite y un solo
 * reintento ante fallos transitorios. La clave viaja solo en la cabecera
 * `xi-api-key`: nunca se registra ni se devuelve en un error.
 */

const API_BASE = "https://api.elevenlabs.io";
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 2;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export class VoiceServiceError extends AppError {
  readonly status = 502;
  readonly code = "voz_no_disponible";
  constructor() {
    super("El servicio de voz no respondió. Intenta de nuevo o usa el modo texto.");
  }
}

export interface ElevenLabsOptions {
  readonly apiKey: string;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
}

export interface ElevenLabs {
  /** Token de corta vida para abrir una conversación con el agente desde el navegador. */
  readonly conversationToken: (agentId: string) => Promise<string>;
}

export function createElevenLabs(options: ElevenLabsOptions): ElevenLabs {
  const send = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function attempt(url: URL): Promise<Response | undefined> {
    try {
      const response = await send(url, {
        headers: { "xi-api-key": options.apiKey },
        signal: AbortSignal.timeout(timeoutMs),
      });
      return response.ok || !RETRYABLE_STATUS.has(response.status) ? response : undefined;
    } catch {
      return undefined; // Sin red o tiempo agotado: se reintenta una vez.
    }
  }

  async function getJson(path: string, query: Readonly<Record<string, string>>): Promise<unknown> {
    const url = new URL(path, API_BASE);
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
    for (let tries = 0; tries < MAX_ATTEMPTS; tries += 1) {
      const response = await attempt(url);
      if (response?.ok) return response.json();
      if (response) break; // Error definitivo (por ejemplo 401 o 404): reintentar no ayuda.
    }
    throw new VoiceServiceError();
  }

  return {
    async conversationToken(agentId) {
      const data = await getJson("/v1/convai/conversation/token", { agent_id: agentId });
      const token = (data as { token?: unknown } | null)?.token;
      if (typeof token !== "string" || token === "") throw new VoiceServiceError();
      return token;
    },
  };
}
