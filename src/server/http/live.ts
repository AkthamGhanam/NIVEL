import "server-only";

import { createElevenLabs } from "../adapters/elevenlabs";
import { app } from "../app";
import { requireEnv, serverEnv } from "../config/env";
import { createApi } from "./api";
import type { Runtime, Services } from "./endpoint";
import { createRateLimiter } from "./rate-limit";

/**
 * API conectada a la base y al entorno reales. Se resuelve por petición:
 * si falta configuración, la ruta responde 503 en vez de tumbar el arranque.
 */
const limiter = createRateLimiter();

/** Las variables de ElevenLabs se exigen al usarlas: sin ellas, solo la voz responde 503. */
const services: Services = {
  conversationToken: async (agent) =>
    createElevenLabs({ apiKey: requireEnv("ELEVENLABS_API_KEY") }).conversationToken(
      requireEnv(agent === "worker" ? "EL_AGENT_WORKER_ID" : "EL_AGENT_CONTRACTOR_ID"),
    ),
};

async function liveRuntime(): Promise<Runtime> {
  const { context } = await app();
  const env = serverEnv();
  return {
    context,
    sessionSecret: requireEnv("SESSION_SECRET", env),
    demoKey: env.DEMO_RESET_KEY,
    toolSecret: env.TOOL_SECRET,
    limiter,
    services,
    // En local (http://localhost) el navegador no guardaría una cookie Secure.
    secureCookies: env.NEXT_PUBLIC_APP_URL
      ? env.NEXT_PUBLIC_APP_URL.startsWith("https://")
      : env.NODE_ENV === "production",
  };
}

export const api = createApi(liveRuntime);
