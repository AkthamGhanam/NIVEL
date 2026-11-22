import { DEMO_TIME_ZONE, localDate } from "./dates";

/**
 * Formato de cifras, fechas y horas para la interfaz, en español de Venezuela.
 * Puro y determinista: no depende de la configuración regional de la máquina.
 */

const LOCALE = "es-VE";

const wholeUsd = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const centsUsd = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bolivares = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const oneDecimal = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });

/** "$25" o "$34,80": los céntimos solo aparecen cuando existen. */
export function formatUsd(amount: number): string {
  const formatter = Number.isInteger(amount) ? wholeUsd : centsUsd;
  return `$${formatter.format(amount)}`;
}

/** "Bs. 1.250,00". Siempre junto a la etiqueta "tasa de ejemplo". */
export function formatBs(amount: number): string {
  return `Bs. ${bolivares.format(amount)}`;
}

/** "1,2 km". */
export function formatKm(km: number): string {
  return `${oneDecimal.format(km)} km`;
}

/** De una proporción (0 a 1) a "96 %". */
export function formatRate(rate: number): string {
  return `${Math.round(rate * 100)} %`;
}

/** "7:02 a. m." en la hora de la demo (Caracas). */
export function formatTime(iso: string, timeZone: string = DEMO_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).formatToParts(new Date(iso));
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const period = pick("dayPeriod").toUpperCase() === "AM" ? "a. m." : "p. m.";
  return `${pick("hour")}:${pick("minute")} ${period}`;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;
const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"] as const;

/** De "2026-11-24" a "mar 24 nov". No pasa por husos horarios: la fecha ya es local. */
export function formatDay(isoDate: string): string {
  const [year = 0, month = 1, day = 1] = isoDate.slice(0, 10).split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${day} ${MONTHS[month - 1]}`;
}

/** De un instante a "mar 24 nov, 3:30 p. m." en la hora de la demo (Caracas). */
export function formatDateTime(iso: string, timeZone: string = DEMO_TIME_ZONE): string {
  return `${formatDay(localDate(new Date(iso), timeZone))}, ${formatTime(iso, timeZone)}`;
}

/** Duración de un audio: 200 segundos son "3:20 min". */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")} min`;
}

/** "1 día" o "5 días": concordancia simple para contadores. */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Iniciales para el avatar: "Carlos Rodríguez" da "CR". Nunca se usa foto (regla legal 8.6). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}
