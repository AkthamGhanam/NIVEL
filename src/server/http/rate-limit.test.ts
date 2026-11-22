import { describe, expect, it } from "vitest";

import { createRateLimiter } from "./rate-limit";

const RULE = { limit: 3, windowSeconds: 60 };
const at = (seconds: number) => new Date(Date.UTC(2026, 10, 22, 12, 0, seconds));

describe("createRateLimiter", () => {
  it("deja pasar hasta el límite y luego dice cuánto esperar", () => {
    const limiter = createRateLimiter();

    expect([0, 1, 2].map((second) => limiter.hit("ip", RULE, at(second)))).toEqual([0, 0, 0]);
    expect(limiter.hit("ip", RULE, at(10))).toBe(50);
    expect(limiter.hit("otra-ip", RULE, at(10))).toBe(0);
  });

  it("abre una ventana nueva cuando vence la anterior", () => {
    const limiter = createRateLimiter();
    for (let attempt = 0; attempt < 5; attempt += 1) limiter.hit("ip", RULE, at(0));

    expect(limiter.hit("ip", RULE, at(59))).toBe(1);
    expect(limiter.hit("ip", RULE, at(60))).toBe(0);
  });

  it("blockedFor avisa del bloqueo sin contar un intento", () => {
    const limiter = createRateLimiter();

    expect(limiter.blockedFor("ip", RULE, at(0))).toBe(0);
    for (let attempt = 0; attempt < 3; attempt += 1) limiter.hit("ip", RULE, at(0));

    expect(limiter.blockedFor("ip", RULE, at(30))).toBe(30);
    expect(limiter.blockedFor("ip", RULE, at(61))).toBe(0);
  });

  it("al llenarse descarta solo la clave menos reciente: el bloqueo de un atacante activo sigue en pie", () => {
    const limiter = createRateLimiter(3);
    for (let attempt = 0; attempt < 3; attempt += 1) limiter.hit("vieja", RULE, at(0));
    for (let attempt = 0; attempt < 3; attempt += 1) limiter.hit("atacante", RULE, at(1));
    limiter.hit("vieja", RULE, at(2));
    limiter.hit("relleno-1", RULE, at(3));
    limiter.hit("atacante", RULE, at(4));
    limiter.hit("relleno-2", RULE, at(5));
    limiter.hit("relleno-3", RULE, at(6));

    expect(limiter.blockedFor("atacante", RULE, at(7))).toBeGreaterThan(0);
    expect(limiter.blockedFor("vieja", RULE, at(7))).toBe(0);
  });
});
