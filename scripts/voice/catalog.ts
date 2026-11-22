import { LESSONS, lessonAudioUrl } from "../../src/server/db/seed/lessons";

/**
 * Audios pregenerados de la demo (sección 7.6): la demo no depende de generar
 * voz en vivo. Cada archivo se publica desde `public/`, así que su ruta en
 * disco es `public` + su URL.
 */

/** Lecciones: el modelo más natural para escuchar 60–90 s seguidos. */
export const LESSON_TTS_MODEL = "eleven_v4";
/** Frases cortas de la app: mismo modelo, misma voz que las lecciones. */
export const PHRASE_TTS_MODEL = "eleven_v4";

export interface SpeechClip {
  readonly kind: "speech";
  readonly url: string;
  readonly text: string;
  readonly modelId: string;
}

export interface SoundClip {
  readonly kind: "sound";
  readonly url: string;
  readonly prompt: string;
  /** Sección 7.6: 1,5 s como máximo. */
  readonly seconds: number;
}

export type Clip = SpeechClip | SoundClip;

/** "Escuchar antes de aceptar": lo mismo que dice la hoja de consentimiento, en unos 40 s. */
const PRIVACY_SUMMARY =
  "Hola, soy Nivi. Antes de que aceptes, te cuento qué hacemos con tus datos. " +
  "Guardamos tu nombre, tu oficio, tu zona y lo que nos cuentes de tu experiencia, para que las empresas te encuentren. " +
  "No te pedimos cédula, dirección exacta, datos bancarios ni contraseñas. " +
  "Las empresas ven tu nivel, tus trabajos confirmados, tu prueba práctica y tus constancias; tus calificaciones son privadas. " +
  "Tu voz se usa solo para hablar conmigo en este momento. " +
  "Cada permiso es aparte, y puedes quitarlo, descargar tus datos o borrar tu cuenta cuando quieras en Mis datos. " +
  "Esto es una prueba de un proyecto de hackathon.";

const LEVEL_UP_CARLOS =
  "¡Felicidades, Carlos! Ya eres Nivel 3: Probado. Ahora apareces en búsquedas de nivel 3 o más.";

const lessonClips: readonly SpeechClip[] = LESSONS.map((lesson) => ({
  kind: "speech",
  url: lessonAudioUrl(lesson.id),
  text: lesson.script,
  modelId: LESSON_TTS_MODEL,
}));

export const CLIPS: readonly Clip[] = [
  ...lessonClips,
  { kind: "speech", url: "/audio/privacidad.mp3", text: PRIVACY_SUMMARY, modelId: PHRASE_TTS_MODEL },
  { kind: "speech", url: "/audio/nivel-3-carlos.mp3", text: LEVEL_UP_CARLOS, modelId: PHRASE_TTS_MODEL },
  {
    kind: "sound",
    url: "/sfx/subir-nivel.mp3",
    prompt: "Short bright celebratory chime, small bell sparkle, mobile app level up, clean, no music",
    seconds: 1.5,
  },
  {
    kind: "sound",
    url: "/sfx/notificacion.mp3",
    prompt: "Two soft gentle notification tones, warm, mobile app, clean, no reverb tail",
    seconds: 1,
  },
  {
    kind: "sound",
    url: "/sfx/exito.mp3",
    prompt: "Soft click followed by a short shimmering sparkle, success confirmation, mobile app UI",
    seconds: 1,
  },
];
