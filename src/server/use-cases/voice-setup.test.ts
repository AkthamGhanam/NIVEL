// Pruebas de voice-setup.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ElevenLabsAdmin } from "../adapters/elevenlabs-admin";
import { AGENTS } from "../agents/definitions";
import { workers } from "../db/schema";
import { createTestApp, type TestApp } from "../testing/test-app";
import { logEvent } from "./events";
import { checkVoice, publishAgents, TOOL_SECRET_NAME, type VoiceSetup } from "./voice-setup";

let app: TestApp;

const unused = async (): Promise<never> => {
  throw new Error("no se usa en esta prueba");
};

function fakeAdmin(chat: ElevenLabsAdmin["chat"]): { admin: ElevenLabsAdmin; calls: string[] } {
  const calls: string[] = [];
  const admin: ElevenLabsAdmin = {
    upsertSecret: async (name) => {
      calls.push(`secreto:${name}`);
      return { id: "sec-1", created: false };
    },
    upsertTool: async (payload) => {
      const config = payload.tool_config as { name: string; api_schema: { url: string } };
      calls.push(`herramienta:${config.api_schema.url}`);
      return { id: `tool-${config.name}`, created: false };
    },
    upsertAgent: async (payload) => {
      calls.push(`agente:${String(payload.name)}`);
      return { id: `agent-${calls.filter((call) => call.startsWith("agente:")).length}`, created: false };
    },
    designVoice: unused,
    saveVoice: unused,
    findVoice: unused,
    speak: unused,
    soundEffect: unused,
    chat,
  };
  return { admin, calls };
}

const setupWith = (admin: ElevenLabsAdmin, agentIds: VoiceSetup["agentIds"]): VoiceSetup => ({
  admin,
  appUrl: "https://nivel.example",
  voiceId: "voz",
  toolSecret: "s".repeat(32),
  agentIds,
});

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(() => app.close());

describe("publicar los agentes", () => {
  it("publica el secreto, cada herramienta con la URL del servidor y los dos agentes", async () => {
    const { admin, calls } = fakeAdmin(unused);
    const toolCount = AGENTS.reduce((total, agent) => total + agent.tools.length, 0);

    const result = await publishAgents(setupWith(admin, { worker: "agent-1", contractor: "agent-2" }));

    expect(calls[0]).toBe(`secreto:${TOOL_SECRET_NAME}`);
    expect(
      calls.filter((call) => call.startsWith("herramienta:https://nivel.example/api/tools/")),
    ).toHaveLength(toolCount);
    expect(result).toMatchObject({
      tools: toolCount,
      idsMatchEnv: true,
      agents: { worker: "agent-1", contractor: "agent-2" },
    });
  });

  it("avisa cuando los identificadores no coinciden con los configurados", async () => {
    const { admin } = fakeAdmin(unused);

    const result = await publishAgents(setupWith(admin, { worker: "otro", contractor: undefined }));

    expect(result.idsMatchEnv).toBe(false);
  });
});

describe("probar la voz", () => {
  const ids = { worker: "agent-1", contractor: "agent-2" };

  it("todo bien: Nivi llamó a la herramienta, el perfil existió y se borró", async () => {
    const { admin } = fakeAdmin(async () => {
      await logEvent(app.context, {
        actor: "Nivi",
        type: "herramienta_guardar_perfil",
        label: "x",
        product: "agents",
      });
      await app.context.db.insert(workers).values({
        id: "w-prueba",
        name: "Prueba Técnica",
        trade: "soldador",
        skills: [],
        zone: "Guacara",
        lat: 10,
        lng: -67,
        availability: "lunes",
        createdVia: "voz",
        conversationId: "conv_prueba123",
        createdAt: app.context.now().toISOString(),
      });
      return { conversationId: "conv_prueba123", said: ["Listo."] };
    });

    const check = await checkVoice(app.context, setupWith(admin, ids), "contexto");

    expect(check.ok).toBe(true);
    expect(check.steps.map((step) => step.ok)).toEqual([true, true, true]);
    expect(await app.context.db.$count(workers)).toBe(40);
  });

  it("si la herramienta no llega, lo dice y sugiere reconectar", async () => {
    const { admin } = fakeAdmin(async () => ({ conversationId: "conv_nada12345", said: [] }));
    app.setNow(new Date(app.context.now().getTime() + 60_000));

    const check = await checkVoice(app.context, setupWith(admin, ids), "contexto");

    expect(check.ok).toBe(false);
    expect(check.steps[1]).toMatchObject({ ok: false });
    expect(check.steps[1]?.detail).toContain("Reconectar a Nivi");
  });

  it("si ElevenLabs rechaza la conversación o falta el agente, se detiene en el primer paso", async () => {
    const { admin } = fakeAdmin(async () => {
      throw new Error("ElevenLabs 401: sin permiso");
    });

    const failed = await checkVoice(app.context, setupWith(admin, ids), "contexto");
    const missing = await checkVoice(
      app.context,
      setupWith(admin, { worker: undefined, contractor: undefined }),
      "c",
    );

    expect(failed.steps).toEqual([
      { name: "Conversación con Nivi", ok: false, detail: "ElevenLabs 401: sin permiso" },
    ]);
    expect(missing.steps[0]?.detail).toContain("EL_AGENT_WORKER_ID");
  });
});
