import { describe, expect, it } from "vitest";

import { passes, passingScore } from "./practical-test";

describe("prueba práctica", () => {
  it("se aprueba con 3 de cada 4 criterios, redondeando hacia arriba", () => {
    expect(passingScore(4)).toBe(3);
    expect(passingScore(10)).toBe(8);
    expect(passes(3, 4)).toBe(true);
    expect(passes(2, 4)).toBe(false);
    expect(passes(7, 10)).toBe(false);
    expect(passes(8, 10)).toBe(true);
  });
});
