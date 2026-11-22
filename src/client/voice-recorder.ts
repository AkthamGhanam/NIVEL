/**
 * Nota de voz grabada en el teléfono (hasta 60 s). El audio solo vive en la
 * memoria de esta pantalla mientras se envía: ni se guarda en el navegador ni
 * el servidor lo conserva. El micrófono se suelta apenas termina la grabación.
 */

export const MAX_NOTE_SECONDS = 60;
/** Voz hablada: 32 kbps en Opus se entiende bien y una nota entera pesa unos 240 KB. */
const NOTE_BITS_PER_SECOND = 32_000;

/** Formatos que el servidor admite, del más liviano al más compatible (Safari graba en MP4). */
export const NOTE_FORMATS = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

export class MicrophoneError extends Error {
  override readonly name = "MicrophoneError";
}

const MESSAGES = {
  unsupported: "Este teléfono no permite grabar desde el navegador. Puedes escribirlo.",
  denied: "No tenemos permiso para usar el micrófono. Actívalo o escríbelo.",
  missing: "No encontramos un micrófono en este equipo. Puedes escribirlo.",
  unavailable: "No pudimos usar el micrófono. Intenta de nuevo o escríbelo.",
  empty: "No se grabó nada. Intenta de nuevo y habla cerca del teléfono.",
} as const;

const DENIED_ERRORS: readonly string[] = ["NotAllowedError", "SecurityError"];
const MISSING_ERRORS: readonly string[] = ["NotFoundError", "OverconstrainedError"];

function messageFor(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (DENIED_ERRORS.includes(name)) return MESSAGES.denied;
  return MISSING_ERRORS.includes(name) ? MESSAGES.missing : MESSAGES.unavailable;
}

/** Lo mínimo que se usa de `MediaStream` y `MediaRecorder`: las pruebas inyectan uno falso. */
export interface AudioStream {
  readonly getTracks: () => ReadonlyArray<{ readonly stop: () => void }>;
}

export interface AudioRecorder {
  /** Formato en el que el navegador terminó grabando. */
  readonly mimeType: string;
  readonly start: () => void;
  readonly stop: () => void;
}

export interface RecorderEvents {
  readonly onData: (data: Blob) => void;
  readonly onStop: () => void;
  readonly onError: () => void;
}

export interface RecorderSetup {
  readonly format: string | undefined;
  readonly events: RecorderEvents;
}

export interface Microphone {
  readonly open: () => Promise<AudioStream>;
  readonly supports: (format: string) => boolean;
  readonly record: (stream: AudioStream, setup: RecorderSetup) => AudioRecorder;
}

/** El micrófono del navegador, o nada si este navegador no sabe grabar. */
export function browserMicrophone(): Microphone | undefined {
  if (typeof navigator === "undefined" || typeof MediaRecorder === "undefined") return undefined;
  const devices = navigator.mediaDevices as MediaDevices | undefined;
  if (!devices) return undefined;
  return {
    open: () => devices.getUserMedia({ audio: true }),
    supports: (format) => MediaRecorder.isTypeSupported(format),
    record: (stream, { format, events }) => {
      const recorder = new MediaRecorder(stream as MediaStream, {
        audioBitsPerSecond: NOTE_BITS_PER_SECOND,
        ...(format ? { mimeType: format } : {}),
      });
      recorder.ondataavailable = ({ data }) => events.onData(data);
      recorder.onstop = events.onStop;
      recorder.onerror = events.onError;
      return recorder;
    },
  };
}

/** "audio/webm;codecs=opus" → "audio/webm": el servidor valida el tipo sin parámetros. */
const baseType = (format: string) => format.split(";")[0]?.trim().toLowerCase() ?? "";

export interface VoiceNoteRecording {
  /** Termina la grabación y entrega el audio. */
  readonly finish: () => Promise<Blob>;
  /** Descarta lo grabado. */
  readonly cancel: () => void;
}

function release(stream: AudioStream): void {
  for (const track of stream.getTracks()) track.stop();
}

async function openMicrophone(microphone: Microphone): Promise<AudioStream> {
  try {
    return await microphone.open();
  } catch (error) {
    throw new MicrophoneError(messageFor(error));
  }
}

/** Comprueba que el micrófono abre (pide el permiso si hace falta) y lo suelta de una vez. */
export async function testMicrophone(
  microphone: Microphone | undefined = browserMicrophone(),
): Promise<void> {
  if (!microphone) throw new MicrophoneError(MESSAGES.unsupported);
  release(await openMicrophone(microphone));
}

interface Waiting {
  readonly resolve: (note: Blob) => void;
  readonly reject: (error: MicrophoneError) => void;
}

/**
 * Pide el micrófono y empieza a grabar. Quien llama decide cuándo terminar
 * (`finish`) o descartar (`cancel`); en ambos casos el micrófono queda libre.
 */
export async function recordVoiceNote(
  microphone: Microphone | undefined = browserMicrophone(),
): Promise<VoiceNoteRecording> {
  if (!microphone) throw new MicrophoneError(MESSAGES.unsupported);
  const stream = await openMicrophone(microphone);
  const format = NOTE_FORMATS.find((candidate) => microphone.supports(candidate));
  const chunks: Blob[] = [];
  let waiting: Waiting | undefined;
  let recorder: AudioRecorder;
  const events: RecorderEvents = {
    onData: (data) => {
      if (data.size > 0) chunks.push(data);
    },
    onStop: () => {
      release(stream);
      const note = new Blob(chunks, { type: baseType(recorder.mimeType || format || "") });
      if (note.size === 0) waiting?.reject(new MicrophoneError(MESSAGES.empty));
      else waiting?.resolve(note);
    },
    onError: () => {
      release(stream);
      waiting?.reject(new MicrophoneError(MESSAGES.unavailable));
    },
  };
  try {
    recorder = microphone.record(stream, { format, events });
    recorder.start();
  } catch {
    release(stream);
    throw new MicrophoneError(MESSAGES.unavailable);
  }

  return {
    finish: () =>
      new Promise<Blob>((resolve, reject) => {
        waiting = { resolve, reject };
        recorder.stop();
      }),
    cancel: () => {
      // Sin nadie esperando, lo grabado se descarta al detenerse.
      waiting = undefined;
      chunks.length = 0;
      try {
        recorder.stop();
      } catch {
        // Ya estaba detenida: igual hay que soltar el micrófono.
      }
      release(stream);
    },
  };
}

/** Segundos de grabación transcurridos, sin pasar del máximo. */
export const noteSeconds = (startedAt: number, now: number): number =>
  Math.min(MAX_NOTE_SECONDS, Math.max(0, Math.floor((now - startedAt) / 1000)));

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** "0:12 de 1:00". */
export const noteClock = (seconds: number): string => `${clock(seconds)} de ${clock(MAX_NOTE_SECONDS)}`;
