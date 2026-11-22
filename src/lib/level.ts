import { ensure } from "./errors";

/**
 * Fórmula pública y verificable del nivel (docs/spec.md, sección 6.1).
 * Las calificaciones privadas nunca bajan el nivel por sí solas: solo
 * pueden frenar el ascenso a 4 y 5.
 */

export type Level = 1 | 2 | 3 | 4 | 5;

export const LEVEL_NAMES: Readonly<Record<Level, string>> = Object.freeze({
  1: "Aprendiz",
  2: "Verificado",
  3: "Probado",
  4: "Confiable",
  5: "Maestro",
});

/** Banda de referencia de mercado en USD al mes. No es una promesa de salario. */
export const MARKET_REFERENCE_BANDS: Readonly<Record<Level, { readonly min: number; readonly max: number }>> =
  Object.freeze({
    1: { min: 160, max: 240 },
    2: { min: 240, max: 300 },
    3: { min: 300, max: 350 },
    4: { min: 350, max: 450 },
    5: { min: 450, max: 600 },
  });

export const LEVEL_RULES = Object.freeze({
  jobsForLevel3: 3,
  jobsForLevel4: 10,
  jobsForLevel5: 25,
  certificatesForLevel5: 2,
  attendanceForLevel4: 0.9,
  attendanceForLevel5: 0.95,
  minRatingsToBrake: 5,
  brakeAverageBelow: 3.5,
  ratingValidityMonths: 12,
});

export interface PrivateRating {
  /** Promedio de las categorías de esa calificación, de 1 a 5. */
  readonly average: number;
  readonly submittedAt: Date;
  /** Congelada por un reporte abierto entre las partes: no cuenta. */
  readonly frozen: boolean;
}

export interface LevelInput {
  readonly confirmedJobs: number;
  readonly practicalPassed: boolean;
  readonly certificates: number;
  /** Proporción de 0 a 1. */
  readonly attendanceRate: number;
  readonly verifiedIncidents: number;
  readonly ratings: readonly PrivateRating[];
}

export interface LevelContext {
  readonly now: Date;
  /** Nivel actual; las calificaciones no pueden bajarlo. */
  readonly currentLevel: Level;
}

function assertValidInput(input: LevelInput): void {
  const counts = [input.confirmedJobs, input.certificates, input.verifiedIncidents];
  ensure(
    counts.every((count) => Number.isInteger(count) && count >= 0),
    "Los conteos deben ser enteros no negativos",
  );
  ensure(input.attendanceRate >= 0 && input.attendanceRate <= 1, "La asistencia debe estar entre 0 y 1");
}

/** Nivel que justifican los hechos verificables, sin mirar calificaciones. */
function levelFromFacts(input: LevelInput): Level {
  const clean = input.verifiedIncidents === 0;
  const verified = input.practicalPassed || input.certificates >= 1;
  if (!verified) return 1;
  if (!clean || input.confirmedJobs < LEVEL_RULES.jobsForLevel3) return 2;
  const meetsLevel4 =
    input.confirmedJobs >= LEVEL_RULES.jobsForLevel4 &&
    input.attendanceRate >= LEVEL_RULES.attendanceForLevel4;
  if (!meetsLevel4) return 3;
  const meetsLevel5 =
    input.confirmedJobs >= LEVEL_RULES.jobsForLevel5 &&
    input.certificates >= LEVEL_RULES.certificatesForLevel5 &&
    input.attendanceRate >= LEVEL_RULES.attendanceForLevel5;
  return meetsLevel5 ? 5 : 4;
}

function monthsAgo(now: Date, months: number): Date {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return cutoff;
}

/** Calificaciones que cuentan: no congeladas y de los últimos 12 meses. */
export function countableRatings(ratings: readonly PrivateRating[], now: Date): PrivateRating[] {
  const cutoff = monthsAgo(now, LEVEL_RULES.ratingValidityMonths);
  return ratings.filter(
    (rating) => !rating.frozen && rating.submittedAt >= cutoff && rating.submittedAt <= now,
  );
}

function ratingsBrakeApplies(ratings: readonly PrivateRating[], now: Date): boolean {
  const countable = countableRatings(ratings, now);
  if (countable.length < LEVEL_RULES.minRatingsToBrake) return false;
  const average = countable.reduce((sum, rating) => sum + rating.average, 0) / countable.length;
  return average < LEVEL_RULES.brakeAverageBelow;
}

const BRAKED_CEILING: Level = 3;

/** Calcula el nivel. Puro y determinista: el reloj llega como argumento. */
export function computeLevel(input: LevelInput, context: LevelContext): Level {
  assertValidInput(input);
  const factsLevel = levelFromFacts(input);
  if (factsLevel <= BRAKED_CEILING || !ratingsBrakeApplies(input.ratings, context.now)) return factsLevel;
  // El freno impide subir, pero no quita un nivel que los hechos siguen respaldando.
  return Math.max(BRAKED_CEILING, Math.min(context.currentLevel, factsLevel)) as Level;
}
