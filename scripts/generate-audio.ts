/**
 * Pregenera los audios de la demo (lecciones, privacidad, felicitación de
 * nivel y efectos de sonido) en `public/audio` y `public/sfx`, con la voz de
 * Nivi. Idempotente: un manifiesto guarda la huella de cada audio y solo se
 * regenera lo que cambió (texto, voz o modelo), para no gastar créditos.
 *
 * Uso: npm run audio:gen                     (genera lo que falta o cambió)
 *      npm run audio:gen -- --force          (regenera todo)
 *      npm run audio:gen -- --design-voice   (crea la voz "Nivi" con Voice Design e imprime su id)
 *
 * Necesita ELEVENLABS_API_KEY, y EL_VOICE_ID para generar.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { createElevenLabsAdmin, type ElevenLabsAdmin } from "../src/server/adapters/elevenlabs-admin";
import { type Clip, CLIPS } from "./voice/catalog";
import { scriptEnv } from "./voice/env";

const PUBLIC_DIR = join(process.cwd(), "public");
const MANIFEST_PATH = join(PUBLIC_DIR, "audio", "manifest.json");

/** Voz de marca (sección 7.6). El nombre la identifica al volver a correr el script. */
const NIVI_VOICE_NAME = "Nivi · NIVEL";
const NIVI_VOICE_DESCRIPTION =
  "Mujer venezolana de unos 30 años, acento venezolano neutro de la región central, voz cálida, clara y segura, " +
  "ritmo pausado, tono cercano y profesional, como una coordinadora de obra amable.";
const NIVI_SAMPLE_TEXT =
  "¡Hola! Soy Nivi, de NIVEL. En dos minutos armamos tu perfil para que las empresas te encuentren. " +
  "Cuéntame tu oficio, cuántos años tienes trabajando y en qué zona vives, y yo me encargo del resto.";

type Manifest = Record<string, string>;

const note = (message: string) => console.warn(message);

function fingerprint(clip: Clip, voiceId: string): string {
  const source =
    clip.kind === "speech" ? [voiceId, clip.modelId, clip.text] : [clip.prompt, String(clip.seconds)];
  return createHash("sha256")
    .update(JSON.stringify([clip.kind, ...source]))
    .digest("hex");
}

function readManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) return {};
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
}

function writePublicFile(url: string, data: Uint8Array): void {
  const path = join(PUBLIC_DIR, url);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

async function designVoice(admin: ElevenLabsAdmin): Promise<void> {
  const existing = await admin.findVoice(NIVI_VOICE_NAME);
  if (existing) {
    note(`La voz "${NIVI_VOICE_NAME}" ya existe.\nEL_VOICE_ID=${existing}`);
    return;
  }
  const [preview] = await admin.designVoice(NIVI_VOICE_DESCRIPTION, NIVI_SAMPLE_TEXT);
  if (!preview) throw new Error("Voice Design no devolvió ninguna muestra");
  const voiceId = await admin.saveVoice(NIVI_VOICE_NAME, NIVI_VOICE_DESCRIPTION, preview.generatedVoiceId);
  note(`Voz "${NIVI_VOICE_NAME}" creada. Ponla en .env.local y en Vercel:\nEL_VOICE_ID=${voiceId}`);
}

function render(admin: ElevenLabsAdmin, clip: Clip, voiceId: string): Promise<Uint8Array> {
  return clip.kind === "speech"
    ? admin.speak(voiceId, clip.text, clip.modelId)
    : admin.soundEffect(clip.prompt, clip.seconds);
}

async function generate(admin: ElevenLabsAdmin, force: boolean): Promise<void> {
  const voiceId = scriptEnv("EL_VOICE_ID");
  const manifest = readManifest();
  let generated = 0;
  const failed: string[] = [];
  for (const clip of CLIPS) {
    const print = fingerprint(clip, voiceId);
    const onDisk = existsSync(join(PUBLIC_DIR, clip.url));
    if (!force && onDisk && manifest[clip.url] === print) continue;
    try {
      writePublicFile(clip.url, await render(admin, clip, voiceId));
    } catch (error) {
      // Un audio que falla (por ejemplo, por un permiso de la clave) no frena a los demás.
      failed.push(`  ${clip.url}: ${error instanceof Error ? error.message : "error"}`);
      continue;
    }
    manifest[clip.url] = print;
    // Se guarda tras cada audio: si algo falla a mitad, lo ya pagado no se vuelve a generar.
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
    generated += 1;
    note(`  ${clip.url}`);
  }
  note(`${generated} audios generados, ${CLIPS.length - generated - failed.length} sin cambios.`);
  if (failed.length > 0) throw new Error(`${failed.length} audios fallaron:\n${failed.join("\n")}`);
}

async function main(): Promise<void> {
  const admin = createElevenLabsAdmin({ apiKey: scriptEnv("ELEVENLABS_API_KEY") });
  if (process.argv.includes("--design-voice")) return designVoice(admin);
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true });
  return generate(admin, process.argv.includes("--force"));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
