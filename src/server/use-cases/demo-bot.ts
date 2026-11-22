import { and, eq, inArray } from "drizzle-orm";

import type { AppContext } from "../context";
import { invitations } from "../db/schema";
import { IDS } from "../db/seed/cast";
import { ConflictError } from "../errors";
import { isDemoFlagOn } from "./demo-state";
import { respondToInvitation } from "./invitations";

/**
 * Bot del Modo Jurado: responde por los personajes que no están en el
 * escenario. Rafael y José aceptan a los 3 s; Luis rechaza a los 6 s.
 * Nunca actúa por Carlos (su teléfono está en el escenario) ni por nadie más.
 * No usa temporizadores: avanza cada vez que la empresa consulta su tablero.
 */
const SCRIPT: ReadonlyArray<{ workerId: string; accept: boolean; afterSeconds: number }> = [
  { workerId: IDS.rafael, accept: true, afterSeconds: 3 },
  { workerId: IDS.jose, accept: true, afterSeconds: 3 },
  { workerId: IDS.luis, accept: false, afterSeconds: 6 },
];

const MS_PER_SECOND = 1000;

/** Responde las invitaciones del guion que ya cumplieron su espera. Devuelve cuántas respondió. */
export async function runDemoBot(context: AppContext, requestId: string): Promise<number> {
  if (!(await isDemoFlagOn(context, "bot"))) return 0;
  const pending = await context.db
    .select({ id: invitations.id, workerId: invitations.workerId, createdAt: invitations.createdAt })
    .from(invitations)
    .where(
      and(
        eq(invitations.requestId, requestId),
        eq(invitations.status, "enviada"),
        inArray(
          invitations.workerId,
          SCRIPT.map((line) => line.workerId),
        ),
      ),
    );
  const nowMs = context.now().getTime();
  let answered = 0;
  for (const line of SCRIPT) {
    const invitation = pending.find((row) => row.workerId === line.workerId);
    if (!invitation || nowMs - Date.parse(invitation.createdAt) < line.afterSeconds * MS_PER_SECOND) continue;
    try {
      await respondToInvitation(
        context,
        { role: "worker", workerId: line.workerId },
        { invitationId: invitation.id, accept: line.accept },
      );
      answered += 1;
    } catch (error) {
      // Otra consulta simultánea ya la respondió, o la cuadrilla se completó: no hay nada que hacer.
      if (!(error instanceof ConflictError)) throw error;
    }
  }
  return answered;
}
