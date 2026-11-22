import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApiRequest } from "@/client/api";
import { levelUpSpeech } from "@/client/level-up";
import { isReportKind } from "@/client/report-kinds";
import { type CompanyApi, createCompanyApi } from "@/client/company-api";
import type { Receipt } from "@/client/company-api";
import { type ContractDetail, createWorkerApi, type WorkerApi, type WorkerOffer } from "@/client/worker-api";
import { jobStep, offerSpeech, stepAction } from "@/client/worker-view";
import { SpokenNoteView } from "@/components/ui/spoken-note";
import {
  BLIND_RATING_NOTICE,
  DEMO_FOOTER,
  FORBIDDEN_WORDS,
  HUMAN_REVIEW_NOTICE,
  NOT_EMPLOYER_NOTICE,
  REFERENCE_BAND_NOTICE,
} from "@/lib/legal-copy";
import { IDS, northOfSite, SITE } from "@/server/db/seed/cast";
import { createBrowserFetch } from "@/server/testing/browser-fetch";
import { dispatch, type InProcessApi, startInProcessApi } from "@/server/testing/in-process-api";

import { ApiClient } from "../../../scripts/smoke/client";
import { ContractView } from "./contract-screen";
import { FinishView } from "./finish-screen";
import { ReportConfirmation, ReportForm } from "./help-screen";
import { LevelCard, NextStep, OfferList, OpenToWorkSwitch } from "./home-screen";
import { LearningView } from "./learning-screen";
import { LevelView } from "./level-screen";
import {
  AccountDeleted,
  ConsentList,
  DeleteAccount,
  ProfileForm,
  ProfileSummary,
  ReceivedRatings,
} from "./my-data-screen";
import { OfferVoiceNote } from "./offer-card";
import { OfferView } from "./offer-screen";
import { SiteView } from "./site-screen";
import { VOICE_REPORT_PROMISE, VoiceReportPanel } from "./voice-report";
import { WorkerGate } from "./worker-gate";
import { WorkerAccess } from "./worker-access";
import { WorkerShell } from "./worker-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/t",
  useRouter: () => ({ push: () => undefined }),
  useSearchParams: () => new URLSearchParams("demo=1"),
}));

/**
 * La app del trabajador de punta a punta, sin navegador: el cliente de la
 * pantalla habla con las rutas reales (misma cookie, mismo CSRF) y cada paso
 * del camino dorado de Carlos se pinta con lo que el servidor devolvió.
 */

let server: InProcessApi;
let worker: WorkerApi;
let company: CompanyApi;
let team: ApiClient;
let requestId: string;
let invitationId: string;
let contractId: string;
let paymentId: string;

/** Lo que "responde" ElevenLabs en estas pruebas: aquí se prueba la pantalla, no su red. */
const SPOKEN_AUDIO = new Uint8Array([73, 68, 51, 4, 0]);
const HEARD = "No había extintor en el área de soldadura.";
let elevenLabs: ReturnType<typeof vi.fn>;

const noop = () => undefined;
const idle = async () => undefined;
const rendered: string[] = [];
const html = (element: ReactElement) => {
  const markup = renderToStaticMarkup(element);
  rendered.push(markup);
  return markup;
};
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const browser = () => createApiRequest(createBrowserFetch(server.baseUrl));

async function workerClient(workerId: string): Promise<WorkerApi> {
  const api = createWorkerApi(browser());
  await api.enter(workerId);
  return api;
}

async function answerFirstOffer(workerId: string, accept: boolean) {
  const api = await workerClient(workerId);
  const [offer] = await api.offers();
  await api.respond(offer!.invitationId, accept);
}

const contractNow = () => worker.contract(contractId);
const siteView = (contract: ContractDetail, canSimulate = false) =>
  html(<SiteView contract={contract} onMark={noop} pending={false} error={null} canSimulate={canSimulate} />);
const finishView = (contract: ContractDetail) =>
  html(<FinishView contract={contract} onConfirm={noop} confirming={false} error={null} onRate={idle} />);
const learningActions = { onEnroll: noop, onProgress: noop, onBookTest: noop, pending: false };

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

