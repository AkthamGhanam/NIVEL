import type { Database } from "./client";

/**
 * Transacción de escritura que tolera la concurrencia. SQLite admite un solo
 * escritor a la vez: si dos personas tocan "aceptar" en el mismo instante, la
 * segunda recibe SQLITE_BUSY. Aquí la transacción toma el candado al empezar
 * (`BEGIN IMMEDIATE`) y, si está ocupado, espera un momento y reintenta.
 * Como una transacción fallida se revierte entera, reintentar es seguro.
 */

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const MAX_RETRIES = 6;
const BASE_DELAY_MS = 15;
const MAX_CAUSE_DEPTH = 5;

/** ¿El error (o su causa) es la base de datos ocupada por otro escritor? */
export function isBusyError(error: unknown, depth = 0): boolean {
  if (typeof error !== "object" || error === null || depth > MAX_CAUSE_DEPTH) return false;
  const { code, cause } = error as { code?: unknown; cause?: unknown };
  if (typeof code === "string" && code.startsWith("SQLITE_BUSY")) return true;
  return isBusyError(cause, depth + 1);
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function writeTransaction<T>(db: Database, work: (tx: Transaction) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await db.transaction(work, { behavior: "immediate" });
    } catch (error) {
      if (attempt >= MAX_RETRIES || !isBusyError(error)) throw error;
      // Espera creciente con algo de azar para que dos reintentos no vuelvan a chocar.
      await wait(BASE_DELAY_MS * 2 ** attempt * (0.5 + Math.random()));
    }
  }
}
