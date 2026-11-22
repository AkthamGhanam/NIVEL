import { describe, expect, it } from "vitest";

import type { Actor } from "../actor";
import { decodeSession, encodeSession, parseCookies, secretMatches, sessionCookie } from "./session";

const SECRET = "un-secreto-de-pruebas-de-32-chars!!";
const NOW = new Date("2026-11-22T06:30:00Z");
const CARLOS: Actor = { role: "worker", workerId: "w-carlos" };

describe("sesión firmada", () => {
  it("recupera el actor con la firma correcta", () => {
    const token = encodeSession(CARLOS, SECRET, NOW);

    expect(decodeSession(token, SECRET, NOW)).toEqual(CARLOS);
  });

  it("rechaza un token firmado con otro secreto", () => {
    const token = encodeSession(CARLOS, "otro-secreto-distinto-de-32-chars!!", NOW);

    expect(decodeSession(token, SECRET, NOW)).toBeUndefined();
  });

  it("rechaza un contenido alterado para suplantar a otra persona", () => {
    const [, signature] = encodeSession(CARLOS, SECRET, NOW).split(".");
    const forged = Buffer.from(
      JSON.stringify({ actor: { role: "admin" }, exp: NOW.getTime() + 1_000_000 }),
    ).toString("base64url");

    expect(decodeSession(`${forged}.${signature}`, SECRET, NOW)).toBeUndefined();
  });

  it("vence a las 12 horas", () => {
    const token = encodeSession(CARLOS, SECRET, NOW);
    const almostTwelveHoursLater = new Date(NOW.getTime() + 12 * 3_600_000 - 1);
    const twelveHoursLater = new Date(NOW.getTime() + 12 * 3_600_000);

    expect(decodeSession(token, SECRET, almostTwelveHoursLater)).toEqual(CARLOS);
    expect(decodeSession(token, SECRET, twelveHoursLater)).toBeUndefined();
  });

  it.each([undefined, "", "sin-punto", "a.b.c", ".", "x."])("rechaza el token mal formado %j", (token) => {
    expect(decodeSession(token, SECRET, NOW)).toBeUndefined();
  });

  it("rechaza un actor con forma inválida aunque la firma sea correcta", () => {
    const token = encodeSession({ role: "worker" } as unknown as Actor, SECRET, NOW);

    expect(decodeSession(token, SECRET, NOW)).toBeUndefined();
  });
});

describe("cookies", () => {
  it("lee varias cookies e ignora fragmentos sin valor", () => {
    const cookies = parseCookies("nivel_worker=abc.def; otro = 1 ; roto; =x");

    expect(cookies.get("nivel_worker")).toBe("abc.def");
    expect(cookies.get("otro")).toBe("1");
    expect(cookies.size).toBe(2);
    expect(parseCookies(null).size).toBe(0);
  });

  it("emite la cookie HttpOnly, SameSite=Lax y Secure en producción", () => {
    const production = sessionCookie("worker", "t", true);
    const local = sessionCookie("worker", "t", false);

    expect(production).toBe("nivel_worker=t; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200; Secure");
    expect(local).not.toContain("Secure");
  });
});

describe("secretMatches", () => {
  it("acepta solo el secreto exacto", () => {
    expect(secretMatches(SECRET, SECRET)).toBe(true);
    expect(secretMatches(`${SECRET}x`, SECRET)).toBe(false);
    expect(secretMatches("", SECRET)).toBe(false);
    expect(secretMatches(null, SECRET)).toBe(false);
  });
});
