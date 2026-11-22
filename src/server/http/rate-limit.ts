/**
 * Límite de peticiones en memoria, por ventana fija. Es por proceso: en un
 * despliegue serverless cada instancia lleva su propia cuenta, así que frena
 * abusos y fuerza bruta pero no es un contador exacto global.
 */

export interface RateRule {
  readonly limit: number;
  readonly windowSeconds: number;
}

export interface RateLimiter {
  /** Cuenta un intento. Devuelve 0 si pasa, o los segundos que debe esperar si excede el límite. */
  readonly hit: (key: string, rule: RateRule, now: Date) => number;
  /** Segundos de espera vigentes para la clave, sin contar un intento nuevo. */
  readonly blockedFor: (key: string, rule: RateRule, now: Date) => number;
}

interface Window {
  readonly startedAt: number;
  readonly count: number;
}

const DEFAULT_MAX_KEYS = 10_000;
const MS_PER_SECOND = 1000;

export function createRateLimiter(maxKeys: number = DEFAULT_MAX_KEYS): RateLimiter {
  const windows = new Map<string, Window>();

  const current = (key: string, rule: RateRule, nowMs: number): Window | undefined => {
    const window = windows.get(key);
    return window && nowMs - window.startedAt < rule.windowSeconds * MS_PER_SECOND ? window : undefined;
  };

  const retryAfter = (window: Window, rule: RateRule, nowMs: number): number =>
    Math.max(1, Math.ceil((window.startedAt + rule.windowSeconds * MS_PER_SECOND - nowMs) / MS_PER_SECOND));

  /** Al llenarse se descarta la clave menos reciente, nunca todas: un atacante no puede borrar los bloqueos. */
  const remember = (key: string, window: Window): void => {
    windows.delete(key);
    windows.set(key, window);
    if (windows.size <= maxKeys) return;
    const oldest = windows.keys().next().value;
    if (oldest !== undefined) windows.delete(oldest);
  };

  return {
    hit(key, rule, now) {
      const nowMs = now.getTime();
      const window = current(key, rule, nowMs) ?? { startedAt: nowMs, count: 0 };
      const next = { startedAt: window.startedAt, count: window.count + 1 };
      remember(key, next);
      return next.count > rule.limit ? retryAfter(next, rule, nowMs) : 0;
    },
    blockedFor(key, rule, now) {
      const nowMs = now.getTime();
      const window = current(key, rule, nowMs);
      return window && window.count >= rule.limit ? retryAfter(window, rule, nowMs) : 0;
    },
  };
}
