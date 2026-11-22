import { describe, expect, it } from "vitest";

import { contributionsFor, estimateLegalCost, liquidation, moneyFlow } from "./legal-cost";

describe("a dónde va cada dólar", () => {
  it("separa lo que recibe el trabajador de lo que va al Estado, y siempre cuadra con el total", () => {
    const flow = moneyFlow(estimateLegalCost({ dailyPayUsd: 25, days: 5, quantity: 3 }));

    expect(flow).toEqual({
      salary: 125,
      workerBenefits: 41.67,
      toWorker: 166.67,
      toState: 30,
      total: 196.67,
    });
    expect(flow.toWorker + flow.toState).toBeCloseTo(flow.total, 2);
  });

  it("con un salario de 1.000 dólares, el resto no es de NIVEL: es del trabajador y del Estado", () => {
    const flow = moneyFlow(estimateLegalCost({ dailyPayUsd: 50, days: 20, quantity: 1 }));

    expect(flow.total).toBe(1573.33);
    expect(flow.toWorker).toBe(1333.33);
    expect(flow.toState).toBe(240);
  });
});

describe("liquidación y aportes por institución", () => {
  it("la liquidación es lo que va al trabajador, con cada concepto", () => {
    expect(liquidation({ dailyPayUsd: 50, days: 20 })).toEqual({
      salary: 1000,
      utilidades: 83.33,
      vacacionesBono: 83.33,
      prestaciones: 166.67,
      total: 1333.33,
    });
  });

  it("los aportes por institución suman lo mismo que el costo legal estimado", () => {
    const split = contributionsFor(1000);

    expect(split).toEqual({ ivss: 110, faov: 20, inces: 20, pensiones: 90 });
    expect(Object.values(split).reduce((sum, value) => sum + value, 0)).toBe(
      moneyFlow(estimateLegalCost({ dailyPayUsd: 50, days: 20, quantity: 1 })).toState,
    );
    expect(() => contributionsFor(-1)).toThrow();
  });
});
