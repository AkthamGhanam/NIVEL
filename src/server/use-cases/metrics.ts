import { and, count, eq, isNotNull, isNull, max, ne, sum } from "drizzle-orm";

import { localDate } from "@/lib/dates";
import { round2 } from "@/lib/money";
import type { PriceWithIva } from "@/lib/pricing";
import { TRADE_LABELS } from "@/lib/trades";

import { type Actor, requireRole } from "../actor";
import type { AppContext } from "../context";
import { contracts, fees, invitations, jobRequests, reports, workers } from "../db/schema";

/**
 * Números del panel interno `/admin` y del Modo Jurado. Todo se calcula en
 * vivo con consultas agregadas; no hay cifras escritas a mano.
 */

export interface Metrics {
  readonly workers: {
    readonly total: number;
    /** Personas reales registradas en el evento (no del seed). */
    readonly real: number;
    readonly byLevel: Readonly<Record<number, number>>;
  };
  readonly requests: { readonly total: number; readonly open: number; readonly complete: number };
  readonly hires: number;
  /** Minutos promedio desde que se publica la solicitud hasta que acepta la última persona. Nulo sin datos. */
  readonly averageMinutesToFullCrew: number | null;
  /** Ingresos de NIVEL, con el IVA siempre aparte. */
  readonly income: {
    readonly hiring: PriceWithIva;
    readonly academyCommission: PriceWithIva;
    readonly total: PriceWithIva;
    readonly pendingTotalUsd: number;
  };
  readonly reportsInReview: number;
}

const MS_PER_MINUTE = 60_000;
const ZERO: PriceWithIva = Object.freeze({ base: 0, iva: 0, total: 0 });

const plus = (a: PriceWithIva, b: PriceWithIva): PriceWithIva => ({
  base: round2(a.base + b.base),
  iva: round2(a.iva + b.iva),
  total: round2(a.total + b.total),
});

async function workerCounts(context: AppContext): Promise<Metrics["workers"]> {
  const rows = await context.db
    .select({ level: workers.level, isReal: workers.isReal, total: count() })
    .from(workers)
    .where(isNull(workers.deletedAt))
    .groupBy(workers.level, workers.isReal);
  const byLevel: Record<number, number> = {};
  for (const row of rows) byLevel[row.level] = (byLevel[row.level] ?? 0) + row.total;
  return {
    total: rows.reduce((total, row) => total + row.total, 0),
    real: rows.filter((row) => row.isReal).reduce((total, row) => total + row.total, 0),
    byLevel,
  };
}

async function requestCounts(context: AppContext): Promise<Metrics["requests"]> {
  const rows = await context.db
    .select({ status: jobRequests.status, total: count() })
    .from(jobRequests)
    .groupBy(jobRequests.status);
  const of = (status: string) => rows.find((row) => row.status === status)?.total ?? 0;
  return {
    total: rows.reduce((total, row) => total + row.total, 0),
    open: of("abierta"),
    complete: of("completa"),
  };
}

/** Solo cuenta solicitudes cuya cuadrilla se completó con invitaciones respondidas en la app. */
async function averageMinutesToFullCrew(context: AppContext): Promise<number | null> {
  const rows = await context.db
    .select({ createdAt: jobRequests.createdAt, lastAcceptedAt: max(invitations.respondedAt) })
    .from(invitations)
    .innerJoin(jobRequests, eq(invitations.requestId, jobRequests.id))
    .where(and(eq(invitations.status, "aceptada"), ne(jobRequests.status, "abierta")))
    .groupBy(jobRequests.id);
  const minutes = rows.flatMap((row) =>
    row.lastAcceptedAt ? [(Date.parse(row.lastAcceptedAt) - Date.parse(row.createdAt)) / MS_PER_MINUTE] : [],
  );
  if (minutes.length === 0) return null;
  return round2(minutes.reduce((total, value) => total + value, 0) / minutes.length);
}

async function income(context: AppContext): Promise<Metrics["income"]> {
  const rows = await context.db
    .select({
      fromAcademy: isNotNull(fees.academyId).mapWith(Boolean),
      status: fees.status,
      base: sum(fees.baseUsd),
      iva: sum(fees.ivaUsd),
      total: sum(fees.totalUsd),
    })
    .from(fees)
    .groupBy(isNotNull(fees.academyId), fees.status);
  const price = (row: (typeof rows)[number]): PriceWithIva => ({
    base: round2(Number(row.base ?? 0)),
    iva: round2(Number(row.iva ?? 0)),
    total: round2(Number(row.total ?? 0)),
  });
  const totalOf = (fromAcademy: boolean) =>
    rows
      .filter((row) => row.fromAcademy === fromAcademy)
      .reduce((total, row) => plus(total, price(row)), ZERO);
  const hiring = totalOf(false);
  const academyCommission = totalOf(true);
  const pending = rows
    .filter((row) => row.status === "por_pagar")
    .reduce((total, row) => plus(total, price(row)), ZERO);
  return {
    hiring,
    academyCommission,
    total: plus(hiring, academyCommission),
    pendingTotalUsd: pending.total,
  };
}

export async function getMetrics(context: AppContext, actor: Actor): Promise<Metrics> {
  requireRole(actor, "admin");
  const [workerTotals, requests, hires, minutes, money, inReview] = await Promise.all([
    workerCounts(context),
    requestCounts(context),
    context.db.select({ total: count() }).from(contracts),
    averageMinutesToFullCrew(context),
    income(context),
    context.db.select({ total: count() }).from(reports).where(eq(reports.status, "en_revision")),
  ]);
  return {
    workers: workerTotals,
    requests,
    hires: hires[0]?.total ?? 0,
    averageMinutesToFullCrew: minutes,
    income: money,
    reportsInReview: inReview[0]?.total ?? 0,
  };
}

export interface RealProfilesToday {
  readonly count: number;
  /** Solo nombre de pila, oficio y zona: nada que identifique a la persona. */
  readonly profiles: ReadonlyArray<{
    readonly firstName: string;
    readonly trade: string;
    readonly zone: string;
  }>;
}

/** Perfiles de personas reales creados hoy (hora de Caracas), para el contador del Modo Jurado. */
export async function realProfilesToday(context: AppContext, actor: Actor): Promise<RealProfilesToday> {
  requireRole(actor, "admin");
  const today = localDate(context.now());
  const rows = await context.db
    .select({ name: workers.name, trade: workers.trade, zone: workers.zone, createdAt: workers.createdAt })
    .from(workers)
    .where(and(eq(workers.isReal, true), isNull(workers.deletedAt)))
    .orderBy(workers.createdAt);
  const profiles = rows
    .filter((row) => localDate(new Date(row.createdAt)) === today)
    .map((row) => ({
      firstName: row.name.trim().split(/\s+/)[0] ?? "",
      trade: TRADE_LABELS[row.trade].singular,
      zone: row.zone,
    }));
  return { count: profiles.length, profiles };
}
