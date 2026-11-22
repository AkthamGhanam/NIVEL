import { describe, expect, it } from "vitest";

import { locateZone, ZONES } from "./zones";

describe("locateZone", () => {
  it("reconoce la zona dentro de una frase, sin importar acentos ni mayúsculas", () => {
    expect(locateZone("vivo por LOS GUAYOS, cerca de la plaza")).toEqual({
      name: "Los Guayos",
      point: ZONES.losGuayos.point,
      known: true,
    });
    expect(locateZone("moron").name).toBe("Morón");
  });

  it("si no la reconoce conserva el texto y aproxima al centro de Valencia", () => {
    expect(locateZone("  La   Isabelica ")).toEqual({
      name: "La Isabelica",
      point: ZONES.valencia.point,
      known: false,
    });
  });
});
