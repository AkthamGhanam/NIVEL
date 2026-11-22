import { describe, expect, it } from "vitest";

import { moderateJobText, type ViolationCategory } from "./moderation";

describe("moderateJobText: bloquea criterios prohibidos", () => {
  it.each<[string, ViolationCategory]>([
    ["Necesito 3 soldadores, solo hombres", "sexo"],
    ["Sólo MUJERES para pintura", "sexo"],
    ["Electricista menor de 30", "edad"],
    ["Albañiles entre 20 y 35 años", "edad"],
    ["Plomero mayor de 25 años", "edad"],
    ["Buscamos gente de buena presencia", "apariencia"],
    ["Solo venezolanos, no extranjeros", "nacionalidad"],
    ["Preferible cristiano evangélico", "religion"],
    ["Soldador soltero sin hijos", "estado_civil"],
    ["No contratamos embarazadas", "embarazo"],
    ["Personal sin discapacidad", "discapacidad"],
    ["El candidato debe pagar una inscripción de 10 dólares", "cobro_al_candidato"],
    ["Cuota de ingreso de 5$", "cobro_al_candidato"],
  ])("%j → %s", (text, category) => {
    const result = moderateJobText(text);

    expect(result.allowed).toBe(false);
    expect(result.violations.map((v) => v.category)).toContain(category);
  });

  it("explica cada problema en lenguaje simple", () => {
    const result = moderateJobText("solo hombres de buena presencia");

    expect(result.violations).toHaveLength(2);
    for (const violation of result.violations) expect(violation.explanation.length).toBeGreaterThan(10);
  });
});

describe("moderateJobText: no bloquea vacantes legítimas", () => {
  it.each([
    "Necesito 3 soldadores, nivel 2 o más, desde el martes en Los Guayos, 5 días, a 25 dólares diarios",
    "Deben ser mayores de 18 años",
    "Requisito: mayor de 18",
    "Mayores de edad con 5 años de experiencia",
    "Electricista con 10 años de experiencia en tableros",
    "Pago diario de 25 dólares por Pago Móvil",
    "Se entrega equipo de protección personal completo",
    "",
    "🔥 Soldadura SMAW en estructuras 💪",
  ])("%j", (text) => {
    expect(moderateJobText(text)).toEqual({ allowed: true, violations: [] });
  });
});