beforeAll(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  server = startInProcessApi();
  vi.stubEnv("ELEVENLABS_API_KEY", "clave-de-voz");
  vi.stubEnv("EL_VOICE_ID", "voz-nivi");
  elevenLabs = vi.fn(async (url: URL) =>
    url.pathname === "/v1/speech-to-text"
      ? new Response(JSON.stringify({ text: HEARD }))
      : new Response(SPOKEN_AUDIO),
  );
  // El cliente de las pantallas usa su propio `fetch`; el global queda solo para el servicio de voz.
  vi.stubGlobal("fetch", elevenLabs);
  team = new ApiClient(server.baseUrl, dispatch, server.demoKey);
  await team.post("/api/demo/reset", { as: "admin" });
  // Las pruebas responden por cada persona: el bot queda apagado para que no se adelante.
  await team.post("/api/demo/bot", { as: "admin", body: { state: "off" } });
  worker = createWorkerApi(browser());
  company = createCompanyApi(browser());
  await company.enter(IDS.activeCompany);
});

afterAll(() => {
  vi.unstubAllGlobals();
  server.dispose();
});

describe("entrada del trabajador", () => {
  it("antes de saber quién entra, la puerta dice con palabras que está cargando", () => {
    const markup = html(
      <WorkerGate>
        <p>contenido</p>
      </WorkerGate>,
    );

    expect(markup).toMatch(/role="status".*Abriendo tu app…/);
    expect(markup).not.toContain("contenido");
  });

  it("sin sesión no ve ofertas ni perfil de nadie", async () => {
    await expect(worker.offers()).rejects.toMatchObject({ status: 401, needsSession: true });
    await expect(worker.profile()).rejects.toMatchObject({ status: 401 });
  });

  it("el acceso invita a crear el perfil y deja las cuentas de prueba a un lado, protagonistas primero", async () => {
    const state = await worker.state();
    const access = (error: string | null, accounts = state.personas.workers) =>
      html(
        <WorkerAccess
          api={worker}
          demoAccounts={accounts}
          onPickDemo={noop}
          onRegister={noop}
          onRegistered={noop}
          pending={false}
          error={error}
        />,
      );
    const markup = access(null);

    expect(state.active.workerId).toBeNull();
    expect(state.personas.workers.slice(0, 5).map((persona) => persona.id)).toEqual([
      IDS.carlos,
      IDS.rafael,
      IDS.jose,
      IDS.luis,
      IDS.andres,
    ]);
    expect(markup).toContain("Tu perfil de oficio, listo en dos minutos");
    expect(markup).toContain("Hablando con Nivi");
    expect(markup).toContain("Prefiero escribir");
    expect(markup).not.toContain("¿Quién eres hoy?");
    expect(markup).toContain("Entra con una cuenta de prueba");
    expect(markup).toContain('Entrar<span class="sr-only"> como Carlos Rodríguez</span>');
    expect(text(markup)).toContain("Carlos Rodríguez soldador · Los Guayos Nivel 2");
    expect(markup.replace(/<img src="\/brand\/[^>]*>/g, "")).not.toContain("<img");
    expect(access("No pudimos conectar.", [])).toMatch(
      /role="alert".*No pudimos conectar\..*cuentas de prueba aún no están cargadas/,
    );
  });

  it("al entrar como Carlos, el inicio muestra su nivel, la referencia de mercado y que no hay ofertas", async () => {
    const state = await worker.enter(IDS.carlos);
    const profile = await worker.profile();
    const shell = html(
      <WorkerShell firstName={profile.firstName} onSwitch={noop}>
        <p>contenido</p>
      </WorkerShell>,
    );
    const level = text(html(<LevelCard level={profile.level} />));

    expect(state.active.workerId).toBe(IDS.carlos);
    expect(shell).toContain("Carlos");
    expect(shell).toContain("Cambiar de cuenta");
    expect(shell).not.toContain("md:rounded-[56px]");
    expect(shell).toMatch(/<a [^>]*aria-current="page"[^>]*href="\/t"[^>]*>Inicio<\/a>/);
    // Las mismas cuatro secciones en el menú lateral (escritorio) y en la barra inferior (teléfono).
    expect(shell.match(/<li>/g)).toHaveLength(8);
    expect(shell).toContain(DEMO_FOOTER);
    expect(level).toContain("Nivel 2 · Verificado");
    expect(level).toContain("Te falta 1 trabajo confirmado para Nivel 3: Probado.");
    expect(level).toContain(`De $240 a $300 al mes. ${REFERENCE_BAND_NOTICE}`);
    expect(html(<OfferList offers={await worker.offers()} />)).toContain("Aún no tienes ofertas nuevas.");
  });

  it("con 'Abierto a trabajar' apagado, las empresas dejan de encontrarlo", async () => {
    const off = await worker.correctProfile({ openToWork: false });
    const created = await company.createRequest({
      trade: "soldador",
      quantity: 3,
      minLevel: 2,
      zone: "Los Guayos",
      startDate: "el martes",
      days: 5,
      dailyPayUsd: 25,
      contractType: "obra_determinada",
    });
    requestId = created.request.id;
    const hidden = (await company.board())?.candidates.map((candidate) => candidate.workerId);
    const on = await worker.correctProfile({ openToWork: true });
    const visible = (await company.board())?.candidates.map((candidate) => candidate.workerId);

    expect(html(<OpenToWorkSwitch open={off.openToWork} onChange={noop} pending={false} />)).toMatch(
      /aria-checked="false".*No recibes invitaciones nuevas|No recibes invitaciones nuevas.*aria-checked="false"/,
    );
    expect(html(<OpenToWorkSwitch open={on.openToWork} onChange={noop} pending />)).toMatch(
      /Las empresas pueden invitarte.*role="switch"[^>]*aria-checked="true"[^>]*disabled=""/,
    );
    expect(hidden).not.toContain(IDS.carlos);
    expect(visible).toContain(IDS.carlos);
  });
});

describe("oferta y contrato", () => {
  let offer: WorkerOffer;

  it("la invitación llega con la empresa, el trabajo y el pago, y dice que NIVEL no es el patrono", async () => {
    await company.invite(requestId, { quantity: 3 });
    await answerFirstOffer(IDS.rafael, true);
    await answerFirstOffer(IDS.jose, true);
    await answerFirstOffer(IDS.luis, false);
    await company.invite(requestId, { quantity: 1 });
    [offer] = (await worker.offers()) as [WorkerOffer];
    invitationId = offer.invitationId;
    const list = html(<OfferList offers={[offer]} />);
    const detail = html(<OfferView offer={offer} onRespond={noop} pending={false} error={null} />);

    expect(offer.status).toBe("enviada");
    expect(text(list)).toContain("Constructora Los Guayos Empresa verificada");
    expect(text(list)).toContain("Soldador en Los Guayos 5 días desde mar 24 nov $25 al día Total $125");
    expect(list).toContain(`href="/t/oferta/${invitationId}"`);
    expect(text(detail)).toContain("Tipo de contrato Por obra determinada");
    expect(detail).toContain(NOT_EMPLOYER_NOTICE);
    expect(detail).toMatch(/<h1[^>]*>Soldador en Los Guayos<\/h1>/);
    expect(detail.match(/<button/g)).toHaveLength(2);
    expect(html(<OfferView offer={offer} onRespond={noop} pending error="No pudimos conectar." />)).toMatch(
      /role="alert".*No pudimos conectar\..*<button[^>]*disabled=""[^>]*>Aceptar/,
    );
  });

  it("Nivi lee la oferta en voz alta cuando Carlos lo pide; repetirla no vuelve a gastar", async () => {
    const speak = vi.fn(worker.speak);
    const idleNote = html(<OfferVoiceNote offer={offer} speak={speak} />);
    const audioUrl = await worker.speak(offerSpeech(offer));
    const again = await worker.speak(offerSpeech(offer));
    const audio = await createBrowserFetch(server.baseUrl)(audioUrl);
    const playing = html(<SpokenNoteView state={{ kind: "ready", audioUrl }} action="" onListen={noop} />);

    // El audio no se pide hasta que la persona toca el botón.
    expect(idleNote).toMatch(/<button[^>]*>Escuchar la oferta<\/button>/);
    expect(speak).not.toHaveBeenCalled();
    expect(html(<OfferList offers={[offer]} speak={speak} />)).toContain("Escuchar la oferta");
    expect(html(<OfferView offer={offer} onRespond={noop} pending={false} error={null} />)).not.toContain(
      "Escuchar la oferta",
    );
    expect(audioUrl).toMatch(/^\/api\/voice\/audio\/[a-f0-9]{64}$/);
    expect(again).toBe(audioUrl);
    expect(elevenLabs).toHaveBeenCalledOnce();
    expect(audio.headers.get("content-type")).toBe("audio/mpeg");
    expect(new Uint8Array(await audio.arrayBuffer())).toEqual(SPOKEN_AUDIO);
    expect(playing).toMatch(new RegExp(`<audio controls="" autoPlay="" preload="none" src="${audioUrl}"`));
    expect(html(<SpokenNoteView state={{ kind: "loading" }} action="" onListen={noop} />)).toMatch(
      /role="status".*Nivi está preparando el audio…/,
    );
    expect(
      html(<SpokenNoteView state={{ kind: "failed" }} action="Escuchar la oferta" onListen={noop} />),
    ).toMatch(/Escuchar la oferta<\/button>.*role="alert".*Todo lo que dice está escrito aquí mismo\./);
  });

  it("una invitación que ya trae su audio lo muestra de una vez, solo si es de esta misma app", () => {
    const recorded = html(<OfferVoiceNote offer={{ ...offer, audioUrl: "/audio/oferta.mp3" }} />);
    const foreign = html(<OfferVoiceNote offer={{ ...offer, audioUrl: "https://otro.example/a.mp3" }} />);

    expect(recorded).toMatch(
      /Nota de voz de Nivi.*<audio controls="" preload="none" src="\/audio\/oferta\.mp3"/,
    );
    expect(foreign).toBe("");
  });

  it("nadie más puede responder la invitación de Carlos", async () => {
    const rafael = await workerClient(IDS.rafael);

    await expect(rafael.respond(invitationId, true)).rejects.toMatchObject({ status: 403 });
  });

  it("al aceptar nace el contrato directo con la empresa, pendiente de firma", async () => {
    const accepted = await worker.respond(invitationId, true);
    contractId = accepted.offer.contractId!;
    const contract = await contractNow();
    const markup = html(
      <ContractView contract={contract} onRequestCode={async () => "000000"} onSign={idle} />,
    );
    const [mine] = await worker.offers();

    expect(contract.status).toBe("pendiente_firma");
    expect(text(markup)).toContain("Empresa (patrono) Constructora Los Guayos");
    expect(text(markup)).toContain("Empieza mar 24 nov Duración 5 días Pago diario $25 Total $125");
    expect(markup).toContain(NOT_EMPLOYER_NOTICE);
    expect(markup).toContain("Enviarme el código");
    expect(markup).toContain('autoComplete="one-time-code"');
    expect(markup).toContain("Firmar contrato");
    expect(html(<OfferView offer={mine!} onRespond={noop} pending={false} error={null} />)).toMatch(
      /Aceptaste esta oferta.*href="\/t\/contrato\/[^"]+"[^>]*>Ver mi contrato/,
    );
    expect(html(<NextStep action={stepAction(jobStep(contract), contract.id)} />)).toContain(
      "Firmar mi contrato",
    );
  });

  it("firma con un código de un solo uso; un código equivocado no firma nada", async () => {
    const { otp } = await worker.requestOtp(contractId);
    const wrong = otp === "111111" ? "222222" : "111111";

    expect(otp).toMatch(/^\d{6}$/);
    await expect(worker.sign(contractId, wrong)).rejects.toMatchObject({
      status: 409,
      message: "El código no coincide. Revísalo e intenta de nuevo.",
    });
    expect((await contractNow()).status).toBe("pendiente_firma");

    await worker.sign(contractId, otp);
    const signed = await contractNow();
    const markup = html(<ContractView contract={signed} onRequestCode={async () => otp} onSign={idle} />);

    expect(signed.status).toBe("activo");
    expect(text(markup)).toMatch(/Firmado el \w{3} \d{1,2} \w{3}, \d{1,2}:\d{2} [ap]\. m\./);
    expect(markup).toMatch(/<a [^>]*href="\/t\/obra"[^>]*>Marcar mi entrada<\/a>/);
    expect(markup).not.toContain("Firmar contrato");
    await expect(worker.sign(contractId, otp)).rejects.toMatchObject({ status: 409 });
  });
});

describe("entrada y salida de la obra", () => {
  it("la ubicación se pide solo al marcar, y el botón de simular existe solo en el Modo Jurado", async () => {
    const contract = await contractNow();
    const normal = siteView(contract);
    const jury = siteView(contract, true);

    expect(normal).toContain("Día 0 de 5");
    expect(normal).toContain("Llegué a la obra");
    expect(normal).toContain("Usamos tu ubicación solo en este momento");
    expect(normal).not.toContain("Simular");
    expect(normal).toContain('href="/t/ayuda?tipo=inseguridad"');
    expect(jury).toContain("Simular que estoy en la obra (demo)");
  });

  it("el servidor comprueba la ubicación: sin ella, lejos de la obra o antes de la fecha no marca", async () => {
    await expect(worker.checkIn({ contractId })).rejects.toMatchObject({
      message: "Necesitamos tu ubicación solo para confirmar que estás en la obra.",
    });
    await expect(worker.checkIn({ contractId, position: northOfSite(2) })).rejects.toMatchObject({
      message: "Estás fuera de la obra. Acércate a la entrada para marcar.",
    });
    await expect(worker.checkIn({ contractId, position: SITE.point })).rejects.toMatchObject({
      status: 409,
      message: "La obra empieza el mar 24 nov.",
    });
    expect((await contractNow()).attendance).toHaveLength(0);
  });

  it("marca la entrada, y al terminar los cinco días espera el pago de la empresa", async () => {
    await worker.checkIn({ contractId, simulated: true });
    const arrived = await contractNow();
    const working = siteView(arrived, true);

    expect(jobStep(arrived)).toBe("marcar_salida");
    expect(working).toContain("Día 1 de 5");
    expect(working).toContain("Marcar mi salida");
    expect(text(working)).toMatch(/mar 24 nov Entrada \d{1,2}:\d{2} [ap]\. m\./);

    await team.post("/api/demo/fast-forward", { as: "admin" });
    await worker.checkOut({ contractId, simulated: true });
    const finished = await contractNow();
    const done = siteView(finished, true);

    expect(finished.attendance).toHaveLength(5);
    expect(jobStep(finished)).toBe("esperar_pago");
    expect(done).toContain("Día 5 de 5");
    expect(done).toContain("Terminaste la obra. Falta que la empresa registre tu pago.");
    expect(done).not.toContain("Llegué a la obra");
    expect(text(done)).toMatch(/Entrada \d{1,2}:\d{2} [ap]\. m\. · Salida \d{1,2}:\d{2} [ap]\. m\./);
  });
});

describe("fin de obra", () => {
  it("pregunta si recibió el pago, con el recibo a la vista y una salida si no le llegó", async () => {
    expect(finishView(await contractNow())).toContain("Falta que la empresa registre tu pago.");

    const payment = await company.registerPayment({
      contractId,
      method: "pago_movil",
      reference: "0102-7788",
    });
    paymentId = payment.id;
    const contract = await contractNow();
    const markup = finishView(contract);

    expect(jobStep(contract)).toBe("confirmar_pago");
    expect(markup).toContain("¿Recibiste tu pago de $125?");
    expect(markup).toContain(`href="/recibo/${paymentId}?vista=trabajador"`);
    expect(markup).toContain("Sí, lo recibí");
    expect(markup).toMatch(/<a [^>]*href="\/t\/ayuda\?tipo=no_pago"[^>]*>No lo he recibido<\/a>/);
    expect(markup).not.toContain("Califica a la empresa");
  });

  it("solo Carlos puede confirmar su pago y ver su recibo como trabajador", async () => {
    const rafael = await workerClient(IDS.rafael);
    const receipt = await browser()<Receipt>(`/api/payments/${paymentId}/receipt`, { as: "worker" }).catch(
      (error: unknown) => error,
    );

    await expect(rafael.confirmPayment(paymentId)).rejects.toMatchObject({ status: 403 });
    await expect(rafael.contract(contractId)).rejects.toMatchObject({ status: 403 });
    expect(receipt).toMatchObject({ status: 401 });
  });

  it("al confirmar, califica a la empresa en privado: categorías del 1 al 5 y etiquetas, sin estrellas", async () => {
    await worker.confirmPayment(paymentId);
    const contract = await contractNow();
    const markup = finishView(contract);

    expect(contract.status).toBe("completado");
    expect(jobStep(contract)).toBe("calificar");
    expect(markup).toContain("Califica a la empresa");
    expect(markup).toContain(BLIND_RATING_NOTICE);
    expect(markup.match(/<fieldset/g)).toHaveLength(5);
    expect(markup.match(/type="radio"/g)).toHaveLength(20);
    expect(text(markup)).toContain("Condiciones de la obra");
    expect(text(markup)).toContain("Pago a tiempo");
    expect(markup).toContain("Equipo de protección completo");
    expect(markup).not.toMatch(/★|☆|estrella/i);
  });

  it("la calificación queda en doble ciega, no se repite, y el trabajo confirmado lo sube a Nivel 3", async () => {
    const rating = { contractId, quality: 5, punctuality: 5, safety: 4, attitude: 5 };
    const sent = await worker.rate({ ...rating, tags: ["Pagó a tiempo", "Buen trato"] });
    const level = await worker.recalculateLevel();
    const markup = html(<LevelView level={level} celebrate={level.leveledUp} />);
    const contract = await contractNow();

    expect(sent.revealed).toBe(false);
    expect(level).toMatchObject({ previousLevel: 2, level: 3, levelName: "Probado", leveledUp: true });
    expect(markup).toMatch(/role="status"[^>]*>¡Subiste de nivel!/);
    expect(text(markup)).toContain("Nivel 3 Probado");
    expect(text(markup)).toContain("3 trabajos confirmados");
    expect(markup).toContain(REFERENCE_BAND_NOTICE);
    expect(markup).toContain('href="/legal/niveles"');
    expect(html(<LevelView level={await worker.level()} celebrate={false} />)).not.toContain("¡Subiste");
    const congratulation = levelUpSpeech({ ...level, firstName: (await worker.profile()).firstName });
    const celebrated = html(
      <LevelView level={level} celebrate congratulation={congratulation} onListen={noop} />,
    );
    expect(text(celebrated)).toContain("¡Felicidades, Carlos! Ya eres Nivel 3: Probado.");
    expect(celebrated).toMatch(/<button[^>]*>Escuchar la felicitación<\/button>/);
    expect(html(<LevelView level={level} celebrate={false} congratulation={congratulation} />)).not.toContain(
      "Escuchar la felicitación",
    );
    expect(contract.ratedByMe).toBe(true);
    expect(finishView(contract)).toContain("Calificación enviada");
    await expect(worker.rate({ ...rating, tags: [] })).rejects.toMatchObject({ status: 409 });
  });

  it("no acepta etiquetas fuera de la lista del trabajador", async () => {
    const other = { contractId, quality: 5, punctuality: 5, safety: 5, attitude: 5 };

    await expect(worker.rate({ ...other, tags: ["Trabajo prolijo"] })).rejects.toMatchObject({ status: 422 });
  });
});

describe("mi ruta", () => {
  it("muestra los cursos con su precio y el IVA aparte, y habla de constancias", async () => {
    const route = await worker.route();
    const markup = html(<LearningView route={route} actions={learningActions} />);
    const plain = text(markup);

    expect(plain).toContain("Prueba práctica aprobada");
    expect(plain).toContain("Seguridad en trabajos en caliente");
    expect(plain).toContain("Gratis");
    expect(markup).toContain(
      'Empezar gratis<span class="sr-only">: Seguridad en trabajos en caliente</span>',
    );
    expect(plain).toContain("$120 + IVA 16 % ($19,20) = $139,20");
    expect(plain).toContain("La academia ofrece 4 cuotas de $30. Le pagas directo a la academia.");
    expect(plain).toContain("Constancia C-2041");
    expect(plain).toContain("Avance: 100 %");
    expect(plain.toLowerCase()).not.toContain("certificado");
    expect(markup).not.toContain("Agendar mi prueba práctica");
  });

  it("al empezar un curso gratis, cada lección escuchada mueve el avance", async () => {
    await worker.enroll(IDS.freeCourse);
    const started = (await worker.route()).courses.find((course) => course.id === IDS.freeCourse)!;
    await worker.recordProgress(started.enrollment!.id, 1 / 3);
    const route = await worker.route();
    const markup = html(<LearningView route={route} actions={learningActions} />);

    expect(started.enrollment?.progress).toBe(0);
    expect(text(markup)).toContain("1. Tu equipo de protección personal · 0:47 min Escuchada");
    expect(markup).toContain('Ya la escuché<span class="sr-only">: lección 2</span>');
    expect(markup.match(/Ya la escuché/g)).toHaveLength(1);
    expect(text(markup)).toContain("Avance: 33 %");
    expect(markup).toContain('aria-label="Avance de Seguridad en trabajos en caliente"');
    await expect(worker.bookPracticalTest()).rejects.toMatchObject({
      status: 409,
      message: "Ya aprobaste tu prueba práctica.",
    });
  });
});

describe("ayuda", () => {
  it("el reporte se escribe en pocas palabras y avisa que lo revisa una persona", () => {
    const markup = html(<ReportForm initialKind="no_pago" onSubmit={idle} />);

    expect(markup.match(/<option/g)).toHaveLength(5);
    expect(markup).toMatch(/<option value="no_pago" selected="">No me pagaron<\/option>/);
    expect(markup).toContain(HUMAN_REVIEW_NOTICE);
    expect(isReportKind("acoso")).toBe(true);
    expect(isReportKind("<script>")).toBe(false);
    expect(isReportKind(undefined)).toBe(false);
    expect(isReportKind(["acoso"])).toBe(false);
  });

  it("al enviarlo confirma la revisión humana, y nada cambia de forma automática", async () => {
    const before = await worker.level();
    const receipt = await worker.report({
      kind: "inseguridad",
      text: "No nos dieron arnés para el andamio.",
    });
    const markup = html(<ReportConfirmation receipt={receipt} />);

    expect(markup).toContain("Reporte recibido");
    expect(markup).toContain(HUMAN_REVIEW_NOTICE);
    expect(markup).toContain(receipt.message);
    expect(markup).toMatch(/<a [^>]*href="\/t"[^>]*>Volver al inicio<\/a>/);
    expect((await worker.level()).level).toBe(before.level);
    expect((await company.board())?.request.status).toBe("completa");
    await expect(worker.report({ kind: "otro", text: "x".repeat(2001) })).rejects.toMatchObject({
      status: 422,
    });
  });

  it("el reporte por nota de voz promete que no se guarda el audio y muestra cada momento con palabras", () => {
    const controls = { seconds: 0, error: null, start: noop, finish: noop, cancel: noop };
    const idleNote = html(<VoiceReportPanel note={{ ...controls, phase: "idle" }} />);
    const recording = html(<VoiceReportPanel note={{ ...controls, phase: "recording", seconds: 12 }} />);

    expect(idleNote).toContain(VOICE_REPORT_PROMISE);
    expect(VOICE_REPORT_PROMISE).toContain("No guardamos el audio");
    expect(idleNote).toMatch(/<button[^>]*>Grabar nota de voz<\/button>/);
    expect(text(recording)).toContain("Grabando 0:12 de 1:00");
    expect(recording).toMatch(/role="progressbar"[^>]*aria-valuenow="20"/);
    expect(recording).toMatch(/Terminar y enviar<\/button>.*Descartar<\/button>/);
    expect(recording).not.toContain("Grabar nota de voz");
    expect(html(<VoiceReportPanel note={{ ...controls, phase: "starting" }} />)).toContain(
      "Esperando el permiso del micrófono…",
    );
    expect(html(<VoiceReportPanel note={{ ...controls, phase: "sending" }} />)).toContain(
      "Nivi está escribiendo lo que dijiste…",
    );
    expect(
      html(<VoiceReportPanel note={{ ...controls, phase: "idle", error: "No tenemos permiso." }} />),
    ).toMatch(/role="alert".*No tenemos permiso\./);
  });

  it("al mandar la nota muestra lo que se entendió, y la revisión sigue siendo humana", async () => {
    const before = await worker.level();
    const note = new Blob([new Uint8Array(2048).fill(1)], { type: "audio/webm" });
    const receipt = await worker.reportByVoice(note);
    const markup = html(<ReportConfirmation receipt={receipt} />);

    expect(receipt).toMatchObject({ kind: "inseguridad", transcript: HEARD });
    expect(text(markup)).toContain(`Esto entendimos «${HEARD}»`);
    expect(text(markup)).toContain("Lo anotamos como «La obra es insegura»");
    expect(markup).toContain(HUMAN_REVIEW_NOTICE);
    expect(markup).toContain("autoridad");
    expect((await worker.level()).level).toBe(before.level);
    // El servidor rechaza lo que no es audio, y a quien no tiene sesión de trabajador.
    await expect(worker.reportByVoice(new Blob(["hola"], { type: "text/plain" }))).rejects.toMatchObject({
      status: 415,
    });
    await expect(createWorkerApi(browser()).reportByVoice(note)).rejects.toMatchObject({ status: 401 });
  });
});

describe("mis datos", () => {
  it("ve lo que NIVEL sabe de él y puede corregirlo; el servidor valida igual que la pantalla", async () => {
    const profile = await worker.profile();
    const summary = text(html(<ProfileSummary profile={profile} />));
    const form = html(<ProfileForm profile={profile} onSave={async () => profile} />);
    const corrected = await worker.correctProfile({ zone: "San Diego", skills: ["SMAW", "MIG"] });

    expect(summary).toContain("Nivel 3 · Probado Carlos Rodríguez soldador · Los Guayos SMAW");
    expect(form.match(/<input/g)).toHaveLength(5);
    expect(form).toContain('value="Carlos Rodríguez"');
    expect(form).toContain('value="Disponible de lunes a sábado"');
    expect(form).toContain("Sepáralas con comas.");
    expect(corrected).toMatchObject({ zone: "San Diego", skills: ["SMAW", "MIG"], name: "Carlos Rodríguez" });
    await expect(worker.correctProfile({ name: "Carlos <b>" })).rejects.toMatchObject({ status: 422 });
    await expect(worker.correctProfile({ yearsExp: 200 })).rejects.toMatchObject({ status: 422 });
  });

  it("cada permiso tiene su propio interruptor y se retira por separado", async () => {
    const before = (await worker.profile()).consents;
    const markup = html(<ConsentList consents={before} onChange={noop} pending={false} />);
    const after = await worker.setConsent("notifications", true);
    const withdrawn = await worker.setConsent("gps", false);

    expect(markup.match(/role="switch"/g)).toHaveLength(5);
    expect(markup.match(/aria-checked="true"/g)).toHaveLength(3);
    expect(markup).toMatch(/aria-labelledby="permiso-gps" aria-describedby="permiso-gps-ayuda"/);
    expect(markup).toContain("Solo en el momento de marcar entrada y salida.");
    expect(after.notifications).not.toBeNull();
    expect(after.gps).toBe(before.gps);
    expect(withdrawn.gps).toBeNull();
    expect(withdrawn.voice).toBe(before.voice);
  });

  it("al retirar 'mostrar mi perfil' sale de las búsquedas de inmediato", async () => {
    const other = createCompanyApi(browser());
    await other.enter("co-prado");
    const request = {
      trade: "soldador",
      quantity: 1,
      minLevel: 1,
      zone: "San Diego",
      startDate: "el lunes",
      days: 2,
      dailyPayUsd: 22,
      contractType: "obra_determinada",
    } as const;
    await other.createRequest(request);
    const ids = async () => (await other.board())?.candidates.map((candidate) => candidate.workerId) ?? [];
    const visible = await ids();
    await worker.setConsent("share_profile", false);
    const hidden = await ids();
    await worker.setConsent("share_profile", true);

    expect(visible).toContain(IDS.carlos);
    expect(hidden).not.toContain(IDS.carlos);
  });

  it("ve sus calificaciones privadas ya reveladas y descarga todo lo suyo", async () => {
    const data = await worker.myData();
    const markup = html(<ReceivedRatings ratings={data.ratingsReceived} />);

    expect(data.ratingsReceived).toHaveLength(2);
    expect(text(markup)).toContain("Calidad del trabajo 5 de 5 Puntualidad 4 de 5");
    expect(markup).toContain("Trabajo prolijo");
    expect(markup).not.toMatch(/★|☆|estrella/i);
    expect(data.work.map((job) => job.contractId)).toContain(contractId);
    // El reporte escrito y el de la nota de voz.
    expect(data.reports).toHaveLength(2);
    expect(JSON.stringify(data)).not.toMatch(/"lat"|"lng"|phone/);
    expect(html(<ReceivedRatings ratings={[]} />)).toContain("Aún no tienes calificaciones.");
  });

  it("borrar la cuenta pide confirmar, cierra la sesión y saca a la persona de la demo", async () => {
    const yorman = await workerClient("w-011");
    const deletion = await yorman.deleteAccount();
    const state = await yorman.state();

    expect(html(<DeleteAccount onDelete={idle} />)).toMatch(/^<button[^>]*>Borrar mi cuenta<\/button>$/);
    expect(deletion.outcome).toMatch(/^(borrada|anonimizada)$/);
    expect(html(<AccountDeleted deletion={deletion} onDone={noop} />)).toMatch(
      /Cuenta borrada.*role="alert".*Borramos tu.*Entendido/,
    );
    expect(state.active.workerId).toBeNull();
    expect(state.personas.workers.map((persona) => persona.id)).not.toContain("w-011");
    await expect(yorman.profile()).rejects.toMatchObject({ status: 401 });
    await expect(yorman.enter("w-011")).rejects.toMatchObject({ status: 404 });
  });
});

describe("reglas que valen para toda la app del trabajador", () => {
  it("nada de lo pintado lleva estilos en línea, palabras prohibidas, fotos ni estrellas", () => {
    expect(rendered.length).toBeGreaterThan(25);
    for (const markup of rendered) {
      const lower = text(markup).toLowerCase();
      expect(markup).not.toMatch(/\sstyle="/);
      expect(markup.replace(/<img [^>]*src="\/brand\/[^>]*>/g, "")).not.toContain("<img");
      expect(lower).not.toMatch(/★|estrellas|certificado/);
      for (const word of FORBIDDEN_WORDS) expect(lower).not.toContain(word);
    }
  });
});
