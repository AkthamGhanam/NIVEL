import { connection } from "next/server";

/** Verificación de vida para Vercel y el preflight. No expone versión ni configuración. */
export async function GET(): Promise<Response> {
  await connection();
  return Response.json({ status: "ok" });
}
