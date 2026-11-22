// La vista del contratista de punta a punta, sin navegador.
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, createApiRequest } from "@/client/api";
import { type CompanyApi, createCompanyApi, type RequestBoard } from "@/client/company-api";
import { FORBIDDEN_WORDS, NOT_EMPLOYER_NOTICE, PRIVATE_RATING_NOTICE } from "@/lib/legal-copy";
import { IDS } from "@/server/db/seed/cast";
import { createBrowserFetch } from "@/server/testing/browser-fetch";
import { dispatch, type InProcessApi, startInProcessApi } from "@/server/testing/in-process-api";

import { ApiClient } from "../../../scripts/smoke/client";
import { ReceiptView } from "../receipt/receipt-view";
import { CompanyGate } from "./company-gate";
import { CompanyAccess } from "./company-access";
import { CompanyIdentity } from "./company-shell";
import { CostPanel } from "./cost-panel";
import { FeeStatementView } from "./fee-statement";
import { RatingView } from "./rating-screen";
import { BoardView, EmptyBoard } from "./request-screen";
import { SiteView } from "./site-screen";
import { WagePayments } from "./wage-payments";

let server: InProcessApi;
let company: CompanyApi;
let team: ApiClient;
let carlos: ApiClient;
let requestId: string;
let contractId: string;
let paymentId: string;

const noop = () => undefined;
const idle = async () => undefined;
const rendered: string[] = [];
const html = (element: ReactElement) => {
  const markup = renderToStaticMarkup(element);
  rendered.push(markup);
  return markup;
};
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const boardNow = async (): Promise<RequestBoard> => {
  const board = await company.board();
  if (!board) throw new Error("La empresa debería tener una solicitud activa");
  return board;
};
const boardView = (board: RequestBoard) =>
  html(<BoardView board={board} onInvite={noop} pending={false} error={null} />);

async function workerClient(workerId: string): Promise<ApiClient> {
  const client = new ApiClient(server.baseUrl, dispatch, server.demoKey);
  await client.enterAs("worker", workerId);
  return client;
}

async function respond(worker: ApiClient, accept: boolean) {
  const { offers } = await worker.get<{ offers: Array<{ invitationId: string }> }>("/api/invitations");
  return worker.post<{ offer: { contractId: string | null }; otp: string | null }>(
    `/api/invitations/${offers[0]?.invitationId}/respond`,
    { body: { accept } },
  );
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

beforeAll(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  server = startInProcessApi();
  team = new ApiClient(server.baseUrl, dispatch, server.demoKey);
  await team.post("/api/demo/reset", { as: "admin" });

  await team.post("/api/demo/bot", { as: "admin", body: { state: "off" } });
  company = createCompanyApi(createApiRequest(createBrowserFetch(server.baseUrl)));
  carlos = await workerClient(IDS.carlos);
});

afterAll(() => server.dispose());

