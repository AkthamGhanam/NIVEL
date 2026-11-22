import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { IDS } from "../../src/server/db/seed/cast";
import { dispatch, type InProcessApi, startInProcessApi } from "../../src/server/testing/in-process-api";
import { ApiClient } from "./client";
import { runGoldenPath, type SmokeClients, type SmokeResult } from "./golden-path";

/**
 * El mismo smoke de `npm run smoke`, pero contra los archivos de ruta reales
 * importados en proceso. Después comprueba los rechazos por HTTP.
 */

let api: InProcessApi;
let clients: SmokeClients;
let result: SmokeResult;
const steps: string[] = [];

const newClient = () => new ApiClient(api.baseUrl, dispatch, api.demoKey);

async function workerClient(workerId: string): Promise<ApiClient> {
  const client = newClient();
  await client.enterAs("worker", workerId);
  return client;
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

beforeAll(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  api = startInProcessApi();
  const workers = new Map<string, ApiClient>();
  clients = {
    company: newClient(),
    team: newClient(),
    worker: async (workerId) => {
      const client = workers.get(workerId) ?? (await workerClient(workerId));
      workers.set(workerId, client);
      return client;
    },
  };
  result = await runGoldenPath(clients, (title) => steps.push(title));
});

afterAll(() => api.dispose());

describe("smoke del camino dorado por las rutas reales", () => {
  it("recorre los 17 pasos en orden", () => {
    expect(steps).toHaveLength(17);
    expect(steps.at(-1)).toContain("17.");
  });

  it("el tablero de la empresa muestra la cuadrilla con firma, asistencia y pago", async () => {
    const { board } = await clients.company.get<{
      board: { crew: Array<{ workerId: string; status: string; daysAttended: number; payment: unknown }> };
    }>("/api/requests/active");
    const carlos = board.crew.find((member) => member.workerId === IDS.carlos);

    expect(board.crew).toHaveLength(3);
    expect(carlos).toMatchObject({ status: "completado", daysAttended: 5, ratedByCompany: true });
    expect(carlos?.payment).not.toBeNull();
    expect(JSON.stringify(board)).not.toContain("otpHash");
  });

  it("el contrato de Carlos trae sus 5 días de asistencia y el pago confirmado", async () => {
    const carlos = await clients.worker(IDS.carlos);
    const contract = await carlos.get<{
      attendance: unknown[];
      payment: { confirmedByWorkerAt: string | null } | null;
    }>(`/api/contracts/${result.contractId}`);

    expect(contract.attendance).toHaveLength(5);
    expect(contract.payment?.confirmedByWorkerAt).not.toBeNull();
    expect(contract).not.toHaveProperty("otpHash");
  });

  it("el estado público lista personajes del seed y la persona activa de cada vista", async () => {
    const state = await clients.company.get<{
      personas: { workers: unknown[]; companies: unknown[] };
      active: { companyId: string | null; workerId: string | null; admin: boolean };
      flags: { simulation: boolean };
    }>("/api/state");

    expect(state.personas.workers).toHaveLength(40);
    expect(state.active).toMatchObject({ companyId: IDS.activeCompany, workerId: null, admin: false });
    expect(state.flags.simulation).toBe(true);
  });
});

