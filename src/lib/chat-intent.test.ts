import { describe, expect, it } from "vitest";

import { readBareNumber, readIntent, readRequestHints } from "./chat-intent";

describe("entender un pedido dicho de corrido", () => {
  it("saca todos los datos de una frase completa", () => {
    expect(readRequestHints("Necesito 3 soldadores nivel 2 para el lunes, 5 días a 25 dólares")).toEqual({
      trade: "soldador",
      quantity: 3,
      minLevel: 2,
      days: 5,
      dailyPayUsd: 25,
      startPhrase: "lunes",
    });
  });

  it("entiende números en palabras, acentos y el signo de dólar, como llega una nota de voz", () => {
    expect(readRequestHints("Busco dos albañiles para mañana, tres días, pago $30 al día.")).toEqual({
      trade: "albanil",
      quantity: 2,
      days: 3,
      dailyPayUsd: 30,
      startPhrase: "manana",
    });
    expect(readRequestHints("cinco personas nivel tres pasado mañana")).toEqual({
      quantity: 5,
      minLevel: 3,
      startPhrase: "pasado manana",
    });
  });

  it("no inventa lo que no se dijo", () => {
    expect(readRequestHints("un electricista")).toEqual({ trade: "electricista", quantity: 1 });
    expect(readRequestHints("hola, ¿cómo estás?")).toEqual({});
    // "5 días" no es un pago ni una cantidad de personas.
    expect(readRequestHints("plomero por 5 días")).toEqual({ trade: "plomero", days: 5 });
  });

  it("lee el número de una respuesta corta", () => {
    expect(readBareNumber("3")).toBe(3);
    expect(readBareNumber("tres")).toBe(3);
    expect(readBareNumber("$25")).toBe(25);
    expect(readBareNumber("25 dólares")).toBe(25);
    expect(readBareNumber("unos cuantos")).toBeUndefined();
    expect(readBareNumber("necesito 3 soldadores para el lunes")).toBeUndefined();
  });
});

describe("entender qué quiere hacer la persona", () => {
  it.each([
    ["¿tengo ofertas?", "ofertas"],
    ["quiero ver mi nivel", "nivel"],
    ["acepto", "aceptar"],
    ["no me interesa", "rechazar"],
    ["la rechazo", "rechazar"],
    ["necesito gente para una obra", "pedir"],
    ["dos pintores", "pedir"],
    ["¿cómo va mi cuadrilla?", "cuadrilla"],
    ["cancela eso", "cancelar"],
    ["sí, dale", "confirmar"],
    ["buenas tardes", "menu"],
  ] as const)("%s → %s", (text, intent) => {
    expect(readIntent(text)).toBe(intent);
  });
});
