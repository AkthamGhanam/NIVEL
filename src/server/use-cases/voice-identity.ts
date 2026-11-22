// Con quién habla Nivi: lo que el servidor ya sabe de quien tiene la sesión, dicho en una frase.
import { and, count, eq } from "drizzle-orm";

import { LEVEL_NAMES, type Level } from "@/lib/level";
import { shortName } from "@/lib/matching";
import { TRADE_LABELS } from "@/lib/trades";

import { AGENTS, IDENTITY_VARIABLES, UNKNOWN_PERSON } from "../agents/definitions";
import type { AppContext } from "../context";
import { companies, invitations, jobRequests, workers } from "../db/schema";
import type { ToolContext } from "../http/tool-context";

export type AgentKey = "worker" | "contractor";

export interface VoiceIdentity {
  readonly greeting: string;
  readonly person: string;
}

const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? "";

const defaultGreeting = (agent: AgentKey) =>
  AGENTS.find((candidate) => candidate.key === agent)?.firstMessage ?? "";

async function workerIdentity(context: AppContext, workerId: string): Promise<VoiceIdentity | undefined> {
  const [worker] = await context.db.select().from(workers).where(eq(workers.id, workerId));
  if (!worker) return undefined;
  const [{ pending } = { pending: 0 }] = await context.db
    .select({ pending: count() })
    .from(invitations)
    .where(and(eq(invitations.workerId, workerId), eq(invitations.status, "enviada")));
  const name = firstName(worker.name);
  const offers =
    pending === 0
      ? "No tiene ofertas pendientes."
      : pending === 1
        ? "Tiene 1 oferta pendiente por responder."
        : `Tiene ${pending} ofertas pendientes por responder.`;
  const level = worker.level as Level;
  return {
    greeting:
      pending > 0
        ? `¡Hola, ${name}! Soy Nivi. Tienes ${pending === 1 ? "una oferta de trabajo esperando. ¿Te la cuento?" : `${pending} ofertas de trabajo esperando. ¿Te las cuento?`}`
        : `¡Hola, ${name}! Soy Nivi. ¿En qué te ayudo hoy?`,
    person:
      `${shortName(worker.name)}, ya tiene perfil en NIVEL: ${TRADE_LABELS[worker.trade].singular}, ` +
      `Nivel ${level} (${LEVEL_NAMES[level]}), vive en ${worker.zone}. ` +
      `${worker.openToWork ? "Está abierto a trabajar." : "No está recibiendo invitaciones."} ${offers}`,
  };
}

async function companyIdentity(context: AppContext, companyId: string): Promise<VoiceIdentity | undefined> {
  const [company] = await context.db.select().from(companies).where(eq(companies.id, companyId));
  if (!company) return undefined;
  const [{ open } = { open: 0 }] = await context.db
    .select({ open: count() })
    .from(jobRequests)
    .where(and(eq(jobRequests.companyId, companyId), eq(jobRequests.status, "abierta")));
  return {
    greeting: `Hola, soy Nivi. Te atiendo por ${company.name}. Dime qué gente necesitas y para cuándo.`,
    person:
      `Quien habla representa a ${company.name}, ${company.verified ? "empresa verificada" : "empresa con verificación pendiente"} ` +
      `en ${company.zone}. ${open > 0 ? "Ya tiene una solicitud abierta." : "No tiene solicitudes abiertas."} ` +
      `La obra queda en ${company.zone} salvo que diga otra zona.`,
  };
}

/** Saludo y descripción de la persona para una conversación. Sin sesión, los de una persona nueva. */
export async function voiceIdentity(
  context: AppContext,
  agent: AgentKey,
  toolContext: ToolContext,
): Promise<VoiceIdentity> {
  const unknown = { greeting: defaultGreeting(agent), person: UNKNOWN_PERSON };
  if (toolContext.kind !== "actor") return unknown;
  const { actor } = toolContext;
  const known =
    actor.role === "worker"
      ? await workerIdentity(context, actor.workerId)
      : await companyIdentity(context, actor.companyId);
  return known ?? unknown;
}

/** Las variables tal como viajan a la conversación. */
export const identityVariables = (identity: VoiceIdentity): Record<string, string> => ({
  [IDENTITY_VARIABLES.greeting]: identity.greeting,
  [IDENTITY_VARIABLES.person]: identity.person,
});