describe("entrada del contratista", () => {
  it("antes de saber quién entra, la puerta dice con palabras que está cargando", () => {
    const markup = html(
      <CompanyGate>
        <p>contenido</p>
      </CompanyGate>,
    );

    expect(markup).toMatch(/role="status".*Abriendo tu empresa…/);
    expect(markup).not.toContain("contenido");
  });

  it("sin sesión no puede ver ningún tablero", async () => {
    await expect(company.board()).rejects.toMatchObject({ status: 401, needsSession: true });
  });

  it("el acceso ofrece registrar la empresa o entrar con una cuenta", async () => {
    const state = await company.state();
    const access = (tab: "crear" | "entrar", error: string | null, accounts = state.personas.companies) =>
      html(
        <CompanyAccess
          accounts={accounts}
          onPick={noop}
          onRegister={noop}
          pending={false}
          error={error}
          initialTab={tab}
        />,
      );
    const create = access("crear", null);
    const enter = access("entrar", null);

    expect(state.active.companyId).toBeNull();
    expect(state.activeCompany).toBeNull();
    expect(state.personas.companies).toHaveLength(4);
    expect(create).toContain("Registrar mi empresa");
    expect(create).toContain('name="rif"');
    expect(enter).toContain("Cuentas de demostración");
    expect(enter).toContain("Constructora Los Guayos");
    expect(enter).toContain("RIF J-50123456-7");
    expect(enter).toContain("Verificada");
    expect(enter).toContain("Entrar como Constructora Los Guayos");
    expect(access("entrar", "La clave no es correcta.", [])).toMatch(
      /role="alert".*La clave no es correcta\./,
    );
  });

  it("al entrar, el servidor abre la sesión y el encabezado identifica a la empresa", async () => {
    const state = await company.enter(IDS.activeCompany);
    const active = state.personas.companies.find((persona) => persona.id === state.active.companyId);
    const markup = html(<CompanyIdentity company={active!} onSwitch={noop} />);

    expect(active?.name).toBe("Constructora Los Guayos");
    expect(markup).toContain("Empresa verificada");
    expect(markup).toContain("RIF J-50123456-7");
    expect(markup).toContain("Cambiar de cuenta");
    expect(html(<CompanyIdentity company={{ ...active!, verified: false }} onSwitch={noop} />)).toContain(
      "Verificación pendiente",
    );
    expect(await company.board()).toBeNull();
    expect(html(<EmptyBoard />)).toContain("Arma tu cuadrilla en minutos");
  });
});

describe("pedir cuadrilla y tablero en vivo", () => {
  it("la solicitud muestra quién cumple, sin foto ni estrellas, y ofrece invitar a los mejores", async () => {
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
    const markup = boardView(await boardNow());

    expect(markup).toContain("3 soldadores en Los Guayos");
    expect(text(markup)).toContain("Nivel 2 o más · desde mar 24 nov · 5 días · $25 al día");
    expect(markup).toContain("Pedida por formulario");
    expect(markup).toContain("6 personas cumplen");
    expect(markup).toContain("Invitar a los 3 mejores");
    expect(markup).toContain("Cuadrilla 0 de 3");
    expect(text(markup)).toContain(
      "Rafael T. Nivel 3 5 trabajos confirmados · Prueba práctica aprobada · a 4 km",
    );
    expect(markup).not.toContain("Invitaciones");
    expect(markup).not.toContain("<img");
  });

  it("el panel de costos separa el costo legal estimado, la tarifa con su IVA y la garantía", async () => {
    const markup = html(<CostPanel board={await boardNow()} />);
    const plain = text(markup);

    expect(plain).toContain("Salario (5 días) $125");
    expect(plain).toContain("Por persona $196,67");
    expect(plain).toContain("Por 3 personas $590");
    expect(plain).toContain("Estimado. Valídalo con tu contador.");
    // A dónde va cada dólar: al trabajador y al Estado. Nada de eso es de NIVEL.
    expect(plain).toContain("Va al trabajador $166,67");
    expect(plain).toContain("Va al Estado $30");
    expect(plain).toContain("No es una factura");
    expect(plain).toContain("Lo único que cobra NIVEL");
    expect(plain).toContain("Tarifa de NIVEL por contratación $20 a $30");
    expect(plain).toContain("IVA 16 % (va al SENIAT) $3,20 a $4,80");
    expect(plain).toContain("Total por persona $23,20 a $34,80");
    expect(plain).toContain("Recibo de pago del trabajador");
    expect(plain).toContain("Factura de NIVEL");
    expect(plain).toContain("Pago Móvil o transferencia");
    expect(plain).toContain("Garantía de búsqueda de 7 días");
    expect(plain).toContain(NOT_EMPLOYER_NOTICE);
    expect(text(html(<CostPanel board={null} />))).not.toContain("Costo legal estimado");
  });

  it("tras un rechazo sugiere a Carlos como reemplazo, a un clic", async () => {
    expect(await company.invite(requestId, { quantity: 3 })).toHaveLength(3);
    const waiting = boardView(await boardNow());
    expect(waiting.match(/Invitación enviada/g)).toHaveLength(3);
    expect(waiting).toContain("3 personas más cumplen");
    expect(waiting).not.toContain("Reemplazo sugerido");

    await respond(await workerClient(IDS.rafael), true);
    await respond(await workerClient(IDS.jose), true);
    await respond(await workerClient(IDS.luis), false);
    const board = await boardNow();
    const markup = boardView(board);

    expect(board.suggestedReplacement?.workerId).toBe(IDS.carlos);
    expect(markup).toContain("Cuadrilla 2 de 3");
    expect(markup).toContain('aria-valuenow="67"');
    expect(markup.match(/>Aceptó</g)).toHaveLength(2);
    expect(markup).toContain(">Rechazó<");
    expect(markup).toMatch(
      /Reemplazo sugerido.*Carlos R\..*Invitar<span class="sr-only"> a Carlos R\.<\/span>/,
    );

    expect(markup).not.toContain("Invitar a 1 más");
  });

  it("un error al invitar se anuncia de inmediato sin perder el tablero", async () => {
    const markup = html(
      <BoardView board={await boardNow()} onInvite={noop} pending error="No pudimos conectar." />,
    );

    expect(markup).toMatch(/role="alert".*No pudimos conectar\./);
    expect(markup).toContain("Cuadrilla 2 de 3");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Invitar</);
  });

  it("cuando Carlos acepta, la cuadrilla queda completa y lleva a la obra", async () => {
    await company.invite(requestId, { quantity: 1 });
    const accepted = await respond(carlos, true);
    contractId = accepted.offer.contractId!;
    await carlos.post(`/api/contracts/${contractId}/sign`, { body: { otp: accepted.otp } });
    const board = await boardNow();
    const markup = boardView(board);

    expect(board.request.status).toBe("completa");
    expect(markup).toContain("Cuadrilla completa · 3 de 3");
    expect(markup).toMatch(/<a [^>]*href="\/c\/obra"[^>]*>Ver la obra<\/a>/);
    expect(markup).not.toContain("personas más cumplen");
    expect(markup).not.toContain("Reemplazo sugerido");
  });
});

