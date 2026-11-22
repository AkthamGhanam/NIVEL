import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";

import { addDays, localDate } from "@/lib/dates";
import { ensure } from "@/lib/errors";
import { academyCommission, type PriceWithIva, withIva } from "@/lib/pricing";

import { type Actor, requireRole } from "../actor";
import type { AppContext } from "../context";
import {
  academies,
  certificates,
  courses,
  enrollments,
  fees,
  lessons,
  practicalTests,
  workers,
} from "../db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors";
import { logEvent } from "./events";

/**
 * "Mi ruta" del trabajador: cursos de su oficio, lecciones en audio y la
 * prueba práctica. El curso se paga directo a la academia; NIVEL solo
 * registra la inscripción y cobra su comisión a la academia.
 */

/** Taller aliado donde se presentan las pruebas prácticas de la demo. */
export const PARTNER_WORKSHOP = "Taller Escuela Los Guayos";
const TEST_MAX_SCORE = 4;
const DAYS_UNTIL_TEST = 2;

export interface RouteCourse {
  readonly id: string;
  readonly title: string;
  readonly academy: string;
  readonly free: boolean;
  readonly price: PriceWithIva | null;
  /** Cuotas ofrecidas por la academia, no por NIVEL. */
  readonly installments: { readonly count: number; readonly amountUsd: number } | null;
  readonly weeks: number;
  readonly mode: string;
  readonly lessons: ReadonlyArray<{
    readonly id: string;
    readonly order: number;
    readonly title: string;
    readonly durationS: number;
    readonly audioUrl: string | null;
  }>;
  readonly enrollment: { readonly id: string; readonly status: string; readonly progress: number } | null;
  /** Código de la constancia que emitió la academia, si ya la tiene. */
  readonly constancia: string | null;
}

export interface MyRoute {
  readonly courses: readonly RouteCourse[];
  readonly practicalTest: {
    readonly passed: boolean;
    /** Fecha de la prueba agendada y aún sin evaluar, si hay una. */
    readonly scheduledFor: string | null;
    readonly workshop: string;
  };
}

async function selfTrade(context: AppContext, workerId: string) {
  const [worker] = await context.db
    .select({ trade: workers.trade })
    .from(workers)
    .where(and(eq(workers.id, workerId), isNull(workers.deletedAt)));
  if (!worker) throw new NotFoundError("tu perfil");
  return worker.trade;
}

export async function getMyRoute(context: AppContext, actor: Actor): Promise<MyRoute> {
  const { workerId } = requireRole(actor, "worker");
  const trade = await selfTrade(context, workerId);
  const offered = await context.db
    .select({ course: courses, academy: academies.name })
    .from(courses)
    .innerJoin(academies, eq(courses.academyId, academies.id))
    // Los cursos del oficio y los gratuitos de seguridad, que sirven a cualquiera.
    .where(or(eq(courses.trade, trade), eq(courses.free, true)))
    .orderBy(asc(courses.priceUsd));
  const courseIds = offered.map((row) => row.course.id);
  const [courseLessons, enrolled, constancias, tests] = await Promise.all([
    courseIds.length === 0
      ? []
      : context.db
          .select()
          .from(lessons)
          .where(inArray(lessons.courseId, courseIds))
          .orderBy(asc(lessons.order)),
    context.db.select().from(enrollments).where(eq(enrollments.workerId, workerId)),
    context.db.select().from(certificates).where(eq(certificates.workerId, workerId)),
    context.db.select().from(practicalTests).where(eq(practicalTests.workerId, workerId)),
  ]);
  return {
    courses: offered.map(({ course, academy }) => {
      const enrollment = enrolled.find((row) => row.courseId === course.id);
      return {
        id: course.id,
        title: course.title,
        academy,
        free: course.free,
        price: course.free ? null : withIva(course.priceUsd),
        installments: course.installments ?? null,
        weeks: course.weeks,
        mode: course.mode,
        lessons: courseLessons
          .filter((lesson) => lesson.courseId === course.id)
          .map(({ id, order, title, durationS, audioUrl }) => ({ id, order, title, durationS, audioUrl })),
        enrollment: enrollment
          ? { id: enrollment.id, status: enrollment.status, progress: enrollment.progress }
          : null,
        constancia: constancias.find((row) => row.courseId === course.id)?.code ?? null,
      };
    }),
    practicalTest: {
      passed: tests.some((test) => test.passed === true),
      scheduledFor: tests.find((test) => test.score === null)?.date ?? null,
      workshop: PARTNER_WORKSHOP,
    },
  };
}

