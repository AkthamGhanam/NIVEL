import { and, count, countDistinct, eq, inArray, isNotNull, isNull, like, or, sql, sum } from "drizzle-orm";

import { addDays, type IsoDate } from "@/lib/dates";
import type { Level, LevelInput, PrivateRating } from "@/lib/level";
import type { BusyPeriod, CandidateWorker } from "@/lib/matching";
import type { Trade } from "@/lib/trades";
import type { WorkArea } from "@/lib/venezuela";

import type { Database } from "../db/client";
import {
  attendance,
  certificates,
  contracts,
  incidents,
  payments,
  practicalTests,
  ratings,
  reports,
  workers,
} from "../db/schema";

/**
 * Hechos verificables de cada trabajador, leídos con un número fijo de
 * consultas agregadas (sin N+1) sin importar cuántos trabajadores sean.
 */

export interface WorkerFacts {
  readonly workerId: string;
  readonly name: string;
  readonly trade: Trade;
  readonly trades: readonly Trade[];
  readonly level: Level;
  readonly location: { readonly lat: number; readonly lng: number };
  readonly workArea: WorkArea | null;
  readonly levelInput: LevelInput;
  /** Compromisos vigentes, con la solicitud que los originó. */
  readonly busy: ReadonlyArray<BusyPeriod & { readonly requestId: string }>;
}

export interface FactsFilter {
  readonly workerIds?: readonly string[];
  readonly trade?: Trade;
  /**
   * Solo perfiles que una empresa puede ver: con cuenta vigente, abiertos a
   * trabajar y, si son de personas reales, que aceptaron compartir su perfil.
   * Toda búsqueda de candidatos lo usa.
   */
  readonly shareableOnly?: boolean;
}

const BUSY_STATUSES = ["activo", "pendiente_firma"] as const;
const RATING_CATEGORIES = 4;

type CountByWorker = ReadonlyMap<string, number>;

const toCountMap = (
  rows: ReadonlyArray<{ workerId: string; total: number | string | null }>,
): CountByWorker => new Map(rows.map((row) => [row.workerId, Number(row.total ?? 0)]));

function confirmedJobsByWorker(db: Database, ids: readonly string[]) {
  return db
    .select({ workerId: contracts.workerId, total: countDistinct(contracts.id) })
    .from(contracts)
    .innerJoin(payments, eq(payments.contractId, contracts.id))
    .where(
      and(
        inArray(contracts.workerId, [...ids]),
        eq(contracts.status, "completado"),
        isNotNull(payments.confirmedByWorkerAt),
      ),
    )
    .groupBy(contracts.workerId);
}

function certificatesByWorker(db: Database, ids: readonly string[]) {
  return db
    .select({ workerId: certificates.workerId, total: count() })
    .from(certificates)
    .where(inArray(certificates.workerId, [...ids]))
    .groupBy(certificates.workerId);
}

function passedTestsByWorker(db: Database, ids: readonly string[]) {
  return db
    .select({ workerId: practicalTests.workerId, total: count() })
    .from(practicalTests)
    .where(and(inArray(practicalTests.workerId, [...ids]), eq(practicalTests.passed, true)))
    .groupBy(practicalTests.workerId);
}

function verifiedIncidentsByWorker(db: Database, ids: readonly string[]) {
  return db
    .select({ workerId: incidents.workerId, total: count() })
    .from(incidents)
    .where(and(inArray(incidents.workerId, [...ids]), isNotNull(incidents.verifiedAt)))
    .groupBy(incidents.workerId);
}

/** Días pactados en contratos terminados, por trabajador. */
function expectedDaysByWorker(db: Database, ids: readonly string[]) {
  return db
    .select({ workerId: contracts.workerId, total: sum(contracts.days) })
    .from(contracts)
    .where(and(inArray(contracts.workerId, [...ids]), eq(contracts.status, "completado")))
    .groupBy(contracts.workerId);
}

/** Días con entrada registrada en contratos terminados, por trabajador. */
function attendedDaysByWorker(db: Database, ids: readonly string[]) {
  return db
    .select({ workerId: contracts.workerId, total: count() })
    .from(attendance)
    .innerJoin(contracts, eq(attendance.contractId, contracts.id))
    .where(
      and(
        inArray(contracts.workerId, [...ids]),
        eq(contracts.status, "completado"),
        isNotNull(attendance.checkInAt),
      ),
    )
    .groupBy(contracts.workerId);
}

function busyContracts(db: Database, ids: readonly string[]) {
  return db
    .select({
      workerId: contracts.workerId,
      requestId: contracts.requestId,
      startDate: contracts.startDate,
      days: contracts.days,
    })
    .from(contracts)
    .where(and(inArray(contracts.workerId, [...ids]), inArray(contracts.status, [...BUSY_STATUSES])));
}

/** Calificaciones que las empresas dieron al trabajador; congeladas si hay un reporte abierto entre ambos. */
function ratingsReceived(db: Database, ids: readonly string[]) {
  const openReportBetweenParties = sql<number>`EXISTS (
    SELECT 1 FROM ${reports}
    WHERE ${reports.status} = 'en_revision'
      AND ${reports.reporterWorkerId} = ${ratings.toId}
      AND ${reports.companyId} = ${contracts.companyId}
  )`;
  return db
    .select({
      workerId: ratings.toId,
      total: sql<number>`${ratings.quality} + ${ratings.punctuality} + ${ratings.safety} + ${ratings.attitude}`,
      submittedAt: ratings.submittedAt,
      frozen: openReportBetweenParties,
    })
    .from(ratings)
    .innerJoin(contracts, eq(ratings.contractId, contracts.id))
    .where(and(inArray(ratings.toId, [...ids]), eq(ratings.fromRole, "empresa")));
}

