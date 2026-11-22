import {
  createElevenLabsHttp,
  type ElevenLabsHttpOptions,
  ElevenLabsRequestError,
  type ElevenLabsSend,
} from "./elevenlabs-http";

/**
 * Operaciones de configuración en ElevenLabs para los scripts (`setup-agents`,
 * `generate-audio`): crear o actualizar secretos, herramientas y agentes por
 * nombre (idempotente), diseñar la voz y generar audios. No corre en la app.
 */

/** Configurar tarda más que hablar: generar una lección de 90 s puede llevar decenas de segundos. */
const ADMIN_TIMEOUT_MS = 60_000;
const PAGE_SIZE = "100";
/** Audios que se commitean: MP3 de 128 kbps, buena calidad para escuchar una lección entera. */
const PREGENERATED_FORMAT = "mp3_44100_128";
const SOUND_MODEL = "eleven_text_to_sound_v3";
/** Más fiel al pedido que al azar: los sonidos de la app deben ser sobrios. */
const SOUND_PROMPT_INFLUENCE = 0.6;

type Json = Readonly<Record<string, unknown>>;

export interface NamedResource {
  readonly id: string;
  readonly created: boolean;
}

export interface VoicePreview {
  readonly generatedVoiceId: string;
  readonly audio: Uint8Array;
}

export interface ElevenLabsAdmin {
  /** Crea o actualiza un secreto de la cuenta y devuelve su id. El valor nunca vuelve. */
  readonly upsertSecret: (name: string, value: string) => Promise<NamedResource>;
  /** Crea o actualiza una herramienta por su nombre. */
  readonly upsertTool: (payload: Json) => Promise<NamedResource>;
  /** Crea o actualiza un agente por su nombre y etiqueta. */
  readonly upsertAgent: (payload: Json, tag: string) => Promise<NamedResource>;
  readonly designVoice: (description: string, sampleText: string) => Promise<VoicePreview[]>;
  readonly saveVoice: (name: string, description: string, generatedVoiceId: string) => Promise<string>;
  readonly findVoice: (name: string) => Promise<string | undefined>;
  readonly speak: (voiceId: string, text: string, modelId: string) => Promise<Uint8Array>;
  readonly soundEffect: (prompt: string, seconds: number) => Promise<Uint8Array>;
  /** Conversación de texto con un agente publicado: ejecuta sus herramientas de verdad. */
  readonly chat: (request: ChatRequest) => Promise<ChatResult>;
  readonly toolTrace: (conversationId: string, toolName: string) => Promise<string[]>;
}

export interface ChatRequest {
  readonly agentId: string;
  readonly dynamicVariables: Readonly<Record<string, string>>;
  /** Mensajes de la persona, uno por turno, en orden. */
  readonly messages: readonly string[];
}

