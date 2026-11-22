import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApiRequest } from "@/client/api";
import { createCompanyApi } from "@/client/company-api";
import { crewTimer, crewTimerLabel, eventLines } from "@/client/demo-view";
import { createEventFeed } from "@/client/event-feed";
import { createTeamApi, type EventRow, type TeamApi } from "@/client/team-api";
import { createWorkerApi } from "@/client/worker-api";
import { FORBIDDEN_WORDS } from "@/lib/legal-copy";
import { IDS } from "@/server/db/seed/cast";
import { createBrowserFetch } from "@/server/testing/browser-fetch";
import { type InProcessApi, startInProcessApi } from "@/server/testing/in-process-api";

import { TeamGate, TeamKeyForm } from "../team/team-gate";
import { QrCode } from "../ui/qr-code";
import { DemoControls, JoinCode, RealProfiles, ResetControl } from "./demo-controls";
import { DemoStage } from "./demo-stage";
import { EventLog } from "./event-log";

/**
 * El Modo Jurado contra las rutas reales: solo el equipo entra, la bitácora
 * cuenta lo que hacen la empresa y los trabajadores, y los controles del
 * presentador cambian la demo de verdad.
 */

let server: InProcessApi;
let team: TeamApi;
let feed: ReturnType<typeof createEventFeed<EventRow>>;

const noop = () => undefined;
const signal = new AbortController().signal;
const rendered: string[] = [];
const html = (element: ReactElement) => {
  const markup = renderToStaticMarkup(element);
  rendered.push(markup);
  return markup;
};
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const browser = () => createApiRequest(createBrowserFetch(server.baseUrl));
const types = (events: readonly EventRow[]) => events.map((event) => event.type);

async function answerFirstOffer(workerId: string, accept: boolean) {
  const worker = createWorkerApi(browser());
  await worker.enter(workerId);
  const [offer] = await worker.offers();
  return worker.respond(offer!.invitationId, accept);
}

const controls = (changes: Partial<Parameters<typeof DemoControls>[0]> = {}) =>
  html(
    <DemoControls
      bot
      onBot={noop}
      onFastForward={noop}
      onReset={noop}
      pending={false}
      notice={null}
      error={null}
      {...changes}
    />,
  );

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

beforeAll(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  server = startInProcessApi();
  team = createTeamApi(browser());
  feed = createEventFeed<EventRow>((since, abort) => team.events(since, abort));
});

afterAll(() => server.dispose());

describe("entrada del equipo", () => {
  it("antes de saber si hay sesión, la puerta dice con palabras que está cargando", () => {
    const markup = html(
      <TeamGate title="Modo Jurado">
        <p>contenido</p>
      </TeamGate>,
    );

    expect(markup).toMatch(/role="status".*Abriendo Modo Jurado…/);
    expect(markup).not.toContain("contenido");
  });

  it("sin la sesión del equipo no hay bitácora, controles ni perfiles", async () => {
    await expect(team.events(undefined)).rejects.toMatchObject({ status: 401 });
    await expect(team.reset()).rejects.toMatchObject({ status: 401 });
    await expect(team.setBot(false)).rejects.toMatchObject({ status: 401 });
    await expect(team.fastForward()).rejects.toMatchObject({ status: 401 });
    await expect(team.realProfiles()).rejects.toMatchObject({ status: 401 });
  });

  it("la clave se pide en un campo de contraseña y no se autocompleta", () => {
    const markup = html(<TeamKeyForm title="Modo Jurado" onEnter={noop} pending={false} error={null} />);

    expect(markup).toMatch(/<h1[^>]*>Modo Jurado<\/h1>/);
    expect(markup).toMatch(/<input[^>]*type="password"[^>]*autoComplete="off"/);
    expect(markup).toContain("Clave del equipo");
    expect(html(<TeamKeyForm title="x" onEnter={noop} pending error="La clave no es correcta." />)).toMatch(
      /role="alert".*La clave no es correcta\..*<button[^>]*disabled=""[^>]*>Entrando…/,
    );
  });

  it("una clave equivocada no abre nada; la correcta abre la sesión del equipo", async () => {
    await expect(team.enter("clave-equivocada")).rejects.toMatchObject({
      status: 401,
      message: "La clave no es correcta.",
    });
    expect((await team.state()).active.admin).toBe(false);

    const entered = await team.enter(server.demoKey);
    await team.reset();

    expect(entered.active.admin).toBe(true);
    expect((await team.state()).flags).toEqual({ bot: true, simulation: true });
  });

  it("una sesión de empresa o de trabajador no sirve para los controles del equipo", async () => {
    const company = createTeamApi(browser());
    await createCompanyApi(browser()).enter(IDS.activeCompany);

    await expect(company.events(undefined)).rejects.toMatchObject({ status: 401 });
  });
});

