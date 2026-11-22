import { z } from "zod";

import { ensure } from "@/lib/errors";

import { UnauthorizedError } from "../../errors";
import { claimProfile } from "../../use-cases/registration";
import { MAX_SPEECH_CHARACTERS, readClip, reportFromVoiceNote, synthesize } from "../../use-cases/voice";
import { ApiResponse, endpoint, type RuntimeProvider, type UploadRule } from "../endpoint";
import type { RateRule } from "../rate-limit";
import { conversationIdSchema } from "../tool";
import type { ToolContext } from "../tool-context";

/** Cada token abre una conversación que consume créditos de voz: tope propio por IP. */
const TOKEN_LIMIT: RateRule & { bucket: string } = Object.freeze({
  bucket: "token-voz",
  limit: 60,
  windowSeconds: 300,
});

/** Cada frase nueva cuesta créditos de TTS (las repetidas salen de la caché). */
const SPEECH_LIMIT: RateRule & { bucket: string } = Object.freeze({
  bucket: "tts",
  limit: 30,
  windowSeconds: 300,
});

/** Cada nota de voz cuesta créditos de Scribe y abre un caso que revisa una persona. */
const TRANSCRIBE_LIMIT: RateRule & { bucket: string } = Object.freeze({
  bucket: "stt",
  limit: 10,
  windowSeconds: 300,
});

/**
 * Nota de voz de hasta 60 s (sección 7.7). Opus a 32–64 kbps pesa menos de
 * 0,5 MB; el tope deja margen para el AAC de Safari sin aceptar archivos enormes.
 */
export const VOICE_NOTE_UPLOAD: UploadRule = Object.freeze({
  maxBytes: 2 * 1024 * 1024,
  types: ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-m4a", "audio/aac"],
});

const speechBody = z.strictObject({ text: z.string().max(MAX_SPEECH_CHARACTERS * 2) });

const flag = z.enum(["1"]).optional();
const tokenQuery = z.object({
  agent: z.enum(["worker", "contractor"]),
  /** Registro de una persona nueva, aunque haya un personaje de ejemplo con sesión. */
  registro: flag,
  /** Persona real del evento: su perfil sobrevive al reset. */
  real: flag,
  /** La persona aceptó en pantalla el uso de su voz y sus datos. */
  consent: flag,
});

const query = (url: URL) => tokenQuery.parse(Object.fromEntries(url.searchParams));

export const voiceRoutes = (runtime: RuntimeProvider) => ({
  /**
   * Entrega el token para hablar con un agente y el contexto firmado que
   * viajará con cada herramienta: así el agente actúa en nombre de quien
   * tiene la sesión, no de quien diga ser durante la conversación.
   */
  token: endpoint(
    { access: "public", limit: TOKEN_LIMIT },
    async ({ url, sessions, context, issueToolContext, services }) => {
      const { agent, registro, real, consent } = query(url);
      const { company, worker } = sessions;
      let toolContext: ToolContext;
      if (agent === "contractor") {
        if (company?.role !== "company") throw new UnauthorizedError("Primero entra como empresa.");
        toolContext = { kind: "actor", actor: company };
      } else if (worker?.role === "worker" && !registro) {
        toolContext = { kind: "actor", actor: worker };
      } else {
        ensure(consent === "1", "Necesitamos tu permiso para usar tu voz y guardar tu perfil.");
        toolContext = { kind: "registration", real: real === "1", consentAt: context.now().toISOString() };
      }
      return {
        token: await services.conversationToken(agent),
        // Variable secreta del agente: se envía solo como cabecera de las herramientas, nunca al modelo.
        dynamicVariables: { secret__nivel_contexto: issueToolContext(toolContext) },
      };
    },
    runtime,
  ),

  /**
   * Frase a voz de Nivi (por ejemplo, la nota de voz de una invitación). Exige
   * una sesión para que nadie use NIVEL como TTS gratis; las frases repetidas
   * salen de la caché y no gastan créditos.
   */
  speech: endpoint(
    { access: ["worker", "company", "academy", "admin"], body: speechBody, limit: SPEECH_LIMIT },
    async ({ body, context, services }) => {
      const { clipId, cached } = await synthesize(context, services.speaker(), body.text);
      return { url: `/api/voice/audio/${clipId}`, cached };
    },
    runtime,
  ),

  /** Audio guardado en la caché. Su id es una huella sha256: no se puede adivinar ni enumerar. */
  clip: endpoint(
    { access: "public" },
    async ({ params, context }) => {
      const { audio, mime } = await readClip(context, params.id ?? "");
      // `next.config.ts` marca toda la API como no-store; leer un audio de la base tarda ~10 ms.
      return new Response(new Uint8Array(audio), { headers: { "Content-Type": mime } });
    },
    runtime,
  ),

  /** Nota de voz del trabajador → Scribe → reporte confidencial en revisión humana. */
  transcribe: endpoint(
    { access: "worker", upload: VOICE_NOTE_UPLOAD, limit: TRANSCRIBE_LIMIT },
    ({ actor, upload, context, services }) =>
      // `upload` siempre existe en una ruta con `upload`: el envoltorio ya rechazó un cuerpo vacío.
      reportFromVoiceNote(context, actor, { audio: upload as Blob, transcribe: services.transcribe }),
    runtime,
  ),

  /** La pantalla que habló con Nivi recoge su perfil recién creado y queda con la sesión abierta. */
  profileByConversation: endpoint(
    { access: "public" },
    async ({ params, context, issueSession }) => {
      const { actor, profile } = await claimProfile(context, conversationIdSchema.parse(params.id));
      return new ApiResponse({ profile }, { headers: { "Set-Cookie": issueSession(actor) } });
    },
    runtime,
  ),
});
