import { normalizeSpanish } from "./dates";

/**
 * Clasificación inicial de un reporte dicho de palabra, por palabras clave.
 * Es solo una ayuda para ordenar la cola: la decisión siempre la toma una
 * persona del equipo (regla legal 8.4), y si hay duda queda como "otro".
 */

export type ReportCategory = "no_pago" | "inseguridad" | "oferta_falsa" | "acoso" | "otro";

/** De lo más grave a lo menos: ante varias coincidencias gana la primera. */
const KEYWORDS: ReadonlyArray<readonly [ReportCategory, readonly string[]]> = [
  [
    "acoso",
    ["acoso", "acosa", "me toco", "manosea", "insinu", "amenaz", "insult", "humill", "golpe", "agred"],
  ],
  [
    "inseguridad",
    [
      "accidente",
      "herid",
      "lesion",
      "sin casco",
      "sin careta",
      "sin guantes",
      "sin arnes",
      "extintor",
      "andamio",
    ],
  ],
  [
    "inseguridad",
    ["peligro", "inseguro", "insegura", "equipo de proteccion", "me cai", "se cayo", "quemadura"],
  ],
  [
    "no_pago",
    ["no me pag", "no pago", "no han pagado", "me deben", "me debe", "sin pagar", "pago incompleto"],
  ],
  ["no_pago", ["me descontaron", "no me han pagado", "no me cancel", "falta de pago"]],
  [
    "oferta_falsa",
    ["oferta falsa", "estafa", "me pidieron dinero", "pidio dinero", "cobraron por", "no existe la obra"],
  ],
  ["oferta_falsa", ["enganar", "engano", "engañ", "mentira", "trabajo falso"]],
];

export function classifyReport(spoken: string): ReportCategory {
  const text = normalizeSpanish(spoken);
  const match = KEYWORDS.find(([, words]) => words.some((word) => text.includes(normalizeSpanish(word))));
  return match?.[0] ?? "otro";
}
