import { describe, expect, it } from "vitest";

import { DomainValidationError } from "./errors";
import { computeLevel, countableRatings, type Level, type LevelInput, type PrivateRating } from "./level";
import { explainLevel } from "./level-explanation";

const NOW = new Date("2026-11-22T12:00:00Z");

const NEWCOMER: LevelInput = {
  confirmedJobs: 0,
  practicalPassed: false,
  certificates: 0,
  attendanceRate: 1,
  verifiedIncidents: 0,
  ratings: [],
};

/** Carlos Rodríguez en el seed: prueba práctica 4/4, constancia C-2041, 2 trabajos. */
const CARLOS: LevelInput = { ...NEWCOMER, practicalPassed: true, certificates: 1, confirmedJobs: 2 };

const VETERAN: LevelInput = {
  ...NEWCOMER,
  practicalPassed: true,
  certificates: 2,
  confirmedJobs: 25,
  attendanceRate: 0.96,
};

const rating = (average: number, overrides: Partial<PrivateRating> = {}): PrivateRating => ({
  average,
  submittedAt: new Date("2026-10-01T12:00:00Z"),
  frozen: false,
  ...overrides,
});

const level = (input: LevelInput, currentLevel: Level = 1) => computeLevel(input, { now: NOW, currentLevel });

describe("computeLevel: requisitos de la tabla pública", () => {
  it("Nivel 1 con solo el registro", () => {
    expect(level(NEWCOMER)).toBe(1);
  });

  it("Nivel 2 con la prueba práctica aprobada", () => {
    expect(level({ ...NEWCOMER, practicalPassed: true })).toBe(2);
  });

  it("Nivel 2 con una constancia de academia", () => {
    expect(level({ ...NEWCOMER, certificates: 1 })).toBe(2);
  });

  it("Carlos está en Nivel 2 y sube a Nivel 3 con su tercer trabajo confirmado", () => {
    expect(level(CARLOS)).toBe(2);
    expect(level({ ...CARLOS, confirmedJobs: 3 })).toBe(3);
  });

  it("los trabajos no bastan sin verificación (prueba o constancia)", () => {
    expect(level({ ...NEWCOMER, confirmedJobs: 30, attendanceRate: 1 })).toBe(1);
  });

  it("un incidente verificado impide Nivel 3 o más", () => {
    expect(level({ ...VETERAN, verifiedIncidents: 1 })).toBe(2);
  });

  it("Nivel 4 exige 10 trabajos y asistencia de 90 % o más (borde incluido)", () => {
    const base = { ...CARLOS, confirmedJobs: 10 };

    expect(level({ ...base, attendanceRate: 0.9 })).toBe(4);
    expect(level({ ...base, attendanceRate: 0.89 })).toBe(3);
    expect(level({ ...base, confirmedJobs: 9, attendanceRate: 1 })).toBe(3);
  });

  it("Nivel 5 exige 25 trabajos, 2 constancias y asistencia de 95 % o más", () => {
    expect(level(VETERAN)).toBe(5);
    expect(level({ ...VETERAN, certificates: 1 })).toBe(4);
    expect(level({ ...VETERAN, attendanceRate: 0.94 })).toBe(4);
    expect(level({ ...VETERAN, confirmedJobs: 24 })).toBe(4);
  });

  it.each([
    { confirmedJobs: -1 },
    { confirmedJobs: 1.5 },
    { certificates: -1 },
    { verifiedIncidents: Number.NaN },
    { attendanceRate: 1.01 },
    { attendanceRate: -0.1 },
  ])("rechaza entradas inválidas %j", (override) => {
    expect(() => level({ ...NEWCOMER, ...override })).toThrow(DomainValidationError);
  });
});

describe("computeLevel: calificaciones privadas", () => {
  const lowRatings = Array.from({ length: 5 }, () => rating(2));

  it("frenan el ascenso a Nivel 5 con 5 o más calificaciones y promedio menor a 3,5", () => {
    expect(level({ ...VETERAN, ratings: lowRatings }, 3)).toBe(3);
  });

  it("nunca bajan por sí solas un nivel que los hechos respaldan", () => {
    expect(level({ ...VETERAN, ratings: lowRatings }, 4)).toBe(4);
    expect(level({ ...VETERAN, ratings: lowRatings }, 5)).toBe(5);
  });

  it("no afectan los niveles 1 a 3", () => {
    expect(level({ ...CARLOS, confirmedJobs: 3, ratings: lowRatings })).toBe(3);
  });

  it("con menos de 5 calificaciones no frenan", () => {
    expect(level({ ...VETERAN, ratings: lowRatings.slice(0, 4) }, 3)).toBe(5);
  });

  it("un promedio de exactamente 3,5 no frena", () => {
    expect(level({ ...VETERAN, ratings: Array.from({ length: 5 }, () => rating(3.5)) }, 3)).toBe(5);
  });

  it("ignoran las congeladas por un reporte y las de más de 12 meses", () => {
    const old = rating(1, { submittedAt: new Date("2025-11-01T00:00:00Z") });
    const frozen = rating(1, { frozen: true });
    const ratings = [...lowRatings.slice(0, 4), old, frozen];

    expect(countableRatings(ratings, NOW)).toHaveLength(4);
    expect(level({ ...VETERAN, ratings }, 3)).toBe(5);
  });

  it("ignoran calificaciones con fecha futura", () => {
    const future = rating(1, { submittedAt: new Date("2027-01-01T00:00:00Z") });

    expect(countableRatings([future], NOW)).toHaveLength(0);
  });
});

describe("explainLevel", () => {
  it("dice a Carlos que le falta 1 trabajo confirmado para Nivel 3", () => {
    expect(explainLevel(CARLOS, 2)).toBe("Te falta 1 trabajo confirmado para Nivel 3: Probado.");
  });

  it("usa plural y une varios requisitos", () => {
    const input = { ...CARLOS, confirmedJobs: 3, attendanceRate: 0.8 };

    expect(explainLevel(input, 3)).toBe(
      "Te faltan 7 trabajos confirmados y una asistencia de 90 % o más para Nivel 4: Confiable.",
    );
  });

  it("lista los tres requisitos de Nivel 5", () => {
    const input = { ...CARLOS, confirmedJobs: 10, attendanceRate: 0.9 };

    expect(explainLevel(input, 4)).toBe(
      "Te faltan 15 trabajos confirmados, 1 constancia de academia y una asistencia de 95 % o más para Nivel 5: Maestro.",
    );
  });

  it("explica la ruta gratis de Nivel 1 a 2", () => {
    expect(explainLevel(NEWCOMER, 1)).toContain("prueba práctica o consigue 1 constancia");
  });

  it("felicita en el nivel más alto", () => {
    expect(explainLevel(VETERAN, 5)).toBe("Ya estás en el nivel más alto: Maestro.");
  });

  it("orienta a pedir revisión si hay un incidente verificado", () => {
    expect(explainLevel({ ...CARLOS, verifiedIncidents: 1 }, 2)).toContain("pide una revisión en Mis datos");
  });

  it("aclara cuando los hechos ya cumplen pero el ascenso está en espera", () => {
    expect(explainLevel(VETERAN, 3)).toContain("Ya cumples los requisitos de Nivel 4");
  });

  it("nunca dice que las calificaciones suben o bajan el nivel", () => {
    const messages = [explainLevel(CARLOS, 2), explainLevel(VETERAN, 3), explainLevel(NEWCOMER, 1)];

    for (const message of messages) expect(message).not.toMatch(/calificaciones (suben|bajan)/i);
  });
});
