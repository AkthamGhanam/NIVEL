import type { ApiRequest } from "./api";
import type { VoiceAgent, VoiceToken } from "./nivi-session";

/**
 * Lo que las pantallas de voz le piden al servidor: el permiso para abrir una
 * conversación con un agente, con el contexto firmado de quien tiene la sesión.
 */

export type { VoiceToken };

export interface TokenOptions {
  /** Registro de una persona nueva, aunque haya un personaje de ejemplo con sesión. */
  readonly registration?: boolean;
  /** Persona real del evento: su perfil sobrevive al reinicio de la demo. */
  readonly real?: boolean;
  /** La persona aceptó en pantalla el uso de su voz y sus datos. */
  readonly consent?: boolean;
}

function tokenPath(agent: VoiceAgent, options: TokenOptions): string {
  const query = new URLSearchParams({ agent });
  if (options.registration) query.set("registro", "1");
  if (options.real) query.set("real", "1");
  if (options.consent) query.set("consent", "1");
  return `/api/el/token?${query.toString()}`;
}

export function createVoiceApi(request: ApiRequest) {
  return {
    token: (agent: VoiceAgent, options: TokenOptions = {}) =>
      request<VoiceToken>(tokenPath(agent, options), { as: agent === "worker" ? "worker" : "company" }),
  };
}

export type VoiceApi = ReturnType<typeof createVoiceApi>;
