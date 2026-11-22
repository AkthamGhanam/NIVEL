import { afterEach, describe, expect, it, vi } from "vitest";

import { dispatch, startInProcessApi } from "../testing/in-process-api";

/** Composición real (entorno → base → API). Cada prueba carga los módulos desde cero. */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const getState = () => dispatch(new Request("http://localhost:3000/api/state"));
const enterAsCompany = () =>
  dispatch(
    new Request("http://localhost:3000/api/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "company", id: "co-guayos" }),
    }),
  );

describe("API en vivo", () => {
  it("sin configurar responde 503 y se recupera cuando el entorno queda completo", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("TURSO_DATABASE_URL", "");
    vi.stubEnv("SESSION_SECRET", "");

    expect((await getState()).status).toBe(503);

    vi.resetModules();
    const api = startInProcessApi();
    const response = await getState();
    api.dispose();

    expect(response.status).toBe(200);
  });

  it("crea las tablas en el primer uso: una base vacía responde sin personajes", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const api = startInProcessApi();
    const state = await (await getState()).json();
    api.dispose();

    expect(state.personas.workers).toEqual([]);
    expect(state.flags).toEqual({ bot: false, simulation: false });
  });

  it("marca la cookie como Secure solo cuando la app se sirve por https", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const api = startInProcessApi();
    await dispatch(
      new Request("http://localhost:3000/api/demo/reset", {
        method: "POST",
        headers: { "x-demo-key": api.demoKey },
      }),
    );
    const local = await enterAsCompany();
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://nivel.example");
    const deployed = await enterAsCompany();
    api.dispose();

    expect(local.headers.get("set-cookie")).not.toContain("Secure");
    expect(deployed.headers.get("set-cookie")).toContain("Secure");
  });
});
