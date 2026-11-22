import { and, eq, inArray, isNull } from "drizzle-orm";

import { addDays, type IsoDate, localDate } from "@/lib/dates";
import { ensure } from "@/lib/errors";
import { formatDay, formatTime } from "@/lib/format";
import { shortName } from "@/lib/matching";
import { approximateDistance, checkArrival, type GeoFix, type GeoPoint } from "@/lib/geo";

import { type Actor, requireRole } from "../actor";
import type { AppContext } from "../context";
import { attendance, contracts, jobRequests, workers } from "../db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors";
import { isDemoFlagOn } from "./demo-state";
import { logEvent } from "./events";
import { notifyByTelegram } from "./telegram-notify";

/** Radio de la obra dentro del cual se puede marcar entrada o salida (regla legal 8.7). */
export const SITE_GEOFENCE_METERS = 120;

export type AttendanceRow = typeof attendance.$inferSelect;

export interface AttendanceMark {
  readonly contractId: string;
  /** Posición del teléfono al marcar, con su margen de error. No se guarda: solo se compara con la geocerca. */
  readonly position?: GeoFix | undefined;
  /**
   * Control de demo "Simular que estoy en la obra": omite el GPS y, si la obra aún
   * no empieza, usa su primer día. Solo funciona con la simulación activada y deja nota.
   */
  readonly simulated?: boolean | undefined;
}

const SIMULATED_NOTE = "Ubicación y día simulados (demo)";

async function loadActiveContract(context: AppContext, actor: Actor, contractId: string) {
  const { workerId } = requireRole(actor, "worker");
  const [row] = await context.db
    .select({
      contract: contracts,
      site: { lat: jobRequests.lat, lng: jobRequests.lng },
      workerName: workers.name,
    })
    .from(contracts)
    .innerJoin(jobRequests, eq(contracts.requestId, jobRequests.id))
    .innerJoin(workers, eq(contracts.workerId, workers.id))
    .where(eq(contracts.id, contractId));
  if (!row) throw new NotFoundError("el contrato");
  if (row.contract.workerId !== workerId) throw new ForbiddenError();
  if (row.contract.status !== "activo")
    throw new ConflictError("Primero firma el contrato para marcar asistencia.");
  return row;
}

function assertInsideSite(position: GeoFix | undefined, site: GeoPoint): void {
  ensure(position !== undefined, "Necesitamos tu ubicación solo para confirmar que estás en la obra.");
  const { verdict, distanceM } = checkArrival(position, { center: site, radiusMeters: SITE_GEOFENCE_METERS });
  ensure(
    verdict !== "senal_debil",
    "La señal de ubicación está débil. Sal a un lugar abierto, espera unos segundos y vuelve a marcar.",
  );
  ensure(
    verdict === "dentro",
    `Estás a ${approximateDistance(distanceM)} de la obra. Acércate a la entrada para marcar.`,
  );
}

interface WorkDay {
  readonly date: IsoDate;
  readonly simulated: boolean;
}

/** Día de trabajo que corresponde a la marca, tras validar ubicación o simulación. */
async function resolveWorkDay(
  context: AppContext,
  mark: AttendanceMark,
  row: { contract: typeof contracts.$inferSelect; site: GeoPoint },
): Promise<WorkDay> {
  const today = localDate(context.now());
  const firstDay = row.contract.startDate as IsoDate;
  const lastDay = addDays(firstDay, row.contract.days - 1);
  if (mark.simulated) {
    if (!(await isDemoFlagOn(context, "simulation")))
      throw new ForbiddenError("La simulación está desactivada.");
    return { date: today >= firstDay && today <= lastDay ? today : firstDay, simulated: true };
  }
  assertInsideSite(mark.position, row.site);
  if (today < firstDay) throw new ConflictError(`La obra empieza el ${formatDay(firstDay)}.`);
  if (today > lastDay) throw new ConflictError("La obra ya terminó.");
  return { date: today, simulated: false };
}

function todayRow(context: AppContext, contractId: string, date: IsoDate) {
  return context.db
    .select()
    .from(attendance)
    .where(and(eq(attendance.contractId, contractId), eq(attendance.date, date)));
}

