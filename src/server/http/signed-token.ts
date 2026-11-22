import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Sobre firmado (HMAC-SHA256) con vencimiento. El contenido no es secreto,
 * pero no se puede falsificar ni alterar sin el secreto del servidor.
 * El propósito entra en la firma: un sobre emitido para una cosa (sesión)
 * no vale como otra (contexto de herramientas).
 */

interface Envelope {
  readonly value: unknown;
  /** Vencimiento en milisegundos desde la época. */
  readonly exp: number;
}

export interface SealOptions {
  readonly purpose: string;
  readonly secret: string;
  readonly now: Date;
}

const sign = (data: string, { purpose, secret }: Pick<SealOptions, "purpose" | "secret">) =>
  createHmac("sha256", secret).update(`${purpose}.${data}`).digest("base64url");

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function seal(value: unknown, options: SealOptions & { readonly ttlMs: number }): string {
  const envelope: Envelope = { value, exp: options.now.getTime() + options.ttlMs };
  const data = Buffer.from(JSON.stringify(envelope)).toString("base64url");
  return `${data}.${sign(data, options)}`;
}

/** Devuelve el contenido si la firma es válida y no venció; si no, `undefined`. */
export function unseal(token: string | null | undefined, options: SealOptions): unknown {
  if (!token) return undefined;
  const [data, signature, ...extra] = token.split(".");
  if (!data || !signature || extra.length > 0) return undefined;
  if (!safeEqual(signature, sign(data, options))) return undefined;
  try {
    const envelope = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Partial<Envelope>;
    if (typeof envelope.exp !== "number" || envelope.exp <= options.now.getTime()) return undefined;
    return envelope.value;
  } catch {
    return undefined; // Firma válida pero contenido ilegible: se trata como inexistente.
  }
}
