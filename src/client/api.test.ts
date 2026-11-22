import { describe, expect, it, vi } from "vitest";

import { ApiError, createApiRequest, errorMessage } from "./api";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

function clientWith(response: Response | Error) {
  const fetchMock = vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response;
    return response.clone();
  });
  return { request: createApiRequest(fetchMock), fetchMock };
}

describe("cliente de la API", () => {
  it("un GET manda la cookie del mismo origen, sin caché y con la vista indicada", async () => {
    const { request, fetchMock } = clientWith(json({ level: 3 }));

    expect(await request<{ level: number }>("/api/level", { as: "worker" })).toEqual({ level: 3 });
    const [path, init] = fetchMock.mock.calls[0] ?? [];
    expect(path).toBe("/api/level");
    expect(init).toMatchObject({ method: "GET", body: null, credentials: "same-origin", cache: "no-store" });
    expect(init?.headers).toEqual({ accept: "application/json", "x-nivel-role": "worker" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("un POST manda el cuerpo en JSON; sin cuerpo manda un objeto vacío", async () => {
    const { request, fetchMock } = clientWith(json({ ok: true }));
    await request("/api/ratings", { method: "POST", body: { quality: 5 } });
    await request("/api/me", { method: "DELETE" });

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST", body: '{"quality":5}' });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ "content-type": "application/json" });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "DELETE", body: "{}" });
  });

  it("una nota de voz viaja cruda, con su propio tipo y siempre por POST", async () => {
    const { request, fetchMock } = clientWith(json({ reportId: "re-1" }));
    const note = new Blob([new Uint8Array(64)], { type: "audio/webm" });
    await request("/api/voice/transcribe", { as: "worker", upload: note });
    await request("/api/voice/transcribe", { upload: new Blob([new Uint8Array(8)]) });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init).toMatchObject({ method: "POST", body: note });
    expect(init?.headers).toEqual({
      accept: "application/json",
      "x-nivel-role": "worker",
      "content-type": "audio/webm",
    });
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      "content-type": "application/octet-stream",
    });
  });

  it("un rechazo del servidor llega como ApiError con código, campos y requestId", async () => {
    const { request } = clientWith(
      json(
        {
          error: {
            code: "dato_invalido",
            message: "Revisa los datos enviados.",
            details: [{ field: "quantity", problem: "requerido" }],
            requestId: "abc-12345",
          },
        },
        422,
      ),
    );
    const error = await request("/api/requests", { method: "POST" }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: "dato_invalido",
      message: "Revisa los datos enviados.",
      details: [{ field: "quantity", problem: "requerido" }],
      requestId: "abc-12345",
      needsSession: false,
    });
  });

  it("un 401 avisa que hay que elegir persona de nuevo", async () => {
    const { request } = clientWith(
      json({ error: { code: "no_autenticado", message: "Primero elige." } }, 401),
    );
    const error = await request("/api/me").catch((caught: unknown) => caught);

    expect((error as ApiError).needsSession).toBe(true);
  });

  it("una respuesta de error que no es JSON da un mensaje genérico, sin filtrar el contenido", async () => {
    const { request } = clientWith(new Response("<html>Bad Gateway nginx/1.2</html>", { status: 502 }));
    const error = await request("/api/state").catch((caught: unknown) => caught);

    expect(error).toMatchObject({ status: 502, code: "desconocido" });
    expect(errorMessage(error)).toBe("Algo falló de nuestro lado. Intenta de nuevo.");
  });

  it("sin red da un mensaje claro, y una respuesta vacía no rompe", async () => {
    const offline = clientWith(new TypeError("fetch failed"));
    const empty = clientWith(new Response(null, { status: 204 }));
    const error = await offline.request("/api/state").catch((caught: unknown) => caught);

    expect(error).toMatchObject({ status: 0, code: "sin_conexion" });
    expect(errorMessage(error)).toContain("Revisa tu conexión");
    expect(await empty.request("/api/state")).toBeUndefined();
  });

  it("si quien llamó cancela la petición, se propaga su cancelación y no un error de red", async () => {
    const controller = new AbortController();
    controller.abort();
    const aborted = new DOMException("Aborted", "AbortError");
    const { request } = clientWith(aborted);

    await expect(request("/api/state", { signal: controller.signal })).rejects.toBe(aborted);
  });

  it("nunca llama a una ruta que no sea de nuestra API", async () => {
    const { request, fetchMock } = clientWith(json({}));
    const error = await request("https://otro.example/api/state").catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: "ruta_invalida" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorMessage(new Error("interno: tabla workers"))).toBe(
      "Algo falló de nuestro lado. Intenta de nuevo.",
    );
    const microphone = Object.assign(new Error("Sin permiso para el micrófono."), {
      name: "MicrophoneError",
    });
    expect(errorMessage(microphone)).toBe("Sin permiso para el micrófono.");
  });
});
