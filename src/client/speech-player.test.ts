import { afterEach, describe, expect, it, vi } from "vitest";

import { type AudioClip, type ClipEvents, createSpeechPlayer, playAudio, readingTime } from "./speech-player";

/** Audios falsos: guardan sus avisos para que la prueba decida cuándo terminan o fallan. */
function fakeClips(play: () => Promise<void> = async () => undefined) {
  const made: Array<{
    url: string;
    events: ClipEvents;
    clip: AudioClip & { pause: ReturnType<typeof vi.fn> };
  }> = [];
  const createClip = (url: string, events: ClipEvents) => {
    const clip = { play: vi.fn(play), pause: vi.fn() };
    made.push({ url, events, clip });
    return clip;
  };
  return { made, createClip };
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function player(clips = fakeClips(), audioUrlFor = async () => "/api/voice/audio/abc") {
  const wait = vi.fn(async () => undefined);
  return { clips, wait, ...createSpeechPlayer({ audioUrlFor, createClip: clips.createClip, wait }) };
}

afterEach(() => vi.unstubAllGlobals());

describe("voz de Nivi fuera de una conversación", () => {
  it("pide el audio de la frase, lo reproduce y termina cuando acaba de sonar", async () => {
    const audioUrlFor = vi.fn(async () => "/api/voice/audio/abc");
    const { speak, clips, wait } = player(fakeClips(), audioUrlFor);

    let done = false;
    const speaking = speak("Hola, soy Nivi.").then(() => (done = true));
    await tick();

    expect(audioUrlFor).toHaveBeenCalledWith("Hola, soy Nivi.");
    expect(clips.made[0]?.url).toBe("/api/voice/audio/abc");
    expect(done).toBe(false);
    clips.made[0]?.events.onEnd();
    await speaking;
    expect(wait).not.toHaveBeenCalled();
  });

  it("si el audio no llega, no suena o el navegador lo bloquea, espera lo que toma leer la frase", async () => {
    const noUrl = player(fakeClips(), async () => {
      throw new Error("sin voz");
    });
    const blocked = player(fakeClips(async () => Promise.reject(new Error("NotAllowedError"))));
    const broken = player();

    await noUrl.speak("Frase uno");
    await blocked.speak("Frase uno");
    const speaking = broken.speak("Frase uno");
    await tick();
    broken.clips.made[0]?.events.onError();
    await speaking;

    expect(noUrl.clips.made).toHaveLength(0);
    for (const { wait } of [noUrl, blocked, broken])
      expect(wait).toHaveBeenCalledWith(readingTime("Frase uno"));
  });

  it("nunca reproduce un audio de fuera de la app", async () => {
    const { speak, clips, wait } = player(fakeClips(), async () => "https://otro.example/audio.mp3");

    await speak("Hola");

    expect(clips.made).toHaveLength(0);
    expect(wait).toHaveBeenCalledOnce();
  });

  it("al detenerla calla el audio y la frase termina de una vez", async () => {
    const { speak, stop, clips, wait } = player();

    const speaking = speak("Una frase larga que se corta.");
    await tick();
    stop();
    await speaking;
    stop();

    expect(clips.made[0]?.clip.pause).toHaveBeenCalledOnce();
    expect(wait).not.toHaveBeenCalled();
  });

  it("una frase nueva corta la anterior", async () => {
    const { speak, clips } = player();

    const first = speak("Primera");
    await tick();
    const second = speak("Segunda");
    await first;
    await tick();
    clips.made[1]?.events.onEnd();
    await second;

    expect(clips.made[0]?.clip.pause).toHaveBeenCalledOnce();
    expect(clips.made).toHaveLength(2);
  });

  it("el tiempo de lectura crece con la frase y tiene un tope", () => {
    expect(readingTime("Hola")).toBeLessThan(readingTime("Hola, ¿cómo estás?"));
    expect(readingTime("a".repeat(2000))).toBe(9000);
  });
});

describe("reproducir un audio suelto", () => {
  it("dice si sonó completo, si falló o si el navegador no lo dejó empezar", async () => {
    const fine = fakeClips();
    const failing = fakeClips();
    const blocked = fakeClips(async () => Promise.reject(new Error("NotAllowedError")));

    const played = playAudio("/audio/privacidad.mp3", fine.createClip);
    fine.made[0]?.events.onEnd();
    const failed = playAudio("/audio/no-existe.mp3", failing.createClip);
    failing.made[0]?.events.onError();

    expect(await played).toBe(true);
    expect(await failed).toBe(false);
    expect(await playAudio("/audio/privacidad.mp3", blocked.createClip)).toBe(false);
  });

  it("en el navegador usa un elemento de audio y escucha su final", async () => {
    const elements: Array<{ src: string; onended?: () => void; pause: () => void }> = [];
    class FakeAudio {
      onended?: () => void;
      onerror?: () => void;
      readonly pause = vi.fn();
      constructor(readonly src: string) {
        elements.push(this);
      }
      play = async () => undefined;
    }
    vi.stubGlobal("Audio", FakeAudio);
    const { speak, stop } = createSpeechPlayer({ audioUrlFor: async () => "/api/voice/audio/abc" });

    const played = playAudio("/audio/privacidad.mp3");
    elements[0]?.onended?.();
    const speaking = speak("Hola");
    await tick();
    stop();
    await speaking;

    expect(await played).toBe(true);
    expect(elements.map((element) => element.src)).toEqual(["/audio/privacidad.mp3", "/api/voice/audio/abc"]);
    expect(elements[1]?.pause).toHaveBeenCalledOnce();
  });

  it("sin audio, la espera por defecto usa el reloj del navegador", async () => {
    vi.useFakeTimers();
    const { speak } = createSpeechPlayer({ audioUrlFor: async () => "" });

    let done = false;
    void speak("Hola").then(() => (done = true));
    await vi.advanceTimersByTimeAsync(readingTime("Hola") - 1);
    const before = done;
    await vi.advanceTimersByTimeAsync(1);
    vi.useRealTimers();

    expect(before).toBe(false);
    expect(done).toBe(true);
  });
});
