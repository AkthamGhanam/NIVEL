import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { OUTCOME_DONE, type ReportView, reportView } from "@/client/admin-view";
import { createApiRequest } from "@/client/api";
import { createCompanyApi } from "@/client/company-api";
import { createTeamApi, type TeamApi } from "@/client/team-api";
import { createWorkerApi, type WorkerApi } from "@/client/worker-api";
import { FORBIDDEN_WORDS } from "@/lib/legal-copy";
import { IDS } from "@/server/db/seed/cast";
import { createBrowserFetch } from "@/server/testing/browser-fetch";
import { type InProcessApi, startInProcessApi } from "@/server/testing/in-process-api";

import { AdminShell } from "./admin-shell";
import { IncomeTable, LevelDistribution, MetricsView } from "./metrics-view";
import { HUMAN_REVIEW_RULE, ReportCard, ReviewQueue } from "./review-queue";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/revision" }));

/**
 * La administración contra las rutas reales: las métricas salen de los datos
 * y los reportes los decide una persona del equipo, con una nota. Nada cambia
 * solo: ni el nivel de quien reporta ni el estado de la empresa.
 */

let server: InProcessApi;
let team: TeamApi;
let carlos: WorkerApi;

const noop = async () => undefined;
const rendered: string[] = [];
const html = (element: ReactElement) => {
  const markup = renderToStaticMarkup(element);
  rendered.push(markup);
  return markup;
};
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const browser = () => createApiRequest(createBrowserFetch(server.baseUrl));
const SAFETY_REPORT = "No había extintor en el área de soldadura.";

async function queue(): Promise<ReportView[]> {
  const [reports, state] = await Promise.all([team.reports(), team.state()]);
  return reports.map((report) => reportView(report, state.personas.companies, new Date()));
}

beforeAll(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  server = startInProcessApi();
  team = createTeamApi(browser());
  carlos = createWorkerApi(browser());
});

afterAll(() => server.dispose());

describe("acceso del equipo", () => {
  it("sin la sesión del equipo no hay métricas ni cola de reportes, ni se puede decidir un caso", async () => {
    const outsider = createTeamApi(browser());
    await createCompanyApi(browser()).state();

    await expect(outsider.metrics()).rejects.toMatchObject({ status: 401 });
    await expect(outsider.reports()).rejects.toMatchObject({ status: 401 });
    await expect(outsider.resolveReport("re-1", { outcome: "resuelto", note: "x" })).rejects.toMatchObject({
      status: 401,
    });
  });

  it("el marco marca la sección abierta y enlaza las otras pantallas del equipo", async () => {
    await team.enter(server.demoKey);
    await team.reset();
    await carlos.enter(IDS.carlos);
    const markup = html(
      <AdminShell>
        <h1>Revisión</h1>
      </AdminShell>,
    );

    expect(markup).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/admin\/revision"/);
    expect(markup).toMatch(/<a[^>]*href="\/admin"[^>]*>Métricas<\/a>/);
    expect(markup).not.toMatch(/<a[^>]*aria-current="page"[^>]*href="\/admin"[^>]*>Métricas/);
    expect(markup).toMatch(/<a[^>]*href="\/demo"[^>]*>Modo Jurado<\/a>/);
    expect(markup.match(/<main/g)).toHaveLength(1);
    expect(markup).toContain("Demo · nombres, empresas y cifras de ejemplo");
  });
});

