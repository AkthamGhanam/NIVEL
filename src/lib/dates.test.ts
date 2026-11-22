import { describe, expect, it } from "vitest";

import { addDays, localDate, normalizeSpanish, parseIsoDate, resolveStartDate, weekday } from "./dates";
import { DomainValidationError } from "./errors";

/** Domingo 22 de noviembre de 2026, 2:30 a. m. en Caracas (06:30 UTC). */
const SUNDAY_EARLY = new Date("2026-11-22T06:30:00Z");

describe("parseIsoDate", () => {
  it("acepta fechas reales", () => {
    expect(parseIsoDate("2028-02-29")).toBe("2028-02-29");
  });

  it.each(["2026-02-30", "2026-13-01", "22/11/2026", "2026-1-5", "", "2026-11-22T00:00"])(
    "rechaza %j",
    (value) => {
      expect(() => parseIsoDate(value)).toThrow(DomainValidationError);
    },
  );
});

describe("aritmética de fechas", () => {
  it("suma días cruzando meses y años", () => {
    expect(addDays(parseIsoDate("2026-12-30"), 3)).toBe("2027-01-02");
    expect(addDays(parseIsoDate("2026-03-01"), -1)).toBe("2026-02-28");
  });

  it("rechaza días no enteros", () => {
    expect(() => addDays(parseIsoDate("2026-11-22"), 1.5)).toThrow(DomainValidationError);
  });

  it("calcula el día de la semana", () => {
    expect(weekday(parseIsoDate("2026-11-22"))).toBe(0);
  });
});

describe("localDate", () => {
  it("usa la hora de Caracas, no la UTC", () => {
    const lateNightInCaracas = new Date("2026-11-23T02:00:00Z"); // 22 nov, 10 p. m. en Caracas

    expect(localDate(lateNightInCaracas)).toBe("2026-11-22");
    expect(localDate(lateNightInCaracas, "UTC")).toBe("2026-11-23");
  });
});

describe("resolveStartDate", () => {
  it.each([
    ["el martes", "2026-11-24"],
    ["desde el martes", "2026-11-24"],
    ["el próximo martes", "2026-11-24"],
    ["Miércoles", "2026-11-25"],
    ["el sabado", "2026-11-28"],
    ["el domingo", "2026-11-29"],
    ["hoy", "2026-11-22"],
    ["mañana", "2026-11-23"],
    ["pasado mañana", "2026-11-24"],
    ["  2026-11-30 ", "2026-11-30"],
  ])("resuelve %j a %s", (text, expected) => {
    expect(resolveStartDate(text, SUNDAY_EARLY)).toBe(expected);
  });

  it("no acepta una fecha pasada", () => {
    expect(() => resolveStartDate("2026-11-21", SUNDAY_EARLY)).toThrow(/pasado/);
  });

  it.each(["", "algún día", "el martes 13 de diciembre", "🙂"])("rechaza lo que no entiende: %j", (text) => {
    expect(() => resolveStartDate(text, SUNDAY_EARLY)).toThrow(DomainValidationError);
  });

  it("no refleja textos largos completos en el error", () => {
    const longText = "x".repeat(500);

    expect(() => resolveStartDate(longText, SUNDAY_EARLY)).toThrow(/^No entendí la fecha "x{40}"/);
  });
});

describe("normalizeSpanish", () => {
  it("quita acentos, signos y emojis", () => {
    expect(normalizeSpanish("  ¡Sólo HOMBRES! 💪 ")).toBe("solo hombres");
  });
});
