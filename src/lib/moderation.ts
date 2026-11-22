import { normalizeSpanish } from "./dates";

/**
 * Moderación de vacantes (docs/spec.md, sección 6.5). Bloquea criterios
 * discriminatorios y cobros al candidato, y explica por qué en lenguaje simple.
 * Trabaja sobre texto normalizado (sin acentos ni mayúsculas), así que
 * "Sólo HOMBRES" y "solo hombres" son lo mismo.
 */

export type ViolationCategory =
  | "sexo"
  | "edad"
  | "apariencia"
  | "nacionalidad"
  | "religion"
  | "estado_civil"
  | "embarazo"
  | "discapacidad"
  | "cobro_al_candidato";

export interface Violation {
  readonly category: ViolationCategory;
  readonly explanation: string;
}

export interface ModerationResult {
  readonly allowed: boolean;
  readonly violations: readonly Violation[];
}

const LEGAL_ADULT_AGE = 18;

interface Rule {
  readonly category: ViolationCategory;
  readonly explanation: string;
  readonly patterns: readonly RegExp[];
}

const RULES: readonly Rule[] = [
  {
    category: "sexo",
    explanation: "No se puede pedir un sexo o género. Elige por oficio, nivel y experiencia.",
    patterns: [
      /\b(solo|solamente|unicamente|preferiblemente)( para)? (hombres|mujeres|varones|caballeros|damas)\b/,
      /\b(sexo|genero) (masculino|femenino)\b/,
      /\bno (se aceptan )?(mujeres|hombres)\b/,
    ],
  },
  {
    category: "apariencia",
    explanation: '"Buena presencia" no es un criterio permitido.',
    patterns: [/\bbuena (presencia|apariencia)\b/],
  },
  {
    category: "nacionalidad",
    explanation: "No se puede filtrar por nacionalidad.",
    patterns: [
      /\b(solo|solamente|unicamente) (venezolan|colombian|extranjer|nacional)\w*/,
      /\bno (se aceptan )?(extranjer|venezolan|colombian)\w*/,
      /\bnacionalidad\b/,
    ],
  },
  {
    category: "religion",
    explanation: "No se puede pedir una religión.",
    patterns: [/\breligi(on|osos?)\b/, /\b(cristian|catolic|evangelic|adventist)\w*/],
  },
  {
    category: "estado_civil",
    explanation: "No se puede pedir un estado civil ni situación familiar.",
    patterns: [/\bestado civil\b/, /\b(solteros?|solteras?|casados?|casadas?)\b/, /\bsin hijos\b/],
  },
  {
    category: "embarazo",
    explanation: "No se puede preguntar por embarazo.",
    patterns: [/\bembaraz\w*/, /\bgestacion\b/],
  },
  {
    category: "discapacidad",
    explanation: "No se puede excluir por discapacidad.",
    patterns: [/\bdiscapacit\w*|\bdiscapacidad\b/, /\bminusvalid\w*/],
  },
  {
    category: "cobro_al_candidato",
    explanation: "No se le puede cobrar dinero al candidato para postularse o trabajar.",
    patterns: [
      /\b(pagar|pague|cancelar|depositar)( una)? (inscripcion|cuota|deposito|adelanto)\b/,
      /\b(cuota|pago|cobro|deposito) (de|por) (ingreso|inscripcion|postulacion|aplicar|postular)\b/,
      /\bpagar para (aplicar|postular|trabajar|entrar)\b/,
    ],
  },
];

const AGE_VIOLATION: Violation = {
  category: "edad",
  explanation: "No se puede pedir una edad. Solo exigimos ser mayor de 18 años.",
};

const AGE_PATTERNS: readonly RegExp[] = [
  /\b(menor|menores) de (\d{1,2})\b/,
  /\bentre (\d{1,2}) y (\d{1,2}) anos\b/,
  /\b(hasta|maximo|no mayor de|no mayores de) (\d{1,2}) anos\b/,
  /\bedad (maxima|minima|entre|de \d)/,
  /\b(jovenes|personas jovenes)\b/,
];

const MINIMUM_AGE_PATTERN = /\b(mayor|mayores) de (\d{1,2})\b/g;

function asksForAge(text: string): boolean {
  if (AGE_PATTERNS.some((pattern) => pattern.test(text))) return true;
  // "mayor de 18" es el requisito legal; cualquier otro mínimo es discriminatorio.
  return [...text.matchAll(MINIMUM_AGE_PATTERN)].some((match) => Number(match[2]) !== LEGAL_ADULT_AGE);
}

const ruleViolations = (text: string): Violation[] =>
  RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(text))).map(
    ({ category, explanation }) => ({ category, explanation }),
  );

export function moderateJobText(rawText: string): ModerationResult {
  const text = normalizeSpanish(rawText);
  const violations = ruleViolations(text);
  if (asksForAge(text)) violations.push(AGE_VIOLATION);
  return { allowed: violations.length === 0, violations };
}