describe("métricas", () => {
  it("las cifras de operación salen de los datos de la demo", async () => {
    const metrics = await team.metrics();
    const page = text(html(<MetricsView metrics={metrics} />));

    expect(metrics.workers).toMatchObject({ total: 40, real: 0 });
    expect(page).toContain("Trabajadores 40 0 personas reales registradas en el evento.");
    expect(page).toContain(`Contrataciones ${metrics.hires}`);
    expect(page).toContain("Tiempo a cuadrilla completa Sin datos");
    expect(page).toContain("Reportes en revisión 0 Ir a la revisión humana");
    expect(html(<MetricsView metrics={metrics} />).match(/<h1/g)).toHaveLength(1);
  });

  it("los ingresos separan tarifa, IVA y total, y cuadran entre sí", async () => {
    const { income } = await team.metrics();
    const table = html(<IncomeTable income={income} />);

    expect(income.total.base).toBe(income.hiring.base + income.academyCommission.base);
    expect(income.academyCommission).toEqual({ base: 108, iva: 17.28, total: 125.28 });
    expect(table.match(/scope="col"/g)).toHaveLength(4);
    expect(table.match(/scope="row"/g)).toHaveLength(3);
    expect(text(table)).toContain("Comisión de academias (15 %) $108 $17,28 $125,28");
    expect(text(table)).toContain("Total $3.158 $505,28 $3.663,28");
    expect(text(table)).toContain("Por cobrar: $0 con IVA.");
    expect(text(table)).toContain("Pago Móvil o transferencia");
  });

  it("reparte a la gente en los cinco niveles con una barra con nombre", async () => {
    const { workers } = await team.metrics();
    const markup = html(<LevelDistribution workers={workers} />);

    expect(markup.match(/role="progressbar"/g)).toHaveLength(5);
    expect(markup).toMatch(/aria-label="Proporción en el nivel 2"[^>]*aria-valuenow="35"/);
    expect(text(markup)).toContain("Nivel 2 · Verificado 14 (35 %)");
    expect(text(markup)).toContain("Nivel 5 · Maestro 1 (3 %)");
  });

  it("al armar una cuadrilla, el tiempo promedio aparece con datos reales", async () => {
    const company = createCompanyApi(browser());
    await company.enter(IDS.activeCompany);
    await team.setBot(false);
    const { request } = await company.createRequest({
      trade: "soldador",
      quantity: 1,
      minLevel: 2,
      zone: "Los Guayos",
      startDate: "el martes",
      days: 5,
      dailyPayUsd: 25,
      contractType: "obra_determinada",
    });
    const before = await team.metrics();
    const [sent] = await company.invite(request.id, { quantity: 1 });
    const invited = createWorkerApi(browser());
    await invited.enter(sent!.candidate.workerId);
    const [offer] = await invited.offers();
    await invited.respond(offer!.invitationId, true);
    const after = await team.metrics();

    expect(before.requests.open).toBe(1);
    expect(after.requests).toMatchObject({ open: 0, complete: before.requests.complete + 1 });
    expect(after.hires).toBe(before.hires + 1);
    expect(after.averageMinutesToFullCrew).not.toBeNull();
    expect(after.income.pendingTotalUsd).toBeGreaterThan(0);
  });
});

