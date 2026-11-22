import "server-only";

import { app } from "../app";
import { requireEnv, serverEnv } from "../config/env";
import { createApi } from "./api";
import type { Runtime } from "./endpoint";

/**
 * API conectada a la base y al entorno reales. Se resuelve por petición:
 * si falta configuración, la ruta responde 503 en vez de tumbar el arranque.
 */
async function liveRuntime(): Promise<Runtime> {
  const { context } = await app();
  const env = serverEnv();
  return {
    context,
    sessionSecret: requireEnv("SESSION_SECRET", env),
    demoKey: env.DEMO_RESET_KEY,
    // En local (http://localhost) el navegador no guardaría una cookie Secure.
    secureCookies: env.NEXT_PUBLIC_APP_URL
      ? env.NEXT_PUBLIC_APP_URL.startsWith("https://")
      : env.NODE_ENV === "production",
  };
}

export const api = createApi(liveRuntime);
