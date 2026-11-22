import { describe, expect, it } from "vitest";

import {
  formatBs,
  formatDateTime,
  formatDay,
  formatKm,
  formatRate,
  formatTime,
  formatUsd,
  initials,
  plural,
} from "./format";

describe("formato para la interfaz", () => {
  it("los dólares muestran céntimos solo cuando existen, con coma decimal", () => {
    expect(formatUsd(25)).toBe("$25");
    expect(formatUsd(34.8)).toBe("$34,80");
    expect(formatUsd(3663.28)).toBe("$3.663,28");
  });

  it("bolívares, kilómetros y porcentajes en formato venezolano", () => {
    expect(formatBs(1250)).toBe("Bs. 1.250,00");
    expect(formatKm(1.2)).toBe("1,2 km");
    expect(formatKm(4)).toBe("4 km");
    expect(formatRate(0.958)).toBe("96 %");
  });

  it("la hora se muestra como en Caracas, sin depender de la máquina", () => {
    expect(formatTime("2026-11-24T11:02:00.000Z")).toBe("7:02 a. m.");
    expect(formatTime("2026-11-24T20:30:00.000Z")).toBe("4:30 p. m.");
    expect(formatTime("2026-11-24T16:05:00.000Z")).toBe("12:05 p. m.");
  });

  it("el día sale de la fecha local, sin corrimientos por huso horario", () => {
    expect(formatDay("2026-11-24")).toBe("mar 24 nov");
    expect(formatDay("2026-01-01")).toBe("jue 1 ene");
    expect(formatDay("2026-11-22T06:30:00.000Z")).toBe("dom 22 nov");
  });

  it("fecha y hora juntas usan el día de Caracas, no el de UTC", () => {
    expect(formatDateTime("2026-11-24T19:30:00.000Z")).toBe("mar 24 nov, 3:30 p. m.");
    expect(formatDateTime("2026-11-25T02:15:00.000Z")).toBe("mar 24 nov, 10:15 p. m.");
  });

  it("plurales e iniciales", () => {
    expect(plural(1, "día", "días")).toBe("1 día");
    expect(plural(5, "día", "días")).toBe("5 días");
    expect(initials("Carlos Rodríguez")).toBe("CR");
    expect(initials("  Miguel Ángel Herrera ")).toBe("MH");
    expect(initials("Ana")).toBe("A");
    expect(initials("")).toBe("");
  });
});
