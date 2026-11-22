import { ApiError } from "./api";

/**
 * Conversación con Nivi, sin React y sin el SDK de voz: quién conecta con el
 * agente se inyecta (`ConnectAgent`), así la lógica se prueba con un agente
 * falso. Tres modos sobre la misma conversación: nota de voz (el micrófono
 * solo se abre mientras se mantiene presionado), llamada (manos libres) y texto.
 */

export type NiviMode = "nota" | "llamada" | "texto";
export const NIVI_MODES: readonly NiviMode[] = ["nota", "llamada", "texto"];
export const NIVI_MODE_LABELS: Readonly<Record<NiviMode, string>> = {
  nota: "Nota de voz",
  llamada: "Llamada",
  texto: "Texto",
};

export type VoiceAgent = "worker" | "contractor";
export type Speaker = "persona" | "nivi";

export interface TranscriptLine {
  readonly id: number;
  readonly from: Speaker;
  readonly text: string;
}

/** Lo que el agente le avisa a la pantalla mientras dura la conversación. */
export interface AgentCallbacks {
  readonly onMessage: (message: { readonly from: Speaker; readonly text: string }) => void;
  readonly onSpeaking: (speaking: boolean) => void;
  /** La conversación terminó; con `problem` si fue por una falla. */
  readonly onEnd: (problem?: string) => void;
}

export interface AgentSession {
  /** Id de la conversación en ElevenLabs: enlaza lo que guardan las herramientas con esta pantalla. */
  readonly conversationId: () => string;
  readonly setMicMuted: (muted: boolean) => void;
  readonly sendText: (text: string) => void;
  readonly end: () => Promise<void>;
}

export interface AgentConnection {
  readonly token: string;
  readonly dynamicVariables: Readonly<Record<string, string>>;
  /** Sin micrófono ni audio: solo mensajes escritos. */
  readonly textOnly: boolean;
  readonly callbacks: AgentCallbacks;
}

export type ConnectAgent = (connection: AgentConnection) => Promise<AgentSession>;

export interface VoiceToken {
  readonly token: string;
  readonly dynamicVariables: Readonly<Record<string, string>>;
}

export type NiviStatus = "idle" | "connecting" | "live";
/** En qué está Nivi; coincide con los estados del orbe. */
export type NiviActivity = "idle" | "listening" | "thinking" | "speaking";

export interface NiviState {
  readonly status: NiviStatus;
  readonly mode: NiviMode;
  readonly activity: NiviActivity;
  /** En modo nota de voz: el micrófono está abierto porque la persona mantiene presionado. */
  readonly talking: boolean;
  readonly lines: readonly TranscriptLine[];
  readonly error: string | null;
  readonly conversationId: string | null;
}

export interface NiviDeps {
  readonly fetchToken: () => Promise<VoiceToken>;
  readonly connect: ConnectAgent;
  readonly mode: NiviMode;
}

export interface NiviSession {
  readonly getState: () => NiviState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
  readonly setMode: (mode: NiviMode) => void;
  /** Modo nota de voz: abrir y cerrar el micrófono. */
  readonly hold: () => void;
  readonly release: () => void;
  readonly sendText: (text: string) => void;
}

export const MAX_MESSAGE_LENGTH = 500;
const MAX_LINES = 80;
const DENIED_ERRORS: readonly string[] = ["NotAllowedError", "SecurityError"];
const MESSAGES = {
  denied: "No tenemos permiso para usar el micrófono. Actívalo o cambia al modo texto.",
  failed: "No pudimos conectar con Nivi. Intenta de nuevo o cambia al modo texto.",
  dropped: "Se cortó la conversación con Nivi. Puedes empezar de nuevo.",
} as const;

function connectionProblem(error: unknown): string {
  // Los errores de nuestra API ya vienen en palabras para la persona; los del SDK de voz, no.
  if (error instanceof ApiError) return error.message;
  const name = error instanceof Error ? error.name : "";
  return DENIED_ERRORS.includes(name) ? MESSAGES.denied : MESSAGES.failed;
}

/** Con qué queda el micrófono al entrar a un modo: solo la llamada lo deja abierto. */
const mutedIn = (mode: NiviMode) => mode !== "llamada";
const restingActivity = (mode: NiviMode): NiviActivity => (mode === "llamada" ? "listening" : "idle");

const initialState = (mode: NiviMode): NiviState => ({
  status: "idle",
  mode,
  activity: "idle",
  talking: false,
  lines: [],
  error: null,
  conversationId: null,
});

