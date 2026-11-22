import { describe, expect, it } from "vitest";

import { AGENTS } from "./definitions";
import { AGENT_TAG, agentPayload, TOOL_TIMEOUT_SECONDS, toolPayload } from "./platform";

const TARGET = { appUrl: "https://nivel.example", toolSecretId: "sec_123" };
const worker = AGENTS.find((agent) => agent.key === "worker");
const contractor = AGENTS.find((agent) => agent.key === "contractor");

type Schema = {
  url: string;
  method: string;
  request_headers: Record<string, unknown>;
  request_body_schema: { required: string[]; properties: Record<string, Record<string, unknown>> };
};

const apiSchema = (name: string) => {
  const tool = AGENTS.flatMap((agent) => agent.tools).find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`no existe ${name}`);
  const payload = toolPayload(tool, TARGET) as { tool_config: Record<string, unknown> };
  return { config: payload.tool_config, schema: payload.tool_config.api_schema as Schema };
};

describe("toolPayload", () => {
  it("es un webhook POST bloqueante a la ruta pública de la herramienta", () => {
    const { config, schema } = apiSchema("crear_solicitud");

    expect(config).toMatchObject({
      type: "webhook",
      name: "crear_solicitud",
      response_timeout_secs: TOOL_TIMEOUT_SECONDS,
    });
    expect(schema.url).toBe("https://nivel.example/api/tools/crear_solicitud");
    expect(schema.method).toBe("POST");
  });

  it("envía el secreto por id y el contexto como variable secreta, nunca valores en claro", () => {
    const { schema } = apiSchema("guardar_perfil");

    expect(schema.request_headers).toEqual({
      "x-tool-secret": { secret_id: "sec_123" },
      "x-nivel-context": { variable_name: "secret__nivel_contexto" },
    });
  });

  it("el id de conversación lo pone la plataforma: el modelo no lo describe ni lo elige", () => {
    const { schema } = apiSchema("guardar_perfil");
    const conversation = schema.request_body_schema.properties.conversation_id;

    expect(conversation).toEqual({ type: "string", dynamic_variable: "system__conversation_id" });
  });

  it("traduce listas, enums y campos opcionales al esquema JSON", () => {
    const { schema } = apiSchema("guardar_perfil");
    const { properties, required } = schema.request_body_schema;

    expect(properties.tecnicas).toMatchObject({ type: "array", items: { type: "string" } });
    expect(properties.oficio?.enum).toContain("soldador");
    expect(required).toContain("nombre");
    expect(required).not.toContain("tecnicas");
  });
});

describe("agentPayload", () => {
  it("publica cada agente con su prompt, su voz, sus herramientas y autenticación obligatoria", () => {
    if (!worker || !contractor) throw new Error("faltan agentes");
    const payload = agentPayload(worker, { voiceId: "voz-nivi", toolIds: ["t1", "t2"] }) as {
      name: string;
      tags: string[];
      conversation_config: {
        agent: Record<string, unknown> & { prompt: Record<string, unknown> };
        tts: Record<string, unknown>;
      };
      platform_settings: { auth: { enable_auth: boolean } };
    };

    expect(payload.name).toBe("Nivi");
    expect(payload.tags).toEqual([AGENT_TAG, "worker"]);
    expect(payload.conversation_config.agent).toMatchObject({
      // El saludo es una variable: el servidor lo llena con el nombre de quien tiene la sesión.
      first_message: "{{nivi_saludo}}",
      language: "es",
      dynamic_variables: {
        dynamic_variable_placeholders: {
          secret__nivel_contexto: "",
          nivi_saludo: worker.firstMessage,
          nivi_persona: "Una persona nueva: todavía no tiene perfil en NIVEL.",
        },
      },
    });
    expect(payload.conversation_config.agent.prompt).toMatchObject({
      prompt: worker.prompt,
      tool_ids: ["t1", "t2"],
    });
    expect(payload.conversation_config.tts.voice_id).toBe("voz-nivi");
    // Sin autenticación cualquiera podría abrir una conversación y gastar créditos.
    expect(payload.platform_settings.auth.enable_auth).toBe(true);
    expect(agentPayload(contractor, { voiceId: "v", toolIds: [] })).toMatchObject({ name: "Nivi Empresas" });
  });
});
