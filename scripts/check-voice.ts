/**
 * Prueba de punta a punta de la voz contra la app desplegada: confirma que
 * ElevenLabs envía la variable secreta `secret__nivel_contexto` en la cabecera
 * `x-nivel-context` de las herramientas, y que nuestro servidor la acepta.
 *
 * Cómo: pide a la app un contexto de registro (como lo haría la pantalla),
 * conversa por texto con el agente "Nivi" hasta que llama a `guardar_perfil`,
 * y comprueba que el perfil existe. `guardar_perfil` solo crea un perfil si el
 * contexto firmado llegó en la cabecera; sin él responde "falta tu permiso".
 *
 * Uso: npm run voice:check
 * Necesita ELEVENLABS_API_KEY, EL_AGENT_WORKER_ID y NEXT_PUBLIC_APP_URL (la app
 * desplegada, con los agentes ya publicados por `npm run agents:setup`).
 * Crea un perfil de ejemplo que el próximo reset de la demo borra.
 */
import { createElevenLabsAdmin } from "../src/server/adapters/elevenlabs-admin";
import { scriptEnv } from "./voice/env";

const PERSONA = [
  "Me llamo Prueba Técnica, soy mayor de edad, tengo 30 años.",
  "Soy soldador con 8 años de experiencia, manejo electrodo 6011 y 7018, vivo en Guacara y puedo empezar el lunes.",
].join(" ");
const CONFIRMATION = "Sí, todo está correcto. Guarda mi perfil, por favor.";
const MAX_CONFIRMATIONS = 2;

const note = (message: string) => console.warn(message);

async function registrationContext(appUrl: string): Promise<Record<string, string>> {
  const url = new URL("/api/el/token?agent=worker&registro=1&consent=1", appUrl);
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`La app respondió ${response.status} en /api/el/token`);
  const data = (await response.json()) as { dynamicVariables?: Record<string, string> };
  if (!data.dynamicVariables?.secret__nivel_contexto)
    throw new Error("La app no devolvió el contexto firmado");
  return data.dynamicVariables;
}

async function profileExists(appUrl: string, conversationId: string): Promise<boolean> {
  const url = new URL(`/api/workers/by-conversation/${encodeURIComponent(conversationId)}`, appUrl);
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  return response.ok;
}

async function main(): Promise<void> {
  const appUrl = scriptEnv("NEXT_PUBLIC_APP_URL");
  const agentId = scriptEnv("EL_AGENT_WORKER_ID");
  const admin = createElevenLabsAdmin({ apiKey: scriptEnv("ELEVENLABS_API_KEY") });
  const context = await registrationContext(appUrl);
  note("1/3 La app entregó el token y el contexto firmado.");

  const messages = [PERSONA, ...Array.from({ length: MAX_CONFIRMATIONS }, () => CONFIRMATION)];
  const { conversationId, said } = await admin.chat({
    agentId,
    dynamicVariables: context,
    messages,
  });
  note(`2/3 Conversación ${conversationId}. Nivi dijo:\n${said.map((line) => `   · ${line}`).join("\n")}`);

  if (!(await profileExists(appUrl, conversationId))) {
    throw new Error("No se creó el perfil: el contexto no llegó en x-nivel-context o la herramienta falló");
  }
  note("3/3 Perfil creado: la variable secreta llegó en x-nivel-context y el servidor la aceptó.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
