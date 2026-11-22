import { describe, expect, it } from "vitest";

import { computeLevel, type LevelInput } from "./level";
import { levelTable, RATING_RULES } from "./level-table";

const NOW = new Date("2026-11-22T12:00:00Z");
const base: LevelInput = {
  confirmedJobs: 0,
  practicalPassed: false,
  certificates: 0,
  attendanceRate: 1,
  verifiedIncidents: 0,
  ratings: [],
};
const levelOf = (input: Partial<LevelInput>) =>
  computeLevel({ ...base, ...input }, { now: NOW, currentLevel: 1 });

describe("tabla pública de niveles", () => {
  it("publica los cinco niveles con su nombre, requisito y banda de referencia", () => {
    const table = levelTable();

    expect(table.map((row) => `${row.level} ${row.name}`)).toEqual([
      "1 Aprendiz",
      "2 Verificado",
      "3 Probado",
      "4 Confiable",
      "5 Maestro",
    ]);
    expect(table[2]).toMatchObject({
      requirement: "Nivel 2, 3 trabajos confirmados y ningún incidente verificado.",
    });
    expect(table[3]?.requirement).toContain("10 trabajos confirmados, asistencia de 90 % o más");
    expect(table[4]?.requirement).toContain(
      "25 trabajos confirmados, 2 constancias y asistencia de 95 % o más",
    );
    expect(table[0]?.band).toEqual({ min: 160, max: 240 });
  });

  it("lo publicado coincide con lo que calcula la fórmula", () => {
    expect(levelOf({})).toBe(1);
    expect(levelOf({ certificates: 1 })).toBe(2);
    expect(levelOf({ practicalPassed: true, confirmedJobs: 3 })).toBe(3);
    expect(levelOf({ practicalPassed: true, confirmedJobs: 10, attendanceRate: 0.9 })).toBe(4);
    expect(levelOf({ practicalPassed: true, confirmedJobs: 25, certificates: 2, attendanceRate: 0.95 })).toBe(
      5,
    );
    expect(levelOf({ practicalPassed: true, confirmedJobs: 25, certificates: 1, attendanceRate: 0.95 })).toBe(
      4,
    );
  });

  it("explica las calificaciones con los números reales y sin palabras de sanción", () => {
    const text = RATING_RULES.join(" ");

    expect(text).toContain("5 o más calificaciones con un promedio menor a 3,5");
    expect(text).toContain("12 meses");
    expect(text).not.toMatch(/castig|sancion|penaliz/i);
  });
});
