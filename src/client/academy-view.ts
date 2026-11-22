import { formatRate, formatUsd, plural } from "@/lib/format";
import { LEVEL_NAMES, type Level } from "@/lib/level";
import { passingScore } from "@/lib/practical-test";

import type { AcademyPanel, ConstanciaIssued, TestEvaluated } from "./academy-api";

/**
 * Lógica de presentación del panel de la academia: textos y cifras listos
 * para mostrar. Sin React ni red, para probarla sola.
 */

export type Course = AcademyPanel["courses"][number];
export type PendingTest = AcademyPanel["pendingTests"][number];
export type PendingConstancia = AcademyPanel["pendingConstancias"][number];

/** "Gratis" o "$120 + IVA": el precio lo fija la academia. */
export const coursePrice = (course: Pick<Course, "free" | "priceUsd">): string =>
  course.free ? "Gratis" : `${formatUsd(course.priceUsd)} + IVA`;

export const enrollmentsThisMonth = (courses: readonly Course[]): number =>
  courses.reduce((total, course) => total + course.enrollmentsThisMonth, 0);

export interface RankingView {
  /** "67 %", o nulo si aún no hay alumnos con qué calcular. */
  readonly percent: string | null;
  readonly detail: string;
  readonly formula: string;
}

/** El ranking se muestra siempre con su cuenta y su fórmula: nunca una cifra suelta. */
export function rankingView(ranking: AcademyPanel["ranking"]): RankingView {
  if (ranking.students === 0) {
    return { percent: null, detail: "Aún no hay alumnos inscritos.", formula: ranking.formula };
  }
  return {
    percent: formatRate(ranking.withJob / ranking.students),
    detail: `${ranking.withJob} de ${plural(ranking.students, "alumno", "alumnos")} con trabajo confirmado en los últimos 90 días.`,
    formula: ranking.formula,
  };
}

/** Notas posibles de una prueba: de 0 al máximo de criterios. */
export const scoreOptions = (maxScore: number): number[] =>
  Array.from({ length: maxScore + 1 }, (_, score) => score);

export const passingHint = (maxScore: number): string =>
  `Aprueba con ${passingScore(maxScore)} o más de ${maxScore}.`;

const levelName = (level: number): string => `Nivel ${level} · ${LEVEL_NAMES[level as Level]}`;

/** Qué pasó al registrar la nota, en una frase: resultado y, si cambió, el nivel nuevo. */
export function testOutcome(worker: string, { test, level }: TestEvaluated): string {
  const result = `${worker}: prueba ${test.passed ? "aprobada" : "no aprobada"} con ${test.score} de ${test.maxScore}.`;
  return level.leveledUp ? `${result} Sube a ${levelName(level.level)}.` : result;
}

export function constanciaOutcome(
  pending: PendingConstancia,
  { constancia, level }: ConstanciaIssued,
): string {
  const issued = `Constancia ${constancia.code} emitida a ${pending.worker} por «${pending.course}».`;
  return level?.leveledUp ? `${issued} Sube a ${levelName(level.level)}.` : issued;
}
