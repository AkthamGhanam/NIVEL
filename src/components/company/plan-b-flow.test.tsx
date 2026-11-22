import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, createApiRequest } from "@/client/api";
import { type CompanyApi, createCompanyApi } from "@/client/company-api";
import { CONTRACTOR_CLOSING, CONTRACTOR_OPENING, contractorScript, isPlanB } from "@/client/plan-b";
import { createScriptedNivi, type ScriptedNivi } from "@/client/scripted-nivi";
import { createSpeechPlayer } from "@/client/speech-player";
import { createTeamApi } from "@/client/team-api";
import { IDS } from "@/server/db/seed/cast";
import { createBrowserFetch } from "@/server/testing/browser-fetch";
import { type InProcessApi, startInProcessApi } from "@/server/testing/in-process-api";

import { RequestHeader } from "./board";

/**
 * Plan B de punta a punta contra las rutas reales: Nivi sigue el guion sin
 * conectarse al agente en vivo, y aun así la solicitud, las invitaciones y la
 * bitácora quedan como en una conversación de verdad.
 */

const ZONE = "Los Guayos";
const REQUEST_LINE = "Necesito 3 soldadores de Nivel 2 en Los Guayos, por 5 días, a 25 dólares diarios.";
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
  const nivi = createScriptedNivi({
    script: () => contractorScript({ api, zone, refresh }),
    speak: player.speak,
    stopSpeaking: player.stop,
    schedule: () => noop,
  });
  return { nivi, played, refresh };
}

const lines = (nivi: ScriptedNivi) => nivi.getState().bubbles.map(({ from, text }) => `${from}: ${text}`);
const niviLines = (nivi: ScriptedNivi) => nivi.getState().bubbles.filter((line) => line.from === "nivi");

async function until(done: () => boolean) {
  await vi.waitFor(() => expect(done()).toBe(true), { timeout: 4000, interval: 10 });
}

/** El turno de la persona: envía su frase y espera a que Nivi responda. */
async function sayTurn(nivi: ScriptedNivi, text: string) {
  const before = niviLines(nivi).length;
  nivi.send(text);
  await until(() => niviLines(nivi).length > before && nivi.getState().activity === "listening");
}

async function openTalk(nivi: ScriptedNivi) {
  nivi.start("voz");
  await until(() => nivi.getState().bubbles.length === 1 && nivi.getState().activity === "listening");
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
    const { nivi: session, played } = planB();

    await openTalk(session);

    expect(lines(session)).toEqual([`nivi: ${CONTRACTOR_OPENING}`]);
    expect(session.getState()).toMatchObject({ live: true, ended: false, mode: "voz" });
    expect(played).toEqual([expect.stringMatching(/^\/api\/voice\/audio\/[a-f0-9]{64}$/)]);
    const called = elevenLabs.mock.calls.map(([url]) => (url as URL).pathname);
    expect(called.every((path) => path.startsWith("/v1/text-to-speech/"))).toBe(true);
    session.stop();
  });

  it("el primer turno crea la solicitud real y Nivi dice quién cumple y cuánto cuesta en regla", async () => {
    const { nivi: session, refresh } = planB();
    await openTalk(session);

    await sayTurn(session, REQUEST_LINE);

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
    expect(lines(session)[1]).toBe(`tu: ${REQUEST_LINE}`);
    expect(lines(session)[2]).toMatch(
      /^nivi: Listo\. \d+ soldadores de nivel 2 o más cumplen cerca de Los Guayos\./,
    );
    expect(lines(session)[2]).toMatch(/costo legal estimado.*IVA.*¿Invito/);
    expect(refresh).toHaveBeenCalledOnce();
    expect(renderToStaticMarkup(<RequestHeader request={board!.request} />)).toContain("Pedida por voz");

    await sayTurn(session, "Sí, invítalos.");

    const invited = (await company.board())?.invitations ?? [];
    expect(invited).toHaveLength(3);
    expect(lines(session)[3]).toBe("tu: Sí, invítalos.");
    expect(lines(session)[4]).toMatch(/^nivi: Invité a .+ y .+\. Te aviso en pantalla cuando respondan\.$/);
    for (const { candidate } of invited) {
      expect(lines(session)[4]).toContain(candidate!.shortName.replace(/\.$/, ""));
    }
    expect(refresh).toHaveBeenCalledTimes(2);

    await sayTurn(session, "Gracias.");

    expect(lines(session).at(-1)).toBe(`nivi: ${CONTRACTOR_CLOSING}`);
    expect((await company.board())?.invitations).toHaveLength(3);
    session.stop();
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
    const { nivi: session, played } = planB(company, "Guacara");

    await openTalk(session);
    await sayTurn(session, "Necesito soldadores en Guacara");

    expect(played).toHaveLength(1);
    expect(lines(session)[1]).toBe("tu: Necesito soldadores en Guacara");
    expect(lines(session)[2]).toMatch(/^nivi: .*Guacara/);
    expect(session.getState().live).toBe(true);
    session.stop();
  });

  it("si el servidor rechaza un paso, Nivi pide repetir en vez de quedarse callada", async () => {
    const failing: CompanyApi = {
      ...company,
      createRequest: async () => {
        throw new ApiError({ status: 422, code: "invalido", message: "Revisa los datos." });
      },
    };
    const { nivi: session } = planB(failing);
    await openTalk(session);

    await sayTurn(session, REQUEST_LINE);

    expect(lines(session).at(-1)).toMatch(/^nivi: No pude completar ese paso/);
    session.stop();
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