function groupBy<T, V>(rows: readonly T[], key: (row: T) => string, value: (row: T) => V): Map<string, V[]> {
  const groups = new Map<string, V[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), value(row)]);
  return groups;
}

function attendanceRate(expectedDays: number, attendedDays: number): number {
  if (expectedDays === 0) return 1;
  return Math.min(1, attendedDays / expectedDays);
}

type WorkerRow = typeof workers.$inferSelect;

interface Aggregates {
  readonly jobs: CountByWorker;
  readonly certs: CountByWorker;
  readonly tests: CountByWorker;
  readonly incidents: CountByWorker;
  readonly expected: CountByWorker;
  readonly attended: CountByWorker;
  readonly busy: ReadonlyMap<string, WorkerFacts["busy"][number][]>;
  readonly ratings: ReadonlyMap<string, PrivateRating[]>;
}

/** Ocho consultas agregadas en paralelo, sin importar cuántos trabajadores sean. */
async function loadAggregates(db: Database, ids: readonly string[]): Promise<Aggregates> {
  const [jobs, certs, tests, incidentRows, expected, attended, busyRows, ratingRows] = await Promise.all([
    confirmedJobsByWorker(db, ids),
    certificatesByWorker(db, ids),
    passedTestsByWorker(db, ids),
    verifiedIncidentsByWorker(db, ids),
    expectedDaysByWorker(db, ids),
    attendedDaysByWorker(db, ids),
    busyContracts(db, ids),
    ratingsReceived(db, ids),
  ]);
  return {
    jobs: toCountMap(jobs),
    certs: toCountMap(certs),
    tests: toCountMap(tests),
    incidents: toCountMap(incidentRows),
    expected: toCountMap(expected),
    attended: toCountMap(attended),
    busy: groupBy(
      busyRows,
      (row) => row.workerId,
      (row) => ({
        requestId: row.requestId,
        from: row.startDate as IsoDate,
        to: addDays(row.startDate as IsoDate, row.days - 1),
      }),
    ),
    ratings: groupBy(
      ratingRows,
      (row) => row.workerId,
      (row): PrivateRating => ({
        average: Number(row.total) / RATING_CATEGORIES,
        submittedAt: new Date(row.submittedAt),
        frozen: Boolean(row.frozen),
      }),
    ),
  };
}

function toFacts(person: WorkerRow, data: Aggregates): WorkerFacts {
  return {
    workerId: person.id,
    name: person.name,
    trade: person.trade,
    trades: person.trades ?? [person.trade],
    level: person.level as Level,
    location: { lat: person.lat, lng: person.lng },
    workArea: person.workArea ?? null,
    busy: data.busy.get(person.id) ?? [],
    levelInput: {
      confirmedJobs: data.jobs.get(person.id) ?? 0,
      practicalPassed: (data.tests.get(person.id) ?? 0) > 0,
      certificates: data.certs.get(person.id) ?? 0,
      attendanceRate: attendanceRate(data.expected.get(person.id) ?? 0, data.attended.get(person.id) ?? 0),
      verifiedIncidents: data.incidents.get(person.id) ?? 0,
      ratings: data.ratings.get(person.id) ?? [],
    },
  };
}

export async function loadWorkerFacts(db: Database, filter: FactsFilter = {}): Promise<WorkerFacts[]> {
  const conditions = [
    filter.workerIds ? inArray(workers.id, [...filter.workerIds]) : undefined,
    filter.trade
      ? or(eq(workers.trade, filter.trade), like(workers.trades, `%"${filter.trade}"%`))
      : undefined,
    filter.shareableOnly
      ? and(
          isNull(workers.deletedAt),
          eq(workers.openToWork, true),
          // Sin el permiso "mostrar mi perfil" nadie aparece en una búsqueda, tampoco en la demo.
          isNotNull(workers.consentShareProfileAt),
        )
      : undefined,
  ];
  const people = await db
    .select()
    .from(workers)
    .where(and(...conditions));
  if (people.length === 0) return [];
  const aggregates = await loadAggregates(
    db,
    people.map((person) => person.id),
  );
  return people.map((person) => toFacts(person, aggregates));
}

/**
 * Convierte los hechos en un candidato. Los compromisos de `ownRequestId` no
 * cuentan como ocupado: quien ya aceptó esta solicitud sigue siendo candidato de ella.
 */
export function toCandidate(facts: WorkerFacts, ownRequestId?: string): CandidateWorker {
  return {
    id: facts.workerId,
    fullName: facts.name,
    trade: facts.trade,
    trades: facts.trades,
    level: facts.level,
    confirmedJobs: facts.levelInput.confirmedJobs,
    practicalPassed: facts.levelInput.practicalPassed,
    certificates: facts.levelInput.certificates,
    location: facts.location,
    ...(facts.workArea ? { workArea: facts.workArea } : {}),
    busy: facts.busy.filter((period) => period.requestId !== ownRequestId),
  };
}
