import { describe, expect, it } from "vitest";

import { qrDrawing } from "./qr";

describe("código QR", () => {
  it("dibuja un cuadrado con su zona de silencio y un trazo solo de módulos de 1 × 1", () => {
    const { size, path } = qrDrawing("https://nivel.example/t");

    expect(size).toBeGreaterThanOrEqual(21 + 8);
    expect(path).toMatch(/^(M\d+ \d+h1v1h-1z)+$/);
    // Los tres localizadores de las esquinas empiezan justo después del margen.
    expect(path.startsWith("M4 4h1v1h-1z")).toBe(true);
  });

  it("el mismo enlace da siempre el mismo dibujo, y un enlace más largo ocupa más módulos", () => {
    const short = qrDrawing("https://nivel.example/t");
    const long = qrDrawing(`https://nivel.example/t?${"x".repeat(200)}`);

    expect(qrDrawing("https://nivel.example/t")).toEqual(short);
    expect(long.size).toBeGreaterThan(short.size);
  });
});
