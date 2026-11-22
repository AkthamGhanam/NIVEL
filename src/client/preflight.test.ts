import { describe, expect, it, vi } from "vitest";

import { ApiError, type ApiRequest } from "./api";
import {
  AUDIO_MANIFEST_URL,
  browserPreflightDeps,
  type Check,
  createPreflight,
  preflightChecks,
  type PreflightDeps,
  preflightSummary,
  SOUND_EFFECT_URLS,
  SOUND_TEST_URL,
} from "./preflight";
import { MicrophoneError } from "./voice-recorder";

const ANSWERS: Readonly<Record<string, unknown>> = {
  "/api/state": { personas: { workers: [1, 2, 3, 4, 5] } },
  "/api/el/token?agent=worker&registro=1&consent=1": { token: "token-trabajador" },
  "/api/el/token?agent=contractor": { token: "token-empresa" },
  "/api/voice/tts": { url: "/api/voice/audio/abc", cached: false },
};

function deps(changes: Partial<PreflightDeps> = {}): PreflightDeps {
  const request = vi.fn(async (path: string) => ANSWERS[path]) as unknown as ApiRequest;
  return {
    request,
    fileExists: async () => true,
    listAudio: async () => ["/audio/privacidad.mp3", "/audio/nivel-3-carlos.mp3"],
    openMicrophone: async () => undefined,
    playSound: async () => true,
    ...changes,
  };
}

async function runAll(changes: Partial<PreflightDeps> = {}) {
  const preflight = createPreflight(preflightChecks(deps(changes)));
  await preflight.runAutomatic();
  await preflight.run("microfono");
  await preflight.run("salida");
  const byId = Object.fromEntries(preflight.getState().map((check) => [check.id, check]));
  return { preflight, byId };
}

const failure = (status: number, message: string) => new ApiError({ status, code: "error", message });

describe("chequeo previo del Modo Jurado", () => {
  it("empieza sin probar nada y distingue las pruebas que necesitan un toque", () => {
    const state = createPreflight(preflightChecks(deps())).getState();

    expect(state.map((check) => check.id)).toEqual([
      "servidor",
      "agente-trabajador",
      "agente-empresa",
      "voz",
      "audios",
      "sonidos",
      "microfono",
      "salida",
    ]);
    expect(state.every((check) => check.status === "pending" && check.detail === null)).toBe(true);
    expect(state.filter((check) => check.manual).map((check) => check.id)).toEqual(["microfono", "salida"]);
    expect(preflightSummary(state)).toBe("0 de 8 pruebas listas. Faltan 8 por probar.");
  });

  it("con todo en orden, cada prueba dice qué comprobó", async () => {
    const playSound = vi.fn(async () => true);
    const { byId, preflight } = await runAll({ playSound });

    expect(Object.values(byId).every((check) => check.status === "ok")).toBe(true);
    expect(byId.servidor?.detail).toBe("La base respondió con 5 trabajadores de ejemplo.");
    expect(byId.voz?.detail).toBe("Se generó y se guardó el saludo de Nivi.");
    expect(byId.audios?.detail).toBe("2 de 2 archivos disponibles.");
    expect(byId.sonidos?.detail).toBe(
      `${SOUND_EFFECT_URLS.length} de ${SOUND_EFFECT_URLS.length} archivos disponibles.`,
    );
    expect(byId.salida?.detail).toContain("Confirma que se oyó");
    expect(playSound).toHaveBeenCalledWith(SOUND_TEST_URL);
    expect(preflightSummary(preflight.getState())).toBe("Todo listo: las 8 pruebas pasaron.");
  });

  it("las pruebas automáticas no tocan el micrófono ni hacen sonar nada", async () => {
    const openMicrophone = vi.fn(async () => undefined);
    const playSound = vi.fn(async () => true);
    const preflight = createPreflight(preflightChecks(deps({ openMicrophone, playSound })));

    await preflight.runAutomatic();

    expect(openMicrophone).not.toHaveBeenCalled();
    expect(playSound).not.toHaveBeenCalled();
    expect(preflightSummary(preflight.getState())).toBe("6 de 8 pruebas listas. Faltan 2 por probar.");
  });

  it("un fallo del servidor se muestra con su mensaje y no frena a las demás pruebas", async () => {
    const request = vi.fn(async (path: string) => {
      if (path === "/api/el/token?agent=contractor") throw failure(401, "Primero entra como empresa.");
      if (path === "/api/voice/tts") throw failure(503, "El servidor aún no está configurado.");
      if (path.startsWith("/api/el/token")) return { token: "" };
      return ANSWERS[path];
    }) as unknown as ApiRequest;
    const { byId, preflight } = await runAll({ request });

    expect(byId["agente-empresa"]).toMatchObject({ status: "fail", detail: "Primero entra como empresa." });
    expect(byId.voz).toMatchObject({ status: "fail", detail: "El servidor aún no está configurado." });
    expect(byId["agente-trabajador"]).toMatchObject({ status: "fail", detail: "Llegó vacío." });
    expect(byId.servidor?.status).toBe("ok");
    expect(preflightSummary(preflight.getState())).toBe(
      "3 de 8 pruebas fallaron. Revisa las marcadas antes de salir.",
    );
  });

  it("nombra los archivos de audio que faltan, y sin manifiesto lo dice", async () => {
    const missing = await runAll({
      fileExists: async (url) => {
        if (url === "/sfx/exito.mp3") throw new Error("sin red");
        return url !== "/audio/nivel-3-carlos.mp3";
      },
    });
    const empty = await runAll({ listAudio: async () => [] });

    expect(missing.byId.audios).toMatchObject({
      status: "fail",
      detail: "Faltan 1 de 2: /audio/nivel-3-carlos.mp3",
    });
    expect(missing.byId.sonidos?.detail).toBe("Faltan 1 de 3: /sfx/exito.mp3");
    expect(empty.byId.audios).toMatchObject({ status: "fail", detail: "No hay ningún audio en la lista." });
  });

  it("sin permiso de micrófono o sin sonido, lo dice con palabras para la persona", async () => {
    const { byId } = await runAll({
      openMicrophone: async () => {
        throw new MicrophoneError("No tenemos permiso para usar el micrófono. Actívalo o escríbelo.");
      },
      playSound: async () => false,
    });

    expect(byId.microfono).toMatchObject({ status: "fail", detail: expect.stringContaining("permiso") });
    expect(byId.salida).toMatchObject({
      status: "fail",
      detail: "El navegador no pudo reproducir el audio de prueba.",
    });
  });

  it("la voz ya guardada no gasta créditos: lo dice", async () => {
    const request = vi.fn(async (path: string) =>
      path === "/api/voice/tts" ? { cached: true } : ANSWERS[path],
    ) as unknown as ApiRequest;

    expect((await runAll({ request })).byId.voz?.detail).toBe("El saludo de Nivi ya estaba guardado.");
  });

  it("avisa cada cambio, no repite una prueba que sigue corriendo e ignora ids que no existen", async () => {
    let finish: () => void = () => undefined;
    const run = vi.fn(
      () =>
        new Promise<{ ok: boolean; detail: string }>(
          (resolve) => (finish = () => resolve({ ok: true, detail: "Listo" })),
        ),
    );
    const check: Check = { id: "lenta", label: "Prueba lenta", manual: false, run };
    const preflight = createPreflight([check]);
    const seen: string[] = [];
    const unsubscribe = preflight.subscribe(() => seen.push(preflight.getState()[0]!.status));

    const first = preflight.run("lenta");
    await preflight.run("lenta");
    await preflight.run("otra");
    finish();
    await first;
    unsubscribe();
    const again = preflight.run("lenta");
    finish();
    await again;

    expect(run).toHaveBeenCalledTimes(2);
    expect(seen).toEqual(["running", "ok"]);
  });
});

