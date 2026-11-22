import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Actor } from "../actor";
import type { Database } from "../db/client";
import { contracts, fees, jobRequests } from "../db/schema";
import { isBusyError, writeTransaction } from "../db/write-transaction";
import { ConflictError } from "../errors";
import { ACTORS, createTestApp, type TestApp } from "../testing/test-app";
import { listMyOffers, respondToInvitation } from "./invitations";
import { createJobRequest, inviteCandidates } from "./requests";

/**
 * Varias personas tocando "aceptar" en el mismo instante: nadie recibe un
 * error del servidor y la cuadrilla nunca queda con más gente de la pedida.
 */

const SCRIPT_REQUEST = {
  trade: "soldador",
  quantity: 3,
  minLevel: 2,
  zone: "Los Guayos",
  startDate: "el martes",
  days: 5,
  dailyPayUsd: 25,
  contractType: "obra_determinada",
  createdVia: "web",
} as const;

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(() => app.close());

async function inviteTop(quantity: number): Promise<string> {
  const { request } = await createJobRequest(app.context, ACTORS.company, SCRIPT_REQUEST);
  await inviteCandidates(app.context, ACTORS.company, { requestId: request.id, quantity });
  return request.id;
}

async function acceptAllAtOnce(people: readonly Actor[]) {
  const invitationIds = await Promise.all(
    people.map(async (person) => (await listMyOffers(app.context, person))[0]?.invitationId ?? ""),
  );
  return Promise.allSettled(
    people.map((person, index) =>
      respondToInvitation(app.context, person, { invitationId: invitationIds[index] ?? "", accept: true }),
    ),
  );
}

describe("aceptaciones simultáneas", () => {
  it("tres personas aceptan a la vez y las tres quedan contratadas", async () => {
    const requestId = await inviteTop(3);
    const results = await acceptAllAtOnce([ACTORS.rafael, ACTORS.jose, ACTORS.luis]);
    const [request] = await app.context.db.select().from(jobRequests).where(eq(jobRequests.id, requestId));

    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled", "fulfilled"]);
    expect(request?.status).toBe("completa");
  });

  it("si aceptan cuatro para tres puestos, entran tres y la cuarta recibe un aviso claro", async () => {
    const requestId = await inviteTop(4);
    const results = await acceptAllAtOnce([ACTORS.rafael, ACTORS.jose, ACTORS.luis, ACTORS.carlos]);
    const rejected = results.filter((result) => result.status === "rejected");
    const hired = await app.context.db.select().from(contracts).where(eq(contracts.requestId, requestId));
    const charged = await app.context.db.select().from(fees).where(eq(fees.status, "por_pagar"));

    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(ConflictError);
    expect(hired).toHaveLength(3);
    expect(charged).toHaveLength(3);
  });
});

describe("writeTransaction", () => {
  const busy = () => Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });
  const fakeDb = (transaction: ReturnType<typeof vi.fn>) => ({ transaction }) as unknown as Database;

  it("reconoce la base ocupada aunque el error venga envuelto", () => {
    expect(isBusyError(busy())).toBe(true);
    expect(isBusyError(new Error("fallo", { cause: busy() }))).toBe(true);
    expect(isBusyError(Object.assign(new Error("x"), { code: "SQLITE_BUSY_SNAPSHOT" }))).toBe(true);
    expect(isBusyError(Object.assign(new Error("x"), { code: "SQLITE_CONSTRAINT" }))).toBe(false);
    expect(isBusyError("SQLITE_BUSY")).toBe(false);
  });

  it("reintenta cuando la base está ocupada y devuelve el resultado", async () => {
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(busy())
      .mockRejectedValueOnce(busy())
      .mockResolvedValue("ok");

    expect(await writeTransaction(fakeDb(transaction), async () => "ok")).toBe("ok");
    expect(transaction).toHaveBeenCalledTimes(3);
    expect(transaction.mock.calls[0]?.[1]).toEqual({ behavior: "immediate" });
  });

  it("no reintenta un error de negocio, y se rinde si la base sigue ocupada", async () => {
    vi.useFakeTimers();
    const conflict = vi.fn().mockRejectedValue(new ConflictError("Ya fue respondida."));
    const alwaysBusy = vi.fn().mockRejectedValue(busy());

    await expect(writeTransaction(fakeDb(conflict), async () => 1)).rejects.toBeInstanceOf(ConflictError);
    expect(conflict).toHaveBeenCalledTimes(1);

    const attempt = writeTransaction(fakeDb(alwaysBusy), async () => 1);
    const settled = expect(attempt).rejects.toMatchObject({ code: "SQLITE_BUSY" });
    await vi.runAllTimersAsync();
    await settled;
    expect(alwaysBusy).toHaveBeenCalledTimes(7);
    vi.useRealTimers();
  });
});
