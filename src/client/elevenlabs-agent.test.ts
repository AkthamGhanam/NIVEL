import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { connectElevenLabsAgent, WORKLET_PATHS } from "./elevenlabs-agent";

const conversation = {
  getId: vi.fn(() => "conv_abc12345"),
  setMicMuted: vi.fn(),
  sendUserMessage: vi.fn(),
  endSession: vi.fn(async () => undefined),
};
const startSession = vi.fn(async (_options: Record<string, unknown>) => conversation);

vi.mock("@elevenlabs/client", () => ({ Conversation: { startSession } }));

const callbacks = () => ({ onMessage: vi.fn(), onSpeaking: vi.fn(), onEnd: vi.fn() });
const connection = (textOnly: boolean) => ({
  token: "token-de-prueba",
  dynamicVariables: { secret__nivel_contexto: "contexto-firmado" },
  textOnly,
  callbacks: callbacks(),
});
type Options = Record<string, (payload: unknown) => void>;
const lastOptions = () => startSession.mock.calls.at(-1)?.[0] as Options;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("conexión con el agente de ElevenLabs", () => {
  it("abre la conversación por WebRTC con el token, el contexto firmado y los worklets propios", async () => {
    const request = connection(false);

    const session = await connectElevenLabsAgent(request);
    session.setMicMuted(true);
    session.sendText("hola");
    await session.end();

    expect(startSession.mock.calls.at(-1)?.[0]).toMatchObject({
      conversationToken: "token-de-prueba",
      connectionType: "webrtc",
      dynamicVariables: { secret__nivel_contexto: "contexto-firmado" },
      textOnly: false,
      workletPaths: WORKLET_PATHS,
    });
    expect(session.conversationId()).toBe("conv_abc12345");
    expect(conversation.setMicMuted).toHaveBeenCalledWith(true);
    expect(conversation.sendUserMessage).toHaveBeenCalledWith("hola");
    expect(conversation.endSession).toHaveBeenCalledOnce();
  });

  it("traduce los avisos del SDK a los de la pantalla, sin pasar detalles técnicos de más", async () => {
    const request = connection(false);
    await connectElevenLabsAgent(request);
    const options = lastOptions();

    options.onMessage?.({ message: "¡Hola! Soy Nivi.", role: "agent" });
    options.onMessage?.({ message: "Soy Carlos", role: "user" });
    options.onModeChange?.({ mode: "speaking" });
    options.onModeChange?.({ mode: "listening" });
    options.onDisconnect?.({ reason: "user" });
    options.onDisconnect?.({ reason: "error", message: "ICE failed" });
    options.onError?.("algo técnico");

    expect(request.callbacks.onMessage.mock.calls).toEqual([
      [{ from: "nivi", text: "¡Hola! Soy Nivi." }],
      [{ from: "persona", text: "Soy Carlos" }],
    ]);
    expect(request.callbacks.onSpeaking.mock.calls).toEqual([[true], [false]]);
    expect(request.callbacks.onEnd.mock.calls).toEqual([[undefined], ["ICE failed"]]);
    expect(console.warn).toHaveBeenCalledWith("nivi_voice_error", "algo técnico");
  });

  it("en una conversación solo de texto no toca el micrófono", async () => {
    conversation.setMicMuted.mockClear();

    const session = await connectElevenLabsAgent(connection(true));
    session.setMicMuted(false);

    expect(startSession.mock.calls.at(-1)?.[0]).toMatchObject({ textOnly: true });
    expect(conversation.setMicMuted).not.toHaveBeenCalled();
  });
});

describe("worklets del SDK servidos desde nuestro origen", () => {
  it("son copias exactas de los del paquete instalado: si el SDK cambia de versión, esta prueba avisa", () => {
    for (const path of Object.values(WORKLET_PATHS)) {
      const name = path.split("/").at(-1) ?? "";
      const served = readFileSync(join(process.cwd(), "public", path), "utf8");
      const packaged = readFileSync(
        join(process.cwd(), "node_modules", "@elevenlabs", "client", "worklets", name),
        "utf8",
      );

      expect(path.startsWith("/elevenlabs/")).toBe(true);
      expect(served).toBe(packaged);
    }
  });
});
