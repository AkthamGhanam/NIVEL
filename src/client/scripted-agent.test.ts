import { describe, expect, it, vi } from "vitest";

import type { AgentCallbacks } from "./nivi-session";
import {
  createScriptedAgent,
  PLAN_B_CONVERSATION,
  type Script,
  type ScriptedAgentDeps,
  STEP_FAILED,
  TURN_PAUSE_MS,
} from "./scripted-agent";

const TOKEN = { token: "plan-b", dynamicVariables: {} };

/** Reloj falso: guarda lo agendado y la prueba decide cuándo corre. */
function fakeClock() {
  const pending: Array<{ run: () => void; ms: number; cancelled: boolean }> = [];
  const schedule: NonNullable<ScriptedAgentDeps["schedule"]> = (run, ms) => {
    const entry = { run, ms, cancelled: false };
    pending.push(entry);
    return () => {
      entry.cancelled = true;
    };
  };
  /** Corre lo agendado con esa espera que no se haya cancelado. */
  const fire = (ms: number) => {
    const due = pending.filter((entry) => entry.ms === ms && !entry.cancelled);
    for (const entry of due) {
      entry.cancelled = true;
      entry.run();
    }
    return due.length;
  };
  return { schedule, fire };
}

const settle = async () => {
  for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
};

function script(changes: Partial<Script> = {}): Script {
  return {
    opening: "Hola, soy Nivi.",
    closing: "Eso es todo por ahora.",
    steps: [
      { persona: "Necesito 3 soldadores.", run: async () => "Encontré 4. ¿Los invito?" },
      { persona: "Sí, invítalos.", run: async () => "Invité a 3." },
    ],
    ...changes,
  };
}

interface Options {
  readonly script?: () => Script;
  /** Con `true`, cada frase de Nivi queda sonando hasta que la prueba la termina. */
  readonly holdSpeech?: boolean;
}

async function connect({ script: build = script, holdSpeech = false }: Options = {}) {
  const clock = fakeClock();
  const said: string[] = [];
  const finishSpeech: Array<() => void> = [];
  const speak = vi.fn((text: string) => {
    said.push(text);
    return holdSpeech ? new Promise<void>((resolve) => finishSpeech.push(resolve)) : Promise.resolve();
  });
  const stopSpeaking = vi.fn();
  const heard: string[] = [];
  const speaking: boolean[] = [];
  const callbacks: AgentCallbacks = {
    onMessage: ({ from, text }) => heard.push(`${from}: ${text}`),
    onSpeaking: (value) => speaking.push(value),
    onEnd: vi.fn(),
  };
  const agent = createScriptedAgent({ script: build, speak, stopSpeaking, schedule: clock.schedule });
  const session = await agent({ ...TOKEN, textOnly: false, callbacks });
  /** Mantener presionado y soltar: el turno de la persona en modo nota de voz. */
  const pressAndRelease = async () => {
    session.setMicMuted(false);
    session.setMicMuted(true);
    await settle();
  };
  return { session, clock, said, heard, speaking, speak, stopSpeaking, finishSpeech, pressAndRelease };
}

async function opened(options?: Options) {
  const call = await connect(options);
  call.session.setMicMuted(true);
  call.clock.fire(0);
  await settle();
  return call;
}

