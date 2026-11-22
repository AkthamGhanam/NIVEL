import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, createApiRequest } from "@/client/api";
import { type CompanyApi, createCompanyApi } from "@/client/company-api";
import { createNiviSession, type NiviSession } from "@/client/nivi-session";
import {
  CONTRACTOR_CLOSING,
  CONTRACTOR_OPENING,
  contractorScript,
  isPlanB,
  PLAN_B_TOKEN,
} from "@/client/plan-b";
import { createScriptedAgent } from "@/client/scripted-agent";
import { createSpeechPlayer } from "@/client/speech-player";
import { createTeamApi } from "@/client/team-api";
import { IDS } from "@/server/db/seed/cast";
import { createBrowserFetch } from "@/server/testing/browser-fetch";
import { type InProcessApi, startInProcessApi } from "@/server/testing/in-process-api";

import { DemoControls } from "../demo/demo-controls";
import { DemoStage } from "../demo/demo-stage";
import { RequestHeader } from "./board";

/**
 * Plan B de punta a punta contra las rutas reales: Nivi sigue el guion sin
 * conectarse al agente en vivo, y aun así la solicitud, las invitaciones y la
 * bitácora quedan como en una conversación de verdad.
 */

const ZONE = "Los Guayos";
let server: InProcessApi;
let company: CompanyApi;
let elevenLabs: ReturnType<typeof vi.fn>;

const browser = () => createApiRequest(createBrowserFetch(server.baseUrl));
const noop = () => undefined;

/** La conversación que monta la pantalla en plan B, con audios que "suenan" al instante. */
function planB(api: CompanyApi = company, zone = ZONE) {
  const played: string[] = [];
  const refresh = vi.fn(async () => undefined);
  const player = createSpeechPlayer({
    audioUrlFor: api.speak,
    createClip: (url, events) => {
      played.push(url);
      return { play: async () => events.onEnd(), pause: noop };
    },
    wait: async () => undefined,
  });
  const fetchToken = vi.fn(async () => PLAN_B_TOKEN);
  const session = createNiviSession({
    fetchToken,
    connect: createScriptedAgent({
      script: () => contractorScript({ api, zone, refresh }),
      speak: player.speak,
      stopSpeaking: player.stop,
      turnPauseMs: 5,
    }),
    mode: "nota",
  });
  return { session, played, refresh, fetchToken };
}

const lines = (session: NiviSession) => session.getState().lines.map(({ from, text }) => `${from}: ${text}`);

async function until(done: () => boolean) {
  await vi.waitFor(() => expect(done()).toBe(true), { timeout: 4000, interval: 10 });
}

/** Mantener presionado y soltar: el turno de la persona. Espera a que Nivi responda. */
async function sayTurn(session: NiviSession) {
  const before = session.getState().lines.filter((line) => line.from === "nivi").length;
  session.hold();
  session.release();
  await until(() => {
    const { lines: now, activity } = session.getState();
    return now.filter((line) => line.from === "nivi").length > before && activity !== "speaking";
  });
}

async function openCall(session: NiviSession) {
  await session.start();
  await until(() => session.getState().lines.length === 1 && session.getState().activity !== "speaking");
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

beforeAll(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  server = startInProcessApi();
  vi.stubEnv("ELEVENLABS_API_KEY", "clave-de-voz");
  vi.stubEnv("EL_VOICE_ID", "voz-nivi");
  // ElevenLabs solo sintetiza frases aquí: en plan B nadie pide un token de conversación.
  elevenLabs = vi.fn(async () => new Response(new Uint8Array([73, 68, 51, 4, 0])));
  vi.stubGlobal("fetch", elevenLabs);
  const team = createTeamApi(browser());
  await team.enter(server.demoKey);
  await team.reset();
  await team.setBot(false);
  company = createCompanyApi(browser());
  await company.enter(IDS.activeCompany);
});

afterAll(() => {
  vi.unstubAllGlobals();
  server.dispose();
});

