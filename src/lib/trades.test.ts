import { describe, expect, it } from "vitest";

import { RATING_CATEGORIES, RATING_TAGS } from "./rating-tags";
import { CONTRACT_TYPE_LABELS, CONTRACT_TYPES, tradeCount, TRADES } from "./trades";

describe("catálogos cerrados", () => {
  it("lista los 6 oficios que entiende el agente", () => {
    expect(TRADES).toEqual(["soldador", "electricista", "albanil", "plomero", "pintor", "otro"]);
    expect(Object.isFrozen(TRADES)).toBe(true);
  });

  it("lista los 3 tipos de contrato directo empresa–trabajador", () => {
    expect(CONTRACT_TYPES).toEqual(["obra_determinada", "tiempo_determinado", "servicio_independiente"]);
  });

  it("cada tipo de contrato tiene su nombre y los oficios concuerdan en número", () => {
    expect(Object.keys(CONTRACT_TYPE_LABELS)).toEqual([...CONTRACT_TYPES]);
    expect(CONTRACT_TYPE_LABELS.obra_determinada).toBe("Por obra determinada");
    expect(tradeCount("soldador", 3)).toBe("3 soldadores");
    expect(tradeCount("albanil", 1)).toBe("1 albañil");
    expect(tradeCount("otro", 2)).toBe("2 trabajadores");
  });

  it("las calificaciones usan categorías y etiquetas cerradas, todas positivas", () => {
    expect(RATING_CATEGORIES.map((category) => category.key)).toEqual([
      "quality",
      "punctuality",
      "safety",
      "attitude",
    ]);
    expect(RATING_TAGS.empresa).toContain("Cumple normas de seguridad");
    expect(RATING_TAGS.trabajador).toContain("Pagó a tiempo");
    expect(Object.isFrozen(RATING_TAGS)).toBe(true);
  });
});
