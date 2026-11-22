import { asc, gt } from "drizzle-orm";

import type { AppContext } from "../context";
import { events } from "../db/schema";

export type EventProduct = "agents" | "tts" | "stt" | "sfx" | "app";

export interface NewEvent {
  readonly actor: string;
  readonly type: string;
  readonly label: string;
  /** Solo ids y números: nunca transcripciones, teléfonos ni otros datos personales. */
  readonly detail?: Readonly<Record<string, string | number | boolean | null>>;
  readonly latencyMs?: number;
  readonly product?: EventProduct;
}

const MAX_EVENTS_PER_PAGE = 100;

/** Registra un hecho en la bitácora en vivo del Modo Jurado. */
export async function logEvent(context: AppContext, event: NewEvent): Promise<void> {
  await context.db.insert(events).values({
    id: context.newId("ev"),
    ts: context.now().toISOString(),
    actor: event.actor,
    type: event.type,
    label: event.label,
    detail: event.detail ? { ...event.detail } : null,
    latencyMs: event.latencyMs === undefined ? null : Math.round(event.latencyMs),
    product: event.product ?? "app",
  });
}

export type EventRow = typeof events.$inferSelect;

/** Eventos posteriores a `since` (ISO 8601), en orden cronológico y paginados. */
export function listEventsSince(context: AppContext, since: string | undefined): Promise<EventRow[]> {
  const query = context.db.select().from(events);
  const filtered = since ? query.where(gt(events.ts, since)) : query;
  return filtered.orderBy(asc(events.ts), asc(events.id)).limit(MAX_EVENTS_PER_PAGE);
}
