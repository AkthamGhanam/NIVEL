import { describe, expect, it } from "vitest";

import {
  API_CONTENT_SECURITY_POLICY,
  BASE_SECURITY_HEADERS,
  buildPageContentSecurityPolicy,
  createNonce,
} from "./security-headers";

const VALID_NONCE = "c29tZS1yYW5kb20tbm9uY2U=";

describe("buildPageContentSecurityPolicy", () => {
  it("permite scripts solo con el nonce de la petición", () => {
    const csp = buildPageContentSecurityPolicy({ nonce: VALID_NONCE, isDevelopment: false });

    expect(csp).toContain(`script-src 'self' 'nonce-${VALID_NONCE}' 'strict-dynamic'`);
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("solo deja incrustar la página en el mismo origen y bloquea plugins", () => {
    const csp = buildPageContentSecurityPolicy({ nonce: VALID_NONCE, isDevelopment: false });

    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("añade unsafe-eval únicamente en desarrollo", () => {
    const csp = buildPageContentSecurityPolicy({ nonce: VALID_NONCE, isDevelopment: true });

    expect(csp).toContain("'unsafe-eval'");
  });

  it.each(["", "corto", "con espacios y ; punto y coma", "'nonce-inyectado'"])(
    "rechaza un nonce inválido: %j",
    (nonce) => {
      expect(() => buildPageContentSecurityPolicy({ nonce, isDevelopment: false })).toThrow(
        /Nonce de CSP inválido/,
      );
    },
  );
});

describe("createNonce", () => {
  it("genera nonces válidos y distintos en cada llamada", () => {
    const first = createNonce();
    const second = createNonce();

    expect(first).not.toBe(second);
    expect(() => buildPageContentSecurityPolicy({ nonce: first, isDevelopment: false })).not.toThrow();
  });
});

describe("cabeceras fijas", () => {
  it("la API no carga recursos ni se puede incrustar", () => {
    expect(API_CONTENT_SECURITY_POLICY).toBe("default-src 'none'; frame-ancestors 'none'");
  });

  it("activa HSTS, nosniff y restringe micrófono y GPS al propio sitio", () => {
    expect(BASE_SECURITY_HEADERS["Strict-Transport-Security"]).toMatch(/max-age=\d{8}/);
    expect(BASE_SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(BASE_SECURITY_HEADERS["Permissions-Policy"]).toContain("microphone=(self)");
    expect(BASE_SECURITY_HEADERS["Permissions-Policy"]).toContain("camera=()");
  });

  it("es inmutable", () => {
    expect(Object.isFrozen(BASE_SECURITY_HEADERS)).toBe(true);
  });
});
