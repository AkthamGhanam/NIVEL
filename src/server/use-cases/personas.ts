import { and, asc, eq, isNull } from "drizzle-orm";

import type { Actor, Sessions } from "../actor";
import type { AppContext } from "../context";
import { academies, companies, workers } from "../db/schema";
import { ForbiddenError, NotFoundError } from "../errors";
import { isDemoFlagOn } from "./demo-state";

/**
 * Selector de persona de la demo. Solo se puede entrar como un personaje de
 * ejemplo del seed: nunca como una persona real registrada en el evento.
 */

export type PersonaRole = "worker" | "company" | "academy";

export interface PersonaChoice {
  readonly role: PersonaRole;
  readonly id: string;
}

export interface DemoState {
  readonly personas: {
    readonly workers: ReadonlyArray<{ id: string; name: string; trade: string; level: number; zone: string }>;
    readonly companies: ReadonlyArray<{ id: string; name: string; zone: string }>;
    readonly academies: ReadonlyArray<{ id: string; name: string }>;
  };
  /** Con qué persona está abierta cada vista en este navegador. */
  readonly active: {
    readonly workerId: string | null;
    readonly companyId: string | null;
    readonly academyId: string | null;
    readonly admin: boolean;
  };
  readonly flags: { readonly bot: boolean; readonly simulation: boolean };
}

export async function getDemoState(context: AppContext, sessions: Sessions): Promise<DemoState> {
  const [workerRows, companyRows, academyRows, bot, simulation] = await Promise.all([
    context.db
      .select({
        id: workers.id,
        name: workers.name,
        trade: workers.trade,
        level: workers.level,
        zone: workers.zone,
      })
      .from(workers)
      .where(and(eq(workers.isReal, false), isNull(workers.deletedAt)))
      .orderBy(asc(workers.id)),
    context.db
      .select({ id: companies.id, name: companies.name, zone: companies.zone })
      .from(companies)
      .orderBy(asc(companies.id)),
    context.db.select({ id: academies.id, name: academies.name }).from(academies).orderBy(asc(academies.id)),
    isDemoFlagOn(context, "bot"),
    isDemoFlagOn(context, "simulation"),
  ]);
  const { worker, company, academy, admin } = sessions;
  return {
    personas: { workers: workerRows, companies: companyRows, academies: academyRows },
    active: {
      workerId: worker?.role === "worker" ? worker.workerId : null,
      companyId: company?.role === "company" ? company.companyId : null,
      academyId: academy?.role === "academy" ? academy.academyId : null,
      admin: admin !== undefined,
    },
    flags: { bot, simulation },
  };
}

async function seedWorker(context: AppContext, id: string): Promise<Actor> {
  const [worker] = await context.db
    .select({ id: workers.id, isReal: workers.isReal })
    .from(workers)
    .where(and(eq(workers.id, id), isNull(workers.deletedAt)));
  if (!worker) throw new NotFoundError("esa persona");
  if (worker.isReal) throw new ForbiddenError("No se puede entrar como una persona real.");
  return { role: "worker", workerId: worker.id };
}

/** Convierte la elección del selector en un actor, tras comprobar que el personaje existe. */
export async function resolvePersona(context: AppContext, choice: PersonaChoice): Promise<Actor> {
  if (choice.role === "worker") return seedWorker(context, choice.id);
  if (choice.role === "company") {
    const [company] = await context.db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, choice.id));
    if (!company) throw new NotFoundError("esa empresa");
    return { role: "company", companyId: company.id };
  }
  const [academy] = await context.db
    .select({ id: academies.id })
    .from(academies)
    .where(eq(academies.id, choice.id));
  if (!academy) throw new NotFoundError("esa academia");
  return { role: "academy", academyId: academy.id };
}
