import { and, count, desc, eq } from "drizzle-orm";

import type { Level } from "@/lib/level";
import { shortName } from "@/lib/matching";
import { round2 } from "@/lib/money";
import { hiringFee } from "@/lib/pricing";
import type { ContractType, Trade } from "@/lib/trades";

import { type Actor, requireRole } from "../actor";
import type { AppContext } from "../context";
import { writeTransaction } from "../db/write-transaction";
import { companies, contracts, fees, invitations, jobRequests, workers } from "../db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors";
import { paysOnTimeByCompany } from "../repos/company-reputation";
import { NOT_EMPLOYER_NOTICE, newOtpCode, otpDigest } from "./contracts";
import { logEvent } from "./events";

export interface WorkerOffer {
  readonly invitationId: string;
  readonly status: "enviada" | "aceptada" | "rechazada";
  readonly audioUrl: string | null;
  readonly company: {
    readonly name: string;
    readonly verified: boolean;
    /** Porcentaje de trabajos que pagó a tiempo. Nulo si tiene menos de 5 contrataciones terminadas. */
    readonly paysOnTimePercent: number | null;
  };
  readonly trade: Trade;
  readonly zone: string;
  readonly startDate: string;
  readonly days: number;
  readonly dailyPayUsd: number;
  readonly totalUsd: number;
  readonly contractType: ContractType;
  readonly contractId: string | null;
  readonly notice: string;
}

function offersQuery(context: AppContext) {
  return context.db
    .select({ invitation: invitations, request: jobRequests, company: companies, contractId: contracts.id })
    .from(invitations)
    .innerJoin(jobRequests, eq(invitations.requestId, jobRequests.id))
    .innerJoin(companies, eq(jobRequests.companyId, companies.id))
    .leftJoin(
      contracts,
      and(eq(contracts.requestId, invitations.requestId), eq(contracts.workerId, invitations.workerId)),
    );
}

type OfferJoin = Awaited<ReturnType<typeof offersQuery>>[number];

type PaymentRates = ReadonlyMap<string, number | null>;

function toOffer({ invitation, request, company, contractId }: OfferJoin, rates: PaymentRates): WorkerOffer {
  return {
    invitationId: invitation.id,
    status: invitation.status,
    audioUrl: invitation.audioUrl,
    company: {
      name: company.name,
      verified: company.verified,
      paysOnTimePercent: rates.get(company.id) ?? null,
    },
    trade: request.trade,
    zone: request.zone,
    startDate: request.startDate,
    days: request.days,
    dailyPayUsd: request.dailyPayUsd,
    totalUsd: round2(request.dailyPayUsd * request.days),
    contractType: request.contractType,
    contractId,
    notice: NOT_EMPLOYER_NOTICE,
  };
}

/** Invitaciones del trabajador que hace la petición, de la más reciente a la más antigua. */
export async function listMyOffers(context: AppContext, actor: Actor): Promise<WorkerOffer[]> {
  const { workerId } = requireRole(actor, "worker");
  const rows = await offersQuery(context)
    .where(eq(invitations.workerId, workerId))
    .orderBy(desc(invitations.createdAt));
  const rates = await paysOnTimeByCompany(
    context.db,
    rows.map((row) => row.company.id),
  );
  return rows.map((row) => toOffer(row, rates));
}

export interface InvitationResponse {
  readonly offer: WorkerOffer;
  /** Código de firma, solo al aceptar. Se muestra como "enviado por SMS (simulado)". */
  readonly otp: string | null;
}

interface Acceptance {
  readonly context: AppContext;
  readonly row: OfferJoin;
  readonly worker: { readonly name: string; readonly level: number };
}

