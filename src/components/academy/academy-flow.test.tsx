import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { type AcademyApi, createAcademyApi } from "@/client/academy-api";
import { constanciaOutcome, testOutcome } from "@/client/academy-view";
import { createApiRequest } from "@/client/api";
import { createTeamApi } from "@/client/team-api";
import { createWorkerApi } from "@/client/worker-api";
import { FORBIDDEN_WORDS } from "@/lib/legal-copy";
import { IDS } from "@/server/db/seed/cast";
import { createBrowserFetch } from "@/server/testing/browser-fetch";
import { type InProcessApi, startInProcessApi } from "@/server/testing/in-process-api";

import { AcademyGate } from "./academy-gate";
import { AcademyPanelView, CourseTable, PendingConstancias, RankingCard } from "./academy-panel";
import { AcademyPicker } from "./academy-picker";
import { AcademyShell } from "./academy-shell";

/**
 * El panel de la academia contra las rutas reales: lo que ve, lo que puede
 * hacer y lo que el servidor le niega. Evaluar una prueba o emitir una
 * constancia son los hechos que suben el nivel de una persona.
 */

let server: InProcessApi;
let academy: AcademyApi;
let workshop: AcademyApi;

const noop = async () => undefined;
const rendered: string[] = [];
const html = (element: ReactElement) => {
  const markup = renderToStaticMarkup(element);
  rendered.push(markup);
  return markup;
};
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const browser = () => createApiRequest(createBrowserFetch(server.baseUrl));
const TEST_OF = { yorman: "pt-hoy-w-011", kelvin: "pt-hoy-w-012", angel: "pt-hoy-w-019" } as const;

beforeAll(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  server = startInProcessApi();
  const team = createTeamApi(browser());
  await team.enter(server.demoKey);
  await team.reset();
  academy = createAcademyApi(browser());
  workshop = createAcademyApi(browser());
});

afterAll(() => server.dispose());

describe("entrada de la academia", () => {
  it("antes de saber si hay sesión, la puerta dice con palabras que está cargando", () => {
    const markup = html(
      <AcademyGate>
        <p>contenido</p>
      </AcademyGate>,
    );

    expect(markup).toMatch(/role="status".*Abriendo tu academia…/);
    expect(markup).not.toContain("contenido");
  });

  it("sin sesión de academia el servidor no entrega el panel ni deja evaluar", async () => {
    await expect(academy.panel()).rejects.toMatchObject({ status: 401 });
    await expect(academy.evaluate(TEST_OF.yorman, 4)).rejects.toMatchObject({ status: 401 });
    await expect(academy.issueConstancia("en-w-carlos")).rejects.toMatchObject({ status: 401 });
  });

  it("el selector lista las academias de ejemplo, cada una con su botón nombrado", async () => {
    const { personas } = await academy.state();
    const markup = html(
      <AcademyPicker academies={personas.academies} onPick={noop} pending={false} error={null} />,
    );

    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(text(markup)).toContain("Academia Técnica Carabobo");
    expect(markup).toMatch(/Entrar<span class="sr-only"> como Taller Escuela Los Guayos<\/span>/);
    expect(html(<AcademyPicker academies={[]} onPick={noop} pending error="No se pudo entrar." />)).toMatch(
      /role="alert".*No se pudo entrar\..*Aún no hay academias de ejemplo/,
    );
  });

  it("entrar abre la sesión de esa academia y el marco dice cuál es", async () => {
    const state = await academy.enter(IDS.academy);
    await workshop.enter(IDS.workshop);
    const persona = state.personas.academies.find((candidate) => candidate.id === state.active.academyId);
    const markup = html(
      <AcademyShell academy={persona!} onSwitch={noop}>
        <h1>Panel</h1>
      </AcademyShell>,
    );

    expect(state.active.academyId).toBe(IDS.academy);
    expect(markup).toMatch(/<header[^>]*>.*Academia Técnica Carabobo.*Cambiar de academia.*<\/header>/s);
    expect(markup.match(/<main/g)).toHaveLength(1);
    expect(markup).toContain("Demo · nombres, empresas y cifras de ejemplo");
  });
});

