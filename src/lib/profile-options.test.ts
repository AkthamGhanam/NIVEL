import { describe, expect, it } from "vitest";

import {
  ageOn,
  birthDateProblem,
  isCedula,
  matchSkill,
  rangeOfYears,
  skillsFor,
  yearsOf,
} from "./profile-options";

describe("opciones del perfil", () => {
  it("junta las habilidades de varios oficios sin repetir", () => {
    const skills = skillsFor(["soldador", "electricista"]);
    expect(skills).toContain("Soldadura MIG/MAG");
    expect(skills).toContain("Tableros eléctricos");
    expect(new Set(skills).size).toBe(skills.length);
    expect(skillsFor([])).toEqual([]);
  });

  it("los rangos de experiencia van y vuelven", () => {
    expect(yearsOf("mas_5")).toBe(5);
    expect(rangeOfYears(8).label).toBe("+5 años");
    expect(rangeOfYears(0).label).toBe("Menos de 2 años");
    expect(rangeOfYears(12).label).toBe("+10 años");
  });

  it("calcula la edad con la fecha de nacimiento", () => {
    expect(ageOn("2008-11-22", "2026-11-22")).toBe(18);
    expect(ageOn("2008-11-23", "2026-11-22")).toBe(17);
    expect(ageOn("2001-02-30", "2026-11-22")).toBeUndefined();
    expect(birthDateProblem("2010-01-01", "2026-11-22")).toContain("18 años");
    expect(birthDateProblem("1990-05-10", "2026-11-22")).toBeUndefined();
    expect(birthDateProblem("", "2026-11-22")).toBe("Elige tu fecha de nacimiento.");
  });

  it("revisa la forma de la cédula", () => {
    expect(isCedula("V-12.345.678")).toBe(true);
    expect(isCedula("e 8123456")).toBe(true);
    expect(isCedula("12345678")).toBe(false);
    expect(isCedula("V-12")).toBe(false);
  });

  it("reconoce una habilidad dicha de palabra", () => {
    expect(matchSkill("tig", ["soldador"])).toBeUndefined();
    expect(matchSkill("soldadura tig", ["soldador"])).toBe("Soldadura TIG");
    expect(matchSkill("frisos", ["albanil"])).toBe("Frisos");
  });
});
