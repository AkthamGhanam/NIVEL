import { createHmac, timingSafeEqual } from "node:crypto";

import type { Actor, Role } from "../actor";

/**
 * Sesión de persona en una cookie firmada (HMAC-SHA256), una por rol.
 * Una cookie por rol permite que el Modo Jurado muestre a la vez el teléfono
 * del trabajador y la web del contratista en el mismo navegador.
 * El contenido no es secreto (es un id de persona de demo), pero no se puede
 * falsificar ni alterar sin el secreto del servidor.
 */

const SESSION_HOURS = 12;
const MS_PER_HOUR = 3_600_000;
export const SESSION_MAX_AGE_SECONDS = SESSION_HOURS * 3600;

export const sessionCookieName = (role: Role): string => `nivel_${role}`;

interface SessionPayload {
  readonly actor: Actor;
  /** Vencimiento en milisegundos desde la época. */
  readonly exp: number;
}

const sign = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest("base64url");

export function encodeSession(actor: Actor, secret: string, now: Date): string {
  const payload: SessionPayload = { actor, exp: now.getTime() + SESSION_HOURS * MS_PER_HOUR };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, secret)}`;
}

function isActor(value: unknown): value is Actor {
  if (typeof value !== "object" || value === null) return false;
  const actor = value as Record<string, unknown>;
  if (actor.role === "admin") return true;
  if (actor.role === "worker") return typeof actor.workerId === "string";
  if (actor.role === "company") return typeof actor.companyId === "string";
  if (actor.role === "academy") return typeof actor.academyId === "string";
  return false;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Devuelve el actor si la firma es válida y la sesión no venció; si no, `undefined`. */
export function decodeSession(token: string | undefined, secret: string, now: Date): Actor | undefined {
  if (!token) return undefined;
  const [data, signature, ...extra] = token.split(".");
  if (!data || !signature || extra.length > 0) return undefined;
  if (!safeEqual(signature, sign(data, secret))) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (typeof payload.exp !== "number" || payload.exp <= now.getTime()) return undefined;
    return isActor(payload.actor) ? payload.actor : undefined;
  } catch {
    return undefined; // Firma válida pero contenido ilegible: se trata como sesión inexistente.
  }
}

export function parseCookies(header: string | null): ReadonlyMap<string, string> {
  const cookies = new Map<string, string>();
  for (const part of (header ?? "").split(";")) {
    const separator = part.indexOf("=");
    const name = separator > 0 ? part.slice(0, separator).trim() : "";
    if (name) cookies.set(name, part.slice(separator + 1).trim());
  }
  return cookies;
}

/** Cabecera Set-Cookie: HttpOnly siempre; Secure salvo en desarrollo local por http. */
export function sessionCookie(role: Role, token: string, secure: boolean): string {
  const attributes = [
    `${sessionCookieName(role)}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

/** Comparación en tiempo constante de un secreto compartido (clave de demo, secreto de herramientas). */
export function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const digest = (value: string) => createHmac("sha256", "nivel-compare").update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}
