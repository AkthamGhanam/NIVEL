import { describe, expect, it, vi } from "vitest";

import { createElevenLabs, VoiceServiceError } from "./elevenlabs";

const API_KEY = "clave-de-prueba";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function clientWith(...responses: Array<Response | Error>) {
  const send = vi.fn(async () => {
    const next = responses.shift();
    if (next instanceof Error || next === undefined) throw next ?? new Error("sin respuesta");
    return next;
  });
  return { send, client: createElevenLabs({ apiKey: API_KEY, fetch: send as unknown as typeof fetch }) };
}

describe("conversationToken", () => {
  it("pide el token del agente con la clave en la cabecera", async () => {
    const { send, client } = clientWith(json({ token: "tok-1" }));

    const token = await client.conversationToken("agente 1");

    const [url, init] = send.mock.calls[0] as unknown as [URL, RequestInit];
    expect(token).toBe("tok-1");
    expect(url.href).toBe("https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=agente+1");
    expect(init.headers).toEqual({ "xi-api-key": API_KEY });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("reintenta una vez ante un fallo transitorio o de red", async () => {
    const afterServerError = clientWith(json({}, 503), json({ token: "tok-2" }));
    const afterNetworkError = clientWith(new Error("ECONNRESET"), json({ token: "tok-3" }));

    expect(await afterServerError.client.conversationToken("a")).toBe("tok-2");
    expect(await afterNetworkError.client.conversationToken("a")).toBe("tok-3");
    expect(afterServerError.send).toHaveBeenCalledTimes(2);
  });

  it("no reintenta un error definitivo y nunca filtra la clave ni el detalle", async () => {
    const { send, client } = clientWith(json({ detail: `clave ${API_KEY} inválida` }, 401));

    const failure = await client.conversationToken("a").catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(VoiceServiceError);
    expect((failure as Error).message).not.toContain(API_KEY);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("falla tras dos intentos transitorios o si la respuesta no trae token", async () => {
    const down = clientWith(json({}, 502), json({}, 502));
    const empty = clientWith(json({ token: "" }));
    const odd = clientWith(json(null));

    await expect(down.client.conversationToken("a")).rejects.toBeInstanceOf(VoiceServiceError);
    await expect(empty.client.conversationToken("a")).rejects.toBeInstanceOf(VoiceServiceError);
    await expect(odd.client.conversationToken("a")).rejects.toBeInstanceOf(VoiceServiceError);
    expect(down.send).toHaveBeenCalledTimes(2);
  });
});
