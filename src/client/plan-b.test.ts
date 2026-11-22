import { describe, expect, it, vi } from "vitest";

import type { CompanyApi } from "./company-api";
import { contractorScript } from "./plan-b";

type Created = Awaited<ReturnType<CompanyApi["createRequest"]>>;

/** Lo mínimo de la respuesta del servidor que el guion lee. */
const created = (matching: number) =>
  ({ request: { id: "sol-1" }, matching, legalCost: null, feeRange: null }) as unknown as Created;

function script(matching: number) {
  const createRequest = vi.fn(async () => created(matching));
  const invite = vi.fn(async () => []);
  const refresh = vi.fn(async () => undefined);
  return {
    createRequest,
    invite,
    ...contractorScript({ api: { createRequest, invite }, zone: "Morón", refresh }),
  };
}

describe("guion del plan B para la empresa", () => {
  it("pide la cuadrilla del camino dorado en la zona de la empresa, marcada como pedida por voz", async () => {
    const { steps, createRequest } = script(0);

    await steps[0]?.run();

    expect(createRequest).toHaveBeenCalledWith({
      trade: "soldador",
      quantity: 3,
      minLevel: 2,
      startDate: "el martes",
      days: 5,
      dailyPayUsd: 25,
      contractType: "obra_determinada",
      zone: "Morón",
      via: "voz",
    });
    expect(steps[0]?.persona).toContain("en Morón");
  });

  it("si nadie cumple, lo dice y no intenta invitar", async () => {
    const { steps, invite } = script(0);

    const found = await steps[0]?.run();
    const invited = await steps[1]?.run();

    expect(found).toMatch(/^No encontré soldadores de nivel 2 o más disponibles cerca de Morón/);
    expect(invited).toBe("Ya no quedan candidatos sin invitar que cumplan con esta solicitud.");
    expect(invite).not.toHaveBeenCalled();
  });

  it("si la persona dice que sí antes de pedir nada, tampoco invita", async () => {
    const { steps, invite } = script(4);

    await steps[1]?.run();

    expect(invite).not.toHaveBeenCalled();
  });

  it("invita como mucho a los que pidió, o a los que haya si son menos", async () => {
    const few = script(2);
    const many = script(7);

    for (const { steps } of [few, many]) {
      await steps[0]?.run().catch(() => undefined);
      await steps[1]?.run();
    }

    expect(few.invite).toHaveBeenCalledWith("sol-1", 2);
    expect(many.invite).toHaveBeenCalledWith("sol-1", 3);
  });
});
