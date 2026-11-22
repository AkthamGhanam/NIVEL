import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "../db/client";
import { workers } from "../db/schema";

/** ¿Sigue existiendo la cuenta? Una cookie firmada no sobrevive a la cuenta que la originó. */
export async function workerIsActive(db: Database, workerId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: workers.id })
    .from(workers)
    .where(and(eq(workers.id, workerId), isNull(workers.deletedAt)))
    .limit(1);
  return row !== undefined;
}
