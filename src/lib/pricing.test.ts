import { describe, expect, it } from "vitest";

import { DomainValidationError } from "./errors";
import { estimateLegalCost, LEGAL_COST_DISCLAIMER } from "./legal-cost";
import {
  academyCommission,
  FEE_PAYMENT_METHODS,
  hiringFee,
  hiringFeeRange,
  planObraMonthlyCost,
  toBolivares,
  withIva,
} from "./pricing";

describe("withIva", () => {
  it("separa el 16 % de IVA de la base", () => {
    expect(withIva(20)).toEqual({ base: 20, iva: 3.2, total: 23.2 });
  });

  it("redondea a centavos sin errores de coma flotante", () => {
    expect(withIva(0.1 + 0.2)).toEqual({ base: 0.3, iva: 0.05, total: 0.35 });
    expect(withIva(19.99)).toEqual({ base: 19.99, iva: 3.2, total: 23.19 });
  });

  it("acepta cero y rechaza negativos o no finitos", () => {
    expect(withIva(0)).toEqual({ base: 0, iva: 0, total: 0 });
    expect(() => withIva(-1)).toThrow(DomainValidationError);
    expect(() => withIva(Number.NaN)).toThrow(DomainValidationError);
  });
});

describe("tarifas de NIVEL", () => {
  it.each([
    [1, 15],
    [2, 20],
    [3, 30],
    [4, 40],
    [5, 50],
  ] as const)("Nivel %i cuesta %i dólares más IVA", (level, base) => {
    expect(hiringFee(level).base).toBe(base);
  });

  it("da el rango de 20 a 30 dólares para candidatos de nivel 2 y 3", () => {
    const range = hiringFeeRange(2, 3);

    expect(range.min.total).toBe(23.2);
    expect(range.max.total).toBe(34.8);
    expect(() => hiringFeeRange(3, 2)).toThrow(DomainValidationError);
  });

  it("Plan Obra incluye 3 contrataciones y cobra 20 dólares por cada extra", () => {
    expect(planObraMonthlyCost(0).base).toBe(39);
    expect(planObraMonthlyCost(3).base).toBe(39);
    expect(planObraMonthlyCost(5).base).toBe(79);
    expect(() => planObraMonthlyCost(-1)).toThrow(DomainValidationError);
  });

  it("cobra 15 % del curso a la academia, más IVA", () => {
    expect(academyCommission(120)).toEqual({ base: 18, iva: 2.88, total: 20.88 });
  });

  it("solo cobra por Pago Móvil o transferencia", () => {
    expect(FEE_PAYMENT_METHODS).toEqual(["pago_movil", "transferencia"]);
  });

  it("convierte a bolívares con la tasa de ejemplo", () => {
    expect(toBolivares(23.2, 36.5)).toBe(846.8);
    expect(() => toBolivares(10, 0)).toThrow(DomainValidationError);
  });
});

describe("estimateLegalCost", () => {
  it("25 dólares por 5 días cuesta unos 300,83 por trabajador", () => {
    const estimate = estimateLegalCost({ dailyPayUsd: 25, days: 5, quantity: 3 });

    expect(estimate.perWorker).toEqual({
      salary: 125,
      utilidades: 10.42,
      vacacionesBono: 10.42,
      prestaciones: 125,
      pensiones: 11.25,
      aportes: 18.75,
      total: 300.83,
    });
    expect(estimate.totalForQuantity).toBe(902.5);
  });

  it("muestra siempre el aviso de estimado", () => {
    expect(LEGAL_COST_DISCLAIMER).toBe("Estimado. Valídalo con tu contador.");
  });

  it.each([
    { dailyPayUsd: 0, days: 5, quantity: 1 },
    { dailyPayUsd: 25, days: 0, quantity: 1 },
    { dailyPayUsd: 25, days: 2.5, quantity: 1 },
    { dailyPayUsd: 25, days: 5, quantity: 0 },
    { dailyPayUsd: 25, days: 5, quantity: 101 },
    { dailyPayUsd: 1001, days: 5, quantity: 1 },
    { dailyPayUsd: 25, days: 366, quantity: 1 },
    { dailyPayUsd: Number.NaN, days: 5, quantity: 1 },
  ])("rechaza entradas fuera de rango %j", (input) => {
    expect(() => estimateLegalCost(input)).toThrow(DomainValidationError);
  });
});
