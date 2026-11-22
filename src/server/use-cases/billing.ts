import { and, desc, eq, gte, isNotNull } from "drizzle-orm";

import { localDate } from "@/lib/dates";
import { round2 } from "@/lib/money";
import { type FeePaymentMethod, planObraMonthlyCost, type PriceWithIva } from "@/lib/pricing";

import type { Actor } from "../actor";
import type { AppContext } from "../context";
import { fees } from "../db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors";
import { logEvent } from "./events";

/**
 * Tarifas que NIVEL cobra a empresas y academias (regla legal 8.8): siempre
 * con el IVA aparte y solo por Pago Móvil o transferencia. La factura es
 * simulada en la demo. Al trabajador nunca se le cobra nada.
 */

type FeeRow = typeof fees.$inferSelect;
type Payer = Extract<Actor, { role: "company" | "academy" }>;

export interface FeeLine {
  readonly id: string;
  readonly concept: string;
  readonly base: number;
  readonly iva: number;
  readonly total: number;
  readonly invoiceNumber: string;
  readonly status: FeeRow["status"];
  readonly method: FeeRow["method"];
  readonly createdAt: string;
}

export interface PlanSuggestion {
  readonly hiresThisMonth: number;
  readonly payPerHire: PriceWithIva;
  readonly planObra: PriceWithIva;
  /** Lo que la empresa ahorraría este mes con el Plan Obra, IVA incluido. */
  readonly savesUsd: number;
}

export interface FeeStatement {
  readonly fees: readonly FeeLine[];
  readonly pending: PriceWithIva;
  readonly paid: PriceWithIva;
  /** Solo para empresas, y solo si el Plan Obra le sale más barato este mes. */
  readonly planSuggestion: PlanSuggestion | null;
}

const MAX_FEES_LISTED = 200;

function requirePayer(actor: Actor): Payer {
  if (actor.role !== "company" && actor.role !== "academy") throw new ForbiddenError();
  return actor;
}

const ownedBy = (payer: Payer) =>
  payer.role === "company" ? eq(fees.companyId, payer.companyId) : eq(fees.academyId, payer.academyId);

const toLine = (fee: FeeRow): FeeLine => ({
  id: fee.id,
  concept: fee.concept,
  base: fee.baseUsd,
  iva: fee.ivaUsd,
  total: fee.totalUsd,
  invoiceNumber: fee.invoiceNumber,
  status: fee.status,
  method: fee.method,
  createdAt: fee.createdAt,
});

function totalOf(lines: readonly FeeLine[]): PriceWithIva {
  const add = (pick: (line: FeeLine) => number) => round2(lines.reduce((sum, line) => sum + pick(line), 0));
  return { base: add((line) => line.base), iva: add((line) => line.iva), total: add((line) => line.total) };
}

/** Compara lo que la empresa pagó este mes por contratación con lo que costaría el Plan Obra. */
async function suggestPlan(context: AppContext, companyId: string): Promise<PlanSuggestion | null> {
  const monthStart = `${localDate(context.now()).slice(0, 7)}-01`;
  const hires = await context.db
    .select()
    .from(fees)
    .where(and(eq(fees.companyId, companyId), isNotNull(fees.contractId), gte(fees.createdAt, monthStart)));
  if (hires.length === 0) return null;
  const payPerHire = totalOf(hires.map(toLine));
  const planObra = planObraMonthlyCost(hires.length);
  const savesUsd = round2(payPerHire.total - planObra.total);
  return savesUsd > 0 ? { hiresThisMonth: hires.length, payPerHire, planObra, savesUsd } : null;
}

/** Estado de cuenta de quien hace la petición: nunca el de otra empresa o academia. */
export async function listMyFees(context: AppContext, actor: Actor): Promise<FeeStatement> {
  const payer = requirePayer(actor);
  const rows = await context.db
    .select()
    .from(fees)
    .where(ownedBy(payer))
    .orderBy(desc(fees.createdAt), desc(fees.id))
    .limit(MAX_FEES_LISTED);
  const lines = rows.map(toLine);
  return {
    fees: lines,
    pending: totalOf(lines.filter((line) => line.status === "por_pagar")),
    paid: totalOf(lines.filter((line) => line.status === "pagado")),
    planSuggestion: payer.role === "company" ? await suggestPlan(context, payer.companyId) : null,
  };
}

/** Marca una tarifa como pagada. El cobro real ocurre fuera de NIVEL; aquí queda la factura simulada. */
export async function payFee(
  context: AppContext,
  actor: Actor,
  input: { readonly feeId: string; readonly method: FeePaymentMethod },
): Promise<FeeLine> {
  const payer = requirePayer(actor);
  const [fee] = await context.db.select().from(fees).where(eq(fees.id, input.feeId));
  if (!fee) throw new NotFoundError("la tarifa");
  const isOwner =
    payer.role === "company" ? fee.companyId === payer.companyId : fee.academyId === payer.academyId;
  if (!isOwner) throw new ForbiddenError();
  const [paid] = await context.db
    .update(fees)
    .set({ status: "pagado", method: input.method })
    .where(and(eq(fees.id, fee.id), eq(fees.status, "por_pagar")))
    .returning();
  if (!paid) throw new ConflictError("Esta tarifa ya está pagada.");
  await logEvent(context, {
    actor: "NIVEL",
    type: "tarifa_pagada",
    label: `Tarifa pagada · factura ${paid.invoiceNumber} (simulada)`,
    detail: { feeId: paid.id, totalUsd: paid.totalUsd },
  });
  return toLine(paid);
}