describe("bitácora y contador", () => {
  it("tras reiniciar, la bitácora empieza con ese hecho y el contador espera una solicitud", async () => {
    await team.reset();
    await team.setBot(false);
    feed.clear();
    const events = await feed.load(signal);
    const markup = html(<EventLog lines={eventLines(events)} />);

    expect(types(events)).toEqual(["demo_reiniciada", "bot_demo"]);
    expect(markup).toMatch(/role="log"[^>]*aria-live="polite"/);
    expect(text(markup)).toMatch(/\d{1,2}:\d{2} [ap]\. m\. Modo Jurado Bot de demo apagado/);
    expect(crewTimer(events)).toEqual({ state: "idle" });
    expect(html(<EventLog lines={[]} />)).toContain("Aún no pasa nada.");
  });

  it("cuenta la historia de la cuadrilla y detiene el contador cuando queda completa", async () => {
    const company = createCompanyApi(browser());
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
    await company.invite(created.request.id, 2);
    const running = await feed.load(signal);
    await answerFirstOffer(IDS.rafael, true);
    const accepted = await answerFirstOffer(IDS.jose, true);
    const worker = createWorkerApi(browser());
    await worker.enter(IDS.jose);
    await worker.sign(accepted.offer.contractId!, accepted.otp!);
    const events = await feed.load(signal);
    const timer = crewTimer(events);
    const lines = eventLines(events);

    expect(crewTimer(running).state).toBe("running");
    expect(types(events)).toEqual([
      "demo_reiniciada",
      "bot_demo",
      "solicitud_creada",
      "invitaciones_enviadas",
      "invitacion_aceptada",
      "invitacion_aceptada",
      "cuadrilla_completa",
      "contrato_firmado",
    ]);
    expect(timer.state).toBe("done");
    expect(crewTimerLabel(timer, new Date())).toMatch(/^Cuadrilla armada en 00:0\d$/);
    expect(lines[0]?.label).toBe("Contrato firmado con Constructora Los Guayos");
    expect(text(html(<EventLog lines={lines} />))).toContain(
      "Constructora Los Guayos Solicitud: 2 soldadores · 6 cumplen",
    );
    expect(JSON.stringify(events)).not.toContain(accepted.otp);
  });
});

