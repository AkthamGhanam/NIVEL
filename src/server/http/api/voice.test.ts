import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient, type Transport } from "../../../../scripts/smoke/client";
import { events, reports, voiceClips } from "../../db/schema";
import { IDS } from "../../db/seed/cast";
import { dispatch, type InProcessApi, startInProcessApi } from "../../testing/in-process-api";
import { MAX_SPEECH_CHARACTERS } from "../../use-cases/voice";

/**
 * Voz de la app por las rutas reales: TTS con caché en la base y notas de voz
 * a reporte con Scribe. ElevenLabs se sustituye en `fetch`: aquí se prueba el
 * contrato, no la red.
 */

const VOICE_ID = "voz-nivi";
const AUDIO = new Uint8Array([73, 68, 51, 4, 0]);
const NOTE = new Uint8Array(2048).fill(1);

let api: InProcessApi;
let elevenLabs: ReturnType<typeof vi.fn>;

/** Cliente que recuerda la cabecera de cookies de su última petición, para armar subidas binarias. */
function newClient() {
  let cookie = "";
  const transport: Transport = (request) => {
    cookie = request.headers.get("cookie") ?? cookie;
    return dispatch(request);
  };
  const client = new ApiClient(api.baseUrl, transport, api.demoKey);
  return { client, cookie: () => cookie };
}

async function database() {
  const { app } = await import("../../app");
  return (await app()).handle.db;
}

const elevenLabsCalls = (path: string) =>
  elevenLabs.mock.calls.filter(([url]) => (url as URL).pathname.startsWith(path));

interface Upload {
  readonly cookie: string;
  readonly body: BodyInit;
  readonly type: string;
  readonly ip?: string;
}

async function upload({ cookie, body, type, ip = "198.51.100.20" }: Upload) {
  const response = await dispatch(
    new Request(`${api.baseUrl}/api/voice/transcribe`, {
      method: "POST",
      headers: { cookie, "content-type": type, "x-nivel-role": "worker", "x-forwarded-for": ip },
      body,
    }),
  );
  return { status: response.status, data: (await response.json()) as Record<string, unknown> };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

beforeAll(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  api = startInProcessApi();
  vi.stubEnv("ELEVENLABS_API_KEY", "clave-de-voz");
  vi.stubEnv("EL_VOICE_ID", VOICE_ID);
  elevenLabs = vi.fn(async (url: URL) =>
    url.pathname === "/v1/speech-to-text"
      ? new Response(JSON.stringify({ text: "No había extintor en el área de soldadura." }))
      : new Response(AUDIO),
  );
  vi.stubGlobal("fetch", elevenLabs);
  await newClient().client.post("/api/demo/reset", { as: "admin" });
});

afterAll(() => {
  vi.unstubAllGlobals();
  api.dispose();
});

describe("POST /api/voice/tts", () => {
  it("exige una sesión: nadie usa NIVEL como TTS gratis", async () => {
    const { client } = newClient();

    const response = await client.call("POST", "/api/voice/tts", { body: { text: "Hola" } });

    expect(response.status).toBe(401);
    expect(elevenLabs).not.toHaveBeenCalled();
  });

  it("sintetiza una vez y las repeticiones salen de la caché, sin gastar créditos", async () => {
    const { client } = newClient();
    await client.enterAs("worker", IDS.carlos);
    const text = "Carlos, Constructora Los Guayos te invita: 5 días de soldadura.";

    const first = await client.post<{ url: string; cached: boolean }>("/api/voice/tts", { body: { text } });
    const again = await client.post<{ url: string; cached: boolean }>("/api/voice/tts", {
      body: { text: `  ${text.replace(" ", "\n  ")} ` },
    });

    expect(first.cached).toBe(false);
    expect(again).toEqual({ url: first.url, cached: true });
    expect(first.url).toMatch(/^\/api\/voice\/audio\/[a-f0-9]{64}$/);
    expect(elevenLabsCalls("/v1/text-to-speech")).toHaveLength(1);
    expect((elevenLabsCalls("/v1/text-to-speech")[0]?.[0] as URL).pathname).toBe(
      `/v1/text-to-speech/${VOICE_ID}`,
    );
  });

  it("sirve el audio guardado con su tipo, y 404 para un id que no existe o no es una huella", async () => {
    const { client } = newClient();
    await client.enterAs("company", IDS.activeCompany);
    const { url } = await client.post<{ url: string }>("/api/voice/tts", {
      body: { text: "Listo, cuadrilla armada." },
    });

    const audio = await dispatch(new Request(`${api.baseUrl}${url}`));
    const missing = await dispatch(new Request(`${api.baseUrl}/api/voice/audio/${"0".repeat(64)}`));
    const malformed = await dispatch(new Request(`${api.baseUrl}/api/voice/audio/..%2F..%2Fetc`));

    expect(audio.status).toBe(200);
    expect(audio.headers.get("content-type")).toBe("audio/mpeg");
    expect(audio.headers.get("x-request-id")).toBeTruthy();
    expect([...new Uint8Array(await audio.arrayBuffer())]).toEqual([...AUDIO]);
    expect(missing.status).toBe(404);
    expect(malformed.status).toBe(404);
  });

  it("rechaza un texto vacío o demasiado largo antes de llamar a ElevenLabs", async () => {
    const { client } = newClient();
    await client.enterAs("worker", IDS.rafael);
    elevenLabs.mockClear();

    const blank = await client.call("POST", "/api/voice/tts", { body: { text: "   " } });
    const long = await client.call("POST", "/api/voice/tts", {
      body: { text: "a".repeat(MAX_SPEECH_CHARACTERS + 1) },
    });

    expect(blank.status).toBe(422);
    expect(long.status).toBe(422);
    expect(elevenLabs).not.toHaveBeenCalled();
  });

  it("registra el TTS en la bitácora con su latencia, sin el texto", async () => {
    const db = await database();
    const logged = await db.select().from(events).where(eq(events.product, "tts"));
    const clips = await db.select({ characters: voiceClips.characters }).from(voiceClips);

    expect(logged.length).toBe(clips.length);
    expect(logged.every((event) => typeof event.latencyMs === "number")).toBe(true);
    expect(JSON.stringify(logged)).not.toMatch(/Carlos|cuadrilla/);
  });

  it("si el servicio de voz falla responde 502 y no guarda nada en la caché", async () => {
    const { client } = newClient();
    await client.enterAs("worker", IDS.jose);
    elevenLabs.mockImplementationOnce(async () => new Response("{}", { status: 500 }));
    elevenLabs.mockImplementationOnce(async () => new Response("{}", { status: 500 }));
    const before = await (await database()).$count(voiceClips);

    const response = await client.call<{ error: { code: string } }>("POST", "/api/voice/tts", {
      body: { text: "Frase que falla" },
    });

    expect(response.status).toBe(502);
    expect(response.data.error.code).toBe("voz_no_disponible");
    expect(await (await database()).$count(voiceClips)).toBe(before);
  });
});

