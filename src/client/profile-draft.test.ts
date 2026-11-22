import { describe, expect, it } from "vitest";

import { type EditableProfile, parseProfileDraft, profileDraft } from "./profile-draft";

const profile: EditableProfile = {
  name: "Carlos Rodríguez",
  zone: "Los Guayos",
  availability: "Inmediata",
  yearsExp: 6,
  skills: ["Soldadura MIG", "Lectura de planos"],
};

const draft = profileDraft(profile);

describe("corregir mis datos", () => {
  it("el formulario arranca con lo que NIVEL ya sabe de la persona", () => {
    expect(draft).toEqual({
      name: "Carlos Rodríguez",
      zone: "Los Guayos",
      availability: "Inmediata",
      yearsExp: "6",
      skills: "Soldadura MIG, Lectura de planos",
    });
  });

  it("sin cambios no manda nada al servidor", () => {
    expect(parseProfileDraft(draft, profile)).toEqual({ ok: true, changes: {} });
  });

  it("manda solo lo que cambió, ya limpio de espacios", () => {
    const parsed = parseProfileDraft(
      { ...draft, zone: "  San   Diego ", yearsExp: " 7 ", skills: "Soldadura MIG,  Soldadura TIG ,," },
      profile,
    );

    expect(parsed).toEqual({
      ok: true,
      changes: { zone: "San Diego", yearsExp: 7, skills: ["Soldadura MIG", "Soldadura TIG"] },
    });
    expect(
      parseProfileDraft({ ...draft, name: "Carlos R. Pérez", availability: "Fines de semana" }, profile),
    ).toEqual({ ok: true, changes: { name: "Carlos R. Pérez", availability: "Fines de semana" } });
  });

  it("avisa junto a cada campo lo que falta, antes de llamar al servidor", () => {
    const parsed = parseProfileDraft(
      { name: "C4rlos", zone: " ", availability: "x", yearsExp: "seis", skills: "a".repeat(41) },
      profile,
    );

    expect(parsed).toEqual({
      ok: false,
      problems: {
        name: "Escribe tu nombre solo con letras.",
        zone: "Escribe tu municipio o sector.",
        availability: "Di cuándo puedes trabajar.",
        yearsExp: "Escribe tus años de experiencia, de 0 a 60.",
        skills: "Cada habilidad puede tener hasta 40 letras.",
      },
    });
  });

  it("los años van de 0 a 60 en números enteros, y las habilidades son 12 como máximo", () => {
    const problemsOf = (changes: Partial<typeof draft>) => {
      const parsed = parseProfileDraft({ ...draft, ...changes }, profile);
      return parsed.ok ? {} : parsed.problems;
    };

    expect(problemsOf({ yearsExp: "" }).yearsExp).toBeDefined();
    expect(problemsOf({ yearsExp: "61" }).yearsExp).toBeDefined();
    expect(problemsOf({ yearsExp: "-1" }).yearsExp).toBeDefined();
    expect(problemsOf({ yearsExp: "2.5" }).yearsExp).toBeDefined();
    expect(problemsOf({ yearsExp: "0" })).toEqual({});
    expect(problemsOf({ skills: Array.from({ length: 13 }, (_, i) => `h${i}`).join(",") }).skills).toBe(
      "Escribe hasta 12 habilidades.",
    );
    expect(problemsOf({ skills: "" })).toEqual({});
  });
});
