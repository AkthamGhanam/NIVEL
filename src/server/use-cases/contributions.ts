// Aportes al Estado: cuánto le toca pagar a la empresa en cada institución y si ya registró el comprobante.
import { and, eq, inArray } from "drizzle-orm";

import { ensure } from "@/lib/errors";
import { contributionsFor, type Institution, INSTITUTIONS } from "@/lib/legal-cost";
import { round2 } from "@/lib/money";

import { type Actor, requireRole } from "../actor";
import type { AppContext } from "../context";
import { contributions, contracts, payments } from "../db/schema";
import { ConflictError } from "../errors";
import { logEvent } from "./events";

export interface ContributionLine {
  readonly institution: Institution;
  readonly amountUsd: number;
  /** Comprobante registrado por la empresa; nulo si falta declararlo. */
  readonly reference: string | null;
  readonly declaredAt: string | null;
}

export interface ContributionPeriod {
  /** Mes de los salarios, AAAA-MM. */
  readonly period: string;
  /** Salarios pagados ese mes: la base de los aportes. */
  readonly salariesUsd: number;
  readonly lines: readonly ContributionLine[];
  readonly totalUsd: number;
  readonly complete: boolean;
}

const periodOf = (iso: string) => iso.slice(0, 7);

/** Salarios pagados por la empresa, agrupados por mes. Los pagos anteriores a la liquidación cuentan completos. */
async function salariesByPeriod(context: AppContext, companyId: string): Promise<Map<string, number>> {
  const rows = await context.db
    .select({
      amountUsd: payments.amountUsd,
      salaryUsd: payments.salaryUsd,
      registeredAt: payments.registeredAt,
    })
    .from(payments)
    .innerJoin(contracts, eq(payments.contractId, contracts.id))
    .where(eq(contracts.companyId, companyId));
  const totals = new Map<string, number>();
  for (const row of rows) {
    const period = periodOf(row.registeredAt);
    totals.set(period, (totals.get(period) ?? 0) + (row.salaryUsd ?? row.amountUsd));
  }
  return totals;
}

/** Planilla de aportes de la empresa, del mes más reciente al más antiguo. */
export async function listContributions(context: AppContext, actor: Actor): Promise<ContributionPeriod[]> {
  const { companyId } = requireRole(actor, "company");
  return contributionPeriods(context, companyId);
}

export async function contributionPeriods(
  context: AppContext,
  companyId: string,
): Promise<ContributionPeriod[]> {
  const salaries = await salariesByPeriod(context, companyId);
  if (salaries.size === 0) return [];
  const declared = await context.db
    .select()
    .from(contributions)
    .where(and(eq(contributions.companyId, companyId), inArray(contributions.period, [...salaries.keys()])));
  return [...salaries.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([period, salariesRaw]) => {
      const salariesUsd = round2(salariesRaw);
      const due = contributionsFor(salariesUsd);
      const lines = INSTITUTIONS.map((institution) => {
        const done = declared.find((row) => row.period === period && row.institution === institution);
        return {
          institution,
          amountUsd: due[institution],
          reference: done?.reference ?? null,
          declaredAt: done?.declaredAt ?? null,
        };
      });
      return {
        period,
        salariesUsd,
        lines,
        totalUsd: round2(lines.reduce((sum, line) => sum + line.amountUsd, 0)),
        complete: lines.every((line) => line.reference !== null),
      };
    });
}

const REFERENCE = /^[A-Za-z0-9-]{4,30}$/;

/** La empresa registra el comprobante de un aporte que ya pagó en el portal de la institución. */
export async function declareContribution(
  context: AppContext,
  actor: Actor,
  input: { readonly period: string; readonly institution: Institution; readonly reference: string },
): Promise<ContributionPeriod[]> {
  const { companyId } = requireRole(actor, "company");
  const reference = input.reference.trim();
  ensure(REFERENCE.test(reference), "Escribe el número del comprobante: de 4 a 30 letras o números.");
  const periods = await contributionPeriods(context, companyId);
  const period = periods.find((candidate) => candidate.period === input.period);
  if (!period) throw new ConflictError("Ese mes no tiene salarios pagados.");
  const line = period.lines.find((candidate) => candidate.institution === input.institution);
  if (line?.reference) return periods; // Doble toque: el primer comprobante es el que vale.
  await context.db
    .insert(contributions)
    .values({
      id: context.newId("ap"),
      companyId,
      period: input.period,
      institution: input.institution,
      amountUsd: line?.amountUsd ?? 0,
      reference,
      declaredAt: context.now().toISOString(),
    })
    .onConflictDoNothing();
  await logEvent(context, {
    actor: "Empresa",
    type: "aporte_declarado",
    label: `Aporte declarado: ${input.institution.toUpperCase()} · ${input.period}`,
    detail: { period: input.period, institution: input.institution },
  });
  return contributionPeriods(context, companyId);
}

/**
 * "Paga en regla": la empresa ya liquidó al menos un trabajo, cada trabajador
 * confirmó que recibió su liquidación y registró todos los aportes de esos meses.
 * Solo se muestra cuando se cumple: su ausencia no acusa a nadie.
 */
export async function paysInRegla(context: AppContext, companyIds: readonly string[]): Promise<Set<string>> {
  const unique = [...new Set(companyIds)];
  if (unique.length === 0) return new Set();
  const results = await Promise.all(
    unique.map(async (companyId) => {
      const rows = await context.db
        .select({ confirmedByWorkerAt: payments.confirmedByWorkerAt })
        .from(payments)
        .innerJoin(contracts, eq(payments.contractId, contracts.id))
        .where(eq(contracts.companyId, companyId));
      if (rows.length === 0 || rows.some((row) => row.confirmedByWorkerAt === null)) return null;
      const periods = await contributionPeriods(context, companyId);
      return periods.every((period) => period.complete) ? companyId : null;
    }),
  );
  return new Set(results.filter((id): id is string => id !== null));
}
