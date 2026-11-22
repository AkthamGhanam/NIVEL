import type { ReportInput } from "./worker-api";

/**
 * Tipos de reporte, en las palabras de quien reporta. Módulo sin React: lo
 * usan la pantalla y también la página del servidor que valida `?tipo=`.
 */

export type ReportKind = ReportInput["kind"];

/** La clave obliga a cubrir todos los tipos que acepta el servidor. */
export const REPORT_KIND_LABELS: Readonly<Record<ReportKind, string>> = Object.freeze({
  no_pago: "No me pagaron",
  inseguridad: "La obra es insegura",
  oferta_falsa: "La oferta no era lo que decía",
  acoso: "Acoso o maltrato",
  otro: "Otro problema",
});

export const REPORT_KINDS = Object.keys(REPORT_KIND_LABELS) as ReportKind[];

/** Solo vale un tipo de la lista cerrada; cualquier otro texto se descarta. */
export const isReportKind = (value: unknown): value is ReportKind =>
  typeof value === "string" && (REPORT_KINDS as string[]).includes(value);
