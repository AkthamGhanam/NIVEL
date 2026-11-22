import type { AgentCallbacks, AgentSession, ConnectAgent } from "./nivi-session";

/**
 * Plan B: un "agente" que sigue un guion en vez de conversar. Encaja en el
 * mismo contrato que el agente de verdad (`ConnectAgent`), así la pantalla es
 * exactamente la misma. Cada turno de la persona avanza un paso: se pinta su
 * frase, la app ejecuta la acción real (crear la solicitud, invitar) y Nivi
 * responde con el resultado. No escucha el micrófono: lo que avanza el guion
 * es soltar el botón, enviar un texto o, en llamada, la pausa tras hablar Nivi.
 */

export interface ScriptStep {
  /** Lo que dice la persona en este turno. */
  readonly persona: string;
  /** La acción real de este turno; devuelve lo que Nivi responde. */
  readonly run: () => Promise<string>;
}

export interface Script {
  readonly opening: string;
  readonly steps: readonly ScriptStep[];
  /** Lo que Nivi dice si la persona sigue hablando cuando el guion ya terminó. */
  readonly closing: string;
}

export interface ScriptedAgentDeps {
  /** Un guion nuevo por conversación: si la persona cuelga y vuelve a llamar, empieza de cero. */
  readonly script: () => Script;
  /** Dice una frase de Nivi y termina cuando acaba de sonar. */
  readonly speak: (text: string) => Promise<void>;
  readonly stopSpeaking: () => void;
  /** En llamada (micrófono abierto): cuánto se espera a que la persona diga su parte. */
  readonly turnPauseMs?: number;
  readonly schedule?: (run: () => void, ms: number) => () => void;
}

export const TURN_PAUSE_MS = 5000;
export const STEP_FAILED = "No pude completar ese paso. Probemos de nuevo: repíteme lo que necesitas.";
export const PLAN_B_CONVERSATION = "plan-b";

const browserSchedule = (run: () => void, ms: number) => {
  const timer = setTimeout(run, ms);
  return () => clearTimeout(timer);
};

class ScriptedSession implements AgentSession {
  private next = 0;
  private busy = false;
  private ended = false;
  private micOpen = false;
  /** La persona abrió el micrófono después de la última frase de Nivi: al cerrarlo, es su turno. */
  private heard = false;
  private cancelPause: (() => void) | undefined;

  private readonly script: Script;

  constructor(
    private readonly deps: ScriptedAgentDeps,
    private readonly callbacks: AgentCallbacks,
  ) {
    this.script = deps.script();
  }

  /** El saludo sale un instante después de conectar: la pantalla ya está "en vivo". */
  readonly open = (): void => {
    this.busy = true;
    this.schedule(() => void this.say(this.script.opening), 0);
  };

  readonly conversationId = () => PLAN_B_CONVERSATION;

  readonly setMicMuted = (muted: boolean): void => {
    this.micOpen = !muted;
    if (!muted) {
      this.heard = !this.busy;
      return;
    }
    this.cancelPause?.();
    if (this.heard) void this.turn();
  };

  readonly sendText = (text: string): void => {
    void this.turn(text);
  };

  readonly end = async (): Promise<void> => {
    this.ended = true;
    this.cancelPause?.();
    this.deps.stopSpeaking();
  };

  /** Nivi habla; al terminar, en llamada, se da la pausa para el turno de la persona. */
  private async say(text: string): Promise<void> {
    if (this.ended) return;
    this.busy = true;
    this.callbacks.onMessage({ from: "nivi", text });
    this.callbacks.onSpeaking(true);
    await this.deps.speak(text);
    if (this.ended) return;
    this.callbacks.onSpeaking(false);
    this.busy = false;
    this.heard = false;
    if (this.micOpen) this.waitForPerson();
  }

  private get schedule() {
    return this.deps.schedule ?? browserSchedule;
  }

  private waitForPerson(): void {
    this.cancelPause?.();
    this.cancelPause = this.schedule(() => void this.turn(), this.deps.turnPauseMs ?? TURN_PAUSE_MS);
  }

  private async turn(typed?: string): Promise<void> {
    if (this.busy || this.ended) return;
    this.busy = true;
    this.cancelPause?.();
    const step = this.script.steps[this.next];
    // Lo escrito ya está en pantalla; lo hablado se pinta con la frase del guion.
    if (typed === undefined && step) this.callbacks.onMessage({ from: "persona", text: step.persona });
    if (!step) return this.say(this.script.closing);
    let reply: string;
    try {
      reply = await step.run();
      this.next += 1;
    } catch {
      reply = STEP_FAILED;
    }
    if (!this.ended) await this.say(reply);
  }
}

/** Crea el agente guionizado: "conecta" de inmediato y Nivi dice su saludo. */
export function createScriptedAgent(deps: ScriptedAgentDeps): ConnectAgent {
  return async ({ callbacks }) => {
    const session = new ScriptedSession(deps, callbacks);
    session.open();
    return session;
  };
}