describe("rechazos por HTTP", () => {
  it("sin sesión responde 401 y con la sesión de otro rol también", async () => {
    const anonymous = newClient();
    const carlos = await clients.worker(IDS.carlos);

    expect((await anonymous.call("GET", "/api/requests/active")).status).toBe(401);
    expect((await carlos.call("GET", "/api/requests/active")).status).toBe(401);
    expect((await anonymous.call("GET", "/api/events")).status).toBe(401);
    expect((await anonymous.call("POST", "/api/demo/reset")).status).toBe(401);
  });

  it("un trabajador no puede leer el contrato ni el recibo de otro (403)", async () => {
    const luis = await clients.worker(IDS.luis);
    const contract = await luis.call("GET", `/api/contracts/${result.contractId}`);

    expect(contract.status).toBe(403);
    expect(JSON.stringify(contract.data)).not.toContain("dailyPayUsd");
  });

  it("valida el cuerpo: campos de más o valores fuera de rango dan 422 con el campo señalado", async () => {
    const extra = await clients.company.call<{ error: { code: string; details: Array<{ field: string }> } }>(
      "POST",
      "/api/requests",
      { body: { trade: "soldador", companyId: "co-moron" } },
    );
    const badId = await clients.company.call("POST", "/api/requests/..%2Fx/invite", {
      body: { quantity: 1 },
    });

    expect(extra.status).toBe(422);
    expect(extra.data.error.code).toBe("dato_invalido");
    expect(extra.data.error.details.map((detail) => detail.field)).toContain("quantity");
    expect(badId.status).toBe(422);
  });

  it("rechaza una petición de otro origen aunque traiga la cookie (CSRF)", async () => {
    const forged = await clients.company.call("POST", "/api/requests", {
      body: {},
      headers: { origin: "https://sitio-malicioso.example", host: "localhost:3000" },
    });

    expect(forged.status).toBe(403);
  });

  it("el selector no deja entrar como alguien inexistente ni como equipo con clave errada", async () => {
    const visitor = newClient();

    expect(
      (await visitor.call("POST", "/api/state", { body: { role: "worker", id: "w-nadie" } })).status,
    ).toBe(404);
    expect(
      (await visitor.call("POST", "/api/state", { body: { role: "admin", key: "x".repeat(40) } })).status,
    ).toBe(401);
    expect((await visitor.call("GET", "/api/events")).status).toBe(401);
  });

  it("nadie entra como una persona real del evento, y el reset normal conserva su perfil", async () => {
    const { app } = await import("../../src/server/app");
    const { workers } = await import("../../src/server/db/schema");
    const { handle } = await app();
    await handle.db.insert(workers).values({
      id: "w-real-1",
      name: "Persona Real",
      trade: "soldador",
      skills: [],
      zone: "Valencia",
      lat: 10.162,
      lng: -68.007,
      availability: "inmediata",
      createdVia: "voz",
      isReal: true,
      createdAt: new Date().toISOString(),
    });
    const visitor = newClient();

    const entry = await visitor.call("POST", "/api/state", { body: { role: "worker", id: "w-real-1" } });
    const state = await visitor.get<{ personas: { workers: Array<{ id: string }> } }>("/api/state");
    const summary = await clients.team.post<{ keptRealWorkers: number }>("/api/demo/reset", { as: "admin" });

    expect(entry.status).toBe(403);
    expect(state.personas.workers.map((worker) => worker.id)).not.toContain("w-real-1");
    expect(summary.keptRealWorkers).toBe(1);
  });

  it("entra como academia del seed; una empresa o academia inexistente da 404", async () => {
    const visitor = newClient();
    const state = await visitor.post<{ active: { academyId: string | null } }>("/api/state", {
      body: { role: "academy", id: IDS.academy },
    });

    expect(state.active.academyId).toBe(IDS.academy);
    expect(
      (await visitor.call("POST", "/api/state", { body: { role: "company", id: "co-nadie" } })).status,
    ).toBe(404);
    expect(
      (await visitor.call("POST", "/api/state", { body: { role: "academy", id: "ac-nadie" } })).status,
    ).toBe(404);
  });

  it("con la clave correcta abre sesión de equipo y lee la bitácora y la cola de reportes", async () => {
    const team = newClient();
    await team.post("/api/state", { body: { role: "admin", key: api.demoKey } });
    const { events } = await team.get<{ events: Array<{ type: string }> }>("/api/events");
    const { reports } = await team.get<{ reports: unknown[] }>("/api/reports");
    const badSince = await team.call("GET", "/api/events?since=ayer");

    expect(events.map((event) => event.type)).toContain("demo_reiniciada");
    expect(reports).toEqual([]);
    expect(badSince.status).toBe(422);
  });

  it("una ruta que no existe o un método sin manejador no se resuelven", async () => {
    expect((await newClient().call("GET", "/api/no-existe")).status).toBe(404);
    expect((await newClient().call("POST", "/api/level")).status).toBe(405);
  });

  it("reiniciar deja la demo como al principio y sin obra activa que avanzar", async () => {
    const summary = await clients.team.post<{ insertedRows: number; keptRealWorkers: number }>(
      "/api/demo/reset?all=1",
      {
        as: "admin",
      },
    );
    const { board } = await clients.company.get<{ board: unknown }>("/api/requests/active");
    const forward = await clients.team.call("POST", "/api/demo/fast-forward", { as: "admin" });

    expect(summary.insertedRows).toBeGreaterThan(500);
    expect(summary.keptRealWorkers).toBe(0);
    expect(board).toBeNull();
    expect(forward.status).toBe(409);
  });
});
