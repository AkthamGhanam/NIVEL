import { describe, expect, it } from "vitest";

import type { ConstanciaIssued, TestEvaluated } from "./academy-api";
import {
  constanciaOutcome,
  coursePrice,
  enrollmentsThisMonth,
  passingHint,
  rankingView,
  scoreOptions,
  testOutcome,
} from "./academy-view";

const FORMULA = "Alumnos con trabajo entre todos los inscritos. Datos de NIVEL.";

const evaluated = (changes: { score: number; passed: boolean; level: number; leveledUp: boolean }) =>
  ({
    test: { score: changes.score, maxScore: 4, passed: changes.passed },
    level: { level: changes.level, leveledUp: changes.leveledUp },
  }) as TestEvaluated;

describe("cursos de la academia", () => {
  it("el precio dice que el IVA va aparte, y lo gratis se llama gratis", () => {
    expect(coursePrice({ free: false, priceUsd: 120 })).toBe("$120 + IVA");
    expect(coursePrice({ free: true, priceUsd: 0 })).toBe("Gratis");
  });

  it("suma las inscripciones del mes de todos los cursos", () => {
    const course = (enrollments: number) => ({
      id: `cu-${enrollments}`,
      title: "Curso",
      free: false,
      priceUsd: 120,
      enrollmentsThisMonth: enrollments,
    });

    expect(enrollmentsThisMonth([course(7), course(5)])).toBe(12);
    expect(enrollmentsThisMonth([])).toBe(0);
  });
});

describe("ranking de la academia", () => {
  it("muestra el porcentaje con su cuenta y su fórmula", () => {
    expect(rankingView({ students: 12, withJob: 8, formula: FORMULA })).toEqual({
      percent: "67 %",
      detail: "8 de 12 alumnos con trabajo confirmado en los últimos 90 días.",
      formula: FORMULA,
    });
  });

  it("sin alumnos no inventa una cifra", () => {
    const view = rankingView({ students: 0, withJob: 0, formula: FORMULA });

    expect(view.percent).toBeNull();
    expect(view.detail).toBe("Aún no hay alumnos inscritos.");
  });
});

describe("pruebas prácticas y constancias", () => {
  it("ofrece las notas de 0 al máximo y dice con cuánto se aprueba", () => {
    expect(scoreOptions(4)).toEqual([0, 1, 2, 3, 4]);
    expect(passingHint(4)).toBe("Aprueba con 3 o más de 4.");
  });

  it("cuenta el resultado y el nivel nuevo solo si la persona subió", () => {
    expect(testOutcome("Carlos R.", evaluated({ score: 4, passed: true, level: 2, leveledUp: true }))).toBe(
      "Carlos R.: prueba aprobada con 4 de 4. Sube a Nivel 2 · Verificado.",
    );
    expect(testOutcome("Luis M.", evaluated({ score: 2, passed: false, level: 1, leveledUp: false }))).toBe(
      "Luis M.: prueba no aprobada con 2 de 4.",
    );
  });

  it("la constancia se nombra por su código, y nunca como certificado", () => {
    const pending = { enrollmentId: "en-1", worker: "Ana G.", course: "Seguridad en trabajos en caliente" };
    const issued = (level: ConstanciaIssued["level"]) =>
      ({ constancia: { code: "C-AB12CD" }, level }) as ConstanciaIssued;

    expect(constanciaOutcome(pending, issued({ level: 2, leveledUp: true }))).toBe(
      "Constancia C-AB12CD emitida a Ana G. por «Seguridad en trabajos en caliente». Sube a Nivel 2 · Verificado.",
    );
    expect(constanciaOutcome(pending, issued(null))).toBe(
      "Constancia C-AB12CD emitida a Ana G. por «Seguridad en trabajos en caliente».",
    );
    expect(constanciaOutcome(pending, issued({ level: 2, leveledUp: false }))).not.toContain("Sube");
  });
});
