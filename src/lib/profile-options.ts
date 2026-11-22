import { normalizeSpanish } from "./dates";
import type { Trade } from "./trades";

/**
 * Opciones para armar un perfil o un pedido tocando en vez de escribir:
 * habilidades por oficio, rangos de experiencia, disponibilidad, tipos de
 * empresa y duración de una contratación. Las usan el formulario, Nivi y el bot.
 */

/** Lo que resuelve cada oficio, para elegir "qué sabes hacer" sin escribir. */
export const SKILLS_BY_TRADE: Readonly<Record<Trade, readonly string[]>> = Object.freeze({
  soldador: [
    "Soldadura con electrodo (SMAW)",
    "Soldadura MIG/MAG",
    "Soldadura TIG",
    "Corte con oxiacetileno",
    "Estructuras metálicas",
    "Rejas y portones",
    "Tuberías de acero",
    "Lectura de planos",
  ],
  electricista: [
    "Instalaciones residenciales",
    "Tableros eléctricos",
    "Cableado industrial",
    "Motores y arrancadores",
    "Iluminación",
    "Puesta a tierra",
    "Mantenimiento preventivo",
    "Lectura de planos eléctricos",
  ],
  albanil: [
    "Frisos",
    "Bloques y paredes",
    "Vaciado de concreto",
    "Encofrado",
    "Cerámica y porcelanato",
    "Techos y losas",
    "Reparación de grietas",
    "Pisos",
  ],
  plomero: [
    "Tuberías de agua potable",
    "Aguas negras y drenajes",
    "Instalación de sanitarios",
    "Calentadores",
    "Bombas e hidroneumáticos",
    "Detección de fugas",
    "Tanques",
  ],
  pintor: [
    "Pintura de interiores",
    "Pintura de fachadas",
    "Impermeabilización",
    "Pintura industrial",
    "Empastado y lijado",
    "Pintura con pistola",
    "Acabados decorativos",
  ],
  otro: [
    "Ayudante de obra",
    "Carga y descarga",
    "Limpieza de obra",
    "Carpintería",
    "Herrería básica",
    "Jardinería",
  ],
});

/** Las habilidades de los oficios elegidos, sin repetir. */
export function skillsFor(trades: readonly Trade[]): string[] {
  return [...new Set(trades.flatMap((trade) => SKILLS_BY_TRADE[trade]))];
}

/** Experiencia en rangos: nadie tiene que calcular años exactos. */
export const EXPERIENCE_RANGES = Object.freeze([
  { key: "menos_2", label: "Menos de 2 años", years: 1 },
  { key: "mas_2", label: "+2 años", years: 2 },
  { key: "mas_5", label: "+5 años", years: 5 },
  { key: "mas_10", label: "+10 años", years: 10 },
] as const);
export type ExperienceKey = (typeof EXPERIENCE_RANGES)[number]["key"];

export const yearsOf = (key: ExperienceKey): number =>
  EXPERIENCE_RANGES.find((range) => range.key === key)?.years ?? 0;

/** El rango que corresponde a unos años ("8" → "+5 años"). */
export function rangeOfYears(years: number): (typeof EXPERIENCE_RANGES)[number] {
  return [...EXPERIENCE_RANGES].reverse().find((range) => years >= range.years) ?? EXPERIENCE_RANGES[0];
}

export const AVAILABILITY_OPTIONS = Object.freeze([
  "Ya mismo",
  "Solo fines de semana",
  "Toda la semana",
  "Medio tiempo",
] as const);
export type AvailabilityOption = (typeof AVAILABILITY_OPTIONS)[number];

export const NIGHT_LABEL = "también de noche";

/** "Ya mismo · también de noche". */
export const describeAvailability = (option: string, night: boolean): string =>
  night ? `${option} · ${NIGHT_LABEL}` : option;

