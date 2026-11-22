import { formatDateTime, plural } from "@/lib/format";
import { LEVEL_NAMES, type Level } from "@/lib/level";
import type { PriceWithIva } from "@/lib/pricing";

import type { DemoState, Metrics, ReportOutcome, ReportRow } from "./team-api";

/**
 * Lógica de presentación de la administración: métricas y cola de revisión
 * humana, en textos y cifras listos para mostrar. Sin React ni red.
 */

const oneDecimal = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 1 });
const SECONDS_PER_MINUTE = 60;

/** Tiempo promedio a cuadrilla completa: "47 s", "3,5 min" o que aún no hay datos. */
export function formatCrewTime(minutes: number | null): string {
  if (minutes === null) return "Sin datos";
  if (minutes < 1) return `${Math.round(minutes * SECONDS_PER_MINUTE)} s`;
  return `${oneDecimal.format(minutes)} min`;
}

export interface LevelRow {
  readonly level: Level;
  readonly name: string;
  readonly count: number;
  /** Proporción del total, de 0 a 1, para la barra. */
  readonly share: number;
}

const LEVELS: readonly Level[] = [1, 2, 3, 4, 5];

export function levelRows(workers: Metrics["workers"]): LevelRow[] {
  return LEVELS.map((level) => {
    const count = workers.byLevel[level] ?? 0;
    return { level, name: LEVEL_NAMES[level], count, share: workers.total === 0 ? 0 : count / workers.total };
  });
}

export interface IncomeRow {
  readonly label: string;
  readonly price: PriceWithIva;
  readonly total: boolean;
}

/** Ingresos de NIVEL por origen, con el IVA siempre en su propia columna. */
export const incomeRows = (income: Metrics["income"]): IncomeRow[] => [
  { label: "Tarifas por contratación", price: income.hiring, total: false },
  { label: "Comisión de academias (15 %)", price: income.academyCommission, total: false },
  { label: "Total", price: income.total, total: true },
];

/** Tipos de reporte en palabras del equipo. La clave obliga a cubrir todos los que guarda el servidor. */
export const REPORT_KIND_NAMES: Readonly<Record<ReportRow["kind"], string>> = Object.freeze({
  no_pago: "Falta de pago",
  inseguridad: "Inseguridad en la obra",
  oferta_falsa: "Oferta falsa",
  acoso: "Acoso o maltrato",
  otro: "Otro problema",
});

/** Plazo que se le promete a quien reporta. */
export const REVIEW_PROMISE_HOURS = 24;
const MS_PER_HOUR = 3_600_000;
export const REVIEW_NOTE_MAX_LENGTH = 1000;

export const INPSASEL_REMINDER =
  "Es un reporte de inseguridad: al responder, indícale cómo acudir al INPSASEL.";

export interface ReportView {
  readonly id: string;
  readonly kind: string;
  /** Lo que dijo o escribió la persona. */
  readonly body: string;
  readonly source: "Nota de voz transcrita" | "Escrito por la persona" | "Sin texto";
  /** Empresa señalada, si el reporte nombra una. */
  readonly company: string | null;
  readonly received: string;
  /** "Quedan 20 h de las 24" o "Plazo de 24 h vencido". */
  readonly deadline: string;
  readonly overdue: boolean;
  /** Audio de la nota de voz, solo si es un archivo de este mismo sitio. */
  readonly audioUrl: string | null;
  readonly safetyReminder: boolean;
}

/** Solo se reproduce audio servido por la propia app: nunca una dirección externa guardada en un dato. */
export const sameSiteAudio = (url: string | null): string | null =>
  url !== null && /^\/(?![/\\])/.test(url) ? url : null;

function deadline(createdAt: string, now: Date): Pick<ReportView, "deadline" | "overdue"> {
  const elapsedHours = (now.getTime() - Date.parse(createdAt)) / MS_PER_HOUR;
  // Si el reloj de este navegador va atrasado, nunca se muestran más horas que las prometidas.
  const left = Math.min(REVIEW_PROMISE_HOURS, Math.ceil(REVIEW_PROMISE_HOURS - elapsedHours));
  if (left <= 0) return { deadline: `Plazo de ${REVIEW_PROMISE_HOURS} h vencido`, overdue: true };
  return { deadline: `Quedan ${left} h de las ${REVIEW_PROMISE_HOURS}`, overdue: false };
}

type Companies = DemoState["personas"]["companies"];

/** Un reporte listo para la cola. No incluye quién reportó: la revisión no lo necesita. */
export function reportView(report: ReportRow, companies: Companies, now: Date): ReportView {
  const body = report.transcript ?? report.text ?? "";
  return {
    id: report.id,
    kind: REPORT_KIND_NAMES[report.kind],
    body,
    source: report.transcript ? "Nota de voz transcrita" : body ? "Escrito por la persona" : "Sin texto",
    company: companies.find((company) => company.id === report.companyId)?.name ?? null,
    received: formatDateTime(report.createdAt),
    ...deadline(report.createdAt, now),
    audioUrl: sameSiteAudio(report.audioUrl),
    safetyReminder: report.kind === "inseguridad",
  };
}

export const queueSummary = (count: number): string =>
  count === 0
    ? "No hay reportes por revisar."
    : `${plural(count, "reporte espera", "reportes esperan")} la decisión de una persona del equipo.`;

export type ReviewNote =
  { readonly ok: true; readonly note: string } | { readonly ok: false; readonly error: string };

/** La decisión siempre lleva una nota escrita por quien revisa. */
export function parseReviewNote(draft: string): ReviewNote {
  const note = draft.trim();
  if (note === "") return { ok: false, error: "Escribe una nota que explique la decisión." };
  if (note.length > REVIEW_NOTE_MAX_LENGTH) {
    return { ok: false, error: `La nota no puede pasar de ${REVIEW_NOTE_MAX_LENGTH} caracteres.` };
  }
  return { ok: true, note };
}

export const OUTCOME_DONE: Readonly<Record<ReportOutcome, string>> = Object.freeze({
  resuelto: "Reporte resuelto. Quedó la nota de la decisión.",
  descartado: "Reporte descartado. Quedó la nota de la decisión.",
});
