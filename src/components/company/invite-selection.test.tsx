// La empresa elige a quién invitar.
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApiRequest } from "@/client/api";
import { type CompanyApi, createCompanyApi, type RequestBoard } from "@/client/company-api";
import { IDS } from "@/server/db/seed/cast";
import { createBrowserFetch } from "@/server/testing/browser-fetch";
import { dispatch, type InProcessApi, startInProcessApi } from "@/server/testing/in-process-api";

import { ApiClient } from "../../../scripts/smoke/client";
import { CandidateList } from "./board";

let server: InProcessApi;
let company: CompanyApi;
let requestId: string;

const noop = () => undefined;

async function boardNow(): Promise<RequestBoard> {
  const board = await company.board();
  if (!board) throw new Error("Debería haber una solicitud activa");
  return board;
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

beforeAll(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  server = startInProcessApi();
  const team = new ApiClient(server.baseUrl, dispatch, server.demoKey);
  await team.post("/api/demo/reset", { as: "admin" });
  await team.post("/api/demo/bot", { as: "admin", body: { state: "off" } });
  company = createCompanyApi(createApiRequest(createBrowserFetch(server.baseUrl)));
  await company.enter(IDS.activeCompany);
  const created = await company.createRequest({
    trade: "soldador",
    quantity: 2,
    minLevel: 2,
    zone: "Los Guayos",
    startDate: "el martes",
    days: 5,
    dailyPayUsd: 25,
    contractType: "obra_determinada",
  });
  requestId = created.request.id;
});

afterAll(() => server.dispose());

describe("elegir a quién invitar", () => {
  it("cada persona que cumple tiene su casilla, además del atajo a los mejores", async () => {
    const board = await boardNow();
    const markup = renderToStaticMarkup(<CandidateList board={board} onInvite={noop} pending={false} />);

    expect(markup).toContain("Marca a quien quieras invitar");
    expect(markup.match(/type="checkbox"/g)).toHaveLength(board.candidates.length);
    expect(markup).toContain(`Elegir a ${board.candidates[0]?.shortName}`);
    expect(markup).toContain("Invitar a los 2 mejores");
  });

  it("invita solo a la persona elegida, aunque no sea la mejor", async () => {
    const board = await boardNow();
    const last = board.candidates.at(-1);
    if (!last || last.workerId === board.candidates[0]?.workerId)
      throw new Error("Hacen falta varias personas");

    const sent = await company.invite(requestId, { workerIds: [last.workerId] });

    expect(sent.map((invitation) => invitation.candidate.workerId)).toEqual([last.workerId]);
    const after = await boardNow();
    expect(after.invitations.map((invitation) => invitation.candidate?.workerId)).toEqual([last.workerId]);

    expect(after.suggestedReplacement).toBeNull();
  });

  it("no invita dos veces a la misma persona ni a quien no cumple", async () => {
    const board = await boardNow();
    const invited = board.invitations[0]?.candidate?.workerId ?? "";

    await expect(company.invite(requestId, { workerIds: [invited] })).rejects.toMatchObject({ status: 422 });
    await expect(company.invite(requestId, { workerIds: [IDS.andres, "w-no-existe"] })).rejects.toMatchObject(
      {
        status: 422,
      },
    );
    expect((await boardNow()).invitations).toHaveLength(1);
  });

  it("no acepta más de 10 personas a la vez", async () => {
    const ids = Array.from({ length: 11 }, (_, index) => `w-${index}`);

    await expect(company.invite(requestId, { workerIds: ids })).rejects.toMatchObject({ status: 422 });
  });

  it("el atajo a los mejores sigue funcionando y salta a quien ya fue invitado", async () => {
    const before = await boardNow();
    const invited = new Set(before.invitations.map((invitation) => invitation.candidate?.workerId));

    const sent = await company.invite(requestId, { quantity: 1 });

    expect(sent).toHaveLength(1);
    expect(invited.has(sent[0]?.candidate.workerId)).toBe(false);
  });
});