describe("revisión humana de reportes", () => {
  it("la cola vacía lo dice y recuerda la regla: decide una persona, nunca una máquina", async () => {
    const markup = text(html(<ReviewQueue reports={await queue()} onResolve={noop} notice={null} />));

    expect(markup).toContain("No hay reportes por revisar.");
    expect(markup).toContain(HUMAN_REVIEW_RULE);
    expect(markup).toContain("su nivel no cambia");
  });

  it("un reporte de inseguridad llega a la cola con lo que dijo la persona, sin decir quién fue", async () => {
    const levelBefore = (await carlos.level()).level;
    await carlos.report({ kind: "inseguridad", text: SAFETY_REPORT });
    const reports = await queue();
    const markup = html(<ReviewQueue reports={reports} onResolve={noop} notice={null} />);

    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      kind: "Inseguridad en la obra",
      body: SAFETY_REPORT,
      source: "Escrito por la persona",
      deadline: "Quedan 24 h de las 24",
      safetyReminder: true,
    });
    expect(text(markup)).toContain("1 reporte espera la decisión de una persona del equipo.");
    expect(markup).toMatch(/<blockquote[^>]*>No había extintor en el área de soldadura\.<\/blockquote>/);
    expect(text(markup)).toContain("indícale cómo acudir al INPSASEL");
    expect(markup).not.toContain(IDS.carlos);
    expect(markup).not.toContain("Carlos");
    expect(markup).not.toContain("<audio");
    // Reportar no cambia el nivel de nadie, y las métricas cuentan el caso abierto.
    expect((await carlos.level()).level).toBe(levelBefore);
    expect((await team.metrics()).reportsInReview).toBe(1);
  });

  it("cada caso pide una nota con etiqueta y ofrece resolver o descartar", async () => {
    const [report] = await queue();
    const card = html(<ReportCard report={report!} onResolve={noop} />);
    const withAudio = html(
      <ReportCard
        report={{ ...report!, audioUrl: "/audio/reportes/a.webm", overdue: true }}
        onResolve={noop}
      />,
    );

    expect(card).toMatch(/<label for="reporte-[^"]+-nota"[^>]*>Nota de la decisión<\/label>/);
    expect(card).toMatch(/<textarea[^>]*maxLength="1000"/);
    expect(card).toMatch(/<article aria-labelledby="reporte-[^"]+-titulo"/);
    expect(text(card)).toContain("Marcar como resuelto");
    expect(text(card)).toContain("Descartar");
    expect(text(card)).toContain("Empresa señalada No nombra una empresa");
    expect(withAudio).toMatch(
      /<audio controls="" preload="none" src="\/audio\/reportes\/a\.webm" aria-label="Nota de voz del reporte"/,
    );
  });

  it("el servidor no cierra un caso sin nota; con nota queda resuelto y sale de la cola", async () => {
    const [report] = await queue();
    await expect(team.resolveReport(report!.id, { outcome: "resuelto", note: "   " })).rejects.toMatchObject({
      status: 422,
    });

    const resolved = await team.resolveReport(report!.id, {
      outcome: "resuelto",
      note: "Se habló con la empresa: ya hay extintor en el área.",
    });
    const events = await team.events(undefined);
    const markup = text(
      html(<ReviewQueue reports={await queue()} onResolve={noop} notice={OUTCOME_DONE.resuelto} />),
    );

    expect(resolved).toMatchObject({
      status: "resuelto",
      reviewerNote: "Se habló con la empresa: ya hay extintor en el área.",
    });
    expect(resolved.reviewedAt).not.toBeNull();
    expect(events.at(-1)?.label).toBe("Reporte resuelto por una persona del equipo");
    expect(JSON.stringify(events)).not.toContain(SAFETY_REPORT);
    expect(markup).toContain("Reporte resuelto. Quedó la nota de la decisión.");
    expect(markup).toContain("No hay reportes por revisar.");
    expect((await team.metrics()).reportsInReview).toBe(0);
  });

  it("un caso ya decidido no se decide dos veces, y uno que no existe no se inventa", async () => {
    const before = await team.events(undefined);
    await carlos.report({ kind: "no_pago", text: "No me pagaron la semana." });
    const [report] = await queue();
    const discarded = await team.resolveReport(report!.id, {
      outcome: "descartado",
      note: "Pago confirmado.",
    });

    expect(discarded.status).toBe("descartado");
    await expect(
      team.resolveReport(report!.id, { outcome: "resuelto", note: "Otra vez." }),
    ).rejects.toMatchObject({ status: 409, message: "Este reporte ya fue revisado." });
    await expect(
      team.resolveReport("re-no-existe", { outcome: "resuelto", note: "x" }),
    ).rejects.toMatchObject({
      status: 404,
    });
    expect((await team.events(undefined)).length).toBe(before.length + 2);
  });
});

describe("textos de la administración", () => {
  it("nada de lo mostrado usa una palabra prohibida ni estilos en línea", () => {
    const all = text(rendered.join(" ")).toLowerCase();

    expect(rendered.length).toBeGreaterThan(8);
    for (const word of FORBIDDEN_WORDS) expect(all).not.toContain(word);
    expect(rendered.join(" ")).not.toMatch(/\sstyle="/);
  });
});
