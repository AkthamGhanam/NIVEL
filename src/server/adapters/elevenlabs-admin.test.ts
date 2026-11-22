import { describe, expect, it, vi } from "vitest";

import { createElevenLabsAdmin } from "./elevenlabs-admin";
import { ElevenLabsRequestError } from "./elevenlabs-http";

/** Simula la API: cada ruta "MÉTODO /ruta" responde lo indicado; registra cada llamada. */
function fakeApi(routes: Record<string, unknown>) {
  const calls: Array<{ method: string; path: string; query: URLSearchParams; body: unknown }> = [];
  const send = vi.fn(async (url: URL, init: RequestInit) => {
    const method = init.method ?? "GET";
    const body = typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : init.body;
    calls.push({ method, path: url.pathname, query: url.searchParams, body });
    const answer = routes[`${method} ${url.pathname}`];
    if (answer instanceof Uint8Array) return new Response(answer as Uint8Array<ArrayBuffer>);
    return answer === undefined ? new Response("{}", { status: 404 }) : new Response(JSON.stringify(answer));
  });
  const admin = createElevenLabsAdmin({ apiKey: "clave", fetch: send as unknown as typeof fetch });
  return { admin, calls };
}

describe("upsertSecret", () => {
  it("crea el secreto si no existe", async () => {
    const { admin, calls } = fakeApi({
      "GET /v1/convai/secrets": { secrets: [{ secret_id: "otro", name: "otro" }] },
      "POST /v1/convai/secrets": { secret_id: "sec_1", name: "nivel" },
    });

    expect(await admin.upsertSecret("nivel", "valor")).toEqual({ id: "sec_1", created: true });
    expect(calls.at(-1)?.body).toEqual({ type: "new", name: "nivel", value: "valor" });
  });

  it("actualiza el valor del secreto que ya existe", async () => {
    const { admin, calls } = fakeApi({
      "GET /v1/convai/secrets": { secrets: [{ secret_id: "sec_1", name: "nivel" }] },
      "PATCH /v1/convai/secrets/sec_1": { secret_id: "sec_1" },
    });

    expect(await admin.upsertSecret("nivel", "nuevo")).toEqual({ id: "sec_1", created: false });
    expect(calls.at(-1)).toMatchObject({ method: "PATCH", body: { type: "update", value: "nuevo" } });
  });
});

describe("upsertTool y upsertAgent", () => {
  const tool = { tool_config: { name: "crear_solicitud" } };
  const agent = { name: "Nivi" };

  it("crean lo que falta", async () => {
    const { admin } = fakeApi({
      "GET /v1/convai/tools": { tools: [] },
      "POST /v1/convai/tools": { id: "tool_1" },
      "GET /v1/convai/agents": { agents: [{ agent_id: "ajeno", name: "Nivi", tags: ["otro"] }] },
      "POST /v1/convai/agents/create": { agent_id: "agent_1" },
    });

    expect(await admin.upsertTool(tool)).toEqual({ id: "tool_1", created: true });
    // Un agente con el mismo nombre pero sin la etiqueta de NIVEL no se toca.
    expect(await admin.upsertAgent(agent, "nivel")).toEqual({ id: "agent_1", created: true });
  });

  it("actualizan por nombre lo que ya existe", async () => {
    const { admin, calls } = fakeApi({
      "GET /v1/convai/tools": { tools: [{ id: "tool_1", tool_config: { name: "crear_solicitud" } }] },
      "PATCH /v1/convai/tools/tool_1": { id: "tool_1" },
      "GET /v1/convai/agents": { agents: [{ agent_id: "agent_1", name: "Nivi", tags: ["nivel"] }] },
      "PATCH /v1/convai/agents/agent_1": { agent_id: "agent_1" },
    });

    expect(await admin.upsertTool(tool)).toEqual({ id: "tool_1", created: false });
    expect(await admin.upsertAgent(agent, "nivel")).toEqual({ id: "agent_1", created: false });
    expect(calls.filter((call) => call.method === "PATCH").map((call) => call.body)).toEqual([tool, agent]);
  });

  it("fallan con un error claro si la respuesta no trae id", async () => {
    const { admin } = fakeApi({ "GET /v1/convai/tools": { tools: [] }, "POST /v1/convai/tools": {} });

    await expect(admin.upsertTool(tool)).rejects.toBeInstanceOf(ElevenLabsRequestError);
    await expect(admin.upsertAgent({}, "nivel")).rejects.toThrow("nombre de agente");
  });
});

describe("voz y audios", () => {
  it("diseña la voz, la guarda y la encuentra por nombre", async () => {
    const sample = Buffer.from([1, 2, 3]).toString("base64");
    const { admin, calls } = fakeApi({
      "POST /v1/text-to-voice/design": { previews: [{ generated_voice_id: "gen_1", audio_base_64: sample }] },
      "POST /v1/text-to-voice": { voice_id: "voz_1" },
      "GET /v2/voices": { voices: [{ voice_id: "voz_1", name: "Nivi · NIVEL" }] },
    });

    const [preview] = await admin.designVoice("descripción", "texto de muestra");

    expect(preview).toEqual({ generatedVoiceId: "gen_1", audio: new Uint8Array([1, 2, 3]) });
    expect(await admin.saveVoice("Nivi · NIVEL", "descripción", "gen_1")).toBe("voz_1");
    expect(await admin.findVoice("Nivi · NIVEL")).toBe("voz_1");
    expect(await admin.findVoice("Otra")).toBeUndefined();
    expect(calls[1]?.body).toMatchObject({ voice_name: "Nivi · NIVEL", generated_voice_id: "gen_1" });
  });

  it("genera voz y efectos como MP3", async () => {
    const audio = new Uint8Array([9, 9]);
    const { admin, calls } = fakeApi({
      "POST /v1/text-to-speech/voz_1": audio,
      "POST /v1/sound-generation": audio,
    });

    expect([...(await admin.speak("voz_1", "Hola", "eleven_v4"))]).toEqual([9, 9]);
    expect([...(await admin.soundEffect("campanita", 1.5))]).toEqual([9, 9]);
    expect(calls[0]?.body).toMatchObject({ text: "Hola", model_id: "eleven_v4", language_code: "es" });
    expect(calls[1]?.body).toMatchObject({ text: "campanita", duration_seconds: 1.5 });
  });
});

describe("chat", () => {
  it("abre una conversación de texto con las variables y devuelve lo que respondió el agente", async () => {
    const { admin, calls } = fakeApi({
      "POST /v1/convai/conversations": { conversation_id: "conv_1" },
      "POST /v1/convai/conversations/conv_1/messages": {
        output: [{ role: "agent", text: "Tienes una invitación." }, { role: "agent" }],
      },
    });

    const result = await admin.chat({
      agentId: "agent_1",
      dynamicVariables: { secret__nivel_contexto: "firmado" },
      messages: ["¿Tengo ofertas?"],
    });

    expect(result).toEqual({ conversationId: "conv_1", said: ["Tienes una invitación."] });
    expect(calls[0]?.body).toEqual({
      agent: { type: "persisted", agent_id: "agent_1" },
      dynamic_variables: { secret__nivel_contexto: "firmado" },
    });
    expect(calls[1]?.body).toEqual({
      input: [{ type: "user_message", content: [{ type: "text", text: "¿Tengo ofertas?" }] }],
    });
  });
});
