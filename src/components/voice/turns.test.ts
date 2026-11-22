import { describe, expect, it } from "vitest";

import { micShouldClose } from "./use-nivi";

describe("conversación por turnos con Nivi", () => {
  it("cierra el micrófono mientras Nivi habla, para que no se oiga a sí misma por el altavoz", () => {
    expect(micShouldClose({ voice: true, isSpeaking: true, paused: false })).toBe(true);
    expect(micShouldClose({ voice: true, isSpeaking: false, paused: false })).toBe(false);
  });

  it("la pausa de la persona manda siempre, y por texto no hay micrófono que cerrar", () => {
    expect(micShouldClose({ voice: true, isSpeaking: false, paused: true })).toBe(true);
    expect(micShouldClose({ voice: false, isSpeaking: true, paused: false })).toBe(false);
  });
});
