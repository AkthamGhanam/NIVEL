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
  prestaciones: 15 / 90, // garantía de 15 días por trimestre (art. 142, literal a)
  pensiones: 0.09, // contribución especial
  aportes: 0.15, // IVSS + RPE + FAOV + INCES, estimado simplificado
});

/**
 * Prestaciones sociales (LOTTT, art. 142). Si la relación dura menos de tres
 * meses, el literal e) fija cinco días de salario por mes trabajado o fracción;
 * desde los tres meses rige la garantía de 15 días por trimestre.
 */
export const FIRST_TRIMESTER_DAYS = 90;
const DAYS_PER_MONTH = 30;
const SHORT_RELATION_DAYS_PER_MONTH = 5;

export function prestacionesFor(dailyPayUsd: number, days: number): number {
  if (days < FIRST_TRIMESTER_DAYS) {
    return dailyPayUsd * SHORT_RELATION_DAYS_PER_MONTH * Math.ceil(days / DAYS_PER_MONTH);
  }
  return dailyPayUsd * days * LEGAL_COST_RATES.prestaciones;
}

/** Cómo se calcularon las prestaciones, para decirlo junto al monto. */
export const prestacionesBasis = (days: number): string =>
  days < FIRST_TRIMESTER_DAYS
    ? "Menos de 3 meses: 5 días de salario por mes o fracción (art. 142, literal e)"
    : "Desde 3 meses: 15 días de salario por trimestre (art. 142, literal a)";

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
    prestaciones: prestacionesFor(input.dailyPayUsd, input.days),
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

/**
 * A dónde va cada dólar del costo legal. Nada de esto es ingreso de NIVEL ni
 * pasa por NIVEL: el patrono le paga al trabajador y aporta al Estado.
 */
export interface MoneyFlow {
  /** Lo que recibe el trabajador ahora: su salario por los días de obra. */
  readonly salary: number;
  /** Lo que la ley le reconoce además del salario: utilidades, vacaciones con su bono y prestaciones. */
  readonly workerBenefits: number;
  /** Salario más beneficios: todo lo que termina en manos del trabajador. */
  readonly toWorker: number;
  /** Aportes del patrono a la seguridad social: pensiones, IVSS, FAOV e INCES. */
  readonly toState: number;
  readonly total: number;
}

export function moneyFlow({ perWorker }: LegalCostEstimate): MoneyFlow {
  const workerBenefits = round2(perWorker.utilidades + perWorker.vacacionesBono + perWorker.prestaciones);
  const toState = round2(perWorker.pensiones + perWorker.aportes);
  // El total manda: los subtotales se ajustan a él para que la suma siempre cuadre al centavo.
  const toWorker = round2(perWorker.total - toState);
  return { salary: perWorker.salary, workerBenefits, toWorker, toState, total: perWorker.total };
}

/** Lo que el patrono le paga al trabajador al terminar la obra: salario y partes proporcionales de ley. */
export interface Liquidation {
  readonly salary: number;
  readonly utilidades: number;
  readonly vacacionesBono: number;
  readonly prestaciones: number;
  readonly total: number;
}

export function liquidation(input: { readonly dailyPayUsd: number; readonly days: number }): Liquidation {
  const { perWorker } = estimateLegalCost({ ...input, quantity: 1 });
  const flow = moneyFlow(estimateLegalCost({ ...input, quantity: 1 }));
  return {
    salary: perWorker.salary,
    utilidades: perWorker.utilidades,
    vacacionesBono: perWorker.vacacionesBono,
    prestaciones: perWorker.prestaciones,
    total: flow.toWorker,
  };
}

export const LIQUIDATION_LABELS: ReadonlyArray<
  readonly [key: keyof Omit<Liquidation, "total">, label: string]
> = [
  ["salary", "Salario"],
  ["utilidades", "Utilidades proporcionales"],
  ["vacacionesBono", "Vacaciones y bono vacacional"],
  ["prestaciones", "Prestaciones sociales"],
];

/**
 * Aportes del patrono al Estado, por institución, sobre el salario pagado.
 * Suman lo mismo que el costo legal estimado: 9 % de pensiones y 15 % de aportes.
 */
export const INSTITUTIONS = ["ivss", "faov", "inces", "pensiones"] as const;
export type Institution = (typeof INSTITUTIONS)[number];

export const INSTITUTION_INFO: Readonly<
  Record<
    Institution,
    { readonly name: string; readonly what: string; readonly rate: number; readonly portal: string }
  >
> = Object.freeze({
  ivss: {
    name: "IVSS",
    what: "Seguro social y paro forzoso (RPE)",
    rate: 0.11,
    portal: "Portal TIUNA del IVSS",
  },
  faov: { name: "BANAVIH · FAOV", what: "Ahorro para vivienda", rate: 0.02, portal: "FAOV en línea" },
  inces: { name: "INCES", what: "Formación de trabajadores", rate: 0.02, portal: "Portal del INCES" },
  pensiones: {
    name: "SENIAT · Pensiones",
    what: "Contribución especial de pensiones",
    rate: 0.09,
    portal: "Portal fiscal del SENIAT",
  },
});

/** Cuánto le toca a cada institución por un monto de salarios pagados en el mes. */
export function contributionsFor(salariesUsd: number): Readonly<Record<Institution, number>> {
  ensure(Number.isFinite(salariesUsd) && salariesUsd >= 0, "El salario debe ser un monto válido");
  return Object.fromEntries(
    INSTITUTIONS.map((institution) => [
      institution,
      round2(salariesUsd * INSTITUTION_INFO[institution].rate),
    ]),
  ) as Record<Institution, number>;
}
