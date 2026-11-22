import { describe, expect, it, vi } from "vitest";

import { createLiveStore, type Timers } from "./live-store";

/** Reloj manual: las pruebas deciden cuándo "pasa" el intervalo. */
function manualTimers() {
  const pending = new Map<number, () => void>();
  let next = 1;
  const timers: Timers = {
    set: (callback) => {
      pending.set(next, callback);
      return next++;
    },
    clear: (handle) => void pending.delete(handle as number),
  };
  const tick = () => {
    const callbacks = [...pending.values()];
    pending.clear();
    for (const callback of callbacks) callback();
  };
  return { timers, tick, waiting: () => pending.size };
}

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("dato en vivo", () => {
  it("empieza cargando, consulta al primer suscriptor y avisa cuando llega el dato", async () => {
    const load = vi.fn(async () => ({ accepted: 1 }));
    const store = createLiveStore(load);
    const listener = vi.fn();

    expect(store.getSnapshot()).toEqual({ data: undefined, error: undefined, loading: true });
    expect(load).not.toHaveBeenCalled();
    store.subscribe(listener);
    await settle();

    expect(load).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toEqual({ data: { accepted: 1 }, error: undefined, loading: false });
  });

  it("vuelve a consultar en cada intervalo y solo avisa si el dato cambió", async () => {
    const answers = [{ accepted: 1 }, { accepted: 1 }, { accepted: 2 }];
    const load = vi.fn(async () => answers.shift());
    const clock = manualTimers();
    const store = createLiveStore(load, { intervalMs: 2000, timers: clock.timers });
    const listener = vi.fn();
    store.subscribe(listener);
    await settle();
    const first = store.getSnapshot();

    clock.tick();
    await settle();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(first);

    clock.tick();
    await settle();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().data).toEqual({ accepted: 2 });
  });

  it("sin intervalo consulta una sola vez", async () => {
    const clock = manualTimers();
    const store = createLiveStore(async () => 1, { timers: clock.timers });
    store.subscribe(() => undefined);
    await settle();

    expect(clock.waiting()).toBe(0);
  });

  it("un fallo conserva lo último que se vio y se limpia cuando vuelve la conexión", async () => {
    const offline = new Error("sin conexión");
    const load = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("tablero")
      .mockRejectedValueOnce(offline)
      .mockResolvedValueOnce("tablero");
    const clock = manualTimers();
    const store = createLiveStore(load, { intervalMs: 2000, timers: clock.timers });
    store.subscribe(() => undefined);
    await settle();

    clock.tick();
    await settle();
    expect(store.getSnapshot()).toEqual({ data: "tablero", error: offline, loading: false });

    clock.tick();
    await settle();
    expect(store.getSnapshot()).toEqual({ data: "tablero", error: undefined, loading: false });
  });

  it("si la primera consulta falla deja de cargar y muestra el error", async () => {
    const failure = new Error("falló");
    const store = createLiveStore<string>(async () => {
      throw failure;
    });
    store.subscribe(() => undefined);
    await settle();

    expect(store.getSnapshot()).toEqual({ data: undefined, error: failure, loading: false });
  });

  it("al quedarse sin suscriptores cancela la petición en curso y deja de consultar", async () => {
    let seen: AbortSignal | undefined;
    const clock = manualTimers();
    const store = createLiveStore(
      (signal) => {
        seen = signal;
        return new Promise<string>(() => undefined);
      },
      { intervalMs: 2000, timers: clock.timers },
    );
    const unsubscribe = store.subscribe(() => undefined);
    unsubscribe();

    expect(seen?.aborted).toBe(true);
    expect(clock.waiting()).toBe(0);
  });

  it("descarta la respuesta de una consulta vieja cuando se pidió refrescar", async () => {
    const resolvers: Array<(value: string) => void> = [];
    const store = createLiveStore(() => new Promise<string>((resolve) => resolvers.push(resolve)));
    const listener = vi.fn();
    store.subscribe(listener);
    const refreshed = store.refresh();
    resolvers[1]?.("nuevo");
    await refreshed;
    resolvers[0]?.("viejo");
    await settle();

    expect(store.getSnapshot().data).toBe("nuevo");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("refrescar sin suscriptores consulta una vez y no deja un temporizador vivo", async () => {
    const clock = manualTimers();
    const store = createLiveStore(async () => "dato", { intervalMs: 2000, timers: clock.timers });
    await store.refresh();

    expect(store.getSnapshot().data).toBe("dato");
    expect(clock.waiting()).toBe(0);
  });

  it("usa los temporizadores del navegador si no se inyecta un reloj", async () => {
    vi.useFakeTimers();
    try {
      const load = vi.fn(async () => "dato");
      const store = createLiveStore(load, { intervalMs: 50 });
      const unsubscribe = store.subscribe(() => undefined);
      await vi.advanceTimersByTimeAsync(60);
      unsubscribe();

      expect(load).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