describe("piezas del navegador para el chequeo", () => {
  const files = (present: readonly string[], manifest: unknown = null) =>
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === AUDIO_MANIFEST_URL) {
        return manifest === null ? new Response("", { status: 404 }) : new Response(JSON.stringify(manifest));
      }
      return new Response(null, { status: present.includes(url) ? 200 : 404 });
    });

  it("comprueba cada archivo con una petición sin cuerpo y sin caché", async () => {
    const fetchFile = files(["/audio/privacidad.mp3"]);
    const { fileExists } = browserPreflightDeps(deps().request, fetchFile);

    expect(await fileExists("/audio/privacidad.mp3")).toBe(true);
    expect(await fileExists("/audio/falta.mp3")).toBe(false);
    expect(fetchFile).toHaveBeenCalledWith("/audio/privacidad.mp3", { method: "HEAD", cache: "no-store" });
  });

  it("del manifiesto solo toma rutas de audio de la propia app", async () => {
    const manifest = {
      "/audio/privacidad.mp3": "huella",
      "/audio/lecciones/le-smaw-1.mp3": "huella",
      "/sfx/exito.mp3": "huella",
      "https://otro.example/audio.mp3": "huella",
      "/audio/../api/state.mp3": "huella",
      "/api/demo/reset": "huella",
    };

    const listed = await browserPreflightDeps(deps().request, files([], manifest)).listAudio();
    const none = await browserPreflightDeps(deps().request, files([])).listAudio();

    expect(listed).toEqual(["/audio/privacidad.mp3", "/audio/lecciones/le-smaw-1.mp3", "/sfx/exito.mp3"]);
    expect(none).toEqual([]);
  });

  it("el micrófono y el sonido usan los del navegador; sin ellos, falla con un mensaje claro", async () => {
    const { openMicrophone, playSound } = browserPreflightDeps(deps().request, files([]));
    class FakeAudio {
      play = async () => Promise.reject(new Error("NotAllowedError"));
      pause = () => undefined;
    }
    vi.stubGlobal("Audio", FakeAudio);

    await expect(openMicrophone()).rejects.toBeInstanceOf(MicrophoneError);
    expect(await playSound("/audio/privacidad.mp3")).toBe(false);
    vi.unstubAllGlobals();
  });
});