describe("obra en curso", () => {
  it("antes de la primera entrada dice quién firmó y que nadie ha marcado", async () => {
    const markup = html(<SiteView board={await boardNow()} />);

    expect(markup).toContain("Obra en Los Guayos");
    expect(markup).toContain("Contrato firmado");
    expect(markup.match(/Falta la firma del trabajador/g)).toHaveLength(2);
    expect(markup.match(/Aún no ha marcado su entrada\./g)).toHaveLength(3);
    expect(markup).toContain("Todavía no hay jornadas registradas.");
    expect(markup).toContain("3 días hábiles de inasistencia injustificada");
  });

  it("muestra la hora real de llegada y, al final, los cinco días con su salida", async () => {
    await carlos.post("/api/attendance/checkin", { body: { contractId, simulated: true } });
    const arrived = html(<SiteView board={await boardNow()} />);
    expect(text(arrived)).toMatch(/Llegó \d{1,2}:\d{2} [ap]\. m\. · Sigue en la obra/);
    expect(arrived).toContain("Día 1 de 5");

    await team.post("/api/demo/fast-forward", { as: "admin" });
    await carlos.post("/api/attendance/checkout", { body: { contractId, simulated: true } });
    const board = await boardNow();
    const finished = html(<SiteView board={board} />);
    const mine = board.crew.find((member) => member.workerId === IDS.carlos);

    expect(mine?.attendance).toHaveLength(5);
    expect(mine?.lastAttendance).toEqual(mine?.attendance.at(-1));
    expect(finished).toContain("Día 5 de 5");
    expect(text(finished)).toMatch(/Llegó \d{1,2}:\d{2} [ap]\. m\. · Salió \d{1,2}:\d{2} [ap]\. m\./);
    expect(finished.match(/<li /g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("sin nadie contratado invita a volver a la solicitud", async () => {
    const board = await boardNow();
    const markup = html(<SiteView board={{ ...board, crew: [] }} />);

    expect(markup).toContain("Aún no hay nadie contratado.");
    expect(markup).toMatch(/<a [^>]*href="\/c"/);
  });
});

describe("pagos", () => {
  it("la empresa registra el pago directo y queda el recibo; el dinero no pasa por NIVEL", async () => {
    const before = html(<WagePayments board={await boardNow()} onRegister={idle} />);
    expect(before).toContain("El dinero no pasa por NIVEL");
    expect(text(before)).toContain("Carlos R. 5 días a $25 $125");
    expect(before.match(/Registrar pago/g)).toHaveLength(1);
    expect(before).toContain("Pago Móvil");
    expect(before).toContain("Transferencia");

    const payment = await company.registerPayment({
      contractId,
      method: "pago_movil",
      reference: "0102-123456",
    });
    paymentId = payment.id;
    const registered = html(<WagePayments board={await boardNow()} onRegister={idle} />);

    expect(payment.amountUsd).toBe(125);
    expect(registered).toContain("Pago registrado. Falta que Carlos R. confirme");
    expect(registered).toContain(`href="/recibo/${paymentId}?vista=empresa"`);
    expect(registered).not.toContain("Registrar pago");
  });

  it("no acepta una referencia con símbolos: el servidor valida aunque la pantalla ya lo haga", async () => {
    await expect(
      company.registerPayment({ contractId, method: "pago_movil", reference: "<script>" }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("cuando Carlos confirma, la pantalla lo dice y el recibo lleva lo que exige el artículo 106", async () => {
    await carlos.post(`/api/payments/${paymentId}/confirm`);
    const wages = html(<WagePayments board={await boardNow()} onRegister={idle} />);
    const receipt = await company.receipt(paymentId);
    const markup = html(<ReceiptView receipt={receipt} />);
    const plain = text(markup);

    expect(wages).toContain("Carlos R. confirmó que recibió el pago");
    expect(plain).toContain("Recibo de pago");
    expect(plain).toContain("Artículo 106 de la LOTTT");
    expect(plain).toContain("Patrono Constructora Los Guayos RIF J-50123456-7");
    expect(plain).toContain("Trabajador Carlos Rodríguez");
    expect(plain).toContain("5 días a $25");
    expect(plain).toContain("$125");
    expect(plain).toContain("(tasa de ejemplo)");
    expect(plain).toContain("Pago Móvil · referencia 0102-123456");
    expect(plain).toMatch(/Recibido · \w{3} \d{1,2} \w{3}, \d{1,2}:\d{2} [ap]\. m\./);
    expect(plain).toContain("El dinero no pasó por NIVEL.");
    expect(plain).toContain(NOT_EMPLOYER_NOTICE);
    expect(text(html(<ReceiptView receipt={{ ...receipt, confirmedByWorkerAt: null }} />))).toContain(
      "Pendiente de confirmación",
    );
  });

  it("otra empresa no puede ver ese recibo", async () => {
    const other = createCompanyApi(createApiRequest(createBrowserFetch(server.baseUrl)));
    await other.enter("co-moron");

    await expect(other.receipt(paymentId)).rejects.toBeInstanceOf(ApiError);
    await expect(other.receipt(paymentId)).rejects.toMatchObject({ status: 403 });
  });

  it("las tarifas de NIVEL muestran la factura simulada con el IVA aparte y se marcan como pagadas", async () => {
    const statement = await company.fees();
    const pending = statement.fees.filter((fee) => fee.status === "por_pagar");
    const markup = html(<FeeStatementView statement={statement} onPay={idle} />);

    expect(pending).toHaveLength(3);
    expect(statement.pending).toEqual({ base: 80, iva: 12.8, total: 92.8 });
    expect(text(markup)).toContain("Por pagar Tarifa $80 IVA 16 % $12,80 Total $92,80");
    expect(markup).toContain("Factura simulada N.º");
    expect(markup).toContain("Factura digital (simulada)");
    expect(markup.match(/Marcar como pagada/g)).toHaveLength(3);

    await company.payFee(pending[0]!.id, "transferencia");
    const after = await company.fees();
    expect(after.pending.total).toBeLessThan(statement.pending.total);
    expect(html(<FeeStatementView statement={after} onPay={idle} />)).toContain("Pagada por Transferencia");
    await expect(company.payFee(pending[0]!.id, "transferencia")).rejects.toMatchObject({ status: 409 });
  });

  it("sugiere el Plan Obra solo cuando sale más barato, con las cifras a la vista", async () => {
    const statement = await company.fees();
    const plan = statement.planSuggestion;
    const markup = text(html(<FeeStatementView statement={statement} onPay={idle} />));

    expect(plan).not.toBeNull();
    expect(markup).toContain("Con el Plan Obra ahorrarías");
    expect(markup).toContain("El plan cuesta $39 al mes + IVA, incluye 3 contrataciones");
    expect(
      text(
        html(<FeeStatementView statement={{ ...statement, fees: [], planSuggestion: null }} onPay={idle} />),
      ),
    ).toContain("Aún no tienes tarifas.");
  });
});

describe("calificación privada", () => {
  it("se califica por categorías del 1 al 5 y etiquetas, nunca con estrellas", async () => {
    const markup = html(<RatingView board={await boardNow()} onSubmit={idle} />);

    expect(markup).toContain("Califica a tu cuadrilla");
    expect(markup).toContain(PRIVATE_RATING_NOTICE);
    expect(markup.match(/<fieldset/g)).toHaveLength(5);
    expect(markup.match(/type="radio"/g)).toHaveLength(20);
    expect(markup.match(/type="checkbox"/g)).toHaveLength(5);
    expect(markup).toContain("Cumple normas de seguridad");
    expect(markup.match(/Enviar calificación/g)).toHaveLength(1);
    expect(markup.match(/Podrás calificar cuando registres el pago/g)).toHaveLength(2);
    expect(markup).not.toMatch(/★|☆|estrella/i);
  });

  it("al enviarla queda en doble ciega y no se puede repetir", async () => {
    const rating = { contractId, quality: 5, punctuality: 5, safety: 4, attitude: 5 };
    const sent = await company.rate({ ...rating, tags: ["Trabajo prolijo"], comment: "Muy buen trabajo" });
    const markup = html(<RatingView board={await boardNow()} onSubmit={idle} />);

    expect(sent.revealed).toBe(false);
    expect(markup).toContain("Ya enviaste tu calificación");
    expect(markup).not.toContain("Enviar calificación");
    await expect(company.rate({ ...rating, tags: [] })).rejects.toMatchObject({ status: 409 });
    await expect(company.rate({ ...rating, tags: ["Guapo"] })).rejects.toMatchObject({ status: 422 });
    expect(html(<RatingView board={{ ...(await boardNow()), crew: [] }} onSubmit={idle} />)).toContain(
      "Aún no hay nadie contratado",
    );
  });
});

describe("reglas que valen para toda la vista del contratista", () => {
  it("nada de lo pintado lleva estilos en línea, palabras prohibidas, fotos ni calificaciones de personas", () => {
    expect(rendered.length).toBeGreaterThan(20);
    for (const markup of rendered) {
      const lower = text(markup).toLowerCase();
      expect(markup).not.toMatch(/\sstyle="/);
      expect(markup.replace(/<img src="\/brand\/[^>]*>/g, "")).not.toContain("<img");
      expect(lower).not.toMatch(/★|estrellas|promedio/);
      for (const word of FORBIDDEN_WORDS) expect(lower).not.toContain(word);
    }
  });
});