/** Crea el contrato (la empresa lo dejó firmado al publicar) y la tarifa de NIVEL. */
async function acceptInvitation({
  context,
  row,
  worker,
}: Acceptance): Promise<{ contractId: string; otp: string }> {
  const { invitation, request, company } = row;
  const contractId = context.newId("ct");
  const otp = newOtpCode();
  const respondedAt = context.now().toISOString();
  const fee = hiringFee(worker.level as Level);
  await writeTransaction(context.db, async (tx) => {
    const [{ accepted } = { accepted: 0 }] = await tx
      .select({ accepted: count() })
      .from(invitations)
      .where(and(eq(invitations.requestId, request.id), eq(invitations.status, "aceptada")));
    if (accepted >= request.quantity)
      throw new ConflictError("La cuadrilla de esta solicitud ya está completa.");
    const updated = await tx
      .update(invitations)
      .set({ status: "aceptada", respondedAt })
      .where(and(eq(invitations.id, invitation.id), eq(invitations.status, "enviada")))
      .returning({ id: invitations.id });
    if (updated.length === 0) throw new ConflictError("Esta invitación ya fue respondida.");
    await tx.insert(contracts).values({
      id: contractId,
      requestId: request.id,
      companyId: company.id,
      workerId: invitation.workerId,
      contractType: request.contractType,
      dailyPayUsd: request.dailyPayUsd,
      startDate: request.startDate,
      days: request.days,
      otpHash: otpDigest(context, contractId, otp),
      signedCompanyAt: request.createdAt,
      status: "pendiente_firma",
    });
    await tx.insert(fees).values({
      id: context.newId("fe"),
      companyId: company.id,
      contractId,
      concept: `Contratación · Nivel ${worker.level}`,
      baseUsd: fee.base,
      ivaUsd: fee.iva,
      totalUsd: fee.total,
      invoiceNumber: `F-${contractId.slice(-10).toUpperCase()}`,
      status: "por_pagar",
      createdAt: respondedAt,
    });
    if (accepted + 1 >= request.quantity) {
      await tx.update(jobRequests).set({ status: "completa" }).where(eq(jobRequests.id, request.id));
    }
  });
  return { contractId, otp };
}

async function rejectInvitation(context: AppContext, invitationId: string): Promise<void> {
  const updated = await context.db
    .update(invitations)
    .set({ status: "rechazada", respondedAt: context.now().toISOString() })
    .where(and(eq(invitations.id, invitationId), eq(invitations.status, "enviada")))
    .returning({ id: invitations.id });
  if (updated.length === 0) throw new ConflictError("Esta invitación ya fue respondida.");
}

/** El trabajador acepta o rechaza una invitación. Solo puede responder la suya, y una sola vez. */
export async function respondToInvitation(
  context: AppContext,
  actor: Actor,
  input: { readonly invitationId: string; readonly accept: boolean },
): Promise<InvitationResponse> {
  const { workerId } = requireRole(actor, "worker");
  const [row] = await offersQuery(context).where(eq(invitations.id, input.invitationId));
  if (!row) throw new NotFoundError("la invitación");
  if (row.invitation.workerId !== workerId) throw new ForbiddenError();
  const [worker] = await context.db
    .select({ name: workers.name, level: workers.level })
    .from(workers)
    .where(eq(workers.id, workerId));
  if (!worker) throw new NotFoundError("tu perfil");
  const accepted = input.accept ? await acceptInvitation({ context, row, worker }) : null;
  if (!accepted) await rejectInvitation(context, row.invitation.id);
  await logEvent(context, {
    actor: shortName(worker.name),
    type: input.accept ? "invitacion_aceptada" : "invitacion_rechazada",
    label: `${shortName(worker.name)} ${input.accept ? "aceptó" : "rechazó"} la invitación`,
    detail: { invitationId: row.invitation.id, requestId: row.request.id },
  });
  const status = input.accept ? ("aceptada" as const) : ("rechazada" as const);
  const rates = await paysOnTimeByCompany(context.db, [row.company.id]);
  const offer = toOffer(
    { ...row, invitation: { ...row.invitation, status }, contractId: accepted?.contractId ?? null },
    rates,
  );
  return { offer, otp: accepted?.otp ?? null };
}
