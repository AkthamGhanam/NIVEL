import { and, desc, eq, inArray } from "drizzle-orm";

import { type IsoDate, resolveStartDate } from "@/lib/dates";
import { ensure } from "@/lib/errors";
import { estimateLegalCost, type LegalCostEstimate } from "@/lib/legal-cost";
import type { Level } from "@/lib/level";
import { type PublicCandidate, rankCandidates } from "@/lib/matching";
import { moderateJobText } from "@/lib/moderation";
import { hiringFeeRange, type PriceWithIva } from "@/lib/pricing";
import { type ContractType, type Trade, tradeCount } from "@/lib/trades";

import { type Actor, requireRole } from "../actor";
import type { AppContext } from "../context";
import { companies, invitations, jobRequests } from "../db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors";
import { loadWorkerFacts, toCandidate } from "../repos/worker-facts";
import { type CrewMember, loadCrew } from "./crew";
import { runDemoBot } from "./demo-bot";
import { logEvent } from "./events";

export interface NewJobRequest {
  readonly trade: Trade;
  readonly quantity: number;
  readonly minLevel: Level;
  readonly zone: string;
  /** "YYYY-MM-DD" o texto como "el martes". */
  readonly startDate: string;
  readonly days: number;
  readonly dailyPayUsd: number;
  readonly contractType: ContractType;
  /** Texto libre opcional de la vacante; pasa por moderación. */
  readonly notes?: string | undefined;
  readonly createdVia: "voz" | "web";
}

export type JobRequestRow = typeof jobRequests.$inferSelect;
export type InvitationRow = typeof invitations.$inferSelect;

export interface CandidateSearch {
  readonly matching: number;
  readonly candidates: readonly PublicCandidate[];
  readonly legalCost: LegalCostEstimate;
  /** Tarifa de NIVEL por contratación, de la más baja a la más alta según el nivel. Nulo si nadie cumple. */
  readonly feeRange: { readonly min: PriceWithIva; readonly max: PriceWithIva } | null;
}

export interface JobRequestCreated extends CandidateSearch {
  readonly request: JobRequestRow;
}

const MAX_INVITATIONS_PER_CALL = 10;

async function findCandidates(context: AppContext, request: JobRequestRow): Promise<CandidateSearch> {
  const facts = await loadWorkerFacts(context.db, { trade: request.trade, shareableOnly: true });
  const ranked = rankCandidates(
    facts.map((worker) => toCandidate(worker, request.id)),
    {
      trade: request.trade,
      minLevel: request.minLevel as Level,
      site: { lat: request.lat, lng: request.lng },
      startDate: request.startDate as IsoDate,
      days: request.days,
    },
  );
  const candidates = ranked.map((entry) => entry.candidate);
  const levels = candidates.map((candidate) => candidate.level);
  return {
    matching: candidates.length,
    candidates,
    legalCost: estimateLegalCost({
      dailyPayUsd: request.dailyPayUsd,
      days: request.days,
      quantity: request.quantity,
    }),
    feeRange:
      levels.length === 0 ? null : hiringFeeRange(Math.min(...levels) as Level, Math.max(...levels) as Level),
  };
}

function assertAllowedText(input: NewJobRequest): void {
  const moderation = moderateJobText(`${input.zone} ${input.notes ?? ""}`);
  const [firstViolation] = moderation.violations;
  ensure(firstViolation === undefined, firstViolation?.explanation ?? "");
}

/** Publica una solicitud de cuadrilla y devuelve los candidatos que cumplen. */
export async function createJobRequest(
  context: AppContext,
  actor: Actor,
  input: NewJobRequest,
): Promise<JobRequestCreated> {
  const { companyId } = requireRole(actor, "company");
  assertAllowedText(input);
  const now = context.now();
  const [company] = await context.db.select().from(companies).where(eq(companies.id, companyId));
  if (!company) throw new NotFoundError("la empresa");
  const row = {
    id: context.newId("jr"),
    companyId,
    trade: input.trade,
    quantity: input.quantity,
    minLevel: input.minLevel,
    zone: input.zone.trim(),
    // La obra de la demo está en la sede de la empresa activa.
    lat: company.lat,
    lng: company.lng,
    startDate: resolveStartDate(input.startDate, now),
    days: input.days,
    dailyPayUsd: input.dailyPayUsd,
    contractType: input.contractType,
    status: "abierta" as const,
    createdVia: input.createdVia,
    createdAt: now.toISOString(),
  };
  // Valida montos y rangos antes de escribir nada.
  estimateLegalCost({ dailyPayUsd: row.dailyPayUsd, days: row.days, quantity: row.quantity });
  const [request] = await context.db.insert(jobRequests).values(row).returning();
  if (!request) throw new Error("La solicitud no se guardó");
  const search = await findCandidates(context, request);
  await logEvent(context, {
    actor: company.name,
    type: "solicitud_creada",
    label: `Solicitud: ${tradeCount(request.trade, request.quantity)} · ${search.matching} cumplen`,
    detail: { requestId: request.id, matching: search.matching },
  });
  return { request, ...search };
}

export async function loadOwnRequest(
  context: AppContext,
  actor: Actor,
  requestId: string,
): Promise<JobRequestRow> {
  const [request] = await context.db.select().from(jobRequests).where(eq(jobRequests.id, requestId));
  if (!request) throw new NotFoundError("la solicitud");
  if (actor.role !== "admin" && !(actor.role === "company" && actor.companyId === request.companyId)) {
    throw new ForbiddenError();
  }
  return request;
}

