import {
  type AgentDefinition,
  DEFAULT_DYNAMIC_VARIABLES,
  TOOL_HEADERS,
  type ToolDefinition,
  type ToolParameter,
} from "./definitions";

/**
 * Traduce los agentes como código (`definitions.ts`) al formato de la API de
 * ElevenLabs Agents. Funciones puras: `scripts/setup-agents.ts` hace las
 * llamadas. Así lo que se publica se puede revisar en una prueba.
 */

/** Etiqueta común: permite encontrar los agentes de NIVEL al volver a publicar. */
export const AGENT_TAG = "nivel";
/** LLM rápido y con buen uso de herramientas (sección 7.3). */
export const AGENT_LLM = "gemini-3.5-flash";
/** Voz de los agentes en tiempo real: la más expresiva con baja latencia (sección 7). */
export const AGENT_TTS_MODEL = "eleven_v4_turbo";
/** Las herramientas tienen 12 s (sección 12): el servidor responde muy por debajo. */
export const TOOL_TIMEOUT_SECONDS = 12;
/** Hora de Caracas en el prompt: "el martes" se entiende igual que en el servidor. */
const AGENT_TIMEZONE = "America/Caracas";
/** Respuestas estables: es un asistente de trámites, no de creatividad. */
const AGENT_TEMPERATURE = 0.2;

export interface PublishTarget {
  /** URL pública de la app (`NEXT_PUBLIC_APP_URL`), siempre https. */
  readonly appUrl: string;
  /** Id del secreto de herramientas guardado en ElevenLabs (nunca su valor). */
  readonly toolSecretId: string;
}

type JsonSchema = Readonly<Record<string, unknown>>;

function parameterSchema(parameter: ToolParameter): JsonSchema {
  if (parameter.dynamicVariable) {
    // Lo llena la plataforma: el modelo ni lo ve ni lo puede cambiar.
    return { type: parameter.type, dynamic_variable: parameter.dynamicVariable };
  }
  if (parameter.type === "string[]") {
    return {
      type: "array",
      description: parameter.description,
      items: { type: "string", description: "Un elemento de la lista." },
    };
  }
  return {
    type: parameter.type,
    description: parameter.description,
    ...(parameter.enum ? { enum: [...parameter.enum] } : {}),
  };
}

function requestHeaders(toolSecretId: string): JsonSchema {
  return Object.fromEntries(
    Object.entries(TOOL_HEADERS).map(([header, source]) => [
      header,
      "secret" in source ? { secret_id: toolSecretId } : { variable_name: source.dynamicVariable },
    ]),
  );
}

/** Herramienta webhook, bloqueante, que llama a `POST {appUrl}{path}`. */
export function toolPayload(tool: ToolDefinition, target: PublishTarget): JsonSchema {
  const entries = Object.entries(tool.parameters);
  return {
    tool_config: {
      type: "webhook",
      name: tool.name,
      description: tool.description,
      response_timeout_secs: TOOL_TIMEOUT_SECONDS,
      api_schema: {
        url: new URL(tool.path, target.appUrl).href,
        method: "POST",
        request_headers: requestHeaders(target.toolSecretId),
        request_body_schema: {
          type: "object",
          description: `Datos para ${tool.name}.`,
          required: entries.filter(([, parameter]) => !parameter.optional).map(([name]) => name),
          properties: Object.fromEntries(
            entries.map(([name, parameter]) => [name, parameterSchema(parameter)]),
          ),
        },
      },
    },
  };
}

export interface AgentTarget {
  readonly voiceId: string;
  /** Ids de las herramientas ya publicadas, en el orden de la definición. */
  readonly toolIds: readonly string[];
}

/** Agente con autenticación: solo se abre con un token que entrega nuestro servidor. */
export function agentPayload(agent: AgentDefinition, target: AgentTarget): JsonSchema {
  return {
    name: agent.name,
    tags: [AGENT_TAG, agent.key],
    conversation_config: {
      agent: {
        first_message: agent.firstMessage,
        language: agent.language,
        dynamic_variables: { dynamic_variable_placeholders: { ...DEFAULT_DYNAMIC_VARIABLES } },
        prompt: {
          prompt: agent.prompt,
          llm: AGENT_LLM,
          temperature: AGENT_TEMPERATURE,
          timezone: AGENT_TIMEZONE,
          tool_ids: [...target.toolIds],
        },
      },
      tts: { voice_id: target.voiceId, model_id: AGENT_TTS_MODEL },
      // El evento y la obra son ruidosos: el agente espera a que la persona termine de hablar.
      turn: { turn_eagerness: "patient" },
    },
    platform_settings: { auth: { enable_auth: true } },
  };
}
