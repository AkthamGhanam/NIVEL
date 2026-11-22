import { describe, expect, it } from "vitest";

import { classifyReport } from "./report-classifier";

describe("classifyReport", () => {
  it.each([
    ["Terminé la obra hace dos semanas y todavía no me pagan nada, me deben 125 dólares", "no_pago"],
    ["Me descontaron dos días sin explicación", "no_pago"],
    ["Nos tienen soldando sin careta y no hay extintor", "inseguridad"],
    ["Un compañero tuvo un accidente en el andamio", "inseguridad"],
    ["El encargado me insultó y me amenazó delante de todos", "acoso"],
    ["Me pidieron dinero para darme el puesto", "oferta_falsa"],
    ["Llegué y no existe la obra, fue un engaño", "oferta_falsa"],
    ["Quiero hablar con una persona del equipo", "otro"],
    ["", "otro"],
  ])("%s → %s", (spoken, expected) => {
    expect(classifyReport(spoken)).toBe(expected);
  });

  it("ante acoso y falta de pago a la vez, prioriza lo más grave", () => {
    expect(classifyReport("No me pagaron y además el jefe me amenazó")).toBe("acoso");
  });
});
