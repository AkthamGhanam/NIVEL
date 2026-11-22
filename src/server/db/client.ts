import { type Client, createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import { addColumnSql, columnNames, createTableSql, tableName } from "./ddl";
import { schema } from "./schema";

export type Database = LibSQLDatabase<typeof schema>;

export interface DatabaseHandle {
  readonly db: Database;
  readonly client: Client;
}

export interface DatabaseConfig {
  readonly url: string;
  readonly authToken?: string | undefined;
}

/** Índices para las consultas calientes del camino dorado (sin N+1 ni escaneos completos). */
const INDEXES: readonly string[] = [
  `CREATE INDEX IF NOT EXISTS "idx_workers_trade_level" ON "workers" ("trade", "level")`,
  `CREATE INDEX IF NOT EXISTS "idx_workers_conversation" ON "workers" ("conversation_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_invitations_worker" ON "invitations" ("worker_id", "status")`,
  `CREATE INDEX IF NOT EXISTS "idx_invitations_request" ON "invitations" ("request_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_contracts_worker" ON "contracts" ("worker_id", "status")`,
  `CREATE INDEX IF NOT EXISTS "idx_contracts_request" ON "contracts" ("request_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_attendance_contract" ON "attendance" ("contract_id", "date")`,
  `CREATE INDEX IF NOT EXISTS "idx_payments_contract" ON "payments" ("contract_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_ratings_contract" ON "ratings" ("contract_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_events_ts" ON "events" ("ts")`,
  `CREATE INDEX IF NOT EXISTS "idx_reports_status" ON "reports" ("status", "created_at")`,
  // Un comprobante por empresa, mes e institución, aunque lleguen dos toques a la vez.
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_contributions" ON "contributions" ("company_id", "period", "institution")`,
  // Una inscripción y una constancia por persona y curso, aunque lleguen dos toques a la vez.
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_enrollments_worker_course" ON "enrollments" ("worker_id", "course_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_certificates_worker_course" ON "certificates" ("worker_id", "course_id")`,
];

export function openDatabase(config: DatabaseConfig): DatabaseHandle {
  const client = createClient(
    config.authToken ? { url: config.url, authToken: config.authToken } : { url: config.url },
  );
  return { db: drizzle(client, { schema }), client };
}

/** Columnas que el esquema define y la tabla real todavía no tiene. */
async function missingColumnStatements(client: Client): Promise<string[]> {
  const statements: string[] = [];
  for (const table of Object.values(schema)) {
    // El nombre sale del esquema del código, nunca de datos de usuarios.
    const info = await client.execute(`PRAGMA table_info("${tableName(table)}")`);
    const existing = new Set(info.rows.map((row) => String(row.name)));
    for (const name of columnNames(table)) {
      if (!existing.has(name)) statements.push(addColumnSql(table, name));
    }
  }
  return statements;
}

/**
 * Crea tablas e índices si no existen y agrega las columnas nuevas del
 * esquema a las tablas que ya existían, sin tocar sus datos. Idempotente.
 */
export async function migrate({ client }: DatabaseHandle): Promise<void> {
  const tables = Object.values(schema).map(createTableSql);
  await client.batch(["PRAGMA foreign_keys = ON", ...tables], "write");
  const additions = await missingColumnStatements(client);
  await client.batch([...additions, ...INDEXES], "write");
}
