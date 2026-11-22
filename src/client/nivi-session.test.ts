import { describe, expect, it, vi } from "vitest";

import { ApiError } from "./api";
import {
  type AgentCallbacks,
  type AgentConnection,
  type AgentSession,
  createNiviSession,
  MAX_MESSAGE_LENGTH,
  type NiviMode,
  rememberedMode,
  rememberMode,
} from "./nivi-session";

const TOKEN = { token: "token-de-prueba", dynamicVariables: { secret__nivel_contexto: "contexto-firmado" } };

/** Agente falso: guarda lo que la pantalla le pide y deja disparar sus avisos a mano. */
function fakeAgent() {
  const connections: AgentConnection[] = [];
  const session = {
    conversationId: () => "conv_prueba123",
    setMicMuted: vi.fn<AgentSession["setMicMuted"]>(),
    sendText: vi.fn<AgentSession["sendText"]>(),
    end: vi.fn<AgentSession["end"]>(async () => undefined),
  };
  const connect = vi.fn(async (connection: AgentConnection): Promise<AgentSession> => {
    connections.push(connection);
    return session;
  });
  const callbacks = (): AgentCallbacks => connections.at(-1)!.callbacks;
  return { connect, session, connections, callbacks };
}

function nivi(mode: NiviMode, agent = fakeAgent()) {
  const fetchToken = vi.fn(async () => TOKEN);
  const session = createNiviSession({ fetchToken, connect: agent.connect, mode });
  const seen: string[] = [];
  session.subscribe(() => seen.push(`${session.getState().status}/${session.getState().activity}`));
  return { session, agent, fetchToken, seen, state: () => session.getState() };
}

const named = (name: string) => Object.assign(new Error(name), { name });

