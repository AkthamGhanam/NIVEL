import { eq } from "drizzle-orm";

import { computeLevel, type Level, LEVEL_NAMES, MARKET_REFERENCE_BANDS } from "@/lib/level";
import { explainLevel } from "@/lib/level-explanation";
import { shortName } from "@/lib/matching";

import type { Actor } from "../actor";
import type { AppContext } from "../context";
import { workers } from "../db/schema";
import { ForbiddenError, NotFoundError } from "../errors";
import { loadWorkerFacts } from "../repos/worker-facts";
import { logEvent } from "./events";

export interface LevelStatus {
  readonly workerId: string;
  readonly previousLevel: Level;
  readonly level: Level;
  readonly levelName: string;
  readonly leveledUp: boolean;
  /** Qué le falta para el siguiente nivel, en lenguaje simple. */
  readonly explanation: string;
  /** Referencia de mercado en USD al mes. No es una promesa de salario. */
  readonly referenceBand: { readonly min: number; readonly max: number };
  readonly facts: {
    readonly confirmedJobs: number;
    readonly practicalPassed: boolean;
    readonly certificates: number;
    readonly attendanceRate: number;
  };
}

function assertCanSee(actor: Actor, workerId: string): void {
  const isSelf = actor.role === "worker" && actor.workerId === workerId;
  if (!isSelf && actor.role !== "admin") throw new ForbiddenError();
}

async function evaluate(context: AppContext, workerId: string): Promise<LevelStatus> {
  const [facts] = await loadWorkerFacts(context.db, { workerIds: [workerId] });
  if (!facts) throw new NotFoundError("el perfil");
  const level = computeLevel(facts.levelInput, { now: context.now(), currentLevel: facts.level });
  return {
    workerId,
    previousLevel: facts.level,
    level,
    levelName: LEVEL_NAMES[level],
    leveledUp: level > facts.level,
    explanation: explainLevel(facts.levelInput, level),
    referenceBand: MARKET_REFERENCE_BANDS[level],
    facts: {
      confirmedJobs: facts.levelInput.confirmedJobs,
      practicalPassed: facts.levelInput.practicalPassed,
      certificates: facts.levelInput.certificates,
      attendanceRate: facts.levelInput.attendanceRate,
    },
  };
}

/** Nivel actual y qué falta para el siguiente, sin modificar nada. */
export async function getLevelStatus(
  context: AppContext,
  actor: Actor,
  workerId: string,
): Promise<LevelStatus> {
  assertCanSee(actor, workerId);
  return evaluate(context, workerId);
}

/** Recalcula el nivel con la fórmula pública a partir de hechos verificables y lo guarda si cambió. */
export async function recalculateLevel(
  context: AppContext,
  actor: Actor,
  workerId: string,
): Promise<LevelStatus> {
  assertCanSee(actor, workerId);
  const status = await evaluate(context, workerId);
  if (status.level === status.previousLevel) return status;
  const [updated] = await context.db
    .update(workers)
    .set({ level: status.level })
    .where(eq(workers.id, workerId))
    .returning({ name: workers.name });
  await logEvent(context, {
    actor: "NIVEL",
    type: status.leveledUp ? "nivel_sube" : "nivel_actualizado",
    label: `${shortName(updated?.name ?? "")} pasa a Nivel ${status.level}: ${status.levelName}`,
    detail: { workerId, from: status.previousLevel, to: status.level },
  });
  return status;
}
