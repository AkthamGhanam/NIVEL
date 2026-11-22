import { describe, expect, it } from "vitest";

import { parseIsoDate } from "@/lib/dates";

import { newRequestDraft, parseRequestDraft, problemsFromApi, type RequestDraft } from "./request-draft";

const TODAY = parseIsoDate("2026-11-22");
const draft = (changes: Partial<RequestDraft> = {}): RequestDraft => ({
  ...newRequestDraft("Los Guayos", TODAY),
  ...changes,
});

describe("formulario de pedir personal", () => {
  it("arranca con el pedido típico y la obra a dos días, para dar tiempo a responder", () => {
    expect(newRequestDraft("Los Guayos", TODAY)).toEqual({
      trade: "soldador",
      quantity: "3",
      minLevel: "2",
      state: "Carabobo",
      municipality: "Los Guayos",
      startDate: "2026-11-24",
      startTime: "07:00",
      endTime: "16:00",
      duration: "semana",
      dailyPayUsd: "25",
      contractType: "obra_determinada",
      notes: "",
    });
  });

  it("convierte el texto en los datos exactos que espera la API", () => {
    const result = parseRequestDraft(
      draft({ municipality: "  Los Guayos ", dailyPayUsd: "27,50", notes: " con casco " }),
      TODAY,
    );

    expect(result).toEqual({
      ok: true,
      input: {
        trade: "soldador",
        quantity: 3,
        minLevel: 2,
        zone: "Los Guayos, Carabobo",
        place: { state: "Carabobo", municipality: "Los Guayos" },
        startDate: "2026-11-24",
        days: 7,
        duration: "semana",
        hours: { from: "07:00", to: "16:00" },
        dailyPayUsd: 27.5,
        contractType: "obra_determinada",
        notes: "con casco",
      },
    });
  });

  it("sin nota no manda el campo", () => {
    const result = parseRequestDraft(draft(), TODAY);

    expect(result.ok && "notes" in result.input).toBe(false);
  });

  it("señala cada dato malo junto a su campo y no arma el pedido", () => {
    const result = parseRequestDraft(
      draft({
        quantity: "0",
        minLevel: "6",
        municipality: " ",
        startDate: "mañana",
        endTime: "07:00",
        dailyPayUsd: "-3",
        notes: "x".repeat(501),
      }),
      TODAY,
    );

    expect(result).toEqual({
      ok: false,
      problems: {
        quantity: "Escribe cuántas personas, de 1 a 50.",
        minLevel: "Elige un nivel del 1 al 5.",
        municipality: "Elige el municipio de la obra.",
        endTime: "La salida debe ser a otra hora que la entrada.",
        startDate: "Elige el día en que empieza la obra.",
        dailyPayUsd: "Escribe el pago diario en dólares, por ejemplo 25.",
        notes: "La nota es demasiado larga.",
      },
    });
  });

  it.each([
    ["51", "quantity"],
    ["1001", "dailyPayUsd"],
    ["0", "dailyPayUsd"],
    ["25.999", "dailyPayUsd"],
    ["3e2", "quantity"],
  ] as const)("rechaza %s en %s", (value, field) => {
    const result = parseRequestDraft(draft({ [field]: value }), TODAY);

    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.problems)).toEqual([field]);
  });

  it("no acepta una obra que empieza en el pasado, pero sí hoy", () => {
    const past = parseRequestDraft(draft({ startDate: "2026-11-21" }), TODAY);

    expect(!past.ok && past.problems.startDate).toBe("La obra no puede empezar en una fecha pasada.");
    expect(parseRequestDraft(draft({ startDate: TODAY }), TODAY).ok).toBe(true);
  });

  it("reparte los problemas que devuelve la API e ignora campos que el formulario no tiene", () => {
    expect(
      problemsFromApi([
        { field: "municipality", problem: "Muy corta" },
        { field: "companyId", problem: "No se acepta" },
      ]),
    ).toEqual({ municipality: "Muy corta" });
  });

  it("los días salen del tiempo que se quiere contratar; menos de 3 meses lleva prestaciones de 5 días por mes", () => {
    const month = parseRequestDraft(draft({ duration: "mes" }), TODAY);
    const forever = parseRequestDraft(draft({ duration: "indefinido" }), TODAY);

    expect(month.ok && month.input.days).toBe(30);
    expect(forever.ok && forever.input.days).toBe(90);
  });
});
