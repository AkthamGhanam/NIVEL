import { and, count, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "../db/client";
import { contracts, payments } from "../db/schema";

/**
 * "Paga a tiempo": métrica objetiva de la empresa, calculada con pagos
 * registrados. No usa calificaciones ni opiniones (regla legal 8.3).
 */

/** Con menos contrataciones terminadas el porcentaje no dice nada, y no se muestra. */
export const MIN_HIRES_FOR_PAYMENT_RATE = 5;
/** Días de gracia tras el último día de obra para registrar el pago. */
export const PAYMENT_GRACE_DAYS = 3;

/** Porcentaje (0 a 100) de trabajos terminados que la empresa pagó a tiempo, o nulo si aún no hay datos. */
export async function paysOnTimeByCompany(
  db: Database,
  companyIds: readonly string[],
): Promise<ReadonlyMap<string, number | null>> {
  const ids = [...new Set(companyIds)];
  if (ids.length === 0) return new Map();
  const deadline = sql`date(${contracts.startDate}, '+' || (${contracts.days} + ${PAYMENT_GRACE_DAYS - 1}) || ' days')`;
  const rows = await db
    .select({
      companyId: contracts.companyId,
      finished: count(),
      onTime: sql<number>`sum(case when substr(${payments.registeredAt}, 1, 10) <= ${deadline} then 1 else 0 end)`,
    })
    .from(contracts)
    .leftJoin(payments, eq(payments.contractId, contracts.id))
    .where(and(inArray(contracts.companyId, ids), eq(contracts.status, "completado")))
    .groupBy(contracts.companyId);
  const rates = new Map<string, number | null>(ids.map((id) => [id, null]));
  for (const row of rows) {
    if (row.finished < MIN_HIRES_FOR_PAYMENT_RATE) continue;
    rates.set(row.companyId, Math.round((Number(row.onTime) / row.finished) * 100));
  }
  return rates;
}