describe("agente guionizado del plan B", () => {
  it("conecta sin red y Nivi saluda apenas la pantalla queda en vivo", async () => {
    const { session, clock, heard, speaking } = await connect();

    expect(session.conversationId()).toBe(PLAN_B_CONVERSATION);
    expect(heard).toEqual([]);
    clock.fire(0);
    await settle();

    expect(heard).toEqual(["nivi: Hola, soy Nivi."]);
    expect(speaking).toEqual([true, false]);
  });

  it("en nota de voz, al soltar el botón se pinta la frase del guion y corre la acción real", async () => {
    const run = vi.fn(async () => "Encontré 4. ¿Los invito?");
    const steps = [{ persona: "Necesito 3 soldadores.", run }];
    const { heard, pressAndRelease } = await opened({ script: () => script({ steps }) });

    await pressAndRelease();

    expect(run).toHaveBeenCalledOnce();
    expect(heard.slice(1)).toEqual(["persona: Necesito 3 soldadores.", "nivi: Encontré 4. ¿Los invito?"]);
  });

  it("silenciar el micrófono sin haberlo abierto no cuenta como un turno", async () => {
    const { session, heard } = await opened();

    session.setMicMuted(true);
    await settle();

    expect(heard).toHaveLength(1);
  });

  it("lo que la persona suelta mientras Nivi todavía habla no adelanta el guion", async () => {
    const { clock, heard, finishSpeech, pressAndRelease } = await connect({ holdSpeech: true });
    clock.fire(0);
    await settle();

    await pressAndRelease();
    finishSpeech[0]?.();
    await settle();
    await pressAndRelease();

    expect(heard).toEqual([
      "nivi: Hola, soy Nivi.",
      "persona: Necesito 3 soldadores.",
      "nivi: Encontré 4. ¿Los invito?",
    ]);
  });

  it("en llamada, tras cada frase de Nivi espera el turno de la persona y sigue solo", async () => {
    const { session, clock, heard } = await connect();
    session.setMicMuted(false);
    clock.fire(0);
    await settle();

    expect(clock.fire(TURN_PAUSE_MS)).toBe(1);
    await settle();
    expect(clock.fire(TURN_PAUSE_MS)).toBe(1);
    await settle();

    expect(heard).toEqual([
      "nivi: Hola, soy Nivi.",
      "persona: Necesito 3 soldadores.",
      "nivi: Encontré 4. ¿Los invito?",
      "persona: Sí, invítalos.",
      "nivi: Invité a 3.",
    ]);
  });

  it("si en llamada la persona silencia el micrófono, la espera se cancela", async () => {
    const { session, clock, heard } = await connect();
    session.setMicMuted(false);
    clock.fire(0);
    await settle();

    session.setMicMuted(true);
    await settle();

    expect(clock.fire(TURN_PAUSE_MS)).toBe(0);
    expect(heard).toHaveLength(1);
  });

  it("un mensaje escrito avanza el guion sin repetir la frase de la persona", async () => {
    const { session, heard } = await opened();

    session.sendText("necesito soldadores");
    await settle();

    expect(heard.slice(1)).toEqual(["nivi: Encontré 4. ¿Los invito?"]);
  });

  it("si un paso falla, Nivi pide repetir y el mismo paso se intenta otra vez", async () => {
    const run = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error("sin red"));
    run.mockResolvedValueOnce("Listo.");
    const steps = [{ persona: "Necesito 3 soldadores.", run }];
    const { heard, pressAndRelease } = await opened({ script: () => script({ steps }) });

    await pressAndRelease();
    await pressAndRelease();

    expect(heard.slice(1)).toEqual([
      "persona: Necesito 3 soldadores.",
      `nivi: ${STEP_FAILED}`,
      "persona: Necesito 3 soldadores.",
      "nivi: Listo.",
    ]);
  });

  it("cuando el guion se acaba, Nivi cierra con la misma frase las veces que haga falta", async () => {
    const { heard, pressAndRelease } = await opened({ script: () => script({ steps: [] }) });

    await pressAndRelease();
    await pressAndRelease();

    expect(heard.slice(1)).toEqual(["nivi: Eso es todo por ahora.", "nivi: Eso es todo por ahora."]);
  });

  it("al colgar calla a Nivi y nada de lo pendiente llega a la pantalla", async () => {
    let finishStep: (reply: string) => void = () => undefined;
    const steps = [
      {
        persona: "Necesito 3 soldadores.",
        run: () => new Promise<string>((resolve) => (finishStep = resolve)),
      },
    ];
    const { session, heard, stopSpeaking, pressAndRelease } = await opened({
      script: () => script({ steps }),
    });

    await pressAndRelease();
    await session.end();
    finishStep("Encontré 4.");
    await settle();
    session.sendText("hola");
    await settle();

    expect(stopSpeaking).toHaveBeenCalledOnce();
    expect(heard).toEqual(["nivi: Hola, soy Nivi.", "persona: Necesito 3 soldadores."]);
  });

  it("si cuelgan antes del saludo o mientras suena, la conversación no sigue", async () => {
    const early = await connect();
    await early.session.end();
    early.clock.fire(0);
    await settle();

    const during = await connect({ holdSpeech: true });
    during.session.setMicMuted(false);
    during.clock.fire(0);
    await settle();
    await during.session.end();
    during.finishSpeech[0]?.();
    await settle();

    expect(early.heard).toEqual([]);
    expect(during.speaking).toEqual([true]);
    expect(during.clock.fire(TURN_PAUSE_MS)).toBe(0);
  });

  it("cada conversación empieza con un guion nuevo", async () => {
    const build = vi.fn(script);
    const agent = createScriptedAgent({
      script: build,
      speak: async () => undefined,
      stopSpeaking: () => undefined,
    });
    const callbacks: AgentCallbacks = {
      onMessage: () => undefined,
      onSpeaking: () => undefined,
      onEnd: () => undefined,
    };

    const first = await agent({ ...TOKEN, textOnly: true, callbacks });
    const second = await agent({ ...TOKEN, textOnly: true, callbacks });
    await first.end();
    await second.end();

    expect(build).toHaveBeenCalledTimes(2);
  });

  it("sin reloj inyectado usa el del navegador para el saludo y la espera", async () => {
    vi.useFakeTimers();
    const heard: string[] = [];
    const callbacks: AgentCallbacks = {
      onMessage: ({ from, text }) => heard.push(`${from}: ${text}`),
      onSpeaking: () => undefined,
      onEnd: () => undefined,
    };
    const agent = createScriptedAgent({
      script,
      speak: async () => undefined,
      stopSpeaking: () => undefined,
      turnPauseMs: 50,
    });
    const session = await agent({ ...TOKEN, textOnly: false, callbacks });
    session.setMicMuted(false);

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(50);
    session.setMicMuted(true);
    await vi.advanceTimersByTimeAsync(500);
    vi.useRealTimers();

    expect(heard).toEqual([
      "nivi: Hola, soy Nivi.",
      "persona: Necesito 3 soldadores.",
      "nivi: Encontré 4. ¿Los invito?",
    ]);
  });
});
