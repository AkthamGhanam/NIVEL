import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { IDS } from "../db/seed/cast";
import { ACTORS, createTestApp, DEMO_NOW, type TestApp } from "../testing/test-app";
import { setDemoBot } from "./demo";
import { listMyOffers } from "./invitations";
import { activeRequestBoard, createJobRequest, inviteCandidates } from "./requests";

let app: TestApp;
let requestId: string;

const after = (seconds: number) => app.setNow(new Date(DEMO_NOW.getTime() + seconds * 1000));
const statusOf = async (actor: (typeof ACTORS)["rafael" | "jose" | "luis" | "carlos"]) =>
  (await listMyOffers(app.context, actor))[0]?.status;

beforeAll(async () => {
  app = await createTestApp();
  const created = await createJobRequest(app.context, ACTORS.company, {
    trade: "soldador",
    quantity: 3,
    minLevel: 2,
    zone: "Los Guayos",
    startDate: "el martes",
    days: 5,
    dailyPayUsd: 25,
    contractType: "obra_determinada",
    createdVia: "voz",
  });
  requestId = created.request.id;
  await inviteCandidates(app.context, ACTORS.company, { requestId, quantity: 3 });
});

afterAll(() => app.close());

describe("bot de demo", () => {
  it("no responde antes de tiempo", async () => {
    after(2);
    const board = await activeRequestBoard(app.context, ACTORS.company);

    expect(board?.accepted).toBe(0);
  });

  it("apagado no responde por nadie", async () => {
    await setDemoBot(app.context, ACTORS.admin, false);
    after(30);
    const board = await activeRequestBoard(app.context, ACTORS.company);
    await setDemoBot(app.context, ACTORS.admin, true);

    expect(board?.accepted).toBe(0);
  });

  it("a los 3 segundos Rafael y José aceptan; Luis sigue pendiente", async () => {
    after(3);
    const board = await activeRequestBoard(app.context, ACTORS.company);

    expect(board?.accepted).toBe(2);
    expect(await statusOf(ACTORS.luis)).toBe("enviada");
    expect(board?.suggestedReplacement).toBeNull();
  });

  it("a los 6 segundos Luis rechaza y el tablero sugiere a Carlos R.", async () => {
    after(6);
    const board = await activeRequestBoard(app.context, ACTORS.company);

    expect(await statusOf(ACTORS.luis)).toBe("rechazada");
    expect(board?.suggestedReplacement?.workerId).toBe(IDS.carlos);
  });

  it("nunca responde por Carlos: su invitación espera a la persona", async () => {
    await inviteCandidates(app.context, ACTORS.company, { requestId, quantity: 1 });
    after(600);
    const board = await activeRequestBoard(app.context, ACTORS.company);

    expect(await statusOf(ACTORS.carlos)).toBe("enviada");
    expect(board?.accepted).toBe(2);
  });

  it("solo el equipo puede encender o apagar el bot", async () => {
    await expect(setDemoBot(app.context, ACTORS.company, false)).rejects.toThrow(/permiso/);
  });
});
