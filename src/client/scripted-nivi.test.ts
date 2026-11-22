import { describe, expect, it, vi } from "vitest";

import {
  createScriptedNivi,
  type Script,
  type ScriptedNivi,
  STEP_FAILED,
  TURN_PAUSE_MS,
} from "./scripted-nivi";

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Una voz que "suena" hasta que la prueba la deja terminar. */
function voice() {
  const pending: Array<() => void> = [];
  const said: string[] = [];
  return {
    said,
    speak: vi.fn((text: string) => {
      said.push(text);
      return new Promise<void>((resolve) => pending.push(resolve));
    }),
    stopSpeaking: vi.fn(),
    finish: async () => {
      pending.shift()?.();
      await flush();
    },
  };
}

/** Un reloj a mano: la pausa del turno corre solo cuando la prueba lo dice. */
function clock() {
  const timers: Array<{ run: () => void; ms: number; cancelled: boolean }> = [];
  return {
    timers,
    schedule: (run: () => void, ms: number) => {
      const timer = { run, ms, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
    tick: async () => {
      const timer = timers.shift();
      if (timer && !timer.cancelled) timer.run();
      await flush();
    },
  };
}

function setup(overrides: Partial<Script> = {}) {
  const runs = [vi.fn(async () => "Hay 4 soldadores. ¿Invito?"), vi.fn(async () => "Invité a tres.")];
  const script: Script = {
    opening: "Hola, soy Nivi.",
    closing: "Listo por ahora.",
    steps: [
      { persona: "Necesito 3 soldadores.", run: runs[0]! },
      { persona: "Sí, invítalos.", run: runs[1]! },
    ],
    ...overrides,
  };
  const sound = voice();
  const time = clock();
  const newScript = vi.fn(() => script);
  const nivi = createScriptedNivi({
    script: newScript,
    speak: sound.speak,
    stopSpeaking: sound.stopSpeaking,
    schedule: time.schedule,
  });
  return { nivi, runs, sound, time, newScript };
}

const lines = (nivi: ScriptedNivi) => nivi.getState().bubbles.map(({ from, text }) => `${from}: ${text}`);

describe("conversación guionizada del plan B", () => {
  it("antes de empezar no hay nada en vivo ni escrito", () => {
    const { nivi } = setup();

    expect(nivi.getState()).toEqual({
      mode: "voz",
      live: false,
      ended: false,
      activity: "idle",
      bubbles: [],
    });
  });

  it("al empezar hablando, Nivi saluda con su voz y el texto al lado", async () => {
    const { nivi, sound } = setup();
    const listener = vi.fn();
    nivi.subscribe(listener);

    nivi.start("voz");

    expect(nivi.getState()).toMatchObject({ live: true, mode: "voz", activity: "speaking" });
    expect(lines(nivi)).toEqual(["nivi: Hola, soy Nivi."]);
    expect(sound.said).toEqual(["Hola, soy Nivi."]);
    expect(listener).toHaveBeenCalled();
    await sound.finish();
    expect(nivi.getState().activity).toBe("listening");
  });

  it("hablando, tras cada frase de Nivi espera el turno de la persona y sigue solo con el guion", async () => {
    const { nivi, sound, time, runs } = setup();
    nivi.start("voz");
    await sound.finish();

    expect(time.timers.map((timer) => timer.ms)).toEqual([TURN_PAUSE_MS]);
    await time.tick();

    expect(runs[0]).toHaveBeenCalledOnce();
    expect(lines(nivi)).toEqual([
      "nivi: Hola, soy Nivi.",
      "tu: Necesito 3 soldadores.",
      "nivi: Hay 4 soldadores. ¿Invito?",
    ]);
    await sound.finish();
    await time.tick();
    await sound.finish();

    expect(runs[1]).toHaveBeenCalledOnce();
    expect(lines(nivi).at(-1)).toBe("nivi: Invité a tres.");
    expect(time.timers).toHaveLength(0);
  });

  it("mientras corre la acción real, Nivi está pensando", async () => {
    let release: (reply: string) => void = () => undefined;
    const run = vi.fn(() => new Promise<string>((resolve) => (release = resolve)));
    const { nivi, sound } = setup({ steps: [{ persona: "Necesito gente.", run }] });
    nivi.start("voz");
    await sound.finish();

    nivi.send("Necesito gente.");
    await flush();

    expect(nivi.getState().activity).toBe("thinking");
    release("Listo.");
    await flush();
    expect(nivi.getState().activity).toBe("speaking");
  });

  it("un mensaje escrito avanza el guion con lo que la persona escribió y cancela la espera", async () => {
    const { nivi, sound, time, runs } = setup();
    nivi.start("voz");
    await sound.finish();

    nivi.send("  Quiero soldadores  ");
    await flush();

    expect(lines(nivi)[1]).toBe("tu: Quiero soldadores");
    expect(runs[0]).toHaveBeenCalledOnce();
    expect(time.timers[0]?.cancelled).toBe(true);
  });

  it("un texto enviado mientras Nivi habla la interrumpe y toma el turno", async () => {
    const { nivi, sound, time, runs } = setup();
    nivi.start("voz");

    nivi.send("Necesito gente");
    await flush();

    expect(sound.stopSpeaking).toHaveBeenCalledOnce();
    expect(runs[0]).toHaveBeenCalledOnce();
    expect(lines(nivi)).toEqual([
      "nivi: Hola, soy Nivi.",
      "tu: Necesito gente",
      "nivi: Hay 4 soldadores. ¿Invito?",
    ]);
    await sound.finish();
    expect(nivi.getState().activity).toBe("speaking");
    expect(time.timers).toHaveLength(0);
    await sound.finish();
    expect(nivi.getState().activity).toBe("listening");
    expect(time.timers).toHaveLength(1);
  });

  it("un texto vacío, o enviado mientras corre la acción, no adelanta el guion", async () => {
    let release: (reply: string) => void = () => undefined;
    const run = vi.fn(() => new Promise<string>((resolve) => (release = resolve)));
    const { nivi, sound } = setup({ steps: [{ persona: "Necesito gente.", run }] });
    nivi.start("voz");
    await sound.finish();

    nivi.send("   ");
    await flush();
    expect(run).not.toHaveBeenCalled();

    nivi.send("Necesito gente");
    await flush();
    nivi.send("¿Me oyes?");
    await flush();
    expect(run).toHaveBeenCalledOnce();
    expect(lines(nivi)).toHaveLength(2);
    release("Listo.");
    await flush();
  });

  it("escribiendo no suena nada ni avanza solo: cada mensaje es un turno", async () => {
    const { nivi, sound, time, runs } = setup();

    nivi.start("texto");
    await flush();

    expect(nivi.getState()).toMatchObject({ mode: "texto", activity: "listening" });
    expect(sound.speak).not.toHaveBeenCalled();
    expect(time.timers).toHaveLength(0);
    nivi.send("Necesito soldadores");
    await flush();
    expect(runs[0]).toHaveBeenCalledOnce();
    expect(lines(nivi).at(-1)).toBe("nivi: Hay 4 soldadores. ¿Invito?");
  });

  it("si un paso falla, Nivi pide repetir y el mismo paso se intenta otra vez", async () => {
    const run = vi.fn(async () => "Listo.");
    run.mockRejectedValueOnce(new Error("sin red"));
    const { nivi } = setup({ steps: [{ persona: "Necesito gente.", run }] });
    nivi.start("texto");
    await flush();

    nivi.send("Necesito gente");
    await flush();
    expect(lines(nivi).at(-1)).toBe(`nivi: ${STEP_FAILED}`);

    nivi.send("Necesito gente");
    await flush();
    expect(run).toHaveBeenCalledTimes(2);
    expect(lines(nivi).at(-1)).toBe("nivi: Listo.");
  });

  it("cuando el guion se acaba, Nivi cierra con la misma frase las veces que haga falta", async () => {
    const { nivi } = setup({ steps: [] });
    nivi.start("texto");
    await flush();

    nivi.send("¿Algo más?");
    await flush();
    nivi.send("¿Seguro?");
    await flush();

    expect(lines(nivi).slice(1)).toEqual([
      "tu: ¿Algo más?",
      "nivi: Listo por ahora.",
      "tu: ¿Seguro?",
      "nivi: Listo por ahora.",
    ]);
  });

  it("al terminar calla a Nivi y nada de lo pendiente llega a la pantalla", async () => {
    let release: (reply: string) => void = () => undefined;
    const run = vi.fn(() => new Promise<string>((resolve) => (release = resolve)));
    const { nivi, sound, time } = setup({ steps: [{ persona: "Necesito gente.", run }] });
    nivi.start("voz");
    await sound.finish();
    await time.tick();

    nivi.stop();
    release("Listo.");
    await flush();

    expect(sound.stopSpeaking).toHaveBeenCalledOnce();
    expect(nivi.getState()).toMatchObject({ live: false, ended: true, activity: "idle" });
    expect(lines(nivi)).toEqual(["nivi: Hola, soy Nivi.", "tu: Necesito gente."]);
    nivi.send("¿Sigues ahí?");
    nivi.stop();
    await flush();
    expect(lines(nivi)).toHaveLength(2);
    expect(sound.stopSpeaking).toHaveBeenCalledOnce();
  });

  it("si terminan mientras suena el saludo, la conversación no sigue", async () => {
    const { nivi, sound, time } = setup();
    nivi.start("voz");

    nivi.stop();
    await sound.finish();

    expect(time.timers).toHaveLength(0);
    expect(nivi.getState().activity).toBe("idle");
  });

  it("cada conversación empieza con un guion nuevo y la pantalla limpia", async () => {
    const { nivi, sound, newScript } = setup();
    nivi.start("voz");
    await sound.finish();
    nivi.send("Necesito soldadores");
    await flush();

    nivi.start("texto");
    await flush();

    expect(newScript).toHaveBeenCalledTimes(2);
    expect(sound.stopSpeaking).toHaveBeenCalledOnce();
    expect(lines(nivi)).toEqual(["nivi: Hola, soy Nivi."]);
    expect(nivi.getState()).toMatchObject({ live: true, ended: false, mode: "texto" });
  });

  it("quien deja de escuchar ya no recibe avisos", () => {
    const { nivi } = setup();
    const listener = vi.fn();
    const unsubscribe = nivi.subscribe(listener);

    unsubscribe();
    nivi.start("texto");

    expect(listener).not.toHaveBeenCalled();
  });

  it("sin reloj inyectado usa el del navegador para la espera del turno", async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => "Listo.");
    const nivi = createScriptedNivi({
      script: () => ({ opening: "Hola.", closing: "Chao.", steps: [{ persona: "Necesito gente.", run }] }),
      speak: async () => undefined,
      stopSpeaking: () => undefined,
      turnPauseMs: 20,
    });

    nivi.start("voz");
    await vi.advanceTimersByTimeAsync(25);

    expect(run).toHaveBeenCalledOnce();
    nivi.stop();
    vi.useRealTimers();
  });
});
