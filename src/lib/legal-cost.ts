import { ensure } from "./errors";
import { round2 } from "./money";

/**
 * Costo legal estimado de una contratación (docs/spec.md, sección 6.3).
 * Es un estimado simplificado: la interfaz siempre muestra LEGAL_COST_DISCLAIMER.
 */

export const LEGAL_COST_DISCLAIMER = "Estimado. Valídalo con tu contador.";

const LEGAL_COST_RATES = Object.freeze({
  utilidades: 30 / 360, // mínimo legal de 30 días al año, proporcional
  vacacionesBono: 30 / 360, // 15 días de vacaciones + 15 de bono vacacional, proporcional
  prestaciones: 15 / 90, // garantía de 15 días por trimestre, proporcional
  pensiones: 0.09, // contribución especial
  aportes: 0.15, // IVSS + RPE + FAOV + INCES, estimado simplificado
});

const LIMITS = Object.freeze({ maxDailyPayUsd: 1000, maxDays: 365, maxQuantity: 100 });

export interface LegalCostInput {
  readonly dailyPayUsd: number;
  readonly days: number;
  readonly quantity: number;
}

export interface LegalCostBreakdown {
  readonly salary: number;
  readonly utilidades: number;
  readonly vacacionesBono: number;
  readonly prestaciones: number;
  readonly pensiones: number;
  readonly aportes: number;
}

export interface LegalCostEstimate {
  readonly perWorker: LegalCostBreakdown & { readonly total: number };
  readonly quantity: number;
  readonly totalForQuantity: number;
}

function assertValidInput({ dailyPayUsd, days, quantity }: LegalCostInput): void {
  ensure(
    Number.isFinite(dailyPayUsd) && dailyPayUsd > 0 && dailyPayUsd <= LIMITS.maxDailyPayUsd,
    `El pago diario debe estar entre 0 y ${LIMITS.maxDailyPayUsd} dólares`,
  );
  ensure(
    Number.isInteger(days) && days >= 1 && days <= LIMITS.maxDays,
    `Los días deben ser un entero entre 1 y ${LIMITS.maxDays}`,
  );
  ensure(
    Number.isInteger(quantity) && quantity >= 1 && quantity <= LIMITS.maxQuantity,
    `La cantidad debe ser un entero entre 1 y ${LIMITS.maxQuantity}`,
  );
}

export function estimateLegalCost(input: LegalCostInput): LegalCostEstimate {
  assertValidInput(input);
  const salary = input.dailyPayUsd * input.days;
  const charges = {
    utilidades: salary * LEGAL_COST_RATES.utilidades,
    vacacionesBono: salary * LEGAL_COST_RATES.vacacionesBono,
    prestaciones: salary * LEGAL_COST_RATES.prestaciones,
    pensiones: salary * LEGAL_COST_RATES.pensiones,
    aportes: salary * LEGAL_COST_RATES.aportes,
  };
  // Se suma sin redondear y se redondea al final, para no acumular error de centavos.
  const exactTotal = salary + Object.values(charges).reduce((sum, value) => sum + value, 0);
  const perWorker = {
    salary: round2(salary),
    utilidades: round2(charges.utilidades),
    vacacionesBono: round2(charges.vacacionesBono),
    prestaciones: round2(charges.prestaciones),
    pensiones: round2(charges.pensiones),
    aportes: round2(charges.aportes),
    total: round2(exactTotal),
  };
  return { perWorker, quantity: input.quantity, totalForQuantity: round2(exactTotal * input.quantity) };
}
