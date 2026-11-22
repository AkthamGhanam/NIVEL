import { describe, expect, it } from "vitest";

import { scriptEnv } from "./env";

describe("scriptEnv", () => {
  it("devuelve la variable válida", () => {
    expect(scriptEnv("NEXT_PUBLIC_APP_URL", { NEXT_PUBLIC_APP_URL: "https://nivel.example" })).toBe(
      "https://nivel.example",
    );
    expect(scriptEnv("EL_VOICE_ID", { EL_VOICE_ID: " voz " })).toBe("voz");
  });

  it("falla con el nombre de la variable y nunca con su valor", () => {
    const secret = "corto-y-secreto";

    expect(() => scriptEnv("TOOL_SECRET", {})).toThrow("Falta la variable de entorno TOOL_SECRET");
    expect(() => scriptEnv("TOOL_SECRET", { TOOL_SECRET: secret })).toThrow(/TOOL_SECRET: debe tener/);
    expect(() => scriptEnv("TOOL_SECRET", { TOOL_SECRET: secret })).not.toThrow(secret);
    // Los agentes llaman a la app desde internet: localhost o http no sirven.
    expect(() => scriptEnv("NEXT_PUBLIC_APP_URL", { NEXT_PUBLIC_APP_URL: "http://localhost:3000" })).toThrow(
      /https/,
    );
  });
});
