/**
 * Publica en ElevenLabs los dos agentes de `src/server/agents/definitions.ts`
 * con sus herramientas webhook. Idempotente: crea lo que falta y actualiza lo
 * que ya existe (por nombre), así que se puede correr cada vez que cambie un
 * prompt o la URL pública.
 *
 * Uso: npm run agents:setup              (publica)
 *      npm run agents:setup -- --dry-run (muestra lo que publicaría, sin llamar a la API)
 *
 * Necesita ELEVENLABS_API_KEY, EL_VOICE_ID, TOOL_SECRET y NEXT_PUBLIC_APP_URL (https).
 * El secreto de herramientas se guarda en ElevenLabs como secreto de la cuenta:
 * los agentes lo envían en `x-tool-secret` sin que el modelo lo vea nunca.
 */
import { createElevenLabsAdmin } from "../src/server/adapters/elevenlabs-admin";
import { AGENTS } from "../src/server/agents/definitions";
import { AGENT_TAG, agentPayload, toolPayload } from "../src/server/agents/platform";
import { scriptEnv } from "./voice/env";

/** Nombre del secreto en ElevenLabs (no su valor). */
const TOOL_SECRET_NAME = "nivel_tool_secret";
const DRY_RUN_SECRET_ID = "(secreto)";
const ENV_NAMES = { worker: "EL_AGENT_WORKER_ID", contractor: "EL_AGENT_CONTRACTOR_ID" } as const;

const note = (message: string) => console.warn(message);

function dryRun(appUrl: string, voiceId: string): void {
  for (const agent of AGENTS) {
    const tools = agent.tools.map((tool) => toolPayload(tool, { appUrl, toolSecretId: DRY_RUN_SECRET_ID }));
    const toolIds = agent.tools.map((tool) => `(${tool.name})`);
    note(JSON.stringify({ agent: agentPayload(agent, { voiceId, toolIds }), tools }, null, 2));
  }
}

async function main(): Promise<void> {
  const appUrl = scriptEnv("NEXT_PUBLIC_APP_URL");
  const voiceId = scriptEnv("EL_VOICE_ID");
  if (process.argv.includes("--dry-run")) return dryRun(appUrl, voiceId);

  const admin = createElevenLabsAdmin({ apiKey: scriptEnv("ELEVENLABS_API_KEY") });
  const secret = await admin.upsertSecret(TOOL_SECRET_NAME, scriptEnv("TOOL_SECRET"));
  note(`Secreto de herramientas ${secret.created ? "creado" : "actualizado"}.`);

  const published: string[] = [];
  for (const agent of AGENTS) {
    const toolIds: string[] = [];
    for (const tool of agent.tools) {
      const result = await admin.upsertTool(toolPayload(tool, { appUrl, toolSecretId: secret.id }));
      toolIds.push(result.id);
      note(`  herramienta ${tool.name}: ${result.created ? "creada" : "actualizada"}`);
    }
    const result = await admin.upsertAgent(agentPayload(agent, { voiceId, toolIds }), AGENT_TAG);
    note(`Agente "${agent.name}" ${result.created ? "creado" : "actualizado"} → ${appUrl}`);
    published.push(`${ENV_NAMES[agent.key]}=${result.id}`);
  }
  // Los ids de agente no son secretos: van en .env.local y en Vercel.
  note(`\nPon estas variables en .env.local y en Vercel:\n${published.join("\n")}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