async function findEnrollment(context: AppContext, workerId: string, courseId: string) {
  const [row] = await context.db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.workerId, workerId), eq(enrollments.courseId, courseId)));
  return row;
}

/** Inscribe al trabajador. Repetir la inscripción devuelve la misma (doble toque). */
export async function enrollInCourse(context: AppContext, actor: Actor, courseId: string) {
  const { workerId } = requireRole(actor, "worker");
  await selfTrade(context, workerId);
  const [course] = await context.db.select().from(courses).where(eq(courses.id, courseId));
  if (!course) throw new NotFoundError("el curso");
  const existing = await findEnrollment(context, workerId, courseId);
  if (existing) return existing;
  const now = context.now().toISOString();
  const enrollment = {
    id: context.newId("en"),
    workerId,
    courseId,
    status: "en_curso" as const,
    progress: 0,
    enrolledAt: now,
  };
  const commission = course.free ? null : academyCommission(course.priceUsd);
  const { db } = context;
  // Un solo lote atómico. Si llegan dos toques a la vez, el índice único deja una inscripción y,
  // como el id de la comisión sale de la persona y el curso, también una sola comisión.
  await db.batch([
    db.insert(enrollments).values(enrollment).onConflictDoNothing(),
    ...(commission
      ? [
          db
            .insert(fees)
            .values({
              id: `fe-${workerId}-${courseId}`,
              academyId: course.academyId,
              concept: `Comisión academia 15 % · ${course.title}`,
              baseUsd: commission.base,
              ivaUsd: commission.iva,
              totalUsd: commission.total,
              invoiceNumber: `FA-${enrollment.id.slice(-10).toUpperCase()}`,
              status: "por_pagar" as const,
              createdAt: now,
            })
            .onConflictDoNothing({ target: fees.id }),
        ]
      : []),
  ]);
  const saved = (await findEnrollment(context, workerId, courseId)) ?? enrollment;
  // Solo quien de verdad creó la inscripción la anuncia en la bitácora.
  if (saved.id !== enrollment.id) return saved;
  await logEvent(context, {
    actor: "Trabajador",
    type: "inscripcion_curso",
    label: `Inscripción en "${course.title}"${course.free ? " (gratis)" : ""}`,
    detail: { courseId },
  });
  return saved;
}

/** Avance del curso según las lecciones escuchadas. Nunca retrocede. La constancia la emite la academia. */
export async function recordProgress(
  context: AppContext,
  actor: Actor,
  input: { readonly enrollmentId: string; readonly progress: number },
) {
  const { workerId } = requireRole(actor, "worker");
  ensure(input.progress >= 0 && input.progress <= 1, "El avance va de 0 a 1");
  const [enrollment] = await context.db
    .select()
    .from(enrollments)
    .where(eq(enrollments.id, input.enrollmentId));
  if (!enrollment) throw new NotFoundError("la inscripción");
  if (enrollment.workerId !== workerId) throw new ForbiddenError();
  const progress = Math.max(enrollment.progress, input.progress);
  const status = progress >= 1 ? ("completado" as const) : enrollment.status;
  await context.db.update(enrollments).set({ progress, status }).where(eq(enrollments.id, enrollment.id));
  return { ...enrollment, progress, status };
}

/** Agenda la prueba práctica en el taller aliado. Solo una pendiente a la vez. */
export async function bookPracticalTest(context: AppContext, actor: Actor) {
  const { workerId } = requireRole(actor, "worker");
  const trade = await selfTrade(context, workerId);
  const mine = await context.db.select().from(practicalTests).where(eq(practicalTests.workerId, workerId));
  if (mine.some((test) => test.passed === true)) throw new ConflictError("Ya aprobaste tu prueba práctica.");
  const pending = mine.find((test) => test.score === null);
  if (pending) return pending;
  const test = {
    id: context.newId("pt"),
    workerId,
    trade,
    workshop: PARTNER_WORKSHOP,
    evaluator: "Por asignar",
    score: null,
    maxScore: TEST_MAX_SCORE,
    passed: null,
    insured: true,
    date: addDays(localDate(context.now()), DAYS_UNTIL_TEST),
  };
  await context.db.insert(practicalTests).values(test);
  await logEvent(context, {
    actor: "Trabajador",
    type: "prueba_agendada",
    label: `Prueba práctica agendada en ${PARTNER_WORKSHOP}`,
  });
  return test;
}
