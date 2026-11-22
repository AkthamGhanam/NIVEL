/**
 * Crea las tablas y carga el seed canónico en la base configurada.
 * Uso: npm run db:seed            (conserva los perfiles reales)
 *      npm run db:seed -- --all   (borra también los perfiles reales)
 */
import { migrate, openDatabase } from "../src/server/db/client";
import { resetDemo } from "../src/server/db/reset";

const DEFAULT_LOCAL_URL = "file:local.db";

async function main(): Promise<void> {
  const url = process.env.TURSO_DATABASE_URL || DEFAULT_LOCAL_URL;
  const handle = openDatabase({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
  try {
    await migrate(handle);
    const startedAt = performance.now();
    const summary = await resetDemo(handle, {
      now: new Date(),
      keepRealWorkers: !process.argv.includes("--all"),
    });
    const elapsedMs = Math.round(performance.now() - startedAt);
    // El host de la base es útil para saber dónde se escribió; el token nunca se imprime.
    console.warn(
      `Seed listo en ${elapsedMs} ms: ${summary.insertedRows} filas, ` +
        `${summary.keptRealWorkers} perfiles reales conservados (${new URL(url).protocol}//…)`,
    );
  } finally {
    handle.client.close();
  }
}

main().catch((error: unknown) => {
  console.error("No se pudo cargar el seed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