describe("POST /api/voice/transcribe", () => {
  let worker: ReturnType<typeof newClient>;

  beforeAll(async () => {
    worker = newClient();
    await worker.client.enterAs("worker", IDS.luis);
    await worker.client.get("/api/invitations"); // Deja registrada la cookie de la sesión.
  });

  it("solo un trabajador con sesión puede mandar una nota de voz", async () => {
    const response = await upload({ cookie: "", body: new Blob([NOTE]), type: "audio/webm" });

    expect(response.status).toBe(401);
  });

  it("transcribe, clasifica y abre un reporte en revisión humana; el audio no se guarda", async () => {
    const response = await upload({
      cookie: worker.cookie(),
      body: new Blob([NOTE]),
      type: "audio/webm;codecs=opus",
    });

    const [saved] = await (
      await database()
    )
      .select()
      .from(reports)
      .where(eq(reports.id, response.data.reportId as string));
    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({
      kind: "inseguridad",
      transcript: "No había extintor en el área de soldadura.",
      message: expect.stringContaining("Una persona del equipo lo revisa"),
      guidance: expect.stringContaining("INPSASEL"),
    });
    expect(saved).toMatchObject({
      reporterWorkerId: IDS.luis,
      kind: "inseguridad",
      status: "en_revision",
      transcript: "No había extintor en el área de soldadura.",
      audioUrl: null,
    });
    const scribe = elevenLabsCalls("/v1/speech-to-text").at(-1)?.[1] as RequestInit;
    expect(((scribe.body as FormData).get("file") as File).size).toBe(NOTE.byteLength);
  });

  it("registra Scribe en la bitácora sin la transcripción", async () => {
    const logged = await (await database()).select().from(events).where(eq(events.product, "stt"));

    expect(logged.length).toBeGreaterThan(0);
    expect(JSON.stringify(logged)).not.toContain("extintor");
  });

  it("rechaza formatos que no son audio, notas vacías y archivos demasiado grandes", async () => {
    const text = await upload({ cookie: worker.cookie(), body: "hola", type: "text/plain" });
    const empty = await upload({ cookie: worker.cookie(), body: new Blob([]), type: "audio/webm" });
    const huge = await upload({
      cookie: worker.cookie(),
      body: new Blob([new Uint8Array(2 * 1024 * 1024 + 1)]),
      type: "audio/ogg",
    });

    expect(text.status).toBe(415);
    expect(empty.status).toBe(422);
    expect(huge.status).toBe(413);
  });

  it("si Scribe no entiende nada, pide repetir en vez de abrir un reporte vacío", async () => {
    elevenLabs.mockImplementationOnce(async () => new Response(JSON.stringify({ text: "   " })));
    const before = await (await database()).$count(reports);

    const response = await upload({ cookie: worker.cookie(), body: new Blob([NOTE]), type: "audio/mp4" });

    expect(response.status).toBe(422);
    expect(await (await database()).$count(reports)).toBe(before);
  });

  it("limita cuántas notas de voz manda una misma IP", async () => {
    let last = 200;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      last = (
        await upload({
          cookie: worker.cookie(),
          body: new Blob([NOTE]),
          type: "audio/webm",
          ip: "203.0.113.90",
        })
      ).status;
    }

    expect(last).toBe(429);
  });
});

describe("sin configuración de voz", () => {
  it("el TTS responde 503 si falta la voz de Nivi, y el resto de la API sigue en pie", async () => {
    vi.stubEnv("EL_VOICE_ID", "");
    vi.resetModules();
    const { client } = newClient();
    await client.enterAs("worker", IDS.carlos);

    expect((await client.call("POST", "/api/voice/tts", { body: { text: "Otra frase" } })).status).toBe(503);
    expect((await client.call("GET", "/api/invitations")).status).toBe(200);
  });
});
