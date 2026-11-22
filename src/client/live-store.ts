/**
 * Dato que se mantiene al día consultando al servidor cada cierto tiempo.
 * No depende de React: se conecta con `useSyncExternalStore`. Consulta solo
 * mientras alguien lo mira, nunca solapa dos peticiones y no avisa si lo que
 * llegó es igual a lo que ya se mostraba (la pantalla no parpadea).
 */

export interface LiveState<T> {
  readonly data: T | undefined;
  /** Error de la última consulta. Se limpia cuando una consulta posterior funciona. */
  readonly error: unknown;
  readonly loading: boolean;
}

export interface LiveStore<T> {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => LiveState<T>;
  /** Consulta ya, sin esperar el próximo turno: después de una acción de la persona. */
  readonly refresh: () => Promise<void>;
}

export interface Timers {
  readonly set: (callback: () => void, delayMs: number) => unknown;
  readonly clear: (handle: unknown) => void;
}

export interface LiveOptions {
  /** Cada cuánto se vuelve a consultar. Sin valor, se consulta una sola vez. */
  readonly intervalMs?: number;
  /** Las pruebas inyectan un reloj falso. */
  readonly timers?: Timers;
}

const BROWSER_TIMERS: Timers = {
  set: (callback, delayMs) => setTimeout(callback, delayMs),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

const sameData = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function createLiveStore<T>(
  load: (signal: AbortSignal) => Promise<T>,
  options: LiveOptions = {},
): LiveStore<T> {
  const timers = options.timers ?? BROWSER_TIMERS;
  const listeners = new Set<() => void>();
  let state: LiveState<T> = { data: undefined, error: undefined, loading: true };
  let timer: unknown;
  let inFlight: AbortController | undefined;
  // Cada consulta toma un turno; si llega otra o se deja de mirar, su respuesta se descarta.
  let turn = 0;

  const publish = (next: LiveState<T>) => {
    const unchanged = !state.loading && next.error === state.error && sameData(next.data, state.data);
    if (unchanged) return;
    state = next;
    for (const listener of listeners) listener();
  };

  const scheduleNext = () => {
    if (options.intervalMs === undefined || listeners.size === 0) return;
    timer = timers.set(() => void run(), options.intervalMs);
  };

  async function run(): Promise<void> {
    timers.clear(timer);
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;
    const mine = ++turn;
    try {
      const data = await load(controller.signal);
      if (mine !== turn) return;
      publish({ data, error: undefined, loading: false });
    } catch (error) {
      if (mine !== turn) return;
      // Se conserva lo último que se vio: un fallo de red no vacía la pantalla.
      publish({ data: state.data, error, loading: false });
    }
    scheduleNext();
  }

  const stop = () => {
    turn += 1;
    timers.clear(timer);
    inFlight?.abort();
    inFlight = undefined;
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) void run();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    },
    getSnapshot: () => state,
    refresh: run,
  };
}
