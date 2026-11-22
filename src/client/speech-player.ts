import { sameSiteAudio } from "./audio-url";

/**
 * Voz de Nivi fuera de una conversación en vivo: pide el audio de una frase
 * y lo reproduce. Si el audio no llega o el navegador no lo deja sonar, espera
 * lo que tomaría leer la frase, para que el texto en pantalla lleve el mismo ritmo.
 */

/** Lo mínimo que se usa de `HTMLAudioElement`: las pruebas inyectan uno falso. */
export interface AudioClip {
  readonly play: () => Promise<void>;
  readonly pause: () => void;
}

export interface ClipEvents {
  readonly onEnd: () => void;
  readonly onError: () => void;
}

export interface SpeechPlayerDeps {
  /** Dirección del audio de una frase dentro de la app (TTS con caché). */
  readonly audioUrlFor: (text: string) => Promise<string>;
  readonly createClip?: (url: string, events: ClipEvents) => AudioClip;
  readonly wait?: (ms: number) => Promise<void>;
}

export interface SpeechPlayer {
  /** Dice la frase y termina cuando acaba de sonar (o de "leerse"). */
  readonly speak: (text: string) => Promise<void>;
  readonly stop: () => void;
}

const MS_PER_CHARACTER = 55;
const MAX_READING_MS = 9000;

/** Cuánto tarda una persona en leer la frase, con un tope. */
export const readingTime = (text: string): number => Math.min(MAX_READING_MS, text.length * MS_PER_CHARACTER);

function browserClip(url: string, events: ClipEvents): AudioClip {
  const audio = new Audio(url);
  audio.onended = events.onEnd;
  audio.onerror = events.onError;
  return { play: () => audio.play(), pause: () => audio.pause() };
}

const browserWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Reproduce un audio de la app hasta el final. Falso si el navegador no lo dejó sonar. */
export function playAudio(url: string, createClip: SpeechPlayerDeps["createClip"] = browserClip) {
  return new Promise<boolean>((resolve) => {
    const clip = createClip(url, { onEnd: () => resolve(true), onError: () => resolve(false) });
    clip.play().catch(() => resolve(false));
  });
}

export function createSpeechPlayer(deps: SpeechPlayerDeps): SpeechPlayer {
  const createClip = deps.createClip ?? browserClip;
  const wait = deps.wait ?? browserWait;
  let current: { readonly clip: AudioClip; finish: () => void } | undefined;

  const stop = () => {
    current?.clip.pause();
    current?.finish();
    current = undefined;
  };

  /** Reproduce el audio hasta el final. Falso si no sonó; verdadero si sonó o si lo cortó `stop`. */
  const play = (url: string) =>
    new Promise<boolean>((resolve) => {
      const clip = createClip(url, { onEnd: () => resolve(true), onError: () => resolve(false) });
      current = { clip, finish: () => resolve(true) };
      clip.play().catch(() => resolve(false));
    });

  const speak = async (text: string) => {
    stop();
    let sounded = false;
    try {
      const url = sameSiteAudio(await deps.audioUrlFor(text));
      if (url) sounded = await play(url);
    } catch {
      // Sin audio (red o servicio de voz): la frase igual queda escrita en pantalla.
    }
    current = undefined;
    if (!sounded) await wait(readingTime(text));
  };

  return { speak, stop };
}