export interface InvitationSent {
  readonly invitation: InvitationRow;
  readonly candidate: PublicCandidate;
}

/**
 * A quién invitar: los siguientes N mejores, o las personas que eligió la
 * empresa (siempre entre las que cumplen y aún no fueron invitadas).
 */
export type InviteChoice =
  | { readonly requestId: string; readonly quantity: number }
  | { readonly requestId: string; readonly workerIds: readonly string[] };

const INVITE_RANGE = `Puedes invitar entre 1 y ${MAX_INVITATIONS_PER_CALL} personas a la vez`;

function pickInvitees(available: readonly PublicCandidate[], input: InviteChoice): PublicCandidate[] {
  if ("quantity" in input) return available.slice(0, input.quantity);
  const chosen = new Set(input.workerIds);
  const picked = available.filter((candidate) => chosen.has(candidate.workerId));
  ensure(picked.length === chosen.size, "Alguna de esas personas ya no está disponible o ya fue invitada.");
  return picked;
}

/** Invita a las personas elegidas, o a los siguientes N mejores que aún no fueron invitados. */
export async function inviteCandidates(
  context: AppContext,
  actor: Actor,
  input: InviteChoice,
): Promise<InvitationSent[]> {
  const count = "quantity" in input ? input.quantity : new Set(input.workerIds).size;
  ensure(Number.isInteger(count) && count >= 1 && count <= MAX_INVITATIONS_PER_CALL, INVITE_RANGE);
  const request = await loadOwnRequest(context, actor, input.requestId);
  if (request.status !== "abierta")
    throw new ConflictError("La cuadrilla de esta solicitud ya está completa.");
  const [search, alreadyInvited] = await Promise.all([
    findCandidates(context, request),
    context.db
      .select({ workerId: invitations.workerId })
      .from(invitations)
      .where(eq(invitations.requestId, request.id)),
  ]);
  const invitedIds = new Set(alreadyInvited.map((row) => row.workerId));
  const next = pickInvitees(
    search.candidates.filter((candidate) => !invitedIds.has(candidate.workerId)),
    input,
  );
  if (next.length === 0) return [];
  const createdAt = context.now().toISOString();
  const rows = next.map((candidate) => ({
    id: context.newId("in"),
    requestId: request.id,
    workerId: candidate.workerId,
    status: "enviada" as const,
    channel: "app" as const,
    createdAt,
  }));
  const inserted = await context.db.insert(invitations).values(rows).returning();
  await logEvent(context, {
    actor: "NIVEL",
    type: "invitaciones_enviadas",
    label: `Invitaciones enviadas: ${next.map((candidate) => candidate.shortName).join(", ")}`,
    detail: { requestId: request.id, count: inserted.length },
  });
  return inserted.map((invitation) => ({
    invitation,
    candidate: next.find((candidate) => candidate.workerId === invitation.workerId) as PublicCandidate,
  }));
}

export interface RequestBoard extends CandidateSearch {
  readonly request: JobRequestRow;
  readonly invitations: ReadonlyArray<{
    readonly id: string;
    readonly status: InvitationRow["status"];
    readonly candidate: PublicCandidate | undefined;
  }>;
  readonly accepted: number;
  /** Personas ya contratadas: firma, asistencia y pago de cada una. */
  readonly crew: readonly CrewMember[];
  /** Mejor candidato aún no invitado, si alguien rechazó y falta gente. */
  readonly suggestedReplacement: PublicCandidate | null;
}

/** Tablero en vivo de la solicitud más reciente de la empresa (lo consulta `/c` por polling). */
export async function activeRequestBoard(context: AppContext, actor: Actor): Promise<RequestBoard | null> {
  const { companyId } = requireRole(actor, "company");
  const [request] = await context.db
    .select()
    .from(jobRequests)
    .where(and(eq(jobRequests.companyId, companyId), inArray(jobRequests.status, ["abierta", "completa"])))
    .orderBy(desc(jobRequests.createdAt))
    .limit(1);
  if (!request) return null;
  await runDemoBot(context, request.id);
  const [search, sent, crew] = await Promise.all([
    findCandidates(context, request),
    context.db.select().from(invitations).where(eq(invitations.requestId, request.id)),
    loadCrew(context, request.id),
  ]);
  const byWorker = new Map(search.candidates.map((candidate) => [candidate.workerId, candidate]));
  const invitedIds = new Set(sent.map((invitation) => invitation.workerId));
  const accepted = sent.filter((invitation) => invitation.status === "aceptada").length;
  const pending = sent.filter((invitation) => invitation.status === "enviada").length;
  // Solo hay "reemplazo" si alguien rechazó: si la empresa invitó a menos personas de las que
  // necesita por elección propia, la lista de candidatos ya le ofrece a quién más invitar.
  const someoneDeclined = sent.some((invitation) => invitation.status === "rechazada");
  const needsReplacement = accepted + pending < request.quantity && someoneDeclined;
  return {
    request,
    ...search,
    invitations: sent.map((invitation) => ({
      id: invitation.id,
      status: invitation.status,
      candidate: byWorker.get(invitation.workerId),
    })),
    accepted,
    crew,
    suggestedReplacement: needsReplacement
      ? (search.candidates.find((candidate) => !invitedIds.has(candidate.workerId)) ?? null)
      : null,
  };
}
