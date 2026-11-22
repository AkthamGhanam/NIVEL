import { describe, expect, it } from "vitest";

import { CONTRACT_TYPES, TRADES } from "./trades";

describe("catálogos cerrados", () => {
  it("lista los 6 oficios que entiende el agente", () => {
    expect(TRADES).toEqual(["soldador", "electricista", "albanil", "plomero", "pintor", "otro"]);
    expect(Object.isFrozen(TRADES)).toBe(true);
  });

  it("lista los 3 tipos de contrato directo empresa–trabajador", () => {
    expect(CONTRACT_TYPES).toEqual(["obra_determinada", "tiempo_determinado", "servicio_independiente"]);
  });
});
