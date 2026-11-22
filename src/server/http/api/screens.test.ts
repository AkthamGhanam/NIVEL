import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "../../../../scripts/smoke/client";
import { academies } from "../../db/schema";
import { IDS } from "../../db/seed/cast";
import { dispatch, type InProcessApi, startInProcessApi } from "../../testing/in-process-api";

/**
 * Datos de las pantallas por las rutas reales: quién puede ver y cambiar qué.
 * Las cifras exactas, con el reloj fijo, están en `use-cases/screens.test.ts`.
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
};
const KELVIN = "w-012";
const ROSA = "w-020";
const YORMAN_TEST = "pt-hoy-w-011";
const KELVIN_TEST = "pt-hoy-w-012";
const ANGEL_TEST = "pt-hoy-w-019";

interface Profile {
  name: string;
  zone: string;
  openToWork: boolean;
  consents: Record<string, string | null>;
  level: { level: number };
}
interface Graded {
  test: { passed: boolean };
  level: { level: number; leveledUp: boolean };
}
interface Issued {
  constancia: { code: string };
  level: { level: number; leveledUp: boolean } | null;
}

let api: InProcessApi;
let team: ApiClient;
let company: ApiClient;
let academy: ApiClient;

const newClient = () => new ApiClient(api.baseUrl, dispatch, api.demoKey);

async function enter(role: "worker" | "company" | "academy", id: string): Promise<ApiClient> {
  const client = newClient();
  await client.enterAs(role, id);
  return client;
}

const reset = () => team.post("/api/demo/reset?all=1", { as: "admin" });

const matching = async () =>
  (await company.post<{ matching: number }>("/api/requests", { body: SCRIPT_REQUEST })).matching;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

beforeAll(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  api = startInProcessApi();
  team = newClient();
  await reset();
  company = await enter("company", IDS.activeCompany);
  academy = await enter("academy", IDS.academy);
});

afterAll(() => api.dispose());

describe("Mis datos por HTTP", () => {
  it("muestra el perfil propio, y nadie más entra: ni visitante ni otro rol", async () => {
    const carlos = await enter("worker", IDS.carlos);
    const profile = await carlos.get<Profile>("/api/me");

    expect(profile).toMatchObject({ name: "Carlos Rodríguez", openToWork: true, level: { level: 2 } });
    expect(profile).not.toHaveProperty("phone");
    expect((await newClient().call("GET", "/api/me")).status).toBe(401);
    expect((await company.call("GET", "/api/me/data")).status).toBe(401);
    expect((await company.call("DELETE", "/api/me")).status).toBe(401);
  });

  it("corrige sus datos, pero no puede subirse el nivel ni escribir un nombre inválido", async () => {
    const luis = await enter("worker", IDS.luis);
    const corrected = await luis.patch<Profile>("/api/me", {
      body: { name: "  Luis   Alberto Mendoza ", zone: "Guacara", skills: ["SMAW", " TIG "], yearsExp: 5 },
    });
    const cheat = await luis.call("PATCH", "/api/me", { body: { level: 5 } });
    const badName = await luis.call("PATCH", "/api/me", { body: { name: "<script>alert(1)</script>" } });
    const untouched = await luis.patch<Profile>("/api/me", { body: {} });

    expect(corrected).toMatchObject({
      name: "Luis Alberto Mendoza",
      zone: "Guacara",
      skills: ["SMAW", "TIG"],
    });
    expect(cheat.status).toBe(422);
    expect(badName.status).toBe(422);
    expect(untouched.level.level).toBe(3);
  });

  it("apagar «abierto a trabajar» lo saca de la búsqueda de empresas y encenderlo lo devuelve", async () => {
    const carlos = await enter("worker", IDS.carlos);
    const before = await matching();
    await carlos.patch("/api/me", { body: { openToWork: false } });
    const hidden = await matching();
    await carlos.patch("/api/me", { body: { openToWork: true } });

    expect(before - hidden).toBe(1);
    expect(await matching()).toBe(before);
  });

  it("concede y retira cada permiso por separado", async () => {
    const carlos = await enter("worker", IDS.carlos);
    const granted = await carlos.post<{ consents: Record<string, string | null> }>("/api/me/consents", {
      body: { kind: "selfie", granted: true },
    });
    const revoked = await carlos.post<{ consents: Record<string, string | null> }>("/api/me/consents", {
      body: { kind: "selfie", granted: false },
    });
    const unknown = await carlos.call("POST", "/api/me/consents", { body: { kind: "todo", granted: true } });

    expect(granted.consents.selfie).not.toBeNull();
    expect(granted.consents.gps).not.toBeNull();
    expect(revoked.consents.selfie).toBeNull();
    expect(revoked.consents.gps).not.toBeNull();
    expect(unknown.status).toBe(422);
  });

  it("descarga sus datos como archivo adjunto, sin caché", async () => {
    const carlos = await enter("worker", IDS.carlos);
    const download = await carlos.call<{ profile: Profile; work: unknown[] }>("GET", "/api/me/data");

    expect(download.status).toBe(200);
    expect(download.headers.get("content-disposition")).toContain("attachment");
    expect(download.headers.get("cache-control")).toBe("no-store");
    expect(download.data.work).toHaveLength(2);
  });

  it("borrar la cuenta cierra la sesión, la saca del selector y de la búsqueda", async () => {
    const carlos = await enter("worker", IDS.carlos);
    const otherDevice = await enter("worker", IDS.carlos);
    const before = await matching();
    const removal = await carlos.delete<{ outcome: string }>("/api/me");
    const state = await newClient().get<{ personas: { workers: Array<{ id: string }> } }>("/api/state");

    expect(removal.outcome).toBe("anonimizada");
    expect((await carlos.call("GET", "/api/me")).status).toBe(401);
    expect((await otherDevice.call("GET", "/api/me")).status).toBe(401);
    expect((await otherDevice.call("GET", "/api/invitations")).status).toBe(401);
    expect(state.personas.workers.map((worker) => worker.id)).not.toContain(IDS.carlos);
    expect(await matching()).toBe(before - 1);
    expect(
      (await newClient().call("POST", "/api/state", { body: { role: "worker", id: IDS.carlos } })).status,
    ).toBe(404);
  });

  it("una persona sin contratos se borra por completo", async () => {
    const kelvin = await enter("worker", KELVIN);
    const removal = await kelvin.delete<{ outcome: string }>("/api/me");
    const panel = await academy.get<{ pendingTests: Array<{ id: string }> }>("/api/academy");

    expect(removal.outcome).toBe("borrada");
    expect((await kelvin.call("GET", "/api/me")).status).toBe(401);
    expect(panel.pendingTests.map((test) => test.id)).not.toContain(KELVIN_TEST);
  });
});

describe("Mi ruta por HTTP", () => {
  beforeAll(reset);

  it("muestra los cursos del oficio con precio más IVA y las cuotas de la academia", async () => {
    const luis = await enter("worker", IDS.luis);
    const route = await luis.get<{
      courses: Array<{
        id: string;
        price: unknown;
        installments: unknown;
        lessons: unknown[];
        enrollment: unknown;
      }>;
      practicalTest: { passed: boolean };
    }>("/api/courses");
    const paid = route.courses.find((course) => course.id === IDS.paidCourse);

    expect(route.courses).toHaveLength(2);
    expect(paid).toMatchObject({
      price: { base: 120, iva: 19.2, total: 139.2 },
      installments: { count: 4, amountUsd: 30 },
      enrollment: null,
    });
    expect(route.courses.find((course) => course.id === IDS.freeCourse)?.lessons).toHaveLength(3);
    expect(route.practicalTest.passed).toBe(true);
  });

  it("inscribirse dos veces devuelve la misma inscripción y cobra una sola comisión a la academia", async () => {
    const luis = await enter("worker", IDS.luis);
    const first = await luis.post<{ id: string }>(`/api/courses/${IDS.paidCourse}/enroll`);
    const second = await luis.post<{ id: string }>(`/api/courses/${IDS.paidCourse}/enroll`);
    await luis.post(`/api/courses/${IDS.freeCourse}/enroll`);
    const statement = await academy.get<{ pending: { total: number } }>("/api/fees");

    expect(second.id).toBe(first.id);
    expect(statement.pending.total).toBe(20.88);
    expect((await luis.call("POST", "/api/courses/cu-nada/enroll")).status).toBe(404);
    expect((await company.call("POST", `/api/courses/${IDS.paidCourse}/enroll`)).status).toBe(401);
  });

  it("el avance nunca retrocede, y nadie avanza el curso de otra persona", async () => {
    const luis = await enter("worker", IDS.luis);
    const rafael = await enter("worker", IDS.rafael);
    const { id } = await luis.post<{ id: string }>(`/api/courses/${IDS.freeCourse}/enroll`);
    const advance = (progress: number) =>
      luis.post<{ progress: number; status: string }>(`/api/enrollments/${id}/progress`, {
        body: { progress },
      });

    expect((await advance(0.5)).progress).toBe(0.5);
    expect((await advance(0.25)).progress).toBe(0.5);
    expect(await advance(1)).toMatchObject({ progress: 1, status: "completado" });
    expect(
      (await luis.call("POST", `/api/enrollments/${id}/progress`, { body: { progress: 1.5 } })).status,
    ).toBe(422);
    expect(
      (await rafael.call("POST", `/api/enrollments/${id}/progress`, { body: { progress: 1 } })).status,
    ).toBe(403);
    expect(
      (await luis.call("POST", "/api/enrollments/en-nada/progress", { body: { progress: 1 } })).status,
    ).toBe(404);
  });

  it("agenda una sola prueba práctica pendiente; quien ya aprobó no agenda otra", async () => {
    const ramon = await enter("worker", "w-ramon");
    const carlos = await enter("worker", IDS.carlos);
    const booked = await ramon.post<{ id: string; workshop: string; date: string }>("/api/practical-tests");
    const again = await ramon.post<{ id: string }>("/api/practical-tests");
    const route = await ramon.get<{ practicalTest: { scheduledFor: string | null } }>("/api/courses");

    expect(booked.workshop).toBe("Taller Escuela Los Guayos");
    expect(again.id).toBe(booked.id);
    expect(route.practicalTest.scheduledFor).toBe(booked.date);
    expect((await carlos.call("POST", "/api/practical-tests")).status).toBe(409);
  });
});

describe("panel de la academia por HTTP", () => {
  beforeAll(reset);

  it("solo una academia ve su panel", async () => {
    const panel = await academy.get<{ courses: unknown[]; pendingTests: unknown[] }>("/api/academy");

    expect(panel.courses).toHaveLength(2);
    expect(panel.pendingTests).toHaveLength(3);
    expect((await company.call("GET", "/api/academy")).status).toBe(401);
    expect((await newClient().call("GET", "/api/academy")).status).toBe(401);
  });

  it("aprobar la prueba práctica (3 de 4) sube al trabajador a Nivel 2; reprobarla no", async () => {
    const passed = await academy.post<Graded>(`/api/practical-tests/${KELVIN_TEST}/evaluate`, {
      body: { score: 3 },
    });
    const failed = await academy.post<Graded>(`/api/practical-tests/${ANGEL_TEST}/evaluate`, {
      body: { score: 2 },
    });
    const kelvin = await enter("worker", KELVIN);

    expect(passed).toMatchObject({ test: { passed: true }, level: { level: 2, leveledUp: true } });
    expect(failed).toMatchObject({ test: { passed: false }, level: { level: 1, leveledUp: false } });
    expect((await kelvin.get<{ level: number }>("/api/level")).level).toBe(2);
  });

  it("una prueba no se evalúa dos veces ni con una nota fuera de rango", async () => {
    const evaluate = (testId: string, score: number) =>
      academy.call("POST", `/api/practical-tests/${testId}/evaluate`, { body: { score } });

    expect((await evaluate(KELVIN_TEST, 4)).status).toBe(409);
    expect((await evaluate(YORMAN_TEST, 5)).status).toBe(422);
    expect((await evaluate(YORMAN_TEST, 2.5)).status).toBe(422);
    expect((await evaluate("pt-nada", 3)).status).toBe(404);
  });

  it("una academia ajena no evalúa ni emite constancias de alumnos que no son suyos", async () => {
    const { app } = await import("../../app");
    const { handle } = await app();
    await handle.db
      .insert(academies)
      .values({ id: "ac-ajena", name: "Instituto Ajeno", rif: "J-0", city: "Maracay" });
    const stranger = await enter("academy", "ac-ajena");
    const panel = await stranger.get<{
      courses: unknown[];
      pendingTests: unknown[];
      pendingConstancias: unknown[];
    }>("/api/academy");

    expect(panel).toMatchObject({ courses: [], pendingTests: [], pendingConstancias: [] });
    expect(
      (await stranger.call("POST", `/api/practical-tests/${YORMAN_TEST}/evaluate`, { body: { score: 4 } }))
        .status,
    ).toBe(403);
    expect((await stranger.call("POST", "/api/enrollments/en-w-ramon/constancia")).status).toBe(403);
    expect((await stranger.get<{ fees: unknown[] }>("/api/fees")).fees).toEqual([]);
  });

  it("el taller evalúa las pruebas que se presentan en sus instalaciones", async () => {
    const workshop = await enter("academy", IDS.workshop);
    const graded = await workshop.post<Graded>(`/api/practical-tests/${YORMAN_TEST}/evaluate`, {
      body: { score: 4 },
    });

    expect(graded.level).toEqual({ level: 2, leveledUp: true });
  });

  it("emite la constancia de un curso terminado, una sola vez, y eso sube el nivel", async () => {
    const rosa = await enter("worker", ROSA);
    const notFinished = await academy.call("POST", `/api/enrollments/en-${ROSA}/constancia`);
    await rosa.post(`/api/enrollments/en-${ROSA}/progress`, { body: { progress: 1 } });
    const panel = await academy.get<{ pendingConstancias: Array<{ worker: string }> }>("/api/academy");
    const issued = await academy.post<Issued>(`/api/enrollments/en-${ROSA}/constancia`);
    const again = await academy.post<Issued>(`/api/enrollments/en-${ROSA}/constancia`);
    const route = await rosa.get<{ courses: Array<{ constancia: string | null }> }>("/api/courses");

    expect(notFinished.status).toBe(409);
    expect(panel.pendingConstancias.map((row) => row.worker)).toEqual(["Rosa P."]);
    expect(issued.constancia.code).toMatch(/^C-[0-9A-Z]{6}$/);
    expect(issued.level).toEqual({ level: 2, leveledUp: true });
    expect(again).toMatchObject({ constancia: { code: issued.constancia.code }, level: null });
    expect(route.courses.map((course) => course.constancia)).toContain(issued.constancia.code);
    expect((await academy.call("POST", "/api/enrollments/en-nada/constancia")).status).toBe(404);
  });
});

describe("tarifas y métricas por HTTP", () => {
  beforeAll(reset);

  it("cada quien paga solo sus tarifas, una vez, y solo por Pago Móvil o transferencia", async () => {
    const luis = await enter("worker", IDS.luis);
    await luis.post(`/api/courses/${IDS.paidCourse}/enroll`);
    const { fees } = await academy.get<{ fees: Array<{ id: string; status: string }> }>("/api/fees");
    const due = fees.find((fee) => fee.status === "por_pagar")?.id ?? "";
    const pay = (client: ApiClient, method: string) =>
      client.call("POST", `/api/fees/${due}/pay`, { body: { method } });

    expect((await pay(academy, "zelle")).status).toBe(422);
    expect((await pay(company, "pago_movil")).status).toBe(403);
    expect((await pay(luis, "pago_movil")).status).toBe(401);
    expect((await pay(academy, "pago_movil")).status).toBe(200);
    expect((await pay(academy, "transferencia")).status).toBe(409);
    expect(
      (await academy.call("POST", "/api/fees/fe-nada/pay", { body: { method: "pago_movil" } })).status,
    ).toBe(404);
  });

  it("la empresa ve su estado de cuenta, no el de la academia", async () => {
    const statement = await company.get<{
      fees: Array<{ concept: string }>;
      paid: { iva: number; base: number };
    }>("/api/fees");

    expect(statement.fees.length).toBeGreaterThan(0);
    expect(statement.fees.every((fee) => fee.concept.startsWith("Contratación"))).toBe(true);
    expect(statement.paid.iva).toBeCloseTo(statement.paid.base * 0.16, 2);
  });

  it("las métricas y los perfiles reales son solo para el equipo", async () => {
    const metrics = await team.get<{
      workers: { total: number };
      income: { total: { base: number; iva: number } };
    }>("/api/metrics", { as: "admin" });
    const real = await team.get<{ count: number }>("/api/demo/real-profiles", { as: "admin" });

    expect(metrics.workers.total).toBe(40);
    expect(metrics.income.total.iva).toBeCloseTo(metrics.income.total.base * 0.16, 2);
    expect(real.count).toBe(0);
    expect((await company.call("GET", "/api/metrics")).status).toBe(401);
    expect((await newClient().call("GET", "/api/demo/real-profiles")).status).toBe(401);
  });
});