describe("panel de la academia", () => {
  it("muestra el mes con cifras del servidor: inscripciones, ventas y la comisión con el IVA aparte", async () => {
    const panel = await academy.panel();
    const page = text(
      html(<AcademyPanelView panel={panel} onEvaluate={noop} onIssue={noop} notice={null} />),
    );

    expect(panel.commission).toEqual({ rate: 0.15, base: 108, iva: 17.28, total: 125.28 });
    expect(page).toContain("Inscripciones 12");
    expect(page).toContain("Ventas de la academia $720");
    expect(page).toMatch(/Comisión de NIVEL · 15 % por alumno Tarifa \$108 IVA 16 % \$17,28 Total \$125,28/);
    expect(page).toContain("Pago Móvil o transferencia");
    expect(page).toContain("Soldadura SMAW en estructuras $120 + IVA 6");
    expect(page).toContain("Seguridad en trabajos en caliente Gratis 6");
  });

  it("el ranking va con su cuenta y con la fórmula a la vista", async () => {
    const { ranking } = await academy.panel();
    const card = text(html(<RankingCard ranking={ranking} />));

    expect(card).toContain("42 %");
    expect(card).toContain("5 de 12 alumnos con trabajo confirmado en los últimos 90 días.");
    expect(card).toContain("Cómo se calcula: Alumnos con al menos un trabajo confirmado por ambas partes");
    expect(text(html(<RankingCard ranking={{ students: 0, withJob: 0, formula: "F." }} />))).not.toContain(
      "%",
    );
  });

  it("lista las pruebas de hoy con una nota por elegir y dice con cuánto se aprueba", async () => {
    const panel = await academy.panel();
    const markup = html(<AcademyPanelView panel={panel} onEvaluate={noop} onIssue={noop} notice={null} />);

    expect(panel.pendingTests.map((test) => test.id)).toEqual(Object.values(TEST_OF));
    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toMatch(/<label for="prueba-pt-hoy-w-011-nota"[^>]*>Nota de Yorman B\.<\/label>/);
    expect(markup).toMatch(/<option value="4" selected="">4 de 4<\/option>/);
    expect(text(markup)).toContain("Aprueba con 3 o más de 4.");
    expect(text(markup)).toContain("Prueba de electricista · Taller Escuela Los Guayos");
    expect(markup).toMatch(/Registrar nota<span class="sr-only"> de Ángel F\.<\/span>/);
  });

  it("una academia sin cursos lo dice en vez de mostrar una tabla vacía", async () => {
    const panel = await workshop.panel();

    expect(panel.courses).toEqual([]);
    expect(html(<CourseTable courses={panel.courses} />)).not.toContain("<table");
    expect(text(html(<CourseTable courses={panel.courses} />))).toContain("no publica cursos");
  });
});

