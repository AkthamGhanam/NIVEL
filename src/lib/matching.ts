import { addDays, type IsoDate } from "./dates";
import { ensure } from "./errors";
import { type GeoPoint, haversineKm } from "./geo";
import type { Level } from "./level";
import type { Trade } from "./trades";
import { coversPlace, type Place, type WorkArea } from "./venezuela";

/**
 * Búsqueda de candidatos (docs/spec.md, sección 6.4).
 * No usa calificaciones (privacidad) y el perfil que devuelve no tiene
 * campos para foto, edad, sexo ni estrellas: el tipo lo impide.
 */

export const MAX_DISTANCE_KM = 25;

const SCORE_WEIGHTS = Object.freeze({ level: 10, confirmedJob: 1.5, practicalPassed: 5, distanceKm: -0.5 });

export interface BusyPeriod {
  readonly from: IsoDate;
  /** Último día ocupado, incluido. */
  readonly to: IsoDate;
}

export interface CandidateWorker {
  readonly id: string;
  readonly fullName: string;
  readonly trade: Trade;
  /** Todos sus oficios; si falta, solo el principal. */
  readonly trades?: readonly Trade[];
  readonly level: Level;
  readonly confirmedJobs: number;
  readonly practicalPassed: boolean;
  readonly certificates: number;
  readonly location: GeoPoint;
  /** Dónde acepta trabajar. Sin ella cuenta solo la distancia. */
  readonly workArea?: WorkArea;
  readonly busy: readonly BusyPeriod[];
}

export interface JobSearch {
  readonly trade: Trade;
  readonly minLevel: Level;
  readonly site: GeoPoint;
  /** Estado y municipio de la obra, si se conocen. */
  readonly place?: Place;
  readonly startDate: IsoDate;
  readonly days: number;
}

/** Lo único que una empresa ve de un candidato antes de la entrevista. */
export interface PublicCandidate {
  readonly workerId: string;
  readonly shortName: string;
  readonly level: Level;
  readonly confirmedJobs: number;
  readonly practicalPassed: boolean;
  readonly certificates: number;
  readonly distanceKm: number;
}

export interface RankedCandidate {
  readonly candidate: PublicCandidate;
  readonly score: number;
}

/** "Carlos Rodríguez" → "Carlos R.". */
export function shortName(fullName: string): string {
  const [first = "", ...rest] = fullName.trim().split(/\s+/u);
  const lastInitial = rest.at(-1)?.charAt(0).toLocaleUpperCase("es-VE");
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

function overlaps(period: BusyPeriod, from: IsoDate, to: IsoDate): boolean {
  return period.from <= to && period.to >= from;
}

export function isAvailable(worker: CandidateWorker, search: JobSearch): boolean {
  const lastDay = addDays(search.startDate, search.days - 1);
  return !worker.busy.some((period) => overlaps(period, search.startDate, lastDay));
}

export function candidateScore(worker: CandidateWorker, distanceKm: number): number {
  return (
    worker.level * SCORE_WEIGHTS.level +
    worker.confirmedJobs * SCORE_WEIGHTS.confirmedJob +
    (worker.practicalPassed ? SCORE_WEIGHTS.practicalPassed : 0) +
    distanceKm * SCORE_WEIGHTS.distanceKm
  );
}

function toPublic(worker: CandidateWorker, distanceKm: number): PublicCandidate {
  return {
    workerId: worker.id,
    shortName: shortName(worker.fullName),
    level: worker.level,
    confirmedJobs: worker.confirmedJobs,
    practicalPassed: worker.practicalPassed,
    certificates: worker.certificates,
    distanceKm: Math.round(distanceKm * 10) / 10,
  };
}

export const doesTrade = (worker: CandidateWorker, trade: Trade): boolean =>
  worker.trade === trade || (worker.trades?.includes(trade) ?? false);

/** Cerca de la obra, o la obra queda dentro de la zona donde dijo que trabaja. */
export function reachesSite(worker: CandidateWorker, search: JobSearch, distanceKm: number): boolean {
  if (distanceKm <= MAX_DISTANCE_KM) return true;
  return Boolean(worker.workArea && search.place && coversPlace(worker.workArea, search.place));
}

/** Candidatos que cumplen, del mejor al peor. Empates: por id, para que el orden sea estable. */
export function rankCandidates(workers: readonly CandidateWorker[], search: JobSearch): RankedCandidate[] {
  ensure(Number.isInteger(search.days) && search.days >= 1, "Los días deben ser un entero positivo");
  return workers
    .filter((worker) => doesTrade(worker, search.trade) && worker.level >= search.minLevel)
    .map((worker) => ({ worker, distanceKm: haversineKm(worker.location, search.site) }))
    .filter(
      ({ worker, distanceKm }) => reachesSite(worker, search, distanceKm) && isAvailable(worker, search),
    )
    .map(({ worker, distanceKm }) => ({
      candidate: toPublic(worker, distanceKm),
      score: candidateScore(worker, distanceKm),
    }))
    .sort((a, b) => b.score - a.score || a.candidate.workerId.localeCompare(b.candidate.workerId));
}
