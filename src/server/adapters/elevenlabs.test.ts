import { describe, expect, it, vi } from "vitest";

import { createElevenLabs, DYNAMIC_TTS_MODEL, VoiceServiceError } from "./elevenlabs";
import { createElevenLabsHttp, ElevenLabsRequestError } from "./elevenlabs-http";

const API_KEY = "clave-de-prueba";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function fetchWith(...responses: Array<Response | Error>) {
  return vi.fn(async (_url: URL, _init: RequestInit) => {
    const next = responses.shift();
    if (next instanceof Error || next === undefined) throw next ?? new Error("sin respuesta");
    return next;
  });
}

function clientWith(...responses: Array<Response | Error>) {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const send = fetchWith(...responses);
  return { send, client: createElevenLabs({ apiKey: API_KEY, fetch: send as unknown as typeof fetch }) };
}

const callOf = (send: ReturnType<typeof fetchWith>, index = 0) => {
  const [url, init] = send.mock.calls[index] as [URL, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
};

describe("conversationToken", () => {
  it("pide el token del agente con la clave en la cabecera", async () => {
    const { send, client } = clientWith(json({ token: "tok-1" }));

    const token = await client.conversationToken("agente 1");

    const { url, init, headers } = callOf(send);
    expect(token).toBe("tok-1");
    expect(url.href).toBe("https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=agente+1");
    expect(init.method).toBe("GET");
    expect(headers).toEqual({ "xi-api-key": API_KEY });
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
    const offline = clientWith(new Error("ETIMEDOUT"), new Error("ETIMEDOUT"));
    const empty = clientWith(json({ token: "" }));
    const odd = clientWith(json(null));

    await expect(down.client.conversationToken("a")).rejects.toBeInstanceOf(VoiceServiceError);
    await expect(offline.client.conversationToken("a")).rejects.toBeInstanceOf(VoiceServiceError);
    await expect(empty.client.conversationToken("a")).rejects.toBeInstanceOf(VoiceServiceError);
    await expect(odd.client.conversationToken("a")).rejects.toBeInstanceOf(VoiceServiceError);
    expect(down.send).toHaveBeenCalledTimes(2);
  });
});

describe("speak", () => {
  it("pide MP3 en español a la voz indicada y devuelve los bytes", async () => {
    const { send, client } = clientWith(new Response(new Uint8Array([7, 8, 9])));

    const audio = await client.speak({
      text: "Hola, Carlos",
      voiceId: "voz/nivi",
      modelId: DYNAMIC_TTS_MODEL,
    });

    const { url, init, headers } = callOf(send);
    expect([...audio]).toEqual([7, 8, 9]);
    expect(url.pathname).toBe("/v1/text-to-speech/voz%2Fnivi");
    expect(url.searchParams.get("output_format")).toBe("mp3_44100_64");
    expect(init.method).toBe("POST");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({
      text: "Hola, Carlos",
      model_id: DYNAMIC_TTS_MODEL,
      language_code: "es",
    });
  });

  it("un audio vacío o un error cuentan como servicio no disponible", async () => {
    const empty = clientWith(new Response(new Uint8Array()));
    const refused = clientWith(json({ detail: "voz inexistente" }, 404));
    const request = { text: "a", voiceId: "v", modelId: "m" };

    await expect(empty.client.speak(request)).rejects.toBeInstanceOf(VoiceServiceError);
    await expect(refused.client.speak(request)).rejects.toBeInstanceOf(VoiceServiceError);
  });
});

describe("transcribe", () => {
  it("manda el audio a Scribe v2 en español y devuelve el texto limpio", async () => {
    const { send, client } = clientWith(json({ text: "  No había extintor en el área.  " }));
    const note = new Blob([new Uint8Array([1, 2])], { type: "audio/webm" });

    const text = await client.transcribe(note);

    const { url, init } = callOf(send);
    const form = init.body as FormData;
    expect(text).toBe("No había extintor en el área.");
    expect(url.pathname).toBe("/v1/speech-to-text");
    expect(form.get("model_id")).toBe("scribe_v2");
    expect(form.get("language_code")).toBe("spa");
    expect((form.get("file") as File).size).toBe(2);
  });

  it("una respuesta sin texto cuenta como servicio no disponible", async () => {
    const { client } = clientWith(json({ words: [] }));

    await expect(client.transcribe(new Blob(["x"]))).rejects.toBeInstanceOf(VoiceServiceError);
  });
});

describe("transporte para los scripts", () => {
  it("da el estado y el detalle del error, sin la clave", async () => {
    const send = fetchWith(json({ detail: `la clave ${API_KEY} no tiene permiso` }, 403));
    const http = createElevenLabsHttp({ apiKey: API_KEY, fetch: send as unknown as typeof fetch });

    const failure = (await http("/v1/convai/agents").catch(
      (error: unknown) => error,
    )) as ElevenLabsRequestError;

    expect(failure).toBeInstanceOf(ElevenLabsRequestError);
    expect(failure.status).toBe(403);
    expect(failure.message).toContain("no tiene permiso");
    expect(failure.message).not.toContain(API_KEY);
  });

  it("sin respuesta tras el reintento, dice qué pasó sin estado HTTP", async () => {
    const send = fetchWith(new TypeError("fetch failed"), new TypeError("fetch failed"));
    const http = createElevenLabsHttp({ apiKey: API_KEY, fetch: send as unknown as typeof fetch });

    const failure = (await http("/v1/x", { method: "DELETE" }).catch(
      (error: unknown) => error,
    )) as ElevenLabsRequestError;

    expect(failure.status).toBeUndefined();
    expect(failure.message).toContain("TypeError");
    expect(send).toHaveBeenCalledTimes(2);
  });
});
