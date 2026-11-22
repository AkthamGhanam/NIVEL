import { describe, expect, it, vi } from "vitest";

import { CLIPS } from "../../scripts/voice/catalog";
import { CARLOS_LEVEL_UP_URL, createCelebration, levelUpSpeech, SOUNDS } from "./level-up";
import type { ClipEvents } from "./speech-player";

const CARLOS = levelUpSpeech({ firstName: "Carlos", level: 3, levelName: "Probado" });

/** Audios falsos que terminan de sonar al instante, salvo los que se indiquen como rotos. */
function clips(broken: readonly string[] = []) {
  const played: string[] = [];
  const paused: string[] = [];
  const createClip = (url: string, events: ClipEvents) => ({
    play: async () => {
      played.push(url);
      if (broken.includes(url)) events.onError();
      else events.onEnd();
    },
    pause: () => void paused.push(url),
  });
  return { played, paused, createClip };
}

describe("celebración al subir de nivel", () => {
  it("la felicitación dice el nombre, el nivel nuevo y qué cambia", () => {
    expect(levelUpSpeech({ firstName: "Rosa", level: 4, levelName: "Experta" })).toBe(
      "¡Felicidades, Rosa! Ya eres Nivel 4: Experta. Ahora apareces en búsquedas de nivel 4 o más.",
    );
  });

  it("la de Carlos es, palabra por palabra, el audio pregenerado del camino dorado", () => {
    const clip = CLIPS.find((candidate) => candidate.url === CARLOS_LEVEL_UP_URL);

    expect(clip).toMatchObject({ kind: "speech", text: CARLOS });
  });

  it("los efectos de sonido son los que genera el script de audio", () => {
    const generated = CLIPS.filter((clip) => clip.kind === "sound").map((clip) => clip.url);

    expect(Object.values(SOUNDS).sort()).toEqual(generated.sort());
  });

  it("suena el efecto y luego el audio pregenerado, sin pedir voz al servidor", async () => {
    const speak = vi.fn(async () => "/api/voice/audio/abc");
    const { played, createClip } = clips();

    await createCelebration({ speak, createClip }).play(CARLOS);

    expect(played).toEqual([SOUNDS.levelUp, CARLOS_LEVEL_UP_URL]);
    expect(speak).not.toHaveBeenCalled();
  });

  it("para otra persona pide la frase al servidor; si falta el efecto, la voz suena igual", async () => {
    const speak = vi.fn(async () => "/api/voice/audio/abc");
    const { played, createClip } = clips([SOUNDS.levelUp]);
    const text = levelUpSpeech({ firstName: "Rosa", level: 2, levelName: "Verificada" });

    await createCelebration({ speak, createClip }).play(text);

    expect(speak).toHaveBeenCalledWith(text);
    expect(played).toEqual([SOUNDS.levelUp, "/api/voice/audio/abc"]);
  });

  it("si la voz no está disponible no falla ni se queda esperando", async () => {
    const speak = vi.fn(async () => Promise.reject(new Error("sin voz")));
    const { played, createClip } = clips();

    await createCelebration({ speak, createClip }).play("¡Felicidades, Rosa!");

    expect(played).toEqual([SOUNDS.levelUp]);
  });

  it("al salir de la pantalla se calla: la voz no empieza después del efecto", async () => {
    let endSound: () => void = () => undefined;
    const played: string[] = [];
    const createClip = (url: string, events: ClipEvents) => ({
      play: async () => {
        played.push(url);
        if (url === SOUNDS.levelUp) endSound = events.onEnd;
        else events.onEnd();
      },
      pause: () => undefined,
    });
    const celebration = createCelebration({ speak: async () => "/api/voice/audio/abc", createClip });

    const playing = celebration.play(CARLOS);
    await Promise.resolve();
    celebration.stop();
    endSound();
    await playing;

    expect(played).toEqual([SOUNDS.levelUp]);
  });

  it("sin audios inyectados usa los del navegador", async () => {
    const sources: string[] = [];
    class FakeAudio {
      onended?: () => void;
      constructor(readonly src: string) {
        sources.push(src);
      }
      play = async () => this.onended?.();
      pause = () => undefined;
    }
    vi.stubGlobal("Audio", FakeAudio);

    await createCelebration({ speak: async () => "/api/voice/audio/abc" }).play(CARLOS);
    vi.unstubAllGlobals();

    expect(sources).toEqual([SOUNDS.levelUp, CARLOS_LEVEL_UP_URL]);
  });
});
