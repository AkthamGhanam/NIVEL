import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Actor } from "../actor";
import {
  certificates,
  contracts,
  enrollments,
  fees,
  payments,
  ratings,
  reports,
  workers,
} from "../db/schema";
import { IDS } from "../db/seed/cast";
import { ForbiddenError, NotFoundError } from "../errors";
import { paysOnTimeByCompany } from "../repos/company-reputation";
import { loadWorkerFacts } from "../repos/worker-facts";
import { ACTORS, createTestApp, DEMO_NOW, type TestApp } from "../testing/test-app";
import { getAcademyPanel, issueConstancia } from "./academy";
import { listMyFees, payFee } from "./billing";
import { enrollInCourse, recordProgress } from "./learning";
import { getMetrics, realProfilesToday } from "./metrics";
import { deleteMyAccount, exportMyData, getMyProfile, setMyConsent } from "./profile";
import { createReport } from "./reports";

/**
 * Datos de las pantallas con el reloj fijo en el día de la demo: aquí van las
 * cifras exactas. Los permisos por HTTP se prueban en `http/api/screens.test.ts`.
 */

const ACADEMY: Actor = { role: "academy", academyId: IDS.academy };
const WORKSHOP: Actor = { role: "academy", academyId: IDS.workshop };
const KELVIN: Actor = { role: "worker", workerId: "w-012" };
const REAL: Actor = { role: "worker", workerId: "w-real" };

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(() => app.close());

function realWorker(overrides: Partial<typeof workers.$inferInsert> = {}): typeof workers.$inferInsert {
  return {
    id: "w-real",
    name: "María Fernanda Ejemplo",
    phone: "0414-0000000",
    trade: "soldador",
    skills: ["SMAW"],
    zone: "Los Guayos",
    lat: 10.19,
    lng: -67.93,
    availability: "inmediata",
    level: 2,
    createdVia: "voz",
    isReal: true,
    createdAt: DEMO_NOW.toISOString(),
    ...overrides,
  };
}

const shareableWelders = async () =>
  (await loadWorkerFacts(app.context.db, { trade: "soldador", shareableOnly: true })).map(
    (facts) => facts.workerId,
  );

