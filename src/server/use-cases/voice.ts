import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import { ensure } from "@/lib/errors";
import { classifyReport, type ReportCategory } from "@/lib/report-classifier";

import type { Actor } from "../actor";
import type { AppContext } from "../context";
import { voiceClips } from "../db/schema";
import { NotFoundError } from "../errors";
import { logEvent } from "./events";
import { createReport, MAX_REPORT_TEXT_LENGTH, type ReportCreated } from "./reports";

/**
 * Voz de la app: frases a audio con caché (TTS) y notas de voz a reporte
 * (Scribe). La bitácora registra producto y latencia, nunca lo que se dijo.
 */

/** Una nota de voz de invitación cabe de sobra; un texto más largo sería otro uso (y otro costo). */
export const MAX_SPEECH_CHARACTERS = 400;
export const SPEECH_MIME = "audio/mpeg";
const CLIP_ID_PATTERN = /^[a-f0-9]{64}$/;

/** Una voz concreta (voz + modelo): sintetiza en ella e identifica sus audios en la caché. */
export interface Speaker {
  /** Identidad estable de la voz y el modelo; si cambia, la caché no reutiliza audios viejos. */
  readonly voice: string;
  readonly speak: (text: string) => Promise<Uint8Array>;
}

export type Transcriber = (audio: Blob) => Promise<string>;

export interface SpokenClip {
  readonly clipId: string;
  readonly cached: boolean;
}

/** Espacios repetidos o saltos de línea no cambian lo que se oye: no deben duplicar la caché. */
const normalizeSpeech = (text: string) => text.replace(/\s+/g, " ").trim();

const clipIdOf = (voice: string, text: string) =>
  createHash("sha256").update(voice).update("\n").update(text).digest("hex");

/** Audio de una frase: de la caché si ya existe; si no, se sintetiza una vez y se guarda. */
export async function synthesize(
  context: AppContext,
  speaker: Speaker,
  rawText: string,
): Promise<SpokenClip> {
  const text = normalizeSpeech(rawText);
  ensure(text.length > 0, "Escribe el texto que Nivi debe leer.");
  ensure(
    text.length <= MAX_SPEECH_CHARACTERS,
    `El texto no puede pasar de ${MAX_SPEECH_CHARACTERS} caracteres.`,
  );
  const clipId = clipIdOf(speaker.voice, text);
  const [existing] = await context.db
    .select({ hash: voiceClips.hash })
    .from(voiceClips)
    .where(eq(voiceClips.hash, clipId));
  if (existing) return { clipId, cached: true };

  const startedAt = performance.now();
  const audio = await speaker.speak(text);
  const latencyMs = performance.now() - startedAt;
  // Dos pedidos iguales a la vez producen el mismo audio: el segundo simplemente no se guarda.
  await context.db
    .insert(voiceClips)
    .values({
      hash: clipId,
      mime: SPEECH_MIME,
      audio: Buffer.from(audio),
      characters: text.length,
      createdAt: context.now().toISOString(),
    })
    .onConflictDoNothing();
  await logEvent(context, {
    actor: "Nivi",
    type: "tts",
    label: "TTS · nota de voz",
    detail: { characters: text.length },
    latencyMs,
    product: "tts",
  });
  return { clipId, cached: false };
}

export interface StoredClip {
  readonly audio: Uint8Array;
  readonly mime: string;
}

export async function readClip(context: AppContext, clipId: string): Promise<StoredClip> {
  if (!CLIP_ID_PATTERN.test(clipId)) throw new NotFoundError("ese audio");
  const [clip] = await context.db
    .select({ audio: voiceClips.audio, mime: voiceClips.mime })
    .from(voiceClips)
    .where(eq(voiceClips.hash, clipId));
  if (!clip) throw new NotFoundError("ese audio");
  return { audio: new Uint8Array(clip.audio), mime: clip.mime };
}

export interface VoiceReport extends ReportCreated {
  readonly kind: ReportCategory;
  readonly transcript: string;
}

/**
 * Nota de voz de un trabajador → transcripción → reporte confidencial en
 * revisión humana. El audio no se guarda: solo el texto, que es lo que revisa
 * el equipo (minimización de datos).
 */
export interface VoiceNote {
  readonly audio: Blob;
  readonly transcribe: Transcriber;
}

export async function reportFromVoiceNote(
  context: AppContext,
  actor: Actor,
  { audio, transcribe }: VoiceNote,
): Promise<VoiceReport> {
  const startedAt = performance.now();
  const heard = await transcribe(audio);
  const latencyMs = performance.now() - startedAt;
  await logEvent(context, {
    actor: "Nivi",
    type: "stt",
    label: "Scribe v2 · reporte",
    detail: { characters: heard.length },
    latencyMs,
    product: "stt",
  });
  ensure(heard.length > 0, "No logramos entender la nota de voz. Intenta de nuevo o escribe tu reporte.");
  const transcript = heard.slice(0, MAX_REPORT_TEXT_LENGTH);
  const kind = classifyReport(transcript);
  const created = await createReport(context, actor, { kind, transcript });
  return { ...created, kind, transcript };
}
