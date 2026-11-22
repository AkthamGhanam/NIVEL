import { and, eq, isNull } from "drizzle-orm";

import { ensure } from "@/lib/errors";
import { RATING_TAGS, type RatingRole } from "@/lib/rating-tags";

import type { Actor } from "../actor";
import type { AppContext } from "../context";
import { writeTransaction } from "../db/write-transaction";
import { contracts, ratings } from "../db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors";
import { logEvent } from "./events";

export { RATING_TAGS, type RatingRole };

export interface NewRating {
  readonly contractId: string;
  readonly quality: number;
  readonly punctuality: number;
  readonly safety: number;
  readonly attitude: number;
  readonly tags: readonly string[];
  readonly comment?: string | undefined;
}

export const REVEAL_AFTER_DAYS = 7;
const MIN_SCORE = 1;
const MAX_SCORE = 5;
const MAX_COMMENT_LENGTH = 500;

export type RatingRow = typeof ratings.$inferSelect;

function assertValidRating(role: RatingRole, input: NewRating): void {
  const scores = [input.quality, input.punctuality, input.safety, input.attitude];
  ensure(
    scores.every((score) => Number.isInteger(score) && score >= MIN_SCORE && score <= MAX_SCORE),
    "Cada categoría se califica del 1 al 5",
  );
  const allowed: readonly string[] = RATING_TAGS[role];
  ensure(
    input.tags.every((tag) => allowed.includes(tag)),
    "Usa solo las etiquetas disponibles",
  );
  ensure((input.comment?.length ?? 0) <= MAX_COMMENT_LENGTH, "El comentario es demasiado largo");
}

function partyOf(actor: Actor, contract: typeof contracts.$inferSelect): { role: RatingRole; toId: string } {
  if (actor.role === "worker" && actor.workerId === contract.workerId) {
    return { role: "trabajador", toId: contract.companyId };
  }
  if (actor.role === "company" && actor.companyId === contract.companyId) {
    return { role: "empresa", toId: contract.workerId };
  }
  throw new ForbiddenError();
}

export interface RatingSubmitted {
  /** Doble ciega: verdadero cuando ya calificaron las dos partes y ambas notas se revelan. */
  readonly revealed: boolean;
}

/**
 * Calificación privada y doble ciega. La nota no se revela hasta que la otra
 * parte califica (o pasan 7 días), para que nadie califique en represalia.
 */
export async function submitRating(
  context: AppContext,
  actor: Actor,
  input: NewRating,
): Promise<RatingSubmitted> {
  const [contract] = await context.db.select().from(contracts).where(eq(contracts.id, input.contractId));
  if (!contract) throw new NotFoundError("el contrato");
  const { role, toId } = partyOf(actor, contract);
  assertValidRating(role, input);
  if (contract.status !== "completado")
    throw new ConflictError("Podrás calificar cuando el pago esté confirmado.");
  const existing = await context.db.select().from(ratings).where(eq(ratings.contractId, contract.id));
  if (existing.some((rating) => rating.fromRole === role))
    throw new ConflictError("Ya calificaste este trabajo.");
  const submittedAt = context.now().toISOString();
  const bothRated = existing.length > 0;
  await writeTransaction(context.db, async (tx) => {
    await tx.insert(ratings).values({
      id: context.newId("ra"),
      contractId: contract.id,
      fromRole: role,
      toId,
      quality: input.quality,
      punctuality: input.punctuality,
      safety: input.safety,
      attitude: input.attitude,
      tags: [...input.tags],
      comment: input.comment?.trim() || null,
      submittedAt,
      revealedAt: bothRated ? submittedAt : null,
    });
    if (bothRated) {
      await tx
        .update(ratings)
        .set({ revealedAt: submittedAt })
        .where(and(eq(ratings.contractId, contract.id), isNull(ratings.revealedAt)));
    }
  });
  await logEvent(context, {
    actor: role === "empresa" ? "Empresa" : "Trabajador",
    type: "calificacion_privada",
    label: bothRated
      ? "Calificaciones privadas reveladas a ambas partes"
      : "Calificación privada enviada (doble ciega)",
    detail: { contractId: contract.id },
  });
  return { revealed: bothRated };
}

const MS_PER_DAY = 86_400_000;

/** ¿Ya puede verla quien la recibió? Revelada por ambas partes o por el plazo de 7 días. */
export function isRevealed(rating: Pick<RatingRow, "revealedAt" | "submittedAt">, now: Date): boolean {
  if (rating.revealedAt) return true;
  return now.getTime() - Date.parse(rating.submittedAt) >= REVEAL_AFTER_DAYS * MS_PER_DAY;
}
