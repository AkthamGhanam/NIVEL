// Rutas de Telegram contra los archivos de ruta reales.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "../../../../scripts/smoke/client";
import { IDS } from "../../db/seed/cast";
import { dispatch, type InProcessApi, startInProcessApi } from "../../testing/in-process-api";

let api: InProcessApi;
let client: ApiClient;

const webhook = (
  headers: Record<string, string>,
  body: unknown = { message: { chat: { id: 1, type: "private" } } },
) =>
  dispatch(
    new Request(`${api.baseUrl}/api/telegram/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

beforeAll(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  api = startInProcessApi();
  client = new ApiClient(api.baseUrl, dispatch, api.demoKey);
  await client.post("/api/demo/reset", { as: "admin" });
});

afterAll(() => api.dispose());

describe("webhook de Telegram", () => {
  it("rechaza cualquier llamada sin la firma acordada con Telegram", async () => {
    expect((await webhook({})).status).toBe(401);
    expect((await webhook({ "x-telegram-bot-api-secret-token": "adivinado" })).status).toBe(401);
  });
});

describe("conectar Telegram desde la app", () => {
  it("exige sesión de trabajador o de empresa", async () => {
    await expect(client.get("/api/telegram/link")).rejects.toMatchObject({ status: 401 });
    await expect(client.post("/api/telegram/setup")).rejects.toMatchObject({ status: 401 });
  });

  it("sin bot configurado, la app lo dice y no ofrece el enlace", async () => {
    await client.post("/api/state", { body: { role: "worker", id: IDS.carlos } });

    await expect(client.get("/api/telegram/link", { as: "worker" })).resolves.toEqual({
      available: false,
      linked: false,
    });
    await expect(client.post("/api/telegram/link", { as: "worker", body: {} })).rejects.toMatchObject({
      status: 409,
    });
    await expect(client.post("/api/telegram/setup", { as: "admin" })).rejects.toMatchObject({ status: 409 });
  });
});

describe("entrar a la app desde el bot", () => {
  it("un código inventado no abre ninguna sesión: lleva a la portada", async () => {
    const response = await dispatch(new Request(`${api.baseUrl}/api/telegram/enter?c=en-inventado`));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
