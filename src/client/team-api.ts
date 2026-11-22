import type { ResetSummary } from "@/server/db/reset";
import type { EventRow } from "@/server/use-cases/events";
import type { RealProfilesToday } from "@/server/use-cases/metrics";
import type { DemoState } from "@/server/use-cases/personas";

import type { ApiRequest } from "./api";

/**
 * Lo que el Modo Jurado le pide al servidor. Cada llamada va con la vista
 * "admin": el servidor exige la sesión del equipo, que solo se abre con la
 * clave de la demo.
 */

export type { DemoState, EventRow, RealProfilesToday, ResetSummary };

export interface FastForwardResult {
  readonly requestId: string;
  readonly daysAdded: number;
}

const AS_TEAM = { as: "admin" } as const;

export function createTeamApi(request: ApiRequest) {
  const get = <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, signal ? { ...AS_TEAM, signal } : AS_TEAM);
  const post = <T>(path: string, body?: unknown) => request<T>(path, { ...AS_TEAM, method: "POST", body });

  return {
    state: (signal?: AbortSignal) => get<DemoState>("/api/state", signal),
    /** Abre la sesión del equipo. La clave viaja una vez y no se guarda en el navegador. */
    enter: (key: string) => post<DemoState>("/api/state", { role: "admin", key }),

    /** Eventos posteriores a `since` (ISO 8601), en orden cronológico; como mucho una página. */
    events: async (since: string | undefined, signal?: AbortSignal) => {
      const query = since === undefined ? "" : `?since=${encodeURIComponent(since)}`;
      return (await get<{ events: EventRow[] }>(`/api/events${query}`, signal)).events;
    },

    reset: () => post<ResetSummary>("/api/demo/reset"),
    setBot: (on: boolean) => post<{ bot: boolean }>("/api/demo/bot", { state: on ? "on" : "off" }),
    fastForward: () => post<FastForwardResult>("/api/demo/fast-forward"),
    realProfiles: (signal?: AbortSignal) => get<RealProfilesToday>("/api/demo/real-profiles", signal),
  };
}

export type TeamApi = ReturnType<typeof createTeamApi>;
