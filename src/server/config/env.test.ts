import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { ConfigError, parseServerEnv, requireEnv, serverEnv } = await import("./env");

const STRONG_SECRET = "x".repeat(32);

describe("parseServerEnv", () => {
  it("arranca sin variables opcionales", () => {
    const env = parseServerEnv({});

    expect(env.NODE_ENV).toBe("development");
    expect(env.TOOL_SECRET).toBeUndefined();
  });

  it("trata las variables vacías como ausentes", () => {
    const env = parseServerEnv({ ELEVENLABS_API_KEY: "" });

    expect(env.ELEVENLABS_API_KEY).toBeUndefined();
  });

  it("rechaza secretos cortos sin revelar su valor", () => {
    const weakSecret = "corto-y-secreto";

    const parse = () => parseServerEnv({ TOOL_SECRET: weakSecret });

    expect(parse).toThrow(ConfigError);
    expect(parse).toThrow(/TOOL_SECRET/);
    expect(parse).not.toThrow(new RegExp(weakSecret));
  });

  it.each(["postgres://db", "localhost:8080", "javascript:alert(1)"])(
    "rechaza una URL de base de datos no soportada: %s",
    (url) => {
      expect(() => parseServerEnv({ TURSO_DATABASE_URL: url })).toThrow(/TURSO_DATABASE_URL/);
    },
  );

  it.each(["file:local.db", "libsql://nivel.turso.io", "https://nivel.turso.io"])(
    "acepta la URL de base de datos %s",
    (url) => {
      expect(parseServerEnv({ TURSO_DATABASE_URL: url }).TURSO_DATABASE_URL).toBe(url);
    },
  );

  it("rechaza una URL pública que no sea http(s)", () => {
    expect(() => parseServerEnv({ NEXT_PUBLIC_APP_URL: "ftp://nivel.app" })).toThrow(/NEXT_PUBLIC_APP_URL/);
  });
});

describe("requireEnv", () => {
  it("devuelve la variable cuando existe", () => {
    const env = parseServerEnv({ TOOL_SECRET: STRONG_SECRET });

    expect(requireEnv("TOOL_SECRET", env)).toBe(STRONG_SECRET);
  });

  it("falla con el nombre de la variable cuando falta", () => {
    const env = parseServerEnv({});

    expect(() => requireEnv("ELEVENLABS_API_KEY", env)).toThrow(
      "Falta la variable de entorno ELEVENLABS_API_KEY",
    );
  });
});

describe("serverEnv", () => {
  it("lee process.env una sola vez y reutiliza el resultado", () => {
    const first = serverEnv();

    expect(first.NODE_ENV).toBe("test");
    expect(serverEnv()).toBe(first);
  });

  it("de TOOL_SECRET solo cuenta la primera palabra, aunque se haya pegado texto de más", () => {
    const clean = "a".repeat(40);
    const env = parseServerEnv({ TOOL_SECRET: ` ${clean}\nOTRA_VARIABLE=valor ` });

    expect(env.TOOL_SECRET).toBe(clean);
    expect(() => parseServerEnv({ TOOL_SECRET: "corta\nOTRA=valor" })).toThrow(/TOOL_SECRET/);
  });
});
