// Reset de la demo: deja la base exactamente como el seed, en una sola transacción (todo o nada).
import { eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

import type { Database } from "./client";
import { schema } from "./schema";
import { buildSeed, type SeedRows } from "./seed/build";

export interface ResetOptions {
  readonly now: Date;

  readonly keepRealWorkers: boolean;
}

export interface ResetSummary {
  readonly insertedRows: number;
  readonly keptRealWorkers: number;
}

const INSERT_ORDER = [
  "companies",
  "academies",
  "workers",
  "courses",
  "lessons",
  "enrollments",
  "practicalTests",
  "certificates",
  "jobRequests",
  "invitations",
  "contracts",
  "attendance",
  "payments",
  "ratings",
  "incidents",
  "reports",
  "fees",
  "contributions",
  "events",
  "demoState",
] as const satisfies ReadonlyArray<keyof typeof schema>;

const ROWS_PER_INSERT = 50;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) chunks.push(items.slice(start, start + size));
  return chunks;
}

type Statement = BatchItem<"sqlite">;

function deleteStatements(db: Database, keepRealWorkers: boolean): Statement[] {
  return [...INSERT_ORDER].reverse().map((key) => {
    if (key === "workers" && keepRealWorkers)
      return db.delete(schema.workers).where(eq(schema.workers.isReal, false));

    if (key === "companies" && keepRealWorkers)
      return db.delete(schema.companies).where(eq(schema.companies.isReal, false));
    return db.delete(schema[key] as SQLiteTable);
  });
}

function insertStatements(db: Database, rows: SeedRows): Statement[] {
  return INSERT_ORDER.flatMap((key) =>
    chunk(rows[key] as Array<Record<string, unknown>>, ROWS_PER_INSERT).map((batch) =>
      db.insert(schema[key] as SQLiteTable).values(batch),
    ),
  );
}

export async function resetDemo(
  { db }: { readonly db: Database },
  options: ResetOptions,
): Promise<ResetSummary> {
  const rows = buildSeed(options.now);
  const statements = [...deleteStatements(db, options.keepRealWorkers), ...insertStatements(db, rows)];
  const [first, ...rest] = statements;
  if (!first) throw new Error("El seed no puede estar vacío");
  await db.batch([first, ...rest]);
  const keptRealWorkers = options.keepRealWorkers
    ? await db.$count(schema.workers, eq(schema.workers.isReal, true))
    : 0;
  const insertedRows = Object.values(rows).reduce((total, tableRows) => total + tableRows.length, 0);
  return { insertedRows, keptRealWorkers };
}
