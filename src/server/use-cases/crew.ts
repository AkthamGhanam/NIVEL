import { and, count, eq, inArray, isNotNull } from "drizzle-orm";

import type { Level } from "@/lib/level";
import { shortName } from "@/lib/matching";

import type { AppContext } from "../context";
import { attendance, contracts, payments, ratings, workers } from "../db/schema";

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
      .select({ contractId: attendance.contractId, total: count() })
      .from(attendance)
      .where(and(inArray(attendance.contractId, contractIds), isNotNull(attendance.checkInAt)))
      .groupBy(attendance.contractId),
    context.db
      .select({ contractId: ratings.contractId })
      .from(ratings)
      .where(and(inArray(ratings.contractId, contractIds), eq(ratings.fromRole, "empresa"))),
  ]);
  const daysAttended = new Map(attended.map((row) => [row.contractId, row.total]));
  const ratedContracts = new Set(rated.map((row) => row.contractId));
  return rows.map(({ contract, worker, payment }) => ({
    contractId: contract.id,
    workerId: contract.workerId,
    shortName: shortName(worker.name),
    level: worker.level as Level,
    status: contract.status,
    signedWorkerAt: contract.signedWorkerAt,
    days: contract.days,
    daysAttended: daysAttended.get(contract.id) ?? 0,
    payment: payment && {
      id: payment.id,
      receiptNumber: payment.receiptNumber,
      confirmedByWorkerAt: payment.confirmedByWorkerAt,
    },
    ratedByCompany: ratedContracts.has(contract.id),
  }));
}
