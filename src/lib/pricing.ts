import { ensure } from "./errors";
import type { Level } from "./level";
import { assertMoney, fromCents, round2, toCents } from "./money";

/** Precios de NIVEL (docs/spec.md, sección 6.2). Todo se cobra más IVA, en bolívares. */

export const IVA_RATE = 0.16;
export const ACADEMY_COMMISSION_RATE = 0.15;
export const SEARCH_GUARANTEE_DAYS = 7;

export const HIRING_FEE_USD: Readonly<Record<Level, number>> = Object.freeze({
  1: 15,
  2: 20,
  3: 30,
  4: 40,
  5: 50,
});

export const PLANS = Object.freeze({
  obra: { monthlyUsd: 39, includedHires: 3, extraHireUsd: 20 },
  empresa: { monthlyUsd: 129 },
});

/** Únicos medios de cobro de las tarifas de NIVEL (regla legal 8.8). */
export const FEE_PAYMENT_METHODS = Object.freeze(["pago_movil", "transferencia"] as const);
export type FeePaymentMethod = (typeof FEE_PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Readonly<Record<FeePaymentMethod, string>> = Object.freeze({
  pago_movil: "Pago Móvil",
  transferencia: "Transferencia",
});

export interface PriceWithIva {
  readonly base: number;
  readonly iva: number;
  readonly total: number;
}

/** IVA 16 % siempre aparte. */
export function withIva(base: number): PriceWithIva {
  assertMoney(base, "La base");
  const baseCents = toCents(base);
  const ivaCents = Math.round(baseCents * IVA_RATE);
  return { base: fromCents(baseCents), iva: fromCents(ivaCents), total: fromCents(baseCents + ivaCents) };
}

/** Tarifa por contratación según el nivel del trabajador. Se genera cuando el trabajador acepta. */
export function hiringFee(level: Level): PriceWithIva {
  return withIva(HIRING_FEE_USD[level]);
}

/** Rango de tarifas para una solicitud, del nivel mínimo pedido al máximo de los candidatos. */
export function hiringFeeRange(minLevel: Level, maxLevel: Level): { min: PriceWithIva; max: PriceWithIva } {
  ensure(minLevel <= maxLevel, "El nivel mínimo no puede superar al máximo");
  return { min: hiringFee(minLevel), max: hiringFee(maxLevel) };
}

/** Comisión de NIVEL a la academia: 15 % del precio del curso, más IVA. */
export function academyCommission(coursePriceUsd: number): PriceWithIva {
  assertMoney(coursePriceUsd, "El precio del curso");
  return withIva(round2(coursePriceUsd * ACADEMY_COMMISSION_RATE));
}

/** Costo del Plan Obra en un mes según las contrataciones hechas. */
export function planObraMonthlyCost(hires: number): PriceWithIva {
  ensure(Number.isInteger(hires) && hires >= 0, "Las contrataciones deben ser un entero no negativo");
  const extras = Math.max(0, hires - PLANS.obra.includedHires);
  return withIva(PLANS.obra.monthlyUsd + extras * PLANS.obra.extraHireUsd);
}

/** Equivalente en bolívares con una tasa de ejemplo configurable (se muestra como "tasa de ejemplo"). */
export function toBolivares(amountUsd: number, exampleRateBsPerUsd: number): number {
  assertMoney(amountUsd, "El monto");
  ensure(Number.isFinite(exampleRateBsPerUsd) && exampleRateBsPerUsd > 0, "La tasa debe ser mayor que cero");
  return round2(amountUsd * exampleRateBsPerUsd);
}

/** Datos de NIVEL para recibir pagos. Son de ejemplo: la demo no cobra de verdad. */
export const NIVEL_BILLING = Object.freeze({
  name: "NIVEL (Bytes Technology) · datos de ejemplo",
  rif: "J-00000000-0",
  bank: "Banco de ejemplo",
  pagoMovilPhone: "0414-000-0000",
  account: "0000-0000-00-0000000000",
});