export interface ChatResult {
  readonly conversationId: string;
  /** Lo que respondió el agente en todos los turnos. */
  readonly said: string[];
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
const asList = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map(asRecord) : [];

function requireString(value: unknown, what: string): string {
  if (typeof value !== "string" || value === "") {
    throw new ElevenLabsRequestError(undefined, `respuesta sin ${what}`);
  }
  return value;
}

interface Api {
  readonly http: ElevenLabsSend;
  readonly getJson: (path: string, query?: Record<string, string>) => Promise<Record<string, unknown>>;
  readonly sendJson: (
    method: "POST" | "PATCH",
    path: string,
    json: unknown,
  ) => Promise<Record<string, unknown>>;
}

/** Un tipo de recurso de ElevenLabs que se lista, se crea y se actualiza por nombre. */
interface Collection {
  readonly path: string;
  readonly listKey: string;
  readonly idKey: string;
  readonly createPath: string;
  readonly matches: (item: Record<string, unknown>, name: string) => boolean;
}

async function upsertByName(
  api: Api,
  collection: Collection,
  resource: { readonly name: string; readonly create: unknown; readonly update: unknown },
): Promise<NamedResource> {
  const listed = await api.getJson(collection.path, { search: resource.name, page_size: PAGE_SIZE });
  const existing = asList(listed[collection.listKey]).find((item) => collection.matches(item, resource.name));
  if (existing) {
    const id = requireString(existing[collection.idKey], collection.idKey);
    await api.sendJson("PATCH", `${collection.path}/${encodeURIComponent(id)}`, resource.update);
    return { id, created: false };
  }
  const created = await api.sendJson("POST", collection.createPath, resource.create);
  return { id: requireString(created[collection.idKey], collection.idKey), created: true };
}

const SECRETS: Collection = {
  path: "/v1/convai/secrets",
  listKey: "secrets",
  idKey: "secret_id",
  createPath: "/v1/convai/secrets",
  matches: (item, name) => item.name === name,
};

const TOOLS: Collection = {
  path: "/v1/convai/tools",
  listKey: "tools",
  idKey: "id",
  createPath: "/v1/convai/tools",
  matches: (item, name) => asRecord(item.tool_config).name === name,
};

const agentsTagged = (tag: string): Collection => ({
  path: "/v1/convai/agents",
  listKey: "agents",
  idKey: "agent_id",
  createPath: "/v1/convai/agents/create",
  // Un agente ajeno con el mismo nombre (sin la etiqueta) nunca se toca.
  matches: (item, name) => item.name === name && Array.isArray(item.tags) && item.tags.includes(tag),
});

const bytes = async (response: Response) => new Uint8Array(await response.arrayBuffer());

function voiceOperations({ http, getJson, sendJson }: Api) {
  return {
    async designVoice(description: string, sampleText: string): Promise<VoicePreview[]> {
      const { previews } = await sendJson("POST", "/v1/text-to-voice/design", {
        voice_description: description,
        model_id: "eleven_ttv_v3",
        text: sampleText,
      });
      return asList(previews).map((preview) => ({
        generatedVoiceId: requireString(preview.generated_voice_id, "generated_voice_id"),
        audio: new Uint8Array(
          Buffer.from(requireString(preview.audio_base_64, "audio de muestra"), "base64"),
        ),
      }));
    },

    async saveVoice(name: string, description: string, generatedVoiceId: string): Promise<string> {
      const voice = await sendJson("POST", "/v1/text-to-voice", {
        voice_name: name,
        voice_description: description,
        generated_voice_id: generatedVoiceId,
      });
      return requireString(voice.voice_id, "voice_id");
    },

    async findVoice(name: string): Promise<string | undefined> {
      const { voices } = await getJson("/v2/voices", { search: name, page_size: PAGE_SIZE });
      const match = asList(voices).find((voice) => voice.name === name);
      return typeof match?.voice_id === "string" ? match.voice_id : undefined;
    },

    async speak(voiceId: string, text: string, modelId: string): Promise<Uint8Array> {
      const response = await http(`/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
        method: "POST",
        query: { output_format: PREGENERATED_FORMAT },
        json: { text, model_id: modelId, language_code: "es" },
      });
      return bytes(response);
    },

    async soundEffect(prompt: string, seconds: number): Promise<Uint8Array> {
      const response = await http("/v1/sound-generation", {
        method: "POST",
        query: { output_format: PREGENERATED_FORMAT },
        json: {
          text: prompt,
          duration_seconds: seconds,
          model_id: SOUND_MODEL,
          prompt_influence: SOUND_PROMPT_INFLUENCE,
        },
      });
      return bytes(response);
    },
  };
}

async function chat({ sendJson }: Api, request: ChatRequest): Promise<ChatResult> {
  const conversation = await sendJson("POST", "/v1/convai/conversations", {
    agent: { type: "persisted", agent_id: request.agentId },
    dynamic_variables: request.dynamicVariables,
  });
  const conversationId = requireString(conversation.conversation_id, "conversation_id");
  const said: string[] = [];
  for (const message of request.messages) {
    const turn = await sendJson(
      "POST",
      `/v1/convai/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        input: [{ type: "user_message", content: [{ type: "text", text: message }] }],
      },
    );
    for (const item of asList(turn.output)) if (typeof item.text === "string") said.push(item.text);
  }
  return { conversationId, said };
}

const TRACE_LIMIT = 400;
const brief = (value: unknown) =>
  (typeof value === "string" ? value : JSON.stringify(value ?? "")).slice(0, TRACE_LIMIT);

async function toolTrace({ getJson }: Api, conversationId: string, toolName: string): Promise<string[]> {
  const notes: string[] = [];
  const listed = await getJson(TOOLS.path, { search: toolName, page_size: PAGE_SIZE });
  const tool = asList(listed.tools).find((item) => TOOLS.matches(item, toolName));
  const schema = asRecord(asRecord(tool?.tool_config).api_schema);
  notes.push(
    `Dirección publicada: ${brief(schema.url)} · cabeceras: ${Object.keys(asRecord(schema.request_headers)).join(", ")}`,
  );
  const detail = await getJson(`/v1/convai/conversations/${encodeURIComponent(conversationId)}`);
  for (const turn of asList(detail.transcript)) {
    for (const result of asList(turn.tool_results)) {
      notes.push(
        `Resultado de ${brief(result.tool_name)}: error=${brief(result.is_error)} · ${brief(result.result_value ?? result.error ?? result)}`,
      );
    }
  }
  return notes;
}

export function createElevenLabsAdmin(options: ElevenLabsHttpOptions): ElevenLabsAdmin {
  const http = createElevenLabsHttp({ timeoutMs: ADMIN_TIMEOUT_MS, ...options });
  const api: Api = {
    http,
    getJson: async (path, query = {}) => asRecord(await (await http(path, { query })).json()),
    sendJson: async (method, path, json) => asRecord(await (await http(path, { method, json })).json()),
  };
  return {
    upsertSecret: (name, value) =>
      upsertByName(api, SECRETS, {
        name,
        create: { type: "new", name, value },
        update: { type: "update", name, value },
      }),
    upsertTool: async (payload) => {
      const name = requireString(asRecord(payload.tool_config).name, "nombre de herramienta");
      return upsertByName(api, TOOLS, { name, create: payload, update: payload });
    },
    upsertAgent: async (payload, tag) => {
      const name = requireString(payload.name, "nombre de agente");
      return upsertByName(api, agentsTagged(tag), { name, create: payload, update: payload });
    },
    ...voiceOperations(api),
    chat: (request) => chat(api, request),
    toolTrace: (conversationId, toolName) => toolTrace(api, conversationId, toolName),
  };
}
