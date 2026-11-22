import { ForbiddenError } from "./errors";

/**
 * Quién hace la petición. Se deduce siempre en el servidor (cookie firmada
 * o secreto de servicio), nunca de un id que mande el cliente.
 */
export type Actor =
  | { readonly role: "worker"; readonly workerId: string }
  | { readonly role: "company"; readonly companyId: string }
  | { readonly role: "academy"; readonly academyId: string }
  | { readonly role: "admin" };

export type Role = Actor["role"];

/** Personas con sesión válida en un mismo navegador, una por rol. */
export type Sessions = Readonly<Partial<Record<Role, Actor>>>;

/** Denegado por defecto: exige el rol indicado y estrecha el tipo. */
export function requireRole<R extends Role>(actor: Actor, role: R): Extract<Actor, { role: R }> {
  if (actor.role !== role) throw new ForbiddenError();
  return actor as Extract<Actor, { role: R }>;
}
