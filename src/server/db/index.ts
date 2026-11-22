import "server-only";

import { requireEnv, serverEnv } from "../config/env";
import { type DatabaseHandle, openDatabase } from "./client";

let cached: DatabaseHandle | undefined;

/** Conexión única por proceso, configurada desde el entorno. */
export function database(): DatabaseHandle {
  cached ??= openDatabase({
    url: requireEnv("TURSO_DATABASE_URL"),
    authToken: serverEnv().TURSO_AUTH_TOKEN,
  });
  return cached;
}
