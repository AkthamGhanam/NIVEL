// Plan B: una conversación con Nivi que sigue un guion, sin React y sin el agente en vivo.

/**
 * Cada turno de la persona avanza un paso: se pinta su frase, la app ejecuta la
 * acción real (crear la solicitud, invitar) y Nivi responde con el resultado.
 * No escucha el micrófono: el guion avanza al enviar un texto o, hablando,
 * tras la pausa que sigue a cada frase de Nivi. Un texto enviado mientras Nivi
 * habla la interrumpe, como en una conversación de verdad.
 */

export interface ScriptStep {
  readonly persona: string;
  readonly run: () => Promise<string>;
}

export interface Script {
  readonly opening: string;
  readonly steps: readonly ScriptStep[];
  readonly closing: string;
}

export type ScriptedMode = "voz" | "texto";
export type ScriptedActivity = "idle" | "listening" | "thinking" | "speaking";

export interface ScriptedBubble {
  readonly id: string;
  readonly from: "nivi" | "tu";
  readonly text: string;
}

export interface ScriptedState {
  readonly mode: ScriptedMode;
  readonly live: boolean;
  readonly ended: boolean;
  readonly activity: ScriptedActivity;
  readonly bubbles: readonly ScriptedBubble[];
}

export interface ScriptedNiviDeps {
  readonly script: () => Script;
  readonly speak: (text: string) => Promise<void>;
  readonly stopSpeaking: () => void;
  readonly turnPauseMs?: number;
  readonly schedule?: (run: () => void, ms: number) => () => void;
}

export interface ScriptedNivi {
  readonly getState: () => ScriptedState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly start: (mode: ScriptedMode) => void;
  readonly send: (text: string) => void;
  readonly stop: () => void;
}

export const TURN_PAUSE_MS = 5000;
export const STEP_FAILED = "No pude completar ese paso. Probemos de nuevo: repíteme lo que necesitas.";

const IDLE: ScriptedState = Object.freeze({
  mode: "voz",
  live: false,
  ended: false,
  activity: "idle",
  bubbles: [],
});

const browserSchedule = (run: () => void, ms: number) => {
  const timer = setTimeout(run, ms);
  return () => clearTimeout(timer);
};

interface ConversationSetup {
  readonly deps: ScriptedNiviDeps;
  readonly mode: ScriptedMode;
  readonly publish: (change: (state: ScriptedState) => ScriptedState) => void;
}

class Conversation {
  private next = 0;
  private busy = true;
  private over = false;
  private utterance = 0;
  private sounding = false;
  private cancelPause: (() => void) | undefined;
  private readonly script: Script;
  private readonly deps: ScriptedNiviDeps;
  private readonly mode: ScriptedMode;
  private readonly publish: ConversationSetup["publish"];

  constructor({ deps, mode, publish }: ConversationSetup) {
    this.deps = deps;
    this.mode = mode;
    this.publish = publish;
    this.script = deps.script();
  }

  open(): void {
    void this.say(this.script.opening);
  }

  end(): void {
    this.over = true;
    this.cancelPause?.();
    this.deps.stopSpeaking();
  }

  async turn(typed?: string): Promise<void> {
    if (typed !== undefined && this.sounding) this.interrupt();
    if (this.busy || this.over) return;
    this.busy = true;
    this.cancelPause?.();
    const step = this.script.steps[this.next];
    const said = typed ?? step?.persona;
    if (said) this.bubble("tu", said);
    if (!step) return this.say(this.script.closing);
    this.publish((state) => ({ ...state, activity: "thinking" }));
    let reply: string;
    try {
      reply = await step.run();
      this.next += 1;
    } catch {
      reply = STEP_FAILED;
    }
    await this.say(reply);
  }

  private interrupt(): void {
    this.utterance += 1;
    this.sounding = false;
    this.busy = false;
    this.deps.stopSpeaking();
  }

  private bubble(from: ScriptedBubble["from"], text: string): void {
    this.publish((state) => ({
      ...state,
      bubbles: [...state.bubbles, { id: `${state.bubbles.length}-${from}`, from, text }],
    }));
  }

  private async say(text: string): Promise<void> {
    if (this.over) return;
    this.bubble("nivi", text);
    if (this.mode === "voz") {
      const mine = (this.utterance += 1);
      this.sounding = true;
      this.publish((state) => ({ ...state, activity: "speaking" }));
      await this.deps.speak(text);
      if (this.over || mine !== this.utterance) return;
      this.sounding = false;
    }
    this.publish((state) => ({ ...state, activity: "listening" }));
    this.busy = false;
    if (this.mode === "voz" && this.next < this.script.steps.length) this.waitForPerson();
  }

  private waitForPerson(): void {
    const schedule = this.deps.schedule ?? browserSchedule;
    this.cancelPause = schedule(() => void this.turn(), this.deps.turnPauseMs ?? TURN_PAUSE_MS);
  }
}

export function createScriptedNivi(deps: ScriptedNiviDeps): ScriptedNivi {
  let state = IDLE;
  let current: Conversation | undefined;
  const listeners = new Set<() => void>();
  const set = (next: ScriptedState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  const stop = () => {
    if (!current) return;
    current.end();
    current = undefined;
    set({ ...state, live: false, ended: true, activity: "idle" });
  };
  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    start: (mode) => {
      current?.end();
      set({ ...IDLE, mode, live: true });
      const conversation: Conversation = new Conversation({
        deps,
        mode,
        publish: (change) => {
          if (current === conversation) set(change(state));
        },
      });
      current = conversation;
      conversation.open();
    },
    send: (text) => {
      if (text.trim()) void current?.turn(text.trim());
    },
    stop,
  };
}