describe("conversación con Nivi", () => {
  it("empieza en reposo, sin pedir token ni micrófono hasta que la persona lo decide", () => {
    const { state, fetchToken, agent } = nivi("nota");

    expect(state()).toEqual({
      status: "idle",
      mode: "nota",
      activity: "idle",
      talking: false,
      lines: [],
      error: null,
      conversationId: null,
    });
    expect(fetchToken).not.toHaveBeenCalled();
    expect(agent.connect).not.toHaveBeenCalled();
  });

  it("en nota de voz conecta con el micrófono cerrado y solo lo abre mientras se mantiene presionado", async () => {
    const { session, agent, state, seen } = nivi("nota");

    await session.start();
    session.hold();
    session.hold();
    const whileTalking = state();
    session.release();
    session.release();

    expect(agent.connections[0]).toMatchObject({ ...TOKEN, textOnly: false });
    expect(seen.slice(0, 2)).toEqual(["connecting/thinking", "live/idle"]);
    expect(whileTalking).toMatchObject({ talking: true, activity: "listening" });
    expect(agent.session.setMicMuted.mock.calls).toEqual([[true], [false], [true]]);
    expect(state()).toMatchObject({
      status: "live",
      talking: false,
      activity: "thinking",
      conversationId: "conv_prueba123",
    });
  });

  it("en llamada deja el micrófono abierto y el orbe sigue a quien habla", async () => {
    const { session, agent, state } = nivi("llamada");

    await session.start();
    session.hold();
    const listening = state().activity;
    agent.callbacks().onSpeaking(true);
    const speaking = state().activity;
    agent.callbacks().onSpeaking(false);

    expect(agent.session.setMicMuted.mock.calls).toEqual([[false]]);
    // Mantener presionado no existe en una llamada.
    expect(state().talking).toBe(false);
    expect([listening, speaking, state().activity]).toEqual(["listening", "speaking", "listening"]);
  });

  it("pinta la conversación en orden, sin líneas vacías ni ecos repetidos", async () => {
    const { session, agent, state } = nivi("llamada");
    await session.start();

    agent.callbacks().onMessage({ from: "nivi", text: " ¡Hola! Soy Nivi. " });
    agent.callbacks().onMessage({ from: "persona", text: "Soy Carlos" });
    const afterPerson = state().activity;
    agent.callbacks().onMessage({ from: "persona", text: "Soy Carlos" });
    agent.callbacks().onMessage({ from: "nivi", text: "   " });

    expect(state().lines).toEqual([
      { id: 1, from: "nivi", text: "¡Hola! Soy Nivi." },
      { id: 2, from: "persona", text: "Soy Carlos" },
    ]);
    expect(afterPerson).toBe("thinking");
  });

  it("en texto no usa micrófono: los mensajes se envían recortados y se ven de inmediato", async () => {
    const { session, agent, state } = nivi("texto");

    session.sendText("antes de conectar");
    await session.start();
    session.sendText("  Soy soldador  ");
    session.sendText("   ");
    session.sendText("x".repeat(MAX_MESSAGE_LENGTH + 50));
    agent.callbacks().onMessage({ from: "persona", text: "x".repeat(MAX_MESSAGE_LENGTH) });

    expect(agent.connections[0]?.textOnly).toBe(true);
    expect(agent.session.setMicMuted).not.toHaveBeenCalled();
    expect(agent.session.sendText.mock.calls).toEqual([["Soy soldador"], ["x".repeat(MAX_MESSAGE_LENGTH)]]);
    expect(state().lines.map((line) => line.text)).toEqual(["Soy soldador", "x".repeat(MAX_MESSAGE_LENGTH)]);
    expect(state().activity).toBe("thinking");
  });

  it("cambiar entre nota y llamada solo mueve el micrófono; pasar a texto lo cierra", async () => {
    const { session, agent, state } = nivi("nota");
    await session.start();
    session.hold();

    session.setMode("llamada");
    const call = state();
    session.setMode("llamada");
    session.setMode("texto");

    expect(call).toMatchObject({ mode: "llamada", talking: false, activity: "listening", status: "live" });
    expect(agent.session.setMicMuted.mock.calls).toEqual([[true], [false], [false], [true]]);
    expect(state()).toMatchObject({ mode: "texto", status: "live", activity: "idle" });
    expect(agent.session.end).not.toHaveBeenCalled();
  });

  it("de una conversación solo de texto no se puede pasar a hablar: se cierra y se empieza otra", async () => {
    const { session, agent, state } = nivi("texto");
    await session.start();

    session.setMode("nota");

    expect(agent.session.end).toHaveBeenCalledOnce();
    expect(state()).toMatchObject({ mode: "nota", status: "idle", activity: "idle" });
    await session.start();
    expect(agent.connections[1]?.textOnly).toBe(false);
  });

  it("el modo se puede elegir antes de conectar", () => {
    const { session, state, agent } = nivi("nota");

    session.setMode("texto");

    expect(state()).toMatchObject({ mode: "texto", status: "idle", activity: "idle" });
    expect(agent.connect).not.toHaveBeenCalled();
  });

  it("al terminar cierra la conversación y conserva lo conversado", async () => {
    const { session, agent, state } = nivi("llamada");
    await session.start();
    agent.callbacks().onMessage({ from: "nivi", text: "Hola" });
    const old = agent.callbacks();

    await session.stop();
    old.onMessage({ from: "nivi", text: "mensaje tardío" });
    old.onSpeaking(true);
    old.onEnd("falla tardía");
    session.hold();
    session.release();

    expect(agent.session.end).toHaveBeenCalledOnce();
    expect(state()).toMatchObject({ status: "idle", activity: "idle", error: null });
    expect(state().lines).toHaveLength(1);
  });

  it("si la persona cancela mientras conecta, la conversación que llega tarde se cierra sin usarse", async () => {
    const agent = fakeAgent();
    let open: (session: AgentSession) => void = () => undefined;
    agent.connect.mockImplementationOnce(
      (connection) =>
        new Promise((resolve) => {
          agent.connections.push(connection);
          open = resolve;
        }),
    );
    const { session, state } = nivi("nota", agent);

    const starting = session.start();
    await session.start();
    await vi.waitFor(() => expect(agent.connect).toHaveBeenCalledOnce());
    await session.stop();
    open(agent.session);
    await starting;

    expect(agent.session.end).toHaveBeenCalledOnce();
    expect(agent.session.setMicMuted).not.toHaveBeenCalled();
    expect(state()).toMatchObject({ status: "idle", conversationId: null });
  });

  it("si Nivi cuelga o se cae la conexión, vuelve al reposo y lo dice solo cuando fue una falla", async () => {
    const { session, agent, state } = nivi("llamada");
    await session.start();
    agent.callbacks().onEnd();
    const hungUp = state();

    await session.start();
    agent.callbacks().onEnd("ICE failed");

    expect(hungUp).toMatchObject({ status: "idle", error: null });
    expect(state()).toMatchObject({ status: "idle", activity: "idle" });
    expect(state().error).toBe("Se cortó la conversación con Nivi. Puedes empezar de nuevo.");
    // Los detalles técnicos nunca llegan a la pantalla.
    expect(state().error).not.toContain("ICE");
    session.sendText("hola");
    expect(agent.session.sendText).not.toHaveBeenCalled();
  });

  it("explica por qué no se pudo conectar, y permite reintentar", async () => {
    const attempt = async (error: unknown, stage: "token" | "connect") => {
      const agent = fakeAgent();
      const { session, fetchToken, state } = nivi("nota", agent);
      if (stage === "token") fetchToken.mockRejectedValueOnce(error);
      else agent.connect.mockRejectedValueOnce(error);
      await session.start();
      const failed = state();
      await session.start();
      return { failed, retried: state() };
    };

    const server = new ApiError({
      status: 503,
      code: "sin_configurar",
      message: "El servidor aún no está configurado.",
    });
    const denied = await attempt(named("NotAllowedError"), "connect");
    const unknown = await attempt(new Error("livekit: could not establish pc connection"), "connect");
    const odd = await attempt("raro", "connect");

    expect((await attempt(server, "token")).failed.error).toBe("El servidor aún no está configurado.");
    expect(denied.failed).toMatchObject({ status: "idle", activity: "idle" });
    expect(denied.failed.error).toContain("No tenemos permiso para usar el micrófono");
    expect(unknown.failed.error).toBe(
      "No pudimos conectar con Nivi. Intenta de nuevo o cambia al modo texto.",
    );
    expect(odd.failed.error).toContain("No pudimos conectar con Nivi");
    expect(denied.retried).toMatchObject({ status: "live", error: null });
  });

  it("al cambiar de modo se borra el aviso de la falla anterior", async () => {
    const agent = fakeAgent();
    agent.connect.mockRejectedValueOnce(new Error("sin red"));
    const { session, state } = nivi("nota", agent);
    await session.start();
    const failed = state().error;

    session.setMode("texto");

    expect(failed).toContain("No pudimos conectar con Nivi");
    expect(state().error).toBeNull();
  });

  it("una falla que llega después de cancelar no pisa el estado", async () => {
    const agent = fakeAgent();
    let fail: (error: Error) => void = () => undefined;
    agent.connect.mockImplementationOnce(() => new Promise((_, reject) => (fail = reject)));
    const { session, state } = nivi("nota", agent);

    const starting = session.start();
    await vi.waitFor(() => expect(agent.connect).toHaveBeenCalledOnce());
    await session.stop();
    fail(new Error("tarde"));
    await starting;

    expect(state()).toMatchObject({ status: "idle", error: null });
  });

  it("quien deja de escuchar no recibe más avisos", async () => {
    const { session } = nivi("nota");
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);

    session.setMode("llamada");
    unsubscribe();
    session.setMode("texto");

    expect(listener).toHaveBeenCalledOnce();
  });
});

