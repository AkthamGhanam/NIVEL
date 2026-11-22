import { createHmac, timingSafeEqual } from "node:crypto";

import type { Actor, Role } from "../actor";
import { seal, unseal } from "./signed-token";

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

const PURPOSE = "sesion";

export function encodeSession(actor: Actor, secret: string, now: Date): string {
  return seal(actor, { purpose: PURPOSE, secret, now, ttlMs: SESSION_HOURS * MS_PER_HOUR });
}

export function isActor(value: unknown): value is Actor {
  if (typeof value !== "object" || value === null) return false;
  const actor = value as Record<string, unknown>;
  if (actor.role === "admin") return true;
  if (actor.role === "worker") return typeof actor.workerId === "string";
  if (actor.role === "company") return typeof actor.companyId === "string";
  if (actor.role === "academy") return typeof actor.academyId === "string";
  return false;
}

/** Devuelve el actor si la firma es válida y la sesión no venció; si no, `undefined`. */
export function decodeSession(token: string | undefined, secret: string, now: Date): Actor | undefined {
  const value = unseal(token, { purpose: PURPOSE, secret, now });
  return isActor(value) ? value : undefined;
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

/** Cabecera Set-Cookie que cierra la sesión de un rol en el navegador. */
export function expiredSessionCookie(role: Role, secure: boolean): string {
  const attributes = [`${sessionCookieName(role)}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

/** Comparación en tiempo constante de un secreto compartido (clave de demo, secreto de herramientas). */
export function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const digest = (value: string) => createHmac("sha256", "nivel-compare").update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}
