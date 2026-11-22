import { and, desc, eq, ne } from "drizzle-orm";

import { type Actor, requireRole } from "../actor";
import type { AppContext } from "../context";
import { resetDemo, type ResetSummary } from "../db/reset";
import { contracts, jobRequests } from "../db/schema";
import { ConflictError } from "../errors";
import { fastForwardAttendance } from "./attendance";
import { setDemoValue } from "./demo-state";
import { logEvent } from "./events";

/**
 * Controles del Modo Jurado. Solo el equipo (rol admin) puede usarlos.
 */

/** Devuelve la demo al seed. Conserva los perfiles reales salvo que se pida borrar todo. */
export async function resetDemoData(
  context: AppContext,
  actor: Actor,
  options: { readonly keepRealWorkers: boolean },
): Promise<ResetSummary> {
  requireRole(actor, "admin");
  const summary = await resetDemo(
    { db: context.db },
    { now: context.now(), keepRealWorkers: options.keepRealWorkers },
  );
  await logEvent(context, {
    actor: "Modo Jurado",
    type: "demo_reiniciada",
    label: "Demo reiniciada al estado inicial",
    detail: { keptRealWorkers: summary.keptRealWorkers },
  });
  return summary;
}

/** Solicitud de la demo (no del seed) más reciente que tiene contratos activos. */
async function latestActiveRequestId(context: AppContext): Promise<string | undefined> {
  const [row] = await context.db
    .select({ requestId: contracts.requestId })
    .from(contracts)
    .innerJoin(jobRequests, eq(contracts.requestId, jobRequests.id))
    .where(and(eq(contracts.status, "activo"), ne(jobRequests.createdVia, "seed")))
    .orderBy(desc(jobRequests.createdAt))
    .limit(1);
  return row?.requestId;
}

/** "Avanzar a fin de obra": completa la asistencia de la obra activa (o de la solicitud indicada). */
export async function fastForwardActiveRequest(
  context: AppContext,
  actor: Actor,
  requestId?: string,
): Promise<{ readonly requestId: string; readonly daysAdded: number }> {
  requireRole(actor, "admin");
  const target = requestId ?? (await latestActiveRequestId(context));
  if (!target) throw new ConflictError("No hay una obra activa con contratos firmados.");
  return { requestId: target, daysAdded: await fastForwardAttendance(context, actor, target) };
}

/** Enciende o apaga el bot que responde por los personajes fuera del escenario. */
export async function setDemoBot(
  context: AppContext,
  actor: Actor,
  on: boolean,
): Promise<{ readonly bot: boolean }> {
  requireRole(actor, "admin");
  await setDemoValue(context, "bot", on ? "on" : "off");
  await logEvent(context, {
    actor: "Modo Jurado",
    type: "bot_demo",
    label: on ? "Bot de demo encendido" : "Bot de demo apagado",
  });
  return { bot: on };
}
