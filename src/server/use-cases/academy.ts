import { and, count, countDistinct, desc, eq, gte, inArray, isNotNull, isNull, or, sum } from "drizzle-orm";

import { localDate } from "@/lib/dates";
import { ensure } from "@/lib/errors";
import { shortName } from "@/lib/matching";
import { round2 } from "@/lib/money";
import { passes } from "@/lib/practical-test";
import { ACADEMY_COMMISSION_RATE } from "@/lib/pricing";

import { type Actor, requireRole } from "../actor";
import type { AppContext } from "../context";
import {
  academies,
  certificates,
  contracts,
  courses,
  enrollments,
  fees,
  payments,
  practicalTests,
  workers,
} from "../db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors";
import { logEvent } from "./events";
import { recalculateLevel } from "./levels";

/**
 * Panel de la academia: sus cursos e inscripciones, la comisión de NIVEL,
 * las pruebas prácticas del día y la emisión de constancias. Evaluar una
 * prueba o emitir una constancia son los hechos verificables que suben el nivel.
 */

const MS_PER_DAY = 86_400_000;
const RANKING_WINDOW_DAYS = 90;
const RANKING_FORMULA =
  "Alumnos con al menos un trabajo confirmado por ambas partes en los últimos 90 días, entre todos los alumnos inscritos. Datos de NIVEL.";

/** Recalcula el nivel como sistema: lo dispara un hecho verificado, no la persona. */
const SYSTEM: Actor = { role: "admin" };

async function loadAcademy(context: AppContext, actor: Actor) {
  const { academyId } = requireRole(actor, "academy");
  const [academy] = await context.db.select().from(academies).where(eq(academies.id, academyId));
  if (!academy) throw new NotFoundError("la academia");
  return academy;
}

/** Alumnos de la academia: personas inscritas en alguno de sus cursos. */
async function studentIdsOf(context: AppContext, academyId: string): Promise<string[]> {
  const students = await context.db
    .selectDistinct({ workerId: enrollments.workerId })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(eq(courses.academyId, academyId));
  return students.map((row) => row.workerId);
}

async function employmentRate(context: AppContext, ids: readonly string[]) {
  if (ids.length === 0) return { students: 0, withJob: 0, formula: RANKING_FORMULA };
  const since = new Date(context.now().getTime() - RANKING_WINDOW_DAYS * MS_PER_DAY).toISOString();
  const [{ withJob } = { withJob: 0 }] = await context.db
    .select({ withJob: countDistinct(contracts.workerId) })
    .from(contracts)
    .innerJoin(payments, eq(payments.contractId, contracts.id))
    .where(
      and(
        inArray(contracts.workerId, [...ids]),
        eq(contracts.status, "completado"),
        isNotNull(payments.confirmedByWorkerAt),
        gte(payments.confirmedByWorkerAt, since),
      ),
    );
  return { students: ids.length, withJob, formula: RANKING_FORMULA };
}

async function commissionSince(context: AppContext, academyId: string, since: string) {
  const [row] = await context.db
    .select({ base: sum(fees.baseUsd), iva: sum(fees.ivaUsd), total: sum(fees.totalUsd) })
    .from(fees)
    .where(and(eq(fees.academyId, academyId), gte(fees.createdAt, since)));
  return {
    rate: ACADEMY_COMMISSION_RATE,
    base: round2(Number(row?.base ?? 0)),
    iva: round2(Number(row?.iva ?? 0)),
    total: round2(Number(row?.total ?? 0)),
  };
}

/** Pruebas sin evaluar que le tocan: las de su propio taller y las de sus alumnos en el taller aliado. */
async function pendingTestsOf(
  context: AppContext,
  academy: { readonly name: string },
  students: readonly string[],
) {
  const today = localDate(context.now());
  const own = or(
    eq(practicalTests.workshop, academy.name),
    students.length === 0 ? undefined : inArray(practicalTests.workerId, [...students]),
  );
  const rows = await context.db
    .select({ test: practicalTests, workerName: workers.name })
    .from(practicalTests)
    .innerJoin(workers, eq(practicalTests.workerId, workers.id))
    .where(and(own, isNull(practicalTests.score)))
    .orderBy(practicalTests.date, practicalTests.id);
  return rows.map(({ test, workerName }) => ({
    id: test.id,
    worker: shortName(workerName),
    trade: test.trade,
    workshop: test.workshop,
    date: test.date,
    isToday: test.date === today,
    maxScore: test.maxScore,
  }));
}

async function enrollmentsSince(context: AppContext, courseIds: readonly string[], since: string) {
  if (courseIds.length === 0) return new Map<string, number>();
  const rows = await context.db
    .select({ courseId: enrollments.courseId, total: count() })
    .from(enrollments)
    .where(and(inArray(enrollments.courseId, [...courseIds]), gte(enrollments.enrolledAt, since)))
    .groupBy(enrollments.courseId);
  return new Map(rows.map((row) => [row.courseId, row.total]));
}