describe("modo recordado", () => {
  const storage = () => {
    const values = new Map<string, string>();
    return {
      values,
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };
  };

  it("recuerda el modo de cada vista por separado y descarta valores que no existen", () => {
    const memory = storage();

    rememberMode({ agent: "worker", storage: memory }, "texto");
    memory.values.set("nivel.nivi.modo.contractor", "telepatía");

    expect(rememberedMode({ agent: "worker", storage: memory }, "nota")).toBe("texto");
    expect(rememberedMode({ agent: "contractor", storage: memory }, "llamada")).toBe("llamada");
  });

  it("sin almacenamiento, o si falla, usa el modo de la pantalla y no rompe", () => {
    const broken = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };

    expect(rememberedMode({ agent: "worker", storage: undefined }, "nota")).toBe("nota");
    expect(rememberedMode({ agent: "worker", storage: broken }, "llamada")).toBe("llamada");
    expect(() => rememberMode({ agent: "worker", storage: broken }, "texto")).not.toThrow();
    expect(() => rememberMode({ agent: "worker", storage: undefined }, "texto")).not.toThrow();
    // En las pruebas no hay navegador: no existe `localStorage`.
    expect(rememberedMode({ agent: "worker" }, "nota")).toBe("nota");
    expect(() => rememberMode({ agent: "worker" }, "texto")).not.toThrow();
  });

  it("si el navegador bloquea hasta leer `localStorage`, tampoco rompe", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("SecurityError");
      },
    });

    expect(rememberedMode({ agent: "worker" }, "nota")).toBe("nota");

    Reflect.deleteProperty(globalThis, "localStorage");
  });
});
