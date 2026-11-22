// Lo que la administración le pide al servidor.
import type { ResetSummary } from "@/server/db/reset";
import type { EventRow } from "@/server/use-cases/events";
import type { Metrics, RealProfilesToday } from "@/server/use-cases/metrics";
import type { DemoState } from "@/server/use-cases/personas";
import type { ReportResolution, ReportRow } from "@/server/use-cases/reports";
import type { PublishResult, VoiceCheck } from "@/server/use-cases/voice-setup";

import type { ApiRequest } from "./api";

export type {
  DemoState,
  EventRow,
  Metrics,
  PublishResult,
  RealProfilesToday,
  ReportRow,
  ResetSummary,
  VoiceCheck,
};
export type ReportOutcome = ReportResolution["outcome"];

export interface FastForwardResult {
  readonly requestId: string;
  readonly daysAdded: number;
}

const SLOW_MS = 60_000;
const AS_TEAM = { as: "admin" } as const;
const segment = (id: string) => encodeURIComponent(id);

export function createTeamApi(request: ApiRequest) {
  const get = <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, signal ? { ...AS_TEAM, signal } : AS_TEAM);
  const post = <T>(path: string, body?: unknown) => request<T>(path, { ...AS_TEAM, method: "POST", body });

  return {
    state: (signal?: AbortSignal) => get<DemoState>("/api/state", signal),

    enter: (key: string) => post<DemoState>("/api/state", { role: "admin", key }),

    events: async (since: string | undefined, signal?: AbortSignal) => {
      const query = since === undefined ? "" : `?since=${encodeURIComponent(since)}`;
      return (await get<{ events: EventRow[] }>(`/api/events${query}`, signal)).events;
    },

    reset: (all = false) => post<ResetSummary>(all ? "/api/demo/reset?all=1" : "/api/demo/reset"),
    setBot: (on: boolean) => post<{ bot: boolean }>("/api/demo/bot", { state: on ? "on" : "off" }),
    fastForward: () => post<FastForwardResult>("/api/demo/fast-forward"),
    realProfiles: (signal?: AbortSignal) => get<RealProfilesToday>("/api/demo/real-profiles", signal),

    publishVoice: () =>
      request<PublishResult>("/api/demo/voice/publish", { ...AS_TEAM, method: "POST", timeoutMs: SLOW_MS }),
    checkVoice: () =>
      request<VoiceCheck>("/api/demo/voice/check", { ...AS_TEAM, method: "POST", timeoutMs: SLOW_MS }),

    /** Registra en Telegram a dónde manda los mensajes el bot. Una vez por despliegue. */
    connectTelegram: () => post<{ bot: string; webhook: string }>("/api/telegram/setup"),

    metrics: (signal?: AbortSignal) => get<Metrics>("/api/metrics", signal),

    reports: async (signal?: AbortSignal) =>
      (await get<{ reports: ReportRow[] }>("/api/reports", signal)).reports,
    resolveReport: (reportId: string, resolution: { outcome: ReportOutcome; note: string }) =>
      post<ReportRow>(`/api/reports/${segment(reportId)}/resolve`, resolution),
  };
}

export type TeamApi = ReturnType<typeof createTeamApi>;