export async function getAcademyPanel(context: AppContext, actor: Actor) {
  const academy = await loadAcademy(context, actor);
  const monthStart = `${localDate(context.now()).slice(0, 7)}-01`;
  const [own, students] = await Promise.all([
    context.db.select().from(courses).where(eq(courses.academyId, academy.id)),
    studentIdsOf(context, academy.id),
  ]);
  const courseIds = own.map((course) => course.id);
  const [enrolledThisMonth, pendingConstancias, commission, pendingTests, ranking] = await Promise.all([
    enrollmentsSince(context, courseIds, monthStart),
    completedWithoutConstancia(context, courseIds),
    commissionSince(context, academy.id, monthStart),
    pendingTestsOf(context, academy, students),
    employmentRate(context, students),
  ]);
  const sales = own.reduce(
    (total, course) => total + course.priceUsd * (enrolledThisMonth.get(course.id) ?? 0),
    0,
  );
  return {
    academy: { id: academy.id, name: academy.name, rif: academy.rif },
    courses: own.map((course) => ({
      id: course.id,
      title: course.title,
      free: course.free,
      priceUsd: course.priceUsd,
      enrollmentsThisMonth: enrolledThisMonth.get(course.id) ?? 0,
    })),
    salesThisMonthUsd: round2(sales),
    /** Comisión de NIVEL del mes: 15 % de cada inscripción paga, con el IVA aparte. */
    commission,
    pendingTests,
    pendingConstancias,
    ranking,
  };
}

/** Inscripciones terminadas a las que la academia aún no les emite constancia. */
async function completedWithoutConstancia(context: AppContext, courseIds: readonly string[]) {
  if (courseIds.length === 0) return [];
  const rows = await context.db
    .select({
      enrollment: enrollments,
      workerName: workers.name,
      course: courses.title,
      code: certificates.code,
    })
    .from(enrollments)
    .innerJoin(workers, eq(enrollments.workerId, workers.id))
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .leftJoin(
      certificates,
      and(eq(certificates.workerId, enrollments.workerId), eq(certificates.courseId, enrollments.courseId)),
    )
    .where(and(inArray(enrollments.courseId, [...courseIds]), eq(enrollments.status, "completado")))
    .orderBy(desc(enrollments.enrolledAt));
  return rows
    .filter((row) => row.code === null)
    .map((row) => ({
      enrollmentId: row.enrollment.id,
      worker: shortName(row.workerName),
      course: row.course,
    }));
}

/** Una academia evalúa las pruebas de su taller y las de sus propios alumnos, nunca las de otros. */
async function assertCanEvaluate(
  context: AppContext,
  academy: { readonly id: string; readonly name: string },
  test: { readonly workshop: string; readonly workerId: string },
): Promise<void> {
  if (test.workshop === academy.name) return;
  const students = await studentIdsOf(context, academy.id);
  if (!students.includes(test.workerId)) throw new ForbiddenError();
}

/** Registra la nota de una prueba práctica. Con 3 de 4 criterios aprueba, y el nivel se recalcula. */
export async function evaluatePracticalTest(
  context: AppContext,
  actor: Actor,
  input: { readonly testId: string; readonly score: number },
) {
  const academy = await loadAcademy(context, actor);
  const [test] = await context.db.select().from(practicalTests).where(eq(practicalTests.id, input.testId));
  if (!test) throw new NotFoundError("la prueba");
  await assertCanEvaluate(context, academy, test);
  ensure(
    Number.isInteger(input.score) && input.score >= 0 && input.score <= test.maxScore,
    `La nota va de 0 a ${test.maxScore}`,
  );
  const passed = passes(input.score, test.maxScore);
  const [evaluated] = await context.db
    .update(practicalTests)
    .set({ score: input.score, passed })
    .where(and(eq(practicalTests.id, test.id), isNull(practicalTests.score)))
    .returning();
  if (!evaluated) throw new ConflictError("Esta prueba ya fue evaluada.");
  await logEvent(context, {
    actor: academy.name,
    type: "prueba_evaluada",
    label: `Prueba práctica ${passed ? "aprobada" : "no aprobada"} (${input.score} de ${test.maxScore})`,
    detail: { testId: test.id },
  });
  const level = await recalculateLevel(context, SYSTEM, test.workerId);
  return { test: evaluated, level: { level: level.level, leveledUp: level.leveledUp } };
}

const CONSTANCIA_SUFFIX = 6;

/** La academia emite la constancia de un curso terminado. Se llama "constancia", nunca certificado oficial. */
export async function issueConstancia(context: AppContext, actor: Actor, enrollmentId: string) {
  const academy = await loadAcademy(context, actor);
  const [row] = await context.db
    .select({ enrollment: enrollments, course: courses })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(eq(enrollments.id, enrollmentId));
  if (!row) throw new NotFoundError("la inscripción");
  const { enrollment, course } = row;
  if (course.academyId !== academy.id) throw new ForbiddenError();
  if (enrollment.status !== "completado") throw new ConflictError("El alumno aún no termina el curso.");
  const [existing] = await context.db
    .select()
    .from(certificates)
    .where(and(eq(certificates.workerId, enrollment.workerId), eq(certificates.courseId, course.id)));
  if (existing) return { constancia: existing, level: null };
  const id = context.newId("ce");
  const constancia = {
    id,
    workerId: enrollment.workerId,
    courseId: course.id,
    code: `C-${id.slice(-CONSTANCIA_SUFFIX).toUpperCase()}`,
    issuedByAcademyId: academy.id,
    date: localDate(context.now()),
  };
  const inserted = await context.db.insert(certificates).values(constancia).onConflictDoNothing().returning();
  if (inserted.length === 0) throw new ConflictError("La constancia de este curso ya fue emitida.");
  await logEvent(context, {
    actor: academy.name,
    type: "constancia_emitida",
    label: `Constancia emitida · ${course.title}`,
    detail: { code: constancia.code },
  });
  const level = await recalculateLevel(context, SYSTEM, enrollment.workerId);
  return { constancia, level: { level: level.level, leveledUp: level.leveledUp } };
}