describe("plan B del contratista", () => {
  it("solo `?planb=1` lo activa", () => {
    expect(isPlanB("1")).toBe(true);
    for (const value of [undefined, "", "0", "true", ["1"]]) expect(isPlanB(value)).toBe(false);
  });

  it("Nivi saluda sin pedir token de conversación, con su voz y el texto al lado", async () => {
    const { session, played, fetchToken } = planB();

    await openCall(session);

    expect(lines(session)).toEqual([`nivi: ${CONTRACTOR_OPENING}`]);
    expect(session.getState()).toMatchObject({ status: "live", conversationId: "plan-b", error: null });
    expect(played).toEqual([expect.stringMatching(/^\/api\/voice\/audio\/[a-f0-9]{64}$/)]);
    expect(fetchToken).toHaveBeenCalledOnce();
    const called = elevenLabs.mock.calls.map(([url]) => (url as URL).pathname);
    expect(called.every((path) => path.startsWith("/v1/text-to-speech/"))).toBe(true);
    await session.stop();
  });

  it("el primer turno crea la solicitud real y Nivi dice quién cumple y cuánto cuesta en regla", async () => {
    const { session, refresh } = planB();
    await openCall(session);

    await sayTurn(session);

    const board = await company.board();
    expect(board?.request).toMatchObject({
      trade: "soldador",
      quantity: 3,
      minLevel: 2,
      zone: ZONE,
      days: 5,
      dailyPayUsd: 25,
      createdVia: "voz",
      status: "abierta",
    });
    expect(lines(session)[1]).toBe(
      "persona: Necesito 3 soldadores de Nivel 2 o más en Los Guayos, por 5 días desde el martes, a 25 dólares diarios.",
    );
    expect(lines(session)[2]).toMatch(
      /^nivi: Listo\. \d+ soldadores de nivel 2 o más cumplen cerca de Los Guayos\./,
    );
    expect(lines(session)[2]).toMatch(/costo legal estimado.*IVA.*¿Invito/);
    expect(refresh).toHaveBeenCalledOnce();
    expect(renderToStaticMarkup(<RequestHeader request={board!.request} />)).toContain("Pedida por voz");

    await sayTurn(session);

    const invited = (await company.board())?.invitations ?? [];
    expect(invited).toHaveLength(3);
    expect(lines(session)[3]).toBe("persona: Sí, invítalos.");
    expect(lines(session)[4]).toMatch(/^nivi: Invité a .+ y .+\. Te aviso en pantalla cuando respondan\.$/);
    for (const { candidate } of invited) {
      expect(lines(session)[4]).toContain(candidate!.shortName.replace(/\.$/, ""));
    }
    expect(refresh).toHaveBeenCalledTimes(2);

    await sayTurn(session);

    expect(lines(session).at(-1)).toBe(`nivi: ${CONTRACTOR_CLOSING}`);
    expect((await company.board())?.invitations).toHaveLength(3);
    await session.stop();
  });

  it("la bitácora cuenta lo mismo que en una conversación en vivo", async () => {
    const team = createTeamApi(browser());
    await team.enter(server.demoKey);

    const types = (await team.events(undefined)).map((event) => event.type);

    expect(types).toContain("solicitud_creada");
    expect(types).toContain("invitaciones_enviadas");
  });

  it("sin servicio de voz el guion sigue: la frase nueva queda escrita y nada se rompe", async () => {
    elevenLabs.mockImplementation(async () => new Response("{}", { status: 500 }));
    // Otra zona: la respuesta de Nivi es una frase que no está en la caché.
    const { session, played } = planB(company, "Guacara");

    await openCall(session);
    session.sendText("Necesito soldadores en Guacara");
    await until(() => session.getState().lines.length === 3 && session.getState().activity !== "speaking");

    expect(played).toHaveLength(1);
    expect(lines(session)[1]).toBe("persona: Necesito soldadores en Guacara");
    expect(lines(session)[2]).toMatch(/^nivi: .*Guacara/);
    expect(session.getState().error).toBeNull();
    await session.stop();
  });

  it("si el servidor rechaza un paso, Nivi pide repetir en vez de quedarse callada", async () => {
    const failing: CompanyApi = {
      ...company,
      createRequest: async () => {
        throw new ApiError({ status: 422, code: "invalido", message: "Revisa los datos." });
      },
    };
    const { session } = planB(failing);
    await openCall(session);

    await sayTurn(session);

    expect(lines(session).at(-1)).toMatch(/^nivi: No pude completar ese paso/);
    await session.stop();
  });

  it("el servidor solo acepta `voz` o `web` como origen de una solicitud", async () => {
    const request = browser();
    await createCompanyApi(request).enter(IDS.activeCompany);
    const body = {
      trade: "soldador",
      quantity: 1,
      minLevel: 2,
      zone: ZONE,
      startDate: "el martes",
      days: 1,
      dailyPayUsd: 25,
      contractType: "obra_determinada",
      via: "seed",
    };

    await expect(request("/api/requests", { as: "company", method: "POST", body })).rejects.toMatchObject({
      status: 422,
    });
  });
});

describe("plan B en el Modo Jurado", () => {
  it("con el plan B, la web del contratista abre con el guion; sin él, con el agente en vivo", () => {
    expect(renderToStaticMarkup(<DemoStage planB />)).toContain('<iframe src="/c?planb=1"');
    expect(renderToStaticMarkup(<DemoStage />)).toContain('<iframe src="/c"');
  });

  it("el presentador lo enciende con un interruptor que dice su estado y tiene a mano el chequeo previo", () => {
    const controls = (planBOn: boolean) =>
      renderToStaticMarkup(
        <DemoControls
          bot={false}
          onBot={noop}
          planB={planBOn}
          onPlanB={noop}
          onFastForward={noop}
          onReset={noop}
          pending={false}
          notice={null}
          error={null}
        />,
      );

    expect(controls(true)).toMatch(/role="switch" aria-checked="true" aria-labelledby="planb-titulo"/);
    expect(controls(true)).toContain("Nivi sigue el guion, sin el agente en vivo");
    expect(controls(false)).toContain("Apagado: Nivi conversa en vivo");
    expect(controls(false)).toContain('href="/demo/check"');
  });
});
