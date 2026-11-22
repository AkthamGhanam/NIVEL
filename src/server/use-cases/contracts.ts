import { randomInt, timingSafeEqual } from "node:crypto";

import { and, asc, eq, sql } from "drizzle-orm";

import { round2 } from "@/lib/money";

import { type Actor, requireRole } from "../actor";
import type { AppContext } from "../context";
import { attendance, companies, contracts, payments } from "../db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors";
import { logEvent } from "./events";

export const NOT_EMPLOYER_NOTICE =
  "Contrato directo empresa–trabajador. NIVEL es la plataforma, no el patrono.";

const OTP_DIGITS = 6;
const MAX_OTP_ATTEMPTS = 5;

export type ContractRow = typeof contracts.$inferSelect;

/** Contrato sin los campos internos de la firma. */
export type PublicContract = Omit<ContractRow, "otpHash" | "otpAttempts"> & {
  readonly totalUsd: number;
  readonly companyName: string;
  readonly notice: string;
};

export const otpDigest = (context: AppContext, contractId: string, code: string) =>
  context.sign(`otp:${contractId}:${code}`);

export function newOtpCode(): string {
  return String(randomInt(0, 10 ** OTP_DIGITS)).padStart(OTP_DIGITS, "0");
}

function sameDigest(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(actual, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function loadContractFor(context: AppContext, actor: Actor, contractId: string) {
  const [row] = await context.db
    .select({ contract: contracts, companyName: companies.name })
    .from(contracts)
    .innerJoin(companies, eq(contracts.companyId, companies.id))
    .where(eq(contracts.id, contractId));
  if (!row) throw new NotFoundError("el contrato");
  const isParty =
    (actor.role === "worker" && actor.workerId === row.contract.workerId) ||
    (actor.role === "company" && actor.companyId === row.contract.companyId) ||
    actor.role === "admin";
  if (!isParty) throw new ForbiddenError();
  return row;
}

function toPublic(contract: ContractRow, companyName: string): PublicContract {
  const { otpHash: _otpHash, otpAttempts: _otpAttempts, ...visible } = contract;
  return {
    ...visible,
    totalUsd: round2(contract.dailyPayUsd * contract.days),
    companyName,
    notice: NOT_EMPLOYER_NOTICE,
  };
}

/** Contrato con su asistencia y su pago: lo que cada parte necesita para seguir el trabajo. */
export interface ContractDetail extends PublicContract {
  readonly attendance: ReadonlyArray<{
    readonly date: string;
    readonly checkInAt: string | null;
    readonly checkOutAt: string | null;
  }>;
  readonly payment: {
    readonly id: string;
    readonly receiptNumber: string;
    readonly amountUsd: number;
    readonly registeredAt: string;
    readonly confirmedByWorkerAt: string | null;
  } | null;
}

/** Detalle del contrato para cualquiera de las dos partes. */
export async function getContract(
  context: AppContext,
  actor: Actor,
  contractId: string,
): Promise<ContractDetail> {
  const { contract, companyName } = await loadContractFor(context, actor, contractId);
  const [days, [payment]] = await Promise.all([
    context.db
      .select({ date: attendance.date, checkInAt: attendance.checkInAt, checkOutAt: attendance.checkOutAt })
      .from(attendance)
      .where(eq(attendance.contractId, contract.id))
      .orderBy(asc(attendance.date)),
    context.db
      .select({
        id: payments.id,
        receiptNumber: payments.receiptNumber,
        amountUsd: payments.amountUsd,
        registeredAt: payments.registeredAt,
        confirmedByWorkerAt: payments.confirmedByWorkerAt,
      })
      .from(payments)
      .where(eq(payments.contractId, contract.id)),
  ]);
  return { ...toPublic(contract, companyName), attendance: days, payment: payment ?? null };
}

/**
 * Emite un código de firma nuevo y reinicia los intentos. En la demo el código
 * se muestra en pantalla como "enviado por SMS (simulado)"; en la base solo queda su HMAC.
 */
export async function issueContractOtp(
  context: AppContext,
  actor: Actor,
  contractId: string,
): Promise<{ readonly otp: string }> {
  requireRole(actor, "worker");
  const { contract } = await loadContractFor(context, actor, contractId);
  if (contract.status !== "pendiente_firma") throw new ConflictError("Este contrato ya está firmado.");
  const otp = newOtpCode();
  await context.db
    .update(contracts)
    .set({ otpHash: otpDigest(context, contract.id, otp), otpAttempts: 0 })
    .where(eq(contracts.id, contract.id));
  return { otp };
}

/** El trabajador firma con su código. Máximo 5 intentos por código. */
export async function signContract(
  context: AppContext,
  actor: Actor,
  input: { readonly contractId: string; readonly otp: string },
): Promise<PublicContract> {
  requireRole(actor, "worker");
  const { contract, companyName } = await loadContractFor(context, actor, input.contractId);
  if (contract.status !== "pendiente_firma") throw new ConflictError("Este contrato ya está firmado.");
  if (!contract.otpHash || contract.otpAttempts >= MAX_OTP_ATTEMPTS) {
    throw new ConflictError("El código venció. Pide uno nuevo.");
  }
  if (!sameDigest(contract.otpHash, otpDigest(context, contract.id, input.otp))) {
    await context.db
      .update(contracts)
      .set({ otpAttempts: sql`${contracts.otpAttempts} + 1` })
      .where(eq(contracts.id, contract.id));
    throw new ConflictError("El código no coincide. Revísalo e intenta de nuevo.");
  }
  const [signed] = await context.db
    .update(contracts)
    .set({ status: "activo", signedWorkerAt: context.now().toISOString(), otpHash: null })
    .where(and(eq(contracts.id, contract.id), eq(contracts.status, "pendiente_firma")))
    .returning();
  if (!signed) throw new ConflictError("Este contrato ya está firmado.");
  await logEvent(context, {
    actor: "Trabajador",
    type: "contrato_firmado",
    label: `Contrato firmado con ${companyName}`,
    detail: { contractId: signed.id },
  });
  return toPublic(signed, companyName);
}
