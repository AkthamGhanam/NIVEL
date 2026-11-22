/**
 * Cabeceras de seguridad de NIVEL.
 *
 * Funciones puras: no leen el entorno ni la petición. `proxy.ts` y
 * `next.config.ts` las usan como única fuente de verdad.
 */

const TWO_YEARS_IN_SECONDS = 63_072_000;

/** Cabeceras comunes a toda respuesta (páginas, API y estáticos). */
export const BASE_SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "Strict-Transport-Security": `max-age=${TWO_YEARS_IN_SECONDS}; includeSubDomains; preload`,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // El Modo Jurado incrusta /t y /c en iframes del mismo origen; nadie más puede.
  "X-Frame-Options": "SAMEORIGIN",
  // Micrófono (agentes de voz) y GPS (entrada a la obra) solo para el propio sitio.
  "Permissions-Policy":
    "microphone=(self), geolocation=(self), autoplay=(self), camera=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
});

/** La API solo devuelve JSON: no carga nada ni puede incrustarse. */
export const API_CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'";

interface PageCspOptions {
  readonly nonce: string;
  readonly isDevelopment: boolean;
}

/**
 * Voz en vivo: el navegador habla directo con ElevenLabs (señalización de la
 * conversación y WebRTC). Es el único destino fuera de nuestro origen.
 */
export const VOICE_CONNECT_SOURCES: readonly string[] = Object.freeze([
  "https://*.elevenlabs.io",
  "wss://*.elevenlabs.io",
]);

const NONCE_PATTERN = /^[A-Za-z0-9+/=_-]{16,}$/;

/**
 * CSP estricta para páginas, basada en nonce por petición.
 * En desarrollo React necesita `unsafe-eval` para sus trazas de error.
 */
export function buildPageContentSecurityPolicy({ nonce, isDevelopment }: PageCspOptions): string {
  if (!NONCE_PATTERN.test(nonce)) {
    throw new Error("Nonce de CSP inválido: debe ser aleatorio y de al menos 16 caracteres");
  }
  const scriptSources = [`'self'`, `'nonce-${nonce}'`, `'strict-dynamic'`];
  if (isDevelopment) scriptSources.push(`'unsafe-eval'`);

  const directives: ReadonlyArray<readonly [string, string]> = [
    ["default-src", "'self'"],
    ["script-src", scriptSources.join(" ")],
    ["style-src", `'self' 'nonce-${nonce}'`],
    ["img-src", "'self' blob: data:"],
    ["font-src", "'self'"],
    ["media-src", "'self' blob:"],
    ["connect-src", ["'self'", ...VOICE_CONNECT_SOURCES].join(" ")],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'self'"],
    ["upgrade-insecure-requests", ""],
  ];
  return directives.map(([name, value]) => (value ? `${name} ${value}` : name)).join("; ");
}

/** Nonce criptográficamente aleatorio (128 bits) en base64. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
