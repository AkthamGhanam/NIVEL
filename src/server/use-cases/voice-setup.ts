// Publica los agentes de voz con la configuración del servidor y comprueba de punta a punta que Nivi guarda un perfil.
import { and, eq, gte, inArray } from "drizzle-orm";

import type { ChatResult, ElevenLabsAdmin } from "../adapters/elevenlabs-admin";
import { AGENTS } from "../agents/definitions";
import { AGENT_TAG, agentPayload, toolPayload } from "../agents/platform";
import type { AppContext } from "../context";
import { events, workers } from "../db/schema";

export const TOOL_SECRET_NAME = "nivel_tool_secret";

export interface VoiceSetup {
  readonly admin: ElevenLabsAdmin;
  readonly appUrl: string;
  readonly voiceId: string;
  readonly toolSecret: string;
  readonly agentIds: { readonly worker: string | undefined; readonly contractor: string | undefined };
}

export interface PublishResult {
  readonly agents: { readonly worker: string; readonly contractor: string };
  readonly tools: number;
  readonly appUrl: string;
  readonly idsMatchEnv: boolean;
}

export async function publishAgents(setup: VoiceSetup): Promise<PublishResult> {
  const secret = await setup.admin.upsertSecret(TOOL_SECRET_NAME, setup.toolSecret);
  const ids: Record<string, string> = {};
  let tools = 0;
  for (const agent of AGENTS) {
    const toolIds: string[] = [];
    for (const tool of agent.tools) {
      const published = await setup.admin.upsertTool(
        toolPayload(tool, { appUrl: setup.appUrl, toolSecretId: secret.id }),
      );
      toolIds.push(published.id);
      tools += 1;
    }
    const published = await setup.admin.upsertAgent(
      agentPayload(agent, { voiceId: setup.voiceId, toolIds }),
      AGENT_TAG,
    );
    ids[agent.key] = published.id;
  }
  const agents = { worker: ids.worker ?? "", contractor: ids.contractor ?? "" };
  return {
    agents,
    tools,
    appUrl: setup.appUrl,
    idsMatchEnv: agents.worker === setup.agentIds.worker && agents.contractor === setup.agentIds.contractor,
  };
}

export interface VoiceCheckStep {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface VoiceCheck {
  readonly ok: boolean;
  readonly steps: readonly VoiceCheckStep[];
  readonly said: readonly string[];
}

const PERSONA =
  "Me llamo Prueba Técnica, soy mayor de edad, tengo 30 años. Soy soldador con 8 años de experiencia, " +
  "manejo electrodo 6011 y 7018, vivo en Guacara y puedo empezar el lunes.";
const CONFIRMATION = "Sí, todo está correcto. Guarda mi perfil, por favor.";
const TOOL_EVENT = "herramienta_guardar_perfil";
const TOOL_REJECTED = "herramienta_rechazada";
const TOOL_FAILED = "herramienta_fallo";

const errorDetail = (error: unknown) => (error instanceof Error ? error.message : "fallo desconocido");

async function talk(setup: VoiceSetup, toolContext: string): Promise<ChatResult> {
  if (!setup.agentIds.worker) throw new Error("Falta EL_AGENT_WORKER_ID");
  return setup.admin.chat({
    agentId: setup.agentIds.worker,
    dynamicVariables: { secret__nivel_contexto: toolContext },
    messages: [PERSONA, CONFIRMATION, CONFIRMATION],
  });
}

interface ToolTrace {
  readonly reached: boolean;
  readonly rejected: boolean;
  readonly failure: string | null;
}

async function toolEvents(context: AppContext, since: string): Promise<ToolTrace> {
  const rows = await context.db
    .select({ type: events.type, label: events.label })
    .from(events)
    .where(and(inArray(events.type, [TOOL_EVENT, TOOL_REJECTED, TOOL_FAILED]), gte(events.ts, since)));
  return {
    reached: rows.some((row) => row.type === TOOL_EVENT),
    rejected: rows.some((row) => row.type === TOOL_REJECTED),
    failure: rows.find((row) => row.type === TOOL_FAILED)?.label ?? null,
  };
}

function reachDetail({ reached, rejected, failure }: ToolTrace): string {
  if (reached) return "La herramienta guardar_perfil llegó al servidor.";
  if (rejected)
    return "Nivi llamó, pero el servidor rechazó su clave. Usa «Reconectar a Nivi» y prueba de nuevo.";
  if (failure) return `Nivi llamó, pero el servidor respondió con un fallo: ${failure}.`;
  return "La llamada de Nivi no llegó al servidor: algo la detiene antes (dirección o protección de Vercel).";
}

async function takeTestProfile(context: AppContext, conversationId: string): Promise<boolean> {
  const removed = await context.db
    .delete(workers)
    .where(eq(workers.conversationId, conversationId))
    .returning({ id: workers.id });
  return removed.length > 0;
}

export async function checkVoice(
  context: AppContext,
  setup: VoiceSetup,
  toolContext: string,
): Promise<VoiceCheck> {
  const since = context.now().toISOString();
  const steps: VoiceCheckStep[] = [];
  let chat: ChatResult;
  try {
    chat = await talk(setup, toolContext);
    steps.push({ name: "Conversación con Nivi", ok: true, detail: "Nivi respondió." });
  } catch (error) {
    steps.push({ name: "Conversación con Nivi", ok: false, detail: errorDetail(error) });
    return { ok: false, steps, said: [] };
  }
  const trace = await toolEvents(context, since);
  const reached = trace.reached;
  steps.push({ name: "Nivi llama a NIVEL", ok: reached, detail: reachDetail(trace) });
  const saved = await takeTestProfile(context, chat.conversationId);
  steps.push({
    name: "Perfil guardado",
    ok: saved,
    detail: saved ? "El perfil de prueba se creó y ya se borró." : "No se creó ningún perfil.",
  });
  return { ok: reached && saved, steps, said: chat.said };
}
