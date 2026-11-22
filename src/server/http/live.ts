import "server-only";

import { createElevenLabs, DYNAMIC_TTS_MODEL } from "../adapters/elevenlabs";
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

const elevenLabs = () => createElevenLabs({ apiKey: requireEnv("ELEVENLABS_API_KEY") });

/** Las variables de ElevenLabs se exigen al usarlas: sin ellas, solo la voz responde 503. */
const services: Services = {
  conversationToken: async (agent) =>
    elevenLabs().conversationToken(
      requireEnv(agent === "worker" ? "EL_AGENT_WORKER_ID" : "EL_AGENT_CONTRACTOR_ID"),
    ),
  speaker: () => {
    const client = elevenLabs();
    const voiceId = requireEnv("EL_VOICE_ID");
    return {
      voice: `${voiceId}/${DYNAMIC_TTS_MODEL}`,
      speak: (text) => client.speak({ text, voiceId, modelId: DYNAMIC_TTS_MODEL }),
    };
  },
  transcribe: (audio) => elevenLabs().transcribe(audio),
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
