// Solicitudes de personal: crear, buscar candidatos, invitar y tablero en vivo.
import { and, desc, eq, inArray } from "drizzle-orm";

import { type IsoDate, resolveStartDate } from "@/lib/dates";
import { ensure } from "@/lib/errors";
import { assertValidPoint, type GeoFix, SITE_PIN_MAX_ACCURACY_M } from "@/lib/geo";
import { estimateLegalCost, type LegalCostEstimate } from "@/lib/legal-cost";
import { durationOf, type HireDuration } from "@/lib/profile-options";
import type { Level } from "@/lib/level";
import { type PublicCandidate, rankCandidates } from "@/lib/matching";
import { moderateJobText } from "@/lib/moderation";
import { hiringFeeRange, type PriceWithIva } from "@/lib/pricing";
import { formatDay, formatUsd, plural } from "@/lib/format";
import { type ContractType, TRADE_LABELS, type Trade, tradeCount } from "@/lib/trades";
import { cleanPlace, describePlace, findPlace, type Place } from "@/lib/venezuela";

import { type Actor, requireRole } from "../actor";
import type { AppContext } from "../context";
import { companies, invitations, jobRequests } from "../db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors";
import { loadWorkerFacts, toCandidate } from "../repos/worker-facts";
import { type CrewMember, loadCrew } from "./crew";
import { runDemoBot } from "./demo-bot";
import { logEvent } from "./events";
import { notifyByTelegram, openAppButton } from "./telegram-notify";

export interface NewJobRequest {
  readonly trade: Trade;
  readonly quantity: number;
  readonly minLevel: Level;
  readonly zone: string;
  /** Estado y municipio elegidos de la lista; la zona se escribe con ellos. */
  readonly place?: Place | undefined;

  readonly startDate: string;
  readonly days: number;
  /** Cuánto tiempo quiere contratar; si viene, manda sobre `days`. */
  readonly duration?: HireDuration | undefined;
  /** Horario, "07:00" a "16:00". */
  readonly hours?: { readonly from: string; readonly to: string } | undefined;
  readonly dailyPayUsd: number;
  readonly contractType: ContractType;

  readonly notes?: string | undefined;
  /** Punto exacto de la obra, tomado de la ubicación del contratista. Sin él se usa el de su sede. */
  readonly site?: GeoFix | undefined;
  readonly createdVia: "voz" | "web";
}

export type JobRequestRow = typeof jobRequests.$inferSelect;
export type InvitationRow = typeof invitations.$inferSelect;

export interface CandidateSearch {
  readonly matching: number;
  readonly candidates: readonly PublicCandidate[];
  readonly legalCost: LegalCostEstimate;

  readonly feeRange: { readonly min: PriceWithIva; readonly max: PriceWithIva } | null;
}

export interface JobRequestCreated extends CandidateSearch {
  readonly request: JobRequestRow;
}

const MAX_INVITATIONS_PER_CALL = 10;

/** El lugar de la obra: el que se eligió de la lista o, en pedidos viejos y por voz, el que se reconoce en la zona. */
function placeSearch(request: JobRequestRow): { place?: Place } {
  if (request.state) {
    return {
      place: request.municipality
        ? { state: request.state, municipality: request.municipality }
        : { state: request.state },
    };
  }
  const place = findPlace(request.zone);
  return place ? { place } : {};
}