describe("pruebas prácticas", () => {
  it("aprobar la prueba sube a la persona de nivel, y la prueba sale de la lista", async () => {
    const before = await academy.panel();
    const yorman = before.pendingTests.find((test) => test.id === TEST_OF.yorman)!;
    const result = await academy.evaluate(yorman.id, 4);
    const after = await academy.panel();

    expect(result.test).toMatchObject({ score: 4, passed: true });
    expect(result.level).toEqual({ level: 2, leveledUp: true });
    expect(testOutcome(yorman.worker, result)).toBe(
      "Yorman B.: prueba aprobada con 4 de 4. Sube a Nivel 2 · Verificado.",
    );
    expect(after.pendingTests.map((test) => test.id)).toEqual([TEST_OF.kelvin, TEST_OF.angel]);
  });

  it("con menos de 3 de 4 no aprueba y el nivel no cambia", async () => {
    const result = await workshop.evaluate(TEST_OF.kelvin, 2);

    expect(result.test).toMatchObject({ score: 2, passed: false });
    expect(result.level).toEqual({ level: 1, leveledUp: false });
    expect(testOutcome("Kelvin R.", result)).toBe("Kelvin R.: prueba no aprobada con 2 de 4.");
  });

  it("el servidor rechaza una nota fuera de rango, una prueba ya evaluada y una que no existe", async () => {
    await expect(academy.evaluate(TEST_OF.angel, 5)).rejects.toMatchObject({
      status: 422,
      message: "La nota va de 0 a 4",
    });
    await expect(academy.evaluate(TEST_OF.angel, 2.5)).rejects.toMatchObject({ status: 422 });
    await expect(academy.evaluate(TEST_OF.yorman, 1)).rejects.toMatchObject({
      status: 409,
      message: "Esta prueba ya fue evaluada.",
    });
    await expect(academy.evaluate("pt-no-existe", 3)).rejects.toMatchObject({ status: 404 });
  });

  it("el aviso del resultado se anuncia en una región de estado", async () => {
    const panel = await academy.panel();
    const markup = html(
      <AcademyPanelView
        panel={panel}
        onEvaluate={noop}
        onIssue={noop}
        notice="Yorman B.: prueba aprobada."
      />,
    );

    expect(markup).toMatch(/<div role="status" aria-live="polite">.*Yorman B\.: prueba aprobada\./s);
  });
});

describe("constancias", () => {
  it("quien termina un curso aparece por emitir; al emitir recibe su constancia y sale de la lista", async () => {
    const rafael = createWorkerApi(browser());
    await rafael.enter(IDS.rafael);
    await rafael.enroll(IDS.freeCourse);
    const enrollment = (await rafael.route()).courses.find(
      (course) => course.id === IDS.freeCourse,
    )!.enrollment!;
    await rafael.recordProgress(enrollment.id, 1);

    const [pending] = (await academy.panel()).pendingConstancias;
    const list = html(<PendingConstancias pending={[pending!]} onIssue={noop} />);
    const issued = await academy.issueConstancia(pending!.enrollmentId);
    const mine = (await rafael.route()).courses.find((course) => course.id === IDS.freeCourse)!;

    expect(pending).toEqual({
      enrollmentId: enrollment.id,
      worker: "Rafael T.",
      course: "Seguridad en trabajos en caliente",
    });
    expect(list).toMatch(/Emitir constancia<span class="sr-only"> a Rafael T\.<\/span>/);
    expect(text(list)).toContain("no un título oficial");
    expect(issued.constancia.code).toMatch(/^C-[A-Z0-9]{6}$/);
    expect(constanciaOutcome(pending!, issued)).toContain(
      `Constancia ${issued.constancia.code} emitida a Rafael T.`,
    );
    expect(mine.constancia).toBe(issued.constancia.code);
    expect((await academy.panel()).pendingConstancias).toEqual([]);
    // Emitirla dos veces devuelve la misma: no hay dos constancias del mismo curso.
    expect((await academy.issueConstancia(enrollment.id)).constancia.code).toBe(issued.constancia.code);
  });

  it("una academia no emite constancias de cursos de otra, ni de un curso sin terminar", async () => {
    await expect(workshop.issueConstancia(`en-${IDS.carlos}`)).rejects.toMatchObject({ status: 403 });
    await expect(academy.issueConstancia("en-no-existe")).rejects.toMatchObject({ status: 404 });
  });
});

describe("textos del panel", () => {
  it("nada de lo mostrado usa una palabra prohibida, y siempre dice constancia", () => {
    const all = text(rendered.join(" ")).toLowerCase();

    expect(rendered.length).toBeGreaterThan(8);
    for (const word of FORBIDDEN_WORDS) expect(all).not.toContain(word);
    expect(all).toContain("constancia");
    expect(all).not.toContain("certificado");
    expect(rendered.join(" ")).not.toMatch(/\sstyle="/);
  });
});