/** Tipos de empresa según la gente que suelen buscar. */
export const COMPANY_SECTORS = Object.freeze([
  "Construcción y obras civiles",
  "Contratista de remodelaciones",
  "Mantenimiento industrial",
  "Metalmecánica y herrería",
  "Electricidad e instalaciones",
  "Plomería y servicios sanitarios",
  "Pintura y acabados",
  "Petróleo, gas y energía",
  "Fábrica o planta de producción",
  "Condominio o administradora de inmuebles",
  "Logística y almacenes",
  "Otra",
] as const);
export type CompanySector = (typeof COMPANY_SECTORS)[number];

/**
 * Cuánto tiempo quiere contratar la empresa. Los días son los que usa el
 * estimado del costo legal; "indefinido" se estima con sus primeros 3 meses.
 */
export const HIRE_DURATIONS = Object.freeze([
  { key: "semana", label: "Una semana", days: 7 },
  { key: "mes", label: "Más de un mes", days: 30 },
  { key: "tres_meses", label: "Más de 3 meses", days: 90 },
  { key: "indefinido", label: "Contrato indefinido", days: 90 },
] as const);
export type HireDuration = (typeof HIRE_DURATIONS)[number]["key"];

export const durationOf = (key: HireDuration) =>
  HIRE_DURATIONS.find((duration) => duration.key === key) ?? HIRE_DURATIONS[0];

/** Una habilidad dicha de palabra, si se parece a alguna de la lista. */
export function matchSkill(spoken: string, trades: readonly Trade[]): string | undefined {
  const text = normalizeSpanish(spoken);
  return skillsFor(trades).find((skill) => {
    const name = normalizeSpanish(skill);
    return text.length >= 4 && (name.includes(text) || text.includes(name));
  });
}

export const MIN_WORK_AGE = 18;
const MAX_AGE = 100;
const BIRTH_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Años cumplidos en `today` (AAAA-MM-DD) por quien nació en `birthDate`; indefinido si la fecha no existe. */
export function ageOn(birthDate: string, today: string): number | undefined {
  const born = BIRTH_DATE.exec(birthDate);
  const now = BIRTH_DATE.exec(today);
  if (!born || !now) return undefined;
  const [year, month, day] = born.slice(1).map(Number) as [number, number, number];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return undefined;
  const [nowYear, nowMonth, nowDay] = now.slice(1).map(Number) as [number, number, number];
  const hadBirthday = nowMonth > month || (nowMonth === month && nowDay >= day);
  const age = nowYear - year - (hadBirthday ? 0 : 1);
  return age >= 0 && age <= MAX_AGE ? age : undefined;
}

/** Qué decir de una fecha de nacimiento: nada si sirve, o el problema. */
export function birthDateProblem(birthDate: string, today: string): string | undefined {
  const age = ageOn(birthDate, today);
  if (age === undefined) return "Elige tu fecha de nacimiento.";
  if (age < MIN_WORK_AGE) return "Por ahora NIVEL es solo para personas mayores de 18 años.";
  return undefined;
}

/** La cédula venezolana: V o E y de 6 a 9 cifras. Solo se revisa la forma; NIVEL no la guarda. */
const CEDULA = /^[VE]-?\d{6,9}$/;
export const normalizeCedula = (text: string): string => text.toUpperCase().replace(/[\s.]/g, "");
export const isCedula = (text: string): boolean => CEDULA.test(normalizeCedula(text));

/** "ya mismo", "fines de semana"… a la opción de la lista, o el texto tal cual. */
export function matchAvailability(spoken: string): string {
  const text = normalizeSpanish(spoken);
  const keys: ReadonlyArray<readonly [string, AvailabilityOption]> = [
    ["fin de semana", "Solo fines de semana"],
    ["fines de semana", "Solo fines de semana"],
    ["medio tiempo", "Medio tiempo"],
    ["toda la semana", "Toda la semana"],
    ["lunes a viernes", "Toda la semana"],
    ["ya", "Ya mismo"],
    ["inmediat", "Ya mismo"],
    ["hoy", "Ya mismo"],
  ];
  return keys.find(([key]) => text.includes(key))?.[1] ?? spoken.trim();
}