/** "Llegué a la obra": registra la entrada del día si el trabajador está dentro de la geocerca. */
export async function checkIn(
  context: AppContext,
  actor: Actor,
  mark: AttendanceMark,
): Promise<AttendanceRow> {
  const loaded = await loadActiveContract(context, actor, mark.contractId);
  const { contract, workerName } = loaded;
  const { date, simulated } = await resolveWorkDay(context, mark, loaded);
  const now = context.now();
  const [existing] = await todayRow(context, contract.id, date);
  if (existing) return existing; // Doble toque: la primera entrada es la que vale.
  const [row] = await context.db
    .insert(attendance)
    .values({
      id: context.newId("at"),
      contractId: contract.id,
      date,
      checkInAt: now.toISOString(),
      insideGeofence: !simulated,
      note: simulated ? SIMULATED_NOTE : null,
    })
    .returning();
  if (!row) throw new Error("La entrada no se guardó");
  await logEvent(context, {
    actor: workerName,
    type: "entrada_obra",
    label: simulated ? "Entrada a la obra (ubicación simulada)" : "Entrada a la obra dentro de la geocerca",
    detail: { contractId: contract.id },
  });
  await notifyByTelegram(
    context,
    { role: "company", subjectId: contract.companyId },
    {
      text:
        `${shortName(workerName)} llegó a la obra a las ${formatTime(now.toISOString())}. ` +
        (simulated ? "Ubicación simulada (demo)." : "Ubicación verificada en la obra."),
    },
  );
  return row;
}

/** Registra la salida del día. Exige una entrada previa. */
export async function checkOut(
  context: AppContext,
  actor: Actor,
  mark: AttendanceMark,
): Promise<AttendanceRow> {
  const loaded = await loadActiveContract(context, actor, mark.contractId);
  const { contract } = loaded;
  const { date } = await resolveWorkDay(context, mark, loaded);
  const now = context.now();
  const [existing] = await todayRow(context, contract.id, date);
  if (!existing) throw new ConflictError("Primero marca tu entrada de hoy.");
  if (existing.checkOutAt) return existing;
  const [row] = await context.db
    .update(attendance)
    .set({ checkOutAt: now.toISOString() })
    .where(and(eq(attendance.id, existing.id), isNull(attendance.checkOutAt)))
    .returning();
  return row ?? existing;
}

const WORKDAY = Object.freeze({ checkInUtc: "T11:00:00.000Z", checkOutUtc: "T20:00:00.000Z" });

/**
 * Control del Modo Jurado: completa la asistencia de los días que faltan en los
 * contratos activos de una solicitud, para comprimir la semana en un clic.
 * No toca los días que ya tienen registro.
 */
export async function fastForwardAttendance(
  context: AppContext,
  actor: Actor,
  requestId: string,
): Promise<number> {
  requireRole(actor, "admin");
  const active = await context.db
    .select()
    .from(contracts)
    .where(and(eq(contracts.requestId, requestId), eq(contracts.status, "activo")));
  if (active.length === 0) return 0;
  const existing = await context.db
    .select({ contractId: attendance.contractId, date: attendance.date })
    .from(attendance)
    .where(
      inArray(
        attendance.contractId,
        active.map((contract) => contract.id),
      ),
    );
  const recorded = new Set(existing.map((row) => `${row.contractId}:${row.date}`));
  const missing = active.flatMap((contract) =>
    Array.from({ length: contract.days }, (_, day) => addDays(contract.startDate as IsoDate, day))
      .filter((date) => !recorded.has(`${contract.id}:${date}`))
      .map((date) => ({
        id: context.newId("at"),
        contractId: contract.id,
        date,
        checkInAt: `${date}${WORKDAY.checkInUtc}`,
        checkOutAt: `${date}${WORKDAY.checkOutUtc}`,
        insideGeofence: true,
        note: "Registrado con Avanzar a fin de obra (demo)",
      })),
  );
  if (missing.length > 0) await context.db.insert(attendance).values(missing);
  await logEvent(context, {
    actor: "Modo Jurado",
    type: "avanzar_fin_obra",
    label: `Avanzar a fin de obra: ${missing.length} días de asistencia`,
    detail: { requestId, days: missing.length },
  });
  return missing.length;
}
