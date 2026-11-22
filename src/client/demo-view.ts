import { formatTime } from "@/lib/format";

import type { EventRow } from "./team-api";

/**
 * Cómo se lee el Modo Jurado: la bitácora en palabras y el contador de la
 * cuadrilla. Funciones puras, sin React ni reloj propio.
 */

const PRODUCT_LABELS: Readonly<Record<EventRow["product"], string | null>> = {
  agents: "ElevenAgents",
  tts: "Texto a voz",
  stt: "Scribe v2",
  sfx: "Efectos de sonido",
  app: null,
};

const DECIMAL = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "820 ms" o "1,2 s": la latencia que se le muestra al jurado. */
export function formatLatency(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${DECIMAL.format(ms / 1000)} s`;
}

export interface EventLine {
  readonly id: string;
  readonly time: string;
  readonly actor: string;
  readonly label: string;
  /** "ElevenAgents · 820 ms". Nulo cuando el evento es de la propia app y no midió latencia. */
  readonly badge: string | null;
}

/** "Carlos R. aceptó la invitación" junto al nombre en negrita queda "aceptó la invitación": no se repite. */
const withoutActor = (label: string, actor: string) =>
  label.startsWith(`${actor} `) ? label.slice(actor.length + 1) : label;

export function eventLine(event: EventRow): EventLine {
  const parts = [
    PRODUCT_LABELS[event.product],
    event.latencyMs === null ? null : formatLatency(event.latencyMs),
  ].filter((part): part is string => part !== null);
  return {
    id: event.id,
    time: formatTime(event.ts),
    actor: event.actor,
    label: withoutActor(event.label, event.actor),
    badge: parts.length > 0 ? parts.join(" · ") : null,
  };
}

/** La bitácora con lo más reciente arriba: lo nuevo se ve sin desplazar la lista. */
export const eventLines = (events: readonly EventRow[]): EventLine[] => events.map(eventLine).reverse();

/** 47 segundos son "00:47"; 125 son "02:05". */
export function formatClock(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(totalSeconds));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(whole / 60))}:${pad(whole % 60)}`;
}

export type CrewTimer =
  | { readonly state: "idle" }
  | { readonly state: "running"; readonly since: string }
  | { readonly state: "done"; readonly seconds: number };

const requestIdOf = (event: EventRow) => event.detail?.requestId;

/**
 * Estado del contador según la bitácora: corre desde la última solicitud
 * creada y se detiene cuando el servidor registra su cuadrilla completa.
 */
export function crewTimer(events: readonly EventRow[]): CrewTimer {
  const created = events.findLast((event) => event.type === "solicitud_creada");
  if (!created) return { state: "idle" };
  const complete = events.find(
    (event) => event.type === "cuadrilla_completa" && requestIdOf(event) === requestIdOf(created),
  );
  const seconds = Number(complete?.detail?.seconds);
  if (complete && Number.isFinite(seconds)) return { state: "done", seconds };
  return { state: "running", since: created.ts };
}

/** Texto del contador. `now` lo pone quien llama, para poder probar con una hora exacta. */
export function crewTimerLabel(timer: CrewTimer, now: Date): string {
  if (timer.state === "idle") return "Aún no hay una solicitud";
  if (timer.state === "done") return `Cuadrilla armada en ${formatClock(timer.seconds)}`;
  const elapsed = (now.getTime() - new Date(timer.since).getTime()) / 1000;
  return `Armando la cuadrilla · ${formatClock(elapsed)}`;
}
