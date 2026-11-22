import { and, asc, eq, inArray } from "drizzle-orm";

import type { Level } from "@/lib/level";
import { shortName } from "@/lib/matching";

import type { AppContext } from "../context";
import { attendance, contracts, payments, ratings, workers } from "../db/schema";

export interface AttendanceDay {
  readonly date: string;
  readonly checkInAt: string | null;
  readonly checkOutAt: string | null;
  readonly insideGeofence: boolean;
  readonly note: string | null;
}

/** Una persona ya contratada en la solicitud, como la ve la empresa en su tablero. */
export interface CrewMember {
  readonly contractId: string;
  readonly workerId: string;
  readonly shortName: string;
  readonly level: Level;
  readonly status: (typeof contracts.$inferSelect)["status"];
  readonly signedWorkerAt: string | null;
  readonly days: number;
  readonly daysAttended: number;
  /** Última jornada registrada: horas reales de entrada y salida, y el motivo si la persona dejó uno. */
  readonly lastAttendance: AttendanceDay | null;
  /** Todas las jornadas con entrada registrada, de la más antigua a la más reciente. */
  readonly attendance: readonly AttendanceDay[];
  readonly payment: {
    readonly id: string;
    readonly receiptNumber: string;
    readonly confirmedByWorkerAt: string | null;
  } | null;
  /** La empresa ya envió su calificación privada de este trabajo. */
  readonly ratedByCompany: boolean;
}

/** Cuadrilla de una solicitud en tres consultas, sin importar su tamaño. */
export async function loadCrew(context: AppContext, requestId: string): Promise<CrewMember[]> {
  const rows = await context.db
    .select({ contract: contracts, worker: { name: workers.name, level: workers.level }, payment: payments })
    .from(contracts)
    .innerJoin(workers, eq(contracts.workerId, workers.id))
    .leftJoin(payments, eq(payments.contractId, contracts.id))
    .where(eq(contracts.requestId, requestId))
    .orderBy(contracts.id);
  if (rows.length === 0) return [];
  const contractIds = rows.map((row) => row.contract.id);
  const [attended, rated] = await Promise.all([
    context.db
      .select()
      .from(attendance)
      .where(inArray(attendance.contractId, contractIds))
      .orderBy(asc(attendance.date)),
    context.db
      .select({ contractId: ratings.contractId })
      .from(ratings)
      .where(and(inArray(ratings.contractId, contractIds), eq(ratings.fromRole, "empresa"))),
  ]);
  const daysByContract = new Map<string, AttendanceDay[]>();
  for (const { contractId, date, checkInAt, checkOutAt, insideGeofence, note } of attended) {
    if (checkInAt === null) continue;
    const days = daysByContract.get(contractId) ?? [];
    days.push({ date, checkInAt, checkOutAt, insideGeofence, note });
    daysByContract.set(contractId, days);
  }
  const ratedContracts = new Set(rated.map((row) => row.contractId));
  return rows.map(({ contract, worker, payment }) => ({
    contractId: contract.id,
    workerId: contract.workerId,
    shortName: shortName(worker.name),
    level: worker.level as Level,
    status: contract.status,
    signedWorkerAt: contract.signedWorkerAt,
    days: contract.days,
    daysAttended: daysByContract.get(contract.id)?.length ?? 0,
    lastAttendance: daysByContract.get(contract.id)?.at(-1) ?? null,
    attendance: daysByContract.get(contract.id) ?? [],
    payment: payment && {
      id: payment.id,
      receiptNumber: payment.receiptNumber,
      confirmedByWorkerAt: payment.confirmedByWorkerAt,
    },
    ratedByCompany: ratedContracts.has(contract.id),
  }));
}
