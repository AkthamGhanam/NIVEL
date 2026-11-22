import { type Client, createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import { createTableSql } from "./ddl";
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
];

export function openDatabase(config: DatabaseConfig): DatabaseHandle {
  const client = createClient(
    config.authToken ? { url: config.url, authToken: config.authToken } : { url: config.url },
  );
  return { db: drizzle(client, { schema }), client };
}

/** Crea tablas e índices si no existen. Idempotente. */
export async function migrate({ client }: DatabaseHandle): Promise<void> {
  const statements = ["PRAGMA foreign_keys = ON", ...Object.values(schema).map(createTableSql), ...INDEXES];
  await client.batch(statements, "write");
}
