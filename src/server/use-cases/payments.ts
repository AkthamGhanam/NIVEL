import { and, eq, isNull } from "drizzle-orm";

import { localDate } from "@/lib/dates";
import { shortName } from "@/lib/matching";
import { round2 } from "@/lib/money";
import { type FeePaymentMethod, toBolivares } from "@/lib/pricing";

import { type Actor, requireRole } from "../actor";
import type { AppContext } from "../context";
import { writeTransaction } from "../db/write-transaction";
import { companies, contracts, payments, workers } from "../db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors";
import { getDemoValue } from "./demo-state";
import { logEvent } from "./events";

export type PaymentRow = typeof payments.$inferSelect;

export interface NewPayment {
  readonly contractId: string;
  readonly method: FeePaymentMethod;
  /** Número de referencia del Pago Móvil o la transferencia. */
  readonly reference: string;
}

const FALLBACK_RATE_BS_PER_USD = 36.5;
const RECEIPT_SUFFIX_LENGTH = 8;

async function exampleRate(context: AppContext): Promise<number> {
  const rate = Number(await getDemoValue(context, "example_rate_bs_per_usd"));
  return Number.isFinite(rate) && rate > 0 ? rate : FALLBACK_RATE_BS_PER_USD;
}

/**
 * El contratista registra que pagó el salario al trabajador (el dinero va
 * directo, fuera de NIVEL). NIVEL solo deja constancia y genera el recibo.
 */
export async function registerPayment(
  context: AppContext,
  actor: Actor,
  input: NewPayment,
): Promise<PaymentRow> {
  const { companyId } = requireRole(actor, "company");
  const [contract] = await context.db.select().from(contracts).where(eq(contracts.id, input.contractId));
  if (!contract) throw new NotFoundError("el contrato");
  if (contract.companyId !== companyId) throw new ForbiddenError();
  if (contract.status !== "activo")
    throw new ConflictError("Solo se registra el pago de un contrato activo.");
  const [existing] = await context.db.select().from(payments).where(eq(payments.contractId, contract.id));
  if (existing) return existing; // Doble clic: un contrato tiene un solo pago.
  const now = context.now();
  const amountUsd = round2(contract.dailyPayUsd * contract.days);
  const id = context.newId("pa");
  const [payment] = await context.db
    .insert(payments)
    .values({
      id,
      contractId: contract.id,
      amountUsd,
      amountBs: toBolivares(amountUsd, await exampleRate(context)),
      method: input.method,
      reference: input.reference.trim(),
      receiptNumber: `R-${localDate(now).replaceAll("-", "")}-${id.slice(-RECEIPT_SUFFIX_LENGTH).toUpperCase()}`,
      registeredAt: now.toISOString(),
    })
    .returning();
  if (!payment) throw new Error("El pago no se guardó");
  await logEvent(context, {
    actor: "Empresa",
    type: "pago_registrado",
    label: `Pago registrado por ${input.method === "pago_movil" ? "Pago Móvil" : "transferencia"} · recibo ${payment.receiptNumber}`,
    detail: { contractId: contract.id, amountUsd },
  });
  return payment;
}

async function loadPaymentWithParties(context: AppContext, paymentId: string) {
  const [row] = await context.db
    .select({ payment: payments, contract: contracts, company: companies, workerName: workers.name })
    .from(payments)
    .innerJoin(contracts, eq(payments.contractId, contracts.id))
    .innerJoin(companies, eq(contracts.companyId, companies.id))
    .innerJoin(workers, eq(contracts.workerId, workers.id))
    .where(eq(payments.id, paymentId));
  if (!row) throw new NotFoundError("el pago");
  return row;
}

/** El trabajador confirma que recibió el pago; con eso el trabajo queda confirmado por ambas partes. */
export async function confirmPayment(
  context: AppContext,
  actor: Actor,
  paymentId: string,
): Promise<PaymentRow> {
  const { workerId } = requireRole(actor, "worker");
  const { payment, contract, workerName } = await loadPaymentWithParties(context, paymentId);
  if (contract.workerId !== workerId) throw new ForbiddenError();
  if (payment.confirmedByWorkerAt) return payment;
  const confirmedAt = context.now().toISOString();
  const [confirmed] = await writeTransaction(context.db, async (tx) => {
    await tx.update(contracts).set({ status: "completado" }).where(eq(contracts.id, contract.id));
    return tx
      .update(payments)
      .set({ confirmedByWorkerAt: confirmedAt })
      .where(and(eq(payments.id, payment.id), isNull(payments.confirmedByWorkerAt)))
      .returning();
  });
  await logEvent(context, {
    actor: shortName(workerName),
    type: "pago_confirmado",
    label: `${shortName(workerName)} confirmó que recibió su pago`,
    detail: { contractId: contract.id },
  });
  return confirmed ?? { ...payment, confirmedByWorkerAt: confirmedAt };
}

/** Datos del recibo de pago (LOTTT art. 106). */
export interface Receipt {
  readonly receiptNumber: string;
  readonly employer: { readonly name: string; readonly rif: string };
  readonly workerName: string;
  readonly concept: string;
  readonly days: number;
  readonly dailyPayUsd: number;
  readonly amountUsd: number;
  readonly amountBs: number;
  readonly method: FeePaymentMethod;
  readonly reference: string;
  readonly registeredAt: string;
  readonly confirmedByWorkerAt: string | null;
}

/** Solo las dos partes del contrato (y el equipo de NIVEL) pueden ver el recibo. */
export async function getReceipt(context: AppContext, actor: Actor, paymentId: string): Promise<Receipt> {
  const { payment, contract, company, workerName } = await loadPaymentWithParties(context, paymentId);
  const isParty =
    (actor.role === "worker" && actor.workerId === contract.workerId) ||
    (actor.role === "company" && actor.companyId === contract.companyId) ||
    actor.role === "admin";
  if (!isParty) throw new ForbiddenError();
  return {
    receiptNumber: payment.receiptNumber,
    employer: { name: company.name, rif: company.rif },
    workerName,
    concept: `Salario por ${contract.days} días de trabajo desde el ${contract.startDate}`,
    days: contract.days,
    dailyPayUsd: contract.dailyPayUsd,
    amountUsd: payment.amountUsd,
    amountBs: payment.amountBs,
    method: payment.method,
    reference: payment.reference,
    registeredAt: payment.registeredAt,
    confirmedByWorkerAt: payment.confirmedByWorkerAt,
  };
}