class NiviController implements NiviSession {
  private state: NiviState;
  private session: AgentSession | undefined;
  private textOnly = false;
  /** Cada intento de conexión tiene su número: lo que llegue de uno viejo se ignora. */
  private attempt = 0;
  private nextLineId = 1;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly deps: NiviDeps) {
    this.state = initialState(deps.mode);
  }

  readonly getState = () => this.state;

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private update(changes: Partial<NiviState>): void {
    this.state = { ...this.state, ...changes };
    for (const listener of this.listeners) listener();
  }

  private addLine(from: Speaker, raw: string): void {
    const text = raw.trim();
    const last = this.state.lines.at(-1);
    // Un mensaje escrito ya se pintó al enviarlo: su eco no se repite.
    if (text === "" || (last?.from === from && last.text === text)) return;
    const line = { id: this.nextLineId++, from, text };
    this.update({ lines: [...this.state.lines, line].slice(-MAX_LINES) });
  }

  private callbacksFor(current: number): AgentCallbacks {
    const stale = () => current !== this.attempt;
    return {
      onMessage: ({ from, text }) => {
        if (stale()) return;
        this.addLine(from, text);
        if (from === "persona" && !this.state.talking) this.update({ activity: "thinking" });
      },
      onSpeaking: (speaking) => {
        if (stale() || this.state.talking) return;
        this.update({ activity: speaking ? "speaking" : restingActivity(this.state.mode) });
      },
      onEnd: (problem) => {
        if (stale()) return;
        this.session = undefined;
        const error = problem === undefined ? null : MESSAGES.dropped;
        this.update({ status: "idle", activity: "idle", talking: false, error });
      },
    };
  }

  readonly start = async (): Promise<void> => {
    if (this.state.status !== "idle") return;
    const current = ++this.attempt;
    const textOnly = this.state.mode === "texto";
    this.textOnly = textOnly;
    this.update({ status: "connecting", error: null, conversationId: null, activity: "thinking" });
    try {
      const token = await this.deps.fetchToken();
      const opened = await this.deps.connect({ ...token, textOnly, callbacks: this.callbacksFor(current) });
      // Si la persona canceló mientras conectaba, esta conversación se cierra sin usarse.
      if (current !== this.attempt) return void opened.end().catch(() => undefined);
      this.session = opened;
      if (!textOnly) opened.setMicMuted(mutedIn(this.state.mode));
      const activity = restingActivity(this.state.mode);
      this.update({ status: "live", activity, conversationId: opened.conversationId() });
    } catch (error) {
      if (current !== this.attempt) return;
      this.update({ status: "idle", activity: "idle", error: connectionProblem(error) });
    }
  };

  readonly stop = async (): Promise<void> => {
    this.attempt += 1;
    const open = this.session;
    this.session = undefined;
    this.update({ status: "idle", activity: "idle", talking: false });
    await open?.end().catch(() => undefined);
  };

  readonly setMode = (mode: NiviMode): void => {
    if (mode === this.state.mode) return;
    // Una conversación solo de texto no tiene micrófono: para hablar hay que abrir otra.
    const needsNewSession = this.session !== undefined && this.textOnly && mode !== "texto";
    if (needsNewSession) void this.stop();
    else if (!this.textOnly) this.session?.setMicMuted(mutedIn(mode));
    const live = this.session !== undefined;
    // Un aviso viejo ("cambia al modo texto") deja de tener sentido al cambiar de modo.
    this.update({ mode, talking: false, error: null, activity: live ? restingActivity(mode) : "idle" });
  };

  readonly hold = (): void => {
    if (!this.session || this.state.mode !== "nota" || this.state.talking) return;
    this.session.setMicMuted(false);
    this.update({ talking: true, activity: "listening" });
  };

  readonly release = (): void => {
    if (!this.session || !this.state.talking) return;
    this.session.setMicMuted(true);
    this.update({ talking: false, activity: "thinking" });
  };

  readonly sendText = (raw: string): void => {
    const text = raw.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!this.session || text === "") return;
    this.session.sendText(text);
    this.addLine("persona", text);
    this.update({ activity: "thinking" });
  };
}

export const createNiviSession = (deps: NiviDeps): NiviSession => new NiviController(deps);

const MODE_KEY = "nivel.nivi.modo";
type ModeStorage = Pick<Storage, "getItem" | "setItem">;

const browserStorage = (): ModeStorage | undefined => {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    // Navegación privada o almacenamiento bloqueado: el modo simplemente no se recuerda.
    return undefined;
  }
};

/** Dónde se recuerda el modo: el trabajador y la empresa eligen cada uno el suyo. */
export interface ModeMemory {
  readonly agent: VoiceAgent;
  readonly storage?: ModeStorage | undefined;
}

const storageOf = (memory: ModeMemory) => ("storage" in memory ? memory.storage : browserStorage());

/** El modo que la persona eligió la última vez en este teléfono, o el de la pantalla. */
export function rememberedMode(memory: ModeMemory, fallback: NiviMode): NiviMode {
  try {
    const saved = storageOf(memory)?.getItem(`${MODE_KEY}.${memory.agent}`);
    return NIVI_MODES.find((mode) => mode === saved) ?? fallback;
  } catch {
    return fallback;
  }
}

export function rememberMode(memory: ModeMemory, mode: NiviMode): void {
  try {
    storageOf(memory)?.setItem(`${MODE_KEY}.${memory.agent}`, mode);
  } catch {
    // Sin almacenamiento, el modo vale solo para esta visita.
  }
}
