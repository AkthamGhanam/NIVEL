import { ensure } from "./errors";

/**
 * Fechas de calendario (sin hora) en la zona horaria de la demo.
 * Un `IsoDate` es "YYYY-MM-DD" validado; el tipo marcado impide pasar
 * cualquier string sin validar.
 */

export type IsoDate = string & { readonly __brand: "IsoDate" };

export const DEMO_TIME_ZONE = "America/Caracas";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;

export function parseIsoDate(value: string): IsoDate {
  const match = ISO_DATE_PATTERN.exec(value);
  ensure(match !== null, `Fecha inválida: usa el formato AAAA-MM-DD`);
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  ensure(date.toISOString().slice(0, 10) === value, `La fecha ${value} no existe`);
  return value as IsoDate;
}

const toUtcMidnight = (date: IsoDate) => Date.parse(`${date}T00:00:00Z`);
const fromUtcMs = (ms: number) => new Date(ms).toISOString().slice(0, 10) as IsoDate;

export function addDays(date: IsoDate, days: number): IsoDate {
  ensure(Number.isInteger(days), "Los días a sumar deben ser enteros");
  return fromUtcMs(toUtcMidnight(date) + days * MS_PER_DAY);
}

/** Día de la semana: 0 = domingo … 6 = sábado. */
export const weekday = (date: IsoDate): number => new Date(toUtcMidnight(date)).getUTCDay();

/** Fecha local de un instante en una zona horaria. */
export function localDate(instant: Date, timeZone: string = DEMO_TIME_ZONE): IsoDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  return parseIsoDate(parts);
}

const WEEKDAYS: Readonly<Record<string, number>> = Object.freeze({
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
});

const RELATIVE_DAYS: Readonly<Record<string, number>> = Object.freeze({
  hoy: 0,
  manana: 1,
  "pasado manana": 2,
});

const FILLER_WORDS = /\b(desde|a partir de|el|este|esta|proximo|la|para|que viene)\b/g;

/** Minúsculas, sin acentos ni signos, espacios simples. */
export function normalizeSpanish(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nextWeekday(today: IsoDate, target: number): IsoDate {
  const ahead = (target - weekday(today) + DAYS_PER_WEEK) % DAYS_PER_WEEK || DAYS_PER_WEEK;
  return addDays(today, ahead);
}

/**
 * Resuelve la fecha de inicio que dicta el contratista ("el martes",
 * "mañana", "2026-11-24") a una fecha concreta, nunca en el pasado.
 * Un día de la semana es siempre el próximo, sin contar hoy.
 */
export function resolveStartDate(text: string, now: Date): IsoDate {
  const today = localDate(now);
  const trimmed = text.trim();
  if (ISO_DATE_PATTERN.test(trimmed)) {
    const date = parseIsoDate(trimmed);
    ensure(date >= today, "La fecha de inicio no puede estar en el pasado");
    return date;
  }
  const phrase = normalizeSpanish(trimmed).replace(FILLER_WORDS, " ").replace(/\s+/g, " ").trim();
  const relative = RELATIVE_DAYS[phrase];
  if (relative !== undefined) return addDays(today, relative);
  const target = WEEKDAYS[phrase];
  ensure(target !== undefined, `No entendí la fecha "${trimmed.slice(0, 40)}". Usa un día o AAAA-MM-DD`);
  return nextWeekday(today, target);
}
