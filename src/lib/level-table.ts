import { formatRate } from "./format";
import { type Level, LEVEL_NAMES, LEVEL_RULES, MARKET_REFERENCE_BANDS } from "./level";

/**
 * Tabla pública de niveles (docs/spec.md, sección 6.1). Los requisitos se
 * redactan a partir de las mismas reglas que usa `computeLevel`, así la página
 * `/legal/niveles` nunca dice algo distinto de lo que calcula el sistema.
 */

export interface LevelRow {
  readonly level: Level;
  readonly name: string;
  readonly requirement: string;
  /** Referencia de mercado en USD al mes. No es una promesa de salario. */
  readonly band: { readonly min: number; readonly max: number };
}

const NO_INCIDENTS = "ningún incidente verificado";

const REQUIREMENTS: Readonly<Record<Level, string>> = Object.freeze({
  1: "Registrarte y ser mayor de 18 años.",
  2: "Aprobar la prueba práctica o tener 1 constancia de una academia.",
  3: `Nivel 2, ${LEVEL_RULES.jobsForLevel3} trabajos confirmados y ${NO_INCIDENTS}.`,
  4: `${LEVEL_RULES.jobsForLevel4} trabajos confirmados, asistencia de ${formatRate(LEVEL_RULES.attendanceForLevel4)} o más y ${NO_INCIDENTS}.`,
  5: `${LEVEL_RULES.jobsForLevel5} trabajos confirmados, ${LEVEL_RULES.certificatesForLevel5} constancias y asistencia de ${formatRate(LEVEL_RULES.attendanceForLevel5)} o más.`,
});

const LEVELS: readonly Level[] = [1, 2, 3, 4, 5];

export function levelTable(): LevelRow[] {
  return LEVELS.map((level) => ({
    level,
    name: LEVEL_NAMES[level],
    requirement: REQUIREMENTS[level],
    band: MARKET_REFERENCE_BANDS[level],
  }));
}

/** Cómo influyen las calificaciones privadas, en lenguaje simple y con los números reales. */
export const RATING_RULES: readonly string[] = Object.freeze([
  "Las calificaciones son privadas y nunca bajan tu nivel por sí solas.",
  `Solo pueden frenar el paso a los niveles 4 y 5, y solo si tienes ${LEVEL_RULES.minRatingsToBrake} o más calificaciones con un promedio menor a ${String(LEVEL_RULES.brakeAverageBelow).replace(".", ",")}.`,
  `Las calificaciones de hace más de ${LEVEL_RULES.ratingValidityMonths} meses no cuentan.`,
  "Si hay un reporte abierto entre tú y una empresa, sus calificaciones quedan congeladas y no cuentan.",
]);
