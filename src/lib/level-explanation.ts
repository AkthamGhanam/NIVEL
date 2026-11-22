import { LEVEL_NAMES, LEVEL_RULES, type Level, type LevelInput } from "./level";

/**
 * Explica en lenguaje simple qué falta para el siguiente nivel.
 * Solo habla de hechos verificables: nunca de calificaciones de otros.
 */

const percent = (ratio: number) => `${Math.round(ratio * 100)} %`;

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function missingJobs(input: LevelInput, required: number): string | undefined {
  const missing = required - input.confirmedJobs;
  if (missing <= 0) return undefined;
  return pluralize(missing, "trabajo confirmado", "trabajos confirmados");
}

function missingCertificates(input: LevelInput, required: number): string | undefined {
  const missing = required - input.certificates;
  if (missing <= 0) return undefined;
  return pluralize(missing, "constancia de academia", "constancias de academia");
}

function missingAttendance(input: LevelInput, required: number): string | undefined {
  return input.attendanceRate >= required ? undefined : `una asistencia de ${percent(required)} o más`;
}

function joinSpanish(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}`;
}

type UpperLevel = 3 | 4 | 5;

/** Requisitos pendientes para subir a 3, 4 o 5 (el 2 tiene su propio mensaje). */
function requirementsFor(next: UpperLevel, input: LevelInput): string[] {
  const rules = LEVEL_RULES;
  const pending: Record<UpperLevel, Array<string | undefined>> = {
    3: [missingJobs(input, rules.jobsForLevel3)],
    4: [missingJobs(input, rules.jobsForLevel4), missingAttendance(input, rules.attendanceForLevel4)],
    5: [
      missingJobs(input, rules.jobsForLevel5),
      missingCertificates(input, rules.certificatesForLevel5),
      missingAttendance(input, rules.attendanceForLevel5),
    ],
  };
  return pending[next].filter((part): part is string => part !== undefined);
}

function describeMissing(next: Level, parts: readonly string[]): string {
  const target = `Nivel ${next}: ${LEVEL_NAMES[next]}`;
  const singleItem = parts.length === 1 && /^1 /.test(parts[0] ?? "");
  return `${singleItem ? "Te falta" : "Te faltan"} ${joinSpanish(parts)} para ${target}.`;
}

export function explainLevel(input: LevelInput, level: Level): string {
  if (level === 5) return `Ya estás en el nivel más alto: ${LEVEL_NAMES[5]}.`;
  const next = (level + 1) as Level;
  if (next === 2) {
    return `Aprueba la prueba práctica o consigue 1 constancia de academia para Nivel 2: ${LEVEL_NAMES[2]}.`;
  }
  if (input.verifiedIncidents > 0) {
    return `Para subir a Nivel ${next} no puede haber incidentes verificados. Si crees que hay un error, pide una revisión en Mis datos.`;
  }
  const parts = requirementsFor(next as UpperLevel, input);
  if (parts.length === 0) {
    return `Ya cumples los requisitos de Nivel ${next}. Se confirma cuando tu promedio interno, con 5 o más calificaciones, llegue a 3,5.`;
  }
  return describeMissing(next, parts);
}
