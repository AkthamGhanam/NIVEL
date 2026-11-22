import { addDays, type IsoDate } from "./dates";
import { ensure } from "./errors";
import { type GeoPoint, haversineKm } from "./geo";
import type { Level } from "./level";
import type { Trade } from "./trades";

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
  readonly level: Level;
  readonly confirmedJobs: number;
  readonly practicalPassed: boolean;
  readonly certificates: number;
  readonly location: GeoPoint;
  readonly busy: readonly BusyPeriod[];
}

export interface JobSearch {
  readonly trade: Trade;
  readonly minLevel: Level;
  readonly site: GeoPoint;
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

/** Candidatos que cumplen, del mejor al peor. Empates: por id, para que el orden sea estable. */
export function rankCandidates(workers: readonly CandidateWorker[], search: JobSearch): RankedCandidate[] {
  ensure(Number.isInteger(search.days) && search.days >= 1, "Los días deben ser un entero positivo");
  return workers
    .filter((worker) => worker.trade === search.trade && worker.level >= search.minLevel)
    .map((worker) => ({ worker, distanceKm: haversineKm(worker.location, search.site) }))
    .filter(({ worker, distanceKm }) => distanceKm <= MAX_DISTANCE_KM && isAvailable(worker, search))
    .map(({ worker, distanceKm }) => ({
      candidate: toPublic(worker, distanceKm),
      score: candidateScore(worker, distanceKm),
    }))
    .sort((a, b) => b.score - a.score || a.candidate.workerId.localeCompare(b.candidate.workerId));
}
