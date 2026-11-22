// API conectada a la base y al entorno reales.
import "server-only";

import { createElevenLabs, DYNAMIC_TTS_MODEL } from "../adapters/elevenlabs";
import { createElevenLabsAdmin } from "../adapters/elevenlabs-admin";
import { app } from "../app";
import { requireEnv, serverEnv } from "../config/env";
import { createApi } from "./api";
import type { Runtime, Services } from "./endpoint";
import { createRateLimiter } from "./rate-limit";

const limiter = createRateLimiter();

const elevenLabs = () => createElevenLabs({ apiKey: requireEnv("ELEVENLABS_API_KEY") });

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
  voiceSetup: () => {
    const env = serverEnv();
    return {
      admin: createElevenLabsAdmin({ apiKey: requireEnv("ELEVENLABS_API_KEY") }),
      appUrl: requireEnv("NEXT_PUBLIC_APP_URL"),
      voiceId: requireEnv("EL_VOICE_ID"),
      toolSecret: requireEnv("TOOL_SECRET"),
      agentIds: { worker: env.EL_AGENT_WORKER_ID, contractor: env.EL_AGENT_CONTRACTOR_ID },
    };
  },
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

    secureCookies: env.NEXT_PUBLIC_APP_URL
      ? env.NEXT_PUBLIC_APP_URL.startsWith("https://")
      : env.NODE_ENV === "production",
  };
}

export const api = createApi(liveRuntime);
