import type { ProfileCreated } from "@/server/use-cases/registration";

import { ApiError, type ApiRequest } from "./api";
import type { VoiceAgent, VoiceToken } from "./nivi-session";

/**
 * Lo que las pantallas de voz le piden al servidor: el permiso para abrir una
 * conversación con un agente y, tras un registro hablado, el perfil recién creado.
 */

export type { ProfileCreated, VoiceToken };

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

    /** Recoge el perfil que Nivi guardó en esta conversación y deja la sesión abierta. */
    claimProfile: async (conversationId: string, signal?: AbortSignal) =>
      (
        await request<{ profile: ProfileCreated }>(
          `/api/workers/by-conversation/${encodeURIComponent(conversationId)}`,
          signal ? { signal } : {},
        )
      ).profile,
  };
}

export type VoiceApi = ReturnType<typeof createVoiceApi>;

export const CLAIM_POLL_MS = 2000;
/** Aún no hay perfil (404) o no hubo red (0): son esperas normales, no fallas. */
const KEEP_WAITING: readonly number[] = [404, 0];

export interface ProfileWait {
  readonly signal: AbortSignal;
  readonly intervalMs?: number;
}

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

/**
 * Espera a que Nivi guarde el perfil de la conversación: pregunta cada pocos
 * segundos hasta que exista o hasta que la pantalla deje de esperar.
 */
export async function waitForProfile(
  claim: () => Promise<ProfileCreated>,
  { signal, intervalMs = CLAIM_POLL_MS }: ProfileWait,
): Promise<ProfileCreated | undefined> {
  while (!signal.aborted) {
    try {
      return await claim();
    } catch (error) {
      if (!(error instanceof ApiError) || !KEEP_WAITING.includes(error.status)) throw error;
    }
    await pause(intervalMs, signal);
  }
  return undefined;
}