describe("controles del presentador", () => {
  it("muestra avanzar, reiniciar y el bot con su estado en palabras", () => {
    const on = controls();
    const off = controls({ bot: false, pending: true, notice: "Bot de demo apagado." });

    expect(on).toContain("Avanzar a fin de obra");
    expect(on).toContain("Reiniciar demo");
    expect(on).toMatch(/role="switch" aria-checked="true" aria-labelledby="bot-titulo"/);
    expect(on).toContain("Rafael, José y Luis responden solos");
    expect(off).toMatch(/aria-checked="false"/);
    expect(off).toContain("Apagado: nadie responde solo");
    expect(off).toMatch(/<p role="status">Bot de demo apagado\.<\/p>/);
    expect(off.match(/disabled=""/g)).toHaveLength(3);
    expect(html(<ResetControl onReset={noop} pending={false} />)).not.toContain("Sí, reiniciar");
  });

  it("un error se anuncia de inmediato y tapa el aviso anterior", () => {
    const markup = controls({
      notice: "Demo reiniciada.",
      error: "No hay una obra activa con contratos firmados.",
    });

    expect(markup).toMatch(/role="alert".*No hay una obra activa con contratos firmados\./);
    expect(markup).not.toContain("Demo reiniciada.");
  });

  it("avanzar a fin de obra completa la asistencia de quienes ya firmaron", async () => {
    const result = await team.fastForward();
    const events = await feed.load(signal);

    expect(result.daysAdded).toBeGreaterThan(0);
    expect(types(events).at(-1)).toBe("avanzar_fin_obra");
  });

  it("el bot se enciende y se apaga, y la demo lo recuerda", async () => {
    expect(await team.setBot(true)).toEqual({ bot: true });
    expect((await team.state()).flags.bot).toBe(true);
    expect(await team.setBot(false)).toEqual({ bot: false });
    expect((await team.state()).flags.bot).toBe(false);
  });

  it("reiniciar devuelve la demo al inicio: sin obra que avanzar y con el bot encendido", async () => {
    await team.reset();
    feed.clear();
    const events = await feed.load(signal);

    expect(types(events)).toEqual(["demo_reiniciada"]);
    expect((await team.state()).flags.bot).toBe(true);
    await expect(team.fastForward()).rejects.toMatchObject({
      status: 409,
      message: "No hay una obra activa con contratos firmados.",
    });
  });
});

describe("público y escena", () => {
  it("el contador de perfiles reales solo dice nombre de pila, oficio y zona", async () => {
    const empty = await team.realProfiles();
    const some = { count: 1, profiles: [{ firstName: "María", trade: "electricista", zone: "Guacara" }] };

    expect(empty).toEqual({ count: 0, profiles: [] });
    expect(text(html(<RealProfiles data={empty} />))).toContain("Perfiles reales creados hoy 0");
    expect(text(html(<RealProfiles data={some} />))).toContain("1 María · electricista · Guacara");
    expect(html(<RealProfiles data={undefined} />)).toContain("…");
  });

  it("con mucho público lista a los primeros cuatro y cuenta al resto, para no tapar la bitácora", () => {
    const profiles = ["Ana", "Luis", "Rosa", "Juan", "Eva", "Raúl"].map((firstName) => ({
      firstName,
      trade: "albañil",
      zone: "Valencia",
    }));
    const crowd = text(html(<RealProfiles data={{ count: 6, profiles }} />));

    expect(crowd).toContain("Juan · albañil · Valencia");
    expect(crowd).not.toContain("Eva");
    expect(crowd).toContain("y 2 más");
  });

  it("el QR se dibuja en la página, con nombre accesible, y sin enlace público lo explica", () => {
    const withUrl = html(<JoinCode joinUrl="https://nivel.example/t" />);

    expect(withUrl).toMatch(/<svg role="img" aria-label="Código QR de la app del trabajador"/);
    expect(withUrl).toContain("https://nivel.example/t");
    expect(withUrl).not.toMatch(/<img|https?:\/\/(?!nivel\.example)/);
    expect(html(<JoinCode joinUrl={null} />)).toContain("El QR aparece cuando la demo está publicada");
    expect(html(<QrCode value="hola" label="Prueba" />)).toMatch(/<path d="M4 4h1v1h-1z/);
  });

  it("las dos vistas van en marcos del mismo origen, con título y solo los permisos que usan", () => {
    const markup = html(<DemoStage />);

    expect(markup).toMatch(
      /<iframe src="\/t\?demo=1" title="App del trabajador" allow="microphone; autoplay; geolocation"/,
    );
    expect(markup).toMatch(
      /<iframe src="\/c" title="Web del contratista" allow="microphone; autoplay; geolocation"/,
    );
    expect(markup.match(/<iframe/g)).toHaveLength(2);
    expect(markup).not.toMatch(/<iframe[^>]*src="https?:/);
  });

  it("nada de lo pintado lleva estilos en línea ni palabras prohibidas", () => {
    expect(rendered.length).toBeGreaterThan(12);
    for (const markup of rendered) {
      const lower = text(markup).toLowerCase();
      expect(markup).not.toMatch(/\sstyle="/);
      for (const word of FORBIDDEN_WORDS) expect(lower).not.toContain(word);
    }
  });
});
