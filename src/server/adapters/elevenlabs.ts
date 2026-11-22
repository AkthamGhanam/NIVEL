import { AppError } from "../errors";
import { log } from "../log";
import { createElevenLabsHttp, type ElevenLabsHttpOptions, type ElevenLabsRequest } from "./elevenlabs-http";

/**
 * Lo que la app en vivo le pide a ElevenLabs: tokens de conversación, voz
 * (TTS) y transcripción (Scribe). Cualquier fallo llega a la persona como un
 * mensaje amable; el detalle técnico va al log, nunca la clave.
 */

/** Notas de voz dinámicas: el modelo más rápido con español (sección 7 de la especificación). */
export const DYNAMIC_TTS_MODEL = "eleven_flash_v2_5";
export const TRANSCRIPTION_MODEL = "scribe_v2";
/** Español, en ISO-639-3 como lo pide Scribe. */
const TRANSCRIPTION_LANGUAGE = "spa";
/** MP3 mono de 64 kbps: suena bien en un teléfono y pesa unos 8 KB por segundo. */
export const SPEECH_OUTPUT_FORMAT = "mp3_44100_64";
/** Una nota de 60 s tarda más en subir y transcribirse que una frase en sintetizarse. */
const TRANSCRIPTION_TIMEOUT_MS = 15_000;

export class VoiceServiceError extends AppError {
  readonly status = 502;
  readonly code = "voz_no_disponible";
  constructor() {
    super("El servicio de voz no respondió. Intenta de nuevo o usa el modo texto.");
  }
}

export interface SpeechRequest {
  readonly text: string;
  readonly voiceId: string;
  readonly modelId: string;
}

export interface ElevenLabs {
  /** Token de corta vida para abrir una conversación con el agente desde el navegador. */
  readonly conversationToken: (agentId: string) => Promise<string>;
  /** Texto a voz en MP3. */
  readonly speak: (request: SpeechRequest) => Promise<Uint8Array>;
  /** Audio a texto en español con Scribe. */
  readonly transcribe: (audio: Blob) => Promise<string>;
}

export type ElevenLabsOptions = ElevenLabsHttpOptions;

export function createElevenLabs(options: ElevenLabsOptions): ElevenLabs {
  const http = createElevenLabsHttp(options);

  /** Toda falla se registra (sin datos personales) y se convierte en `VoiceServiceError`. */
  async function call(operation: string, path: string, request?: ElevenLabsRequest): Promise<Response> {
    try {
      return await http(path, request);
    } catch (error) {
      const status = (error as { status?: unknown }).status;
      log("warn", "elevenlabs_failed", { operation, status: typeof status === "number" ? status : null });
      throw new VoiceServiceError();
    }
  }

  async function readJson(response: Response): Promise<Record<string, unknown>> {
    const data = (await response.json().catch(() => null)) as unknown;
    return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  }

  return {
    async conversationToken(agentId) {
      const response = await call("token", "/v1/convai/conversation/token", { query: { agent_id: agentId } });
      const { token } = await readJson(response);
      if (typeof token !== "string" || token === "") throw new VoiceServiceError();
      return token;
    },

    async speak({ text, voiceId, modelId }) {
      const response = await call("tts", `/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
        method: "POST",
        query: { output_format: SPEECH_OUTPUT_FORMAT },
        json: { text, model_id: modelId, language_code: "es" },
      });
      const audio = new Uint8Array(await response.arrayBuffer());
      if (audio.byteLength === 0) throw new VoiceServiceError();
      return audio;
    },

    async transcribe(audio) {
      const form = new FormData();
      form.set("model_id", TRANSCRIPTION_MODEL);
      form.set("language_code", TRANSCRIPTION_LANGUAGE);
      form.set("tag_audio_events", "false");
      form.set("file", audio, "nota-de-voz");
      const response = await call("stt", "/v1/speech-to-text", {
        method: "POST",
        form,
        timeoutMs: TRANSCRIPTION_TIMEOUT_MS,
      });
      const { text } = await readJson(response);
      if (typeof text !== "string") throw new VoiceServiceError();
      return text.trim();
    },
  };
}