describe("panel de la academia", () => {
  it("calcula inscripciones, ventas y comisión del mes con el IVA aparte", async () => {
    const panel = await getAcademyPanel(app.context, ACADEMY);

    expect(panel.courses.map((course) => course.enrollmentsThisMonth)).toEqual([6, 6]);
    expect(panel.salesThisMonthUsd).toBe(720);
    expect(panel.commission).toEqual({ rate: 0.15, base: 108, iva: 17.28, total: 125.28 });
  });

  it("lista las pruebas de hoy de sus alumnos con nombre corto y el ranking con su fórmula", async () => {
    const panel = await getAcademyPanel(app.context, ACADEMY);

    expect(panel.pendingTests.map((test) => test.worker)).toEqual(["Yorman B.", "Kelvin R.", "Ángel F."]);
    expect(panel.pendingTests.every((test) => test.isToday)).toBe(true);
    expect(panel.ranking).toMatchObject({ students: 12, withJob: 5 });
    expect(panel.ranking.formula).toContain("90 días");
    expect(JSON.stringify(panel)).not.toContain("Yorman Blanco");
  });

  it("el taller ve las pruebas que se presentan en sus instalaciones aunque no tenga cursos", async () => {
    const panel = await getAcademyPanel(app.context, WORKSHOP);

    expect(panel.courses).toEqual([]);
    expect(panel.pendingTests).toHaveLength(3);
    expect(panel.ranking).toMatchObject({ students: 0, withJob: 0 });
    expect(panel.commission.total).toBe(0);
  });

  it("no existe para quien no es academia ni para una academia borrada", async () => {
    await expect(getAcademyPanel(app.context, ACTORS.company)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      getAcademyPanel(app.context, { role: "academy", academyId: "ac-nadie" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("tarifas de NIVEL", () => {
  it("la empresa ve solo sus tarifas, con totales y la sugerencia del Plan Obra si le conviene", async () => {
    const statement = await listMyFees(app.context, ACTORS.company);

    const history = await listMyFees(app.context, ACTORS.otherCompany);

    // La empresa de la demo arranca limpia: sin tarifas, sin pagos y sin sugerencia de plan.
    expect(statement.fees).toHaveLength(0);
    expect(statement.paid).toEqual({ base: 0, iva: 0, total: 0 });
    expect(statement.planSuggestion).toBeNull();
    // El historial que respalda los niveles vive en las otras empresas.
    expect(history.fees.length).toBeGreaterThan(0);
    expect(history.pending.total).toBe(0);
    expect(history.paid.iva).toBeCloseTo(history.paid.base * 0.16, 2);
    expect(history.planSuggestion?.savesUsd).toBeGreaterThan(0);
  });

  it("no sugiere el plan a quien no le ahorra nada, ni a las academias", async () => {
    await app.context.db.delete(fees).where(eq(fees.companyId, "co-moron"));

    expect((await listMyFees(app.context, ACTORS.otherCompany)).planSuggestion).toBeNull();
    expect((await listMyFees(app.context, ACADEMY)).planSuggestion).toBeNull();
    await expect(listMyFees(app.context, ACTORS.carlos)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("la comisión de una inscripción paga queda por pagar y solo la paga su academia", async () => {
    await enrollInCourse(app.context, ACTORS.luis, IDS.paidCourse);
    const { fees: lines, pending } = await listMyFees(app.context, ACADEMY);
    const due = lines.find((line) => line.status === "por_pagar");

    expect(pending).toEqual({ base: 18, iva: 2.88, total: 20.88 });
    await expect(
      payFee(app.context, ACTORS.company, { feeId: due?.id ?? "", method: "pago_movil" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      payFee(app.context, WORKSHOP, { feeId: due?.id ?? "", method: "pago_movil" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await payFee(app.context, ACADEMY, { feeId: due?.id ?? "", method: "pago_movil" })).toMatchObject({
      status: "pagado",
      method: "pago_movil",
    });
  });
});

describe("dos toques a la vez", () => {
  it("dos inscripciones simultáneas dejan una sola inscripción y una sola comisión", async () => {
    const [first, second] = await Promise.all([
      enrollInCourse(app.context, ACTORS.luis, IDS.paidCourse),
      enrollInCourse(app.context, ACTORS.luis, IDS.paidCourse),
    ]);
    const mine = await app.context.db.select().from(enrollments).where(eq(enrollments.workerId, IDS.luis));

    expect(second.id).toBe(first.id);
    expect(mine).toHaveLength(1);
    expect((await listMyFees(app.context, ACADEMY)).pending.total).toBe(20.88);
  });

  it("dos emisiones simultáneas dejan una sola constancia", async () => {
    await recordProgress(
      app.context,
      { role: "worker", workerId: "w-020" },
      { enrollmentId: "en-w-020", progress: 1 },
    );
    const results = await Promise.allSettled([
      issueConstancia(app.context, ACADEMY, "en-w-020"),
      issueConstancia(app.context, ACADEMY, "en-w-020"),
    ]);
    const issued = await app.context.db.select().from(certificates).where(eq(certificates.workerId, "w-020"));

    expect(issued).toHaveLength(1);
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
  });
});

describe("métricas del panel interno", () => {
  it("cuenta personas, solicitudes y contrataciones, y separa el IVA de los ingresos", async () => {
    const metrics = await getMetrics(app.context, ACTORS.admin);

    expect(metrics.workers).toMatchObject({ total: 40, real: 0 });
    expect(Object.values(metrics.workers.byLevel).reduce((a, b) => a + b, 0)).toBe(40);
    expect(metrics.requests.total).toBe(87);
    expect(metrics.hires).toBe(87);
    expect(metrics.income.hiring).toEqual({ base: 3050, iva: 488, total: 3538 });
    expect(metrics.income.academyCommission).toEqual({ base: 108, iva: 17.28, total: 125.28 });
    expect(metrics.income.total).toEqual({ base: 3158, iva: 505.28, total: 3663.28 });
    expect(metrics.averageMinutesToFullCrew).toBeNull();
  });

  it("lo pendiente por cobrar y los reportes en revisión se actualizan en vivo", async () => {
    await enrollInCourse(app.context, ACTORS.luis, IDS.paidCourse);
    await createReport(app.context, ACTORS.carlos, { kind: "inseguridad", text: "No había extintor." });
    const metrics = await getMetrics(app.context, ACTORS.admin);

    expect(metrics.income.pendingTotalUsd).toBe(20.88);
    expect(metrics.reportsInReview).toBe(1);
    await expect(getMetrics(app.context, ACTORS.company)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("los perfiles reales de hoy muestran solo nombre de pila, oficio y zona", async () => {
    const yesterday = new Date(DEMO_NOW.getTime() - 86_400_000).toISOString();
    await app.context.db
      .insert(workers)
      .values([
        realWorker(),
        realWorker({ id: "w-real-ayer", name: "Pedro Ayer", createdAt: yesterday }),
        realWorker({ id: "w-real-borrado", name: "Ana Borrada", deletedAt: DEMO_NOW.toISOString() }),
      ]);
    const today = await realProfilesToday(app.context, ACTORS.admin);

    expect(today).toEqual({
      count: 1,
      profiles: [{ firstName: "María", trade: "soldador", zone: "Los Guayos" }],
    });
    expect((await getMetrics(app.context, ACTORS.admin)).workers.real).toBe(2);
    await expect(realProfilesToday(app.context, ACTORS.carlos)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("paga a tiempo", () => {
  it("solo se calcula con 5 o más trabajos terminados, y baja si un pago se registró tarde", async () => {
    const [late] = await app.context.db.select().from(contracts).where(eq(contracts.companyId, "co-prado"));
    await app.context.db
      .update(payments)
      .set({ registeredAt: "2027-01-15T12:00:00.000Z" })
      .where(eq(payments.contractId, late?.id ?? ""));
    const rates = await paysOnTimeByCompany(app.context.db, [
      IDS.activeCompany,
      "co-prado",
      "co-moron",
      "co-sin-historia",
    ]);

    // Sin contrataciones terminadas no hay dato; con historial, un pago tardío baja el porcentaje.
    expect(rates.get(IDS.activeCompany)).toBeNull();
    expect(rates.get("co-prado")).toBeLessThan(100);
    expect(rates.get("co-moron")).toBe(100);
    expect(rates.get("co-sin-historia")).toBeNull();
    expect(await paysOnTimeByCompany(app.context.db, [])).toEqual(new Map());
  });
});

describe("permisos de una persona real", () => {
  it("no aparece en la búsqueda de empresas hasta que acepta compartir su perfil, y sale al retirarlo", async () => {
    await app.context.db.insert(workers).values(realWorker());

    expect(await shareableWelders()).not.toContain("w-real");
    const granted = await setMyConsent(app.context, REAL, { kind: "share_profile", granted: true });
    expect(granted.share_profile).toBe(DEMO_NOW.toISOString());
    expect(await shareableWelders()).toContain("w-real");

    const revoked = await setMyConsent(app.context, REAL, { kind: "share_profile", granted: false });
    expect(revoked.share_profile).toBeNull();
    expect(await shareableWelders()).not.toContain("w-real");
  });

  it("conceder de nuevo un permiso ya dado conserva la fecha original", async () => {
    const before = (await getMyProfile(app.context, ACTORS.carlos)).consents.voice;
    app.setNow(new Date(DEMO_NOW.getTime() + 3_600_000));
    const after = await setMyConsent(app.context, ACTORS.carlos, { kind: "voice", granted: true });

    expect(after.voice).toBe(before);
  });
});

describe("borrar la cuenta", () => {
  it("con contratos: borra lo personal, conserva los recibos y deja los reportes sin autor", async () => {
    await createReport(app.context, ACTORS.carlos, { kind: "no_pago", text: "No me han pagado." });
    const result = await deleteMyAccount(app.context, ACTORS.carlos);
    const { db } = app.context;
    const [row] = await db.select().from(workers).where(eq(workers.id, IDS.carlos));
    const kept = await db
      .select({ id: payments.id })
      .from(payments)
      .innerJoin(contracts, eq(payments.contractId, contracts.id))
      .where(eq(contracts.workerId, IDS.carlos));

    expect(result.outcome).toBe("anonimizada");
    expect(result.message).toContain("recibos");
    expect(row).toMatchObject({ phone: null, skills: [], openToWork: false, consentShareProfileAt: null });
    expect(row?.deletedAt).toBe(DEMO_NOW.toISOString());
    expect(kept).toHaveLength(2);
    expect(await db.select().from(certificates).where(eq(certificates.workerId, IDS.carlos))).toEqual([]);
    expect(await db.select().from(enrollments).where(eq(enrollments.workerId, IDS.carlos))).toEqual([]);
    expect(await db.select().from(ratings).where(eq(ratings.toId, IDS.carlos))).toEqual([]);
    expect((await db.select().from(reports))[0]?.reporterWorkerId).toBeNull();
    expect(await shareableWelders()).not.toContain(IDS.carlos);
    await expect(getMyProfile(app.context, ACTORS.carlos)).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteMyAccount(app.context, ACTORS.carlos)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("sin contratos: no queda ni la fila", async () => {
    const result = await deleteMyAccount(app.context, KELVIN);
    const { db } = app.context;

    expect(result.outcome).toBe("borrada");
    expect(await db.select().from(workers).where(eq(workers.id, "w-012"))).toEqual([]);
    expect(await db.select().from(enrollments).where(eq(enrollments.workerId, "w-012"))).toEqual([]);
  });
});

describe("descarga de Mis datos", () => {
  it("trae lo propio y oculta una calificación que aún no se revela", async () => {
    const [received] = await app.context.db.select().from(ratings).where(eq(ratings.toId, IDS.carlos));
    await app.context.db
      .update(ratings)
      .set({ revealedAt: null, submittedAt: DEMO_NOW.toISOString() })
      .where(eq(ratings.id, received?.id ?? ""));
    const data = await exportMyData(app.context, ACTORS.carlos);

    expect(data.work).toHaveLength(2);
    expect(data.attendance).toHaveLength(6);
    expect(data.training.constancias.map((row) => row.code)).toEqual(["C-2041"]);
    expect(data.ratingsReceived).toHaveLength(1);
    expect(JSON.stringify(data)).not.toMatch(/otpHash|Rafael|w-rafael/);
    await expect(exportMyData(app.context, ACTORS.company)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
