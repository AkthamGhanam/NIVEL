import type { Level } from "@/lib/level";

import { type ClipEvents, createSpeechPlayer, playAudio, type AudioClip } from "./speech-player";

/**
 * Celebración al subir de nivel (sección 7.6): un sonido corto y la
 * felicitación en la voz de Nivi. Lo mismo queda escrito en pantalla.
 */

/** Efectos de sonido de la app. */
export const SOUNDS = Object.freeze({
  levelUp: "/sfx/subir-nivel.mp3",
  notification: "/sfx/notificacion.mp3",
  success: "/sfx/exito.mp3",
});

/** Felicitación pregenerada del camino dorado: no depende de generar voz en vivo. */
export const CARLOS_LEVEL_UP_URL = "/audio/nivel-3-carlos.mp3";

export interface LevelUp {
  readonly firstName: string;
  readonly level: Level;
  readonly levelName: string;
}

export const levelUpSpeech = ({ firstName, level, levelName }: LevelUp): string =>
  `¡Felicidades, ${firstName}! Ya eres Nivel ${level}: ${levelName}. ` +
  `Ahora apareces en búsquedas de nivel ${level} o más.`;

const CARLOS_SPEECH = levelUpSpeech({ firstName: "Carlos", level: 3, levelName: "Probado" });

export interface CelebrationDeps {
  /** Dirección del audio de una frase en la voz de Nivi (TTS con caché). */
  readonly speak: (text: string) => Promise<string>;
  readonly createClip?: (url: string, events: ClipEvents) => AudioClip;
}

export interface Celebration {
  /** Suena el efecto y luego la felicitación. Si el navegador no deja sonar, no pasa nada. */
  readonly play: (text: string) => Promise<void>;
  readonly stop: () => void;
}

export function createCelebration({ speak, createClip }: CelebrationDeps): Celebration {
  const voice = createSpeechPlayer({
    audioUrlFor: async (text) => (text === CARLOS_SPEECH ? CARLOS_LEVEL_UP_URL : speak(text)),
    // La felicitación ya está escrita: sin audio no hay nada que esperar.
    wait: async () => undefined,
    ...(createClip ? { createClip } : {}),
  });
  let round = 0;
  return {
    play: async (text) => {
      const current = ++round;
      voice.stop();
      await playAudio(SOUNDS.levelUp, createClip);
      if (current === round) await voice.speak(text);
    },
    stop: () => {
      round += 1;
      voice.stop();
    },
  };
}
