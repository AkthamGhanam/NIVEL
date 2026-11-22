import { addDays, type IsoDate } from "@/lib/dates";
import type { Level } from "@/lib/level";
import type { ContractType, Trade } from "@/lib/trades";

import type { RequestInput } from "./company-api";

/**
 * Formulario de "pedir personal" tal como lo escribe la persona (todo texto)
 * y su paso a los datos que espera la API. El servidor vuelve a validar todo:
 * aquí solo se le avisa pronto y con palabras claras.
 */

export interface RequestDraft {
  readonly trade: Trade;
  readonly quantity: string;
  readonly minLevel: string;
  readonly zone: string;
  readonly startDate: string;
  readonly days: string;
  readonly dailyPayUsd: string;
  readonly contractType: ContractType;
  readonly notes: string;
}

export type DraftField = keyof RequestDraft;
export type DraftProblems = Partial<Record<DraftField, string>>;

export type DraftResult =
  | { readonly ok: true; readonly input: RequestInput }
  | { readonly ok: false; readonly problems: DraftProblems };

/** Los mismos topes que valida la API. */
export const REQUEST_LIMITS = Object.freeze({
  quantity: 50,
  days: 90,
  dailyPayUsd: 1000,
  zone: 80,
  notes: 500,
});

/** La obra empieza, por defecto, a los dos días: deja un día completo para que la gente responda. */
const DEFAULT_LEAD_DAYS = 2;

export function newRequestDraft(zone: string, today: IsoDate): RequestDraft {
  return {
    trade: "soldador",
    quantity: "3",
    minLevel: "2",
    zone,
    startDate: addDays(today, DEFAULT_LEAD_DAYS),
    days: "5",
    dailyPayUsd: "25",
    contractType: "obra_determinada",
    notes: "",
  };
}

const WHOLE_NUMBER = /^\d{1,4}$/;
const AMOUNT = /^\d{1,4}([.,]\d{1,2})?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function wholeBetween(text: string, max: number): number | undefined {
  if (!WHOLE_NUMBER.test(text.trim())) return undefined;
  const value = Number(text.trim());
  return value >= 1 && value <= max ? value : undefined;
}

function amountUpTo(text: string, max: number): number | undefined {
  if (!AMOUNT.test(text.trim())) return undefined;
  const value = Number(text.trim().replace(",", "."));
  return value > 0 && value <= max ? value : undefined;
}

export function parseRequestDraft(draft: RequestDraft, today: IsoDate): DraftResult {
  const problems: DraftProblems = {};
  const quantity = wholeBetween(draft.quantity, REQUEST_LIMITS.quantity);
  const minLevel = wholeBetween(draft.minLevel, 5);
  const days = wholeBetween(draft.days, REQUEST_LIMITS.days);
  const dailyPayUsd = amountUpTo(draft.dailyPayUsd, REQUEST_LIMITS.dailyPayUsd);
  const zone = draft.zone.trim();
  const notes = draft.notes.trim();

  if (quantity === undefined)
    problems.quantity = `Escribe cuántas personas, de 1 a ${REQUEST_LIMITS.quantity}.`;
  if (minLevel === undefined) problems.minLevel = "Elige un nivel del 1 al 5.";
  if (zone.length < 2 || zone.length > REQUEST_LIMITS.zone) problems.zone = "Escribe la zona de la obra.";
  if (!ISO_DATE.test(draft.startDate)) problems.startDate = "Elige el día en que empieza la obra.";
  else if (draft.startDate < today) problems.startDate = "La obra no puede empezar en una fecha pasada.";
  if (days === undefined) problems.days = `Escribe cuántos días, de 1 a ${REQUEST_LIMITS.days}.`;
  if (dailyPayUsd === undefined) problems.dailyPayUsd = "Escribe el pago diario en dólares, por ejemplo 25.";
  if (notes.length > REQUEST_LIMITS.notes) problems.notes = "La nota es demasiado larga.";

  const complete =
    quantity !== undefined && minLevel !== undefined && days !== undefined && dailyPayUsd !== undefined;
  if (!complete || Object.keys(problems).length > 0) return { ok: false, problems };
  return {
    ok: true,
    input: {
      trade: draft.trade,
      quantity,
      minLevel: minLevel as Level,
      zone,
      startDate: draft.startDate,
      days,
      dailyPayUsd,
      contractType: draft.contractType,
      ...(notes === "" ? {} : { notes }),
    },
  };
}

const API_FIELDS: ReadonlySet<string> = new Set<DraftField>([
  "trade",
  "quantity",
  "minLevel",
  "zone",
  "startDate",
  "days",
  "dailyPayUsd",
  "contractType",
  "notes",
]);

/** Problemas por campo que devolvió la API, para pintarlos junto a cada casilla. */
export function problemsFromApi(details: ReadonlyArray<{ field: string; problem: string }>): DraftProblems {
  const problems: DraftProblems = {};
  for (const { field, problem } of details) {
    if (API_FIELDS.has(field)) problems[field as DraftField] = problem;
  }
  return problems;
}