async function findCandidates(context: AppContext, request: JobRequestRow): Promise<CandidateSearch> {
  const facts = await loadWorkerFacts(context.db, { trade: request.trade, shareableOnly: true });
  const ranked = rankCandidates(
    facts.map((worker) => toCandidate(worker, request.id)),
    {
      trade: request.trade,
      minLevel: request.minLevel as Level,
      site: { lat: request.lat, lng: request.lng },
      ...placeSearch(request),
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

const WEAK_PIN =
  "La señal de ubicación está débil. Sal a un lugar abierto, espera unos segundos y vuelve a intentar.";

/** Una obra solo se fija con una lectura de GPS buena: con ella se verifica después cada llegada. */
function assertGoodPin(site: GeoFix): void {
  assertValidPoint(site);
  ensure(site.accuracyM === undefined || site.accuracyM <= SITE_PIN_MAX_ACCURACY_M, WEAK_PIN);
}

function assertAllowedText(input: NewJobRequest): void {
  const moderation = moderateJobText(`${input.zone} ${input.notes ?? ""}`);
  const [firstViolation] = moderation.violations;
  ensure(firstViolation === undefined, firstViolation?.explanation ?? "");
}

export async function createJobRequest(
  context: AppContext,
  actor: Actor,
  input: NewJobRequest,
): Promise<JobRequestCreated> {
  const { companyId } = requireRole(actor, "company");
  assertAllowedText(input);
  if (input.site) assertGoodPin(input.site);
  const now = context.now();
  const [company] = await context.db.select().from(companies).where(eq(companies.id, companyId));
  if (!company) throw new NotFoundError("la empresa");
  const chosen = input.place ? cleanPlace(input.place) : undefined;
  ensure(!input.place || chosen !== undefined, "Elige el estado y el municipio de la obra de la lista.");
  const place = chosen ?? findPlace(input.zone);
  const days = input.duration ? durationOf(input.duration).days : input.days;
  const row = {
    id: context.newId("jr"),
    companyId,
    trade: input.trade,
    quantity: input.quantity,
    minLevel: input.minLevel,
    zone: chosen ? describePlace(chosen) : input.zone.trim(),
    state: place?.state ?? null,
    municipality: place?.municipality ?? null,
    durationKey: input.duration ?? null,
    startTime: input.hours?.from ?? null,
    endTime: input.hours?.to ?? null,

    lat: input.site?.lat ?? company.lat,
    lng: input.site?.lng ?? company.lng,
    sitePinnedAt: input.site ? now.toISOString() : null,
    startDate: resolveStartDate(input.startDate, now),
    days,
    dailyPayUsd: input.dailyPayUsd,
    contractType: input.contractType,
    status: "abierta" as const,
    createdVia: input.createdVia,
    createdAt: now.toISOString(),
  };

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

/**
 * "La obra es aquí": el contratista, parado en la obra, fija el punto exacto con
 * su ubicación. Desde ese momento las llegadas se verifican contra ese punto.
 */
export async function pinRequestSite(
  context: AppContext,
  actor: Actor,
  input: { readonly requestId: string; readonly site: GeoFix },
): Promise<JobRequestRow> {
  requireRole(actor, "company");
  assertGoodPin(input.site);
  const request = await loadOwnRequest(context, actor, input.requestId);
  if (request.status === "cerrada") throw new ConflictError("Esta obra ya terminó.");
  const [updated] = await context.db
    .update(jobRequests)
    .set({ lat: input.site.lat, lng: input.site.lng, sitePinnedAt: context.now().toISOString() })
    .where(eq(jobRequests.id, request.id))
    .returning();
  if (!updated) throw new NotFoundError("la solicitud");
  await logEvent(context, {
    actor: "NIVEL",
    type: "obra_ubicada",
    label: "La empresa fijó la ubicación exacta de la obra",
    detail: { requestId: request.id },
  });
  return updated;
}

export interface InvitationSent {
  readonly invitation: InvitationRow;
  readonly candidate: PublicCandidate;
}

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

/** Aviso por Telegram a cada persona invitada que conectó su chat, con los botones para responder ahí mismo. */
async function announceInvitations(
  context: AppContext,
  request: JobRequestRow,
  sent: readonly InvitationRow[],
): Promise<void> {
  if (!context.telegram || sent.length === 0) return;
  const [company] = await context.db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, request.companyId));
  const text =
    `Tienes una oferta de trabajo de ${company?.name ?? "una empresa"}.\n` +
    `${TRADE_LABELS[request.trade].singular} en ${request.zone} · desde ${formatDay(request.startDate)} · ` +
    `${plural(request.days, "día", "días")} · ${formatUsd(request.dailyPayUsd)} al día.\n` +
    "El contrato es directo con la empresa. NIVEL es la plataforma, no el patrono.";
  await Promise.all(
    sent.map((invitation) =>
      notifyByTelegram(
        context,
        { role: "worker", subjectId: invitation.workerId },
        {
          text,
          buttons: [
            [
              { text: "Aceptar", data: `ac:${invitation.id}` },
              { text: "Rechazar", data: `re:${invitation.id}` },
            ],
            openAppButton(context, "Ver la oferta en NIVEL", `/t/oferta/${invitation.id}`),
          ].filter((row) => row.length > 0),
        },
      ),
    ),
  );
}

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
  await announceInvitations(context, request, inserted);
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

  readonly crew: readonly CrewMember[];

  readonly suggestedReplacement: PublicCandidate | null;
}

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
