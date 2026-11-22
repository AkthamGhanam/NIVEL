// Cabeceras de seguridad de NIVEL.
const TWO_YEARS_IN_SECONDS = 63_072_000;

export const BASE_SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "Strict-Transport-Security": `max-age=${TWO_YEARS_IN_SECONDS}; includeSubDomains; preload`,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",

  "X-Frame-Options": "SAMEORIGIN",

  "Permissions-Policy":
    "microphone=(self), geolocation=(self), autoplay=(self), camera=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
});

export const API_CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'";

interface PageCspOptions {
  readonly nonce: string;
  readonly isDevelopment: boolean;
}

export const VOICE_CONNECT_SOURCES = Object.freeze([
  "https://api.elevenlabs.io",
  "wss://api.elevenlabs.io",
  "https://livekit.rtc.elevenlabs.io",
  "wss://livekit.rtc.elevenlabs.io",
]);

const NONCE_PATTERN = /^[A-Za-z0-9+/=_-]{16,}$/;

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

export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
