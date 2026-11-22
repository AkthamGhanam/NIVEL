import { z } from "zod";

import { UnauthorizedError } from "../../errors";
import { getDemoState, resolvePersona } from "../../use-cases/personas";
import { ApiResponse, endpoint, type RuntimeProvider } from "../endpoint";
import { idSchema } from "./schemas";

const MAX_KEY_LENGTH = 256;

const selectionSchema = z.discriminatedUnion("role", [
  z.strictObject({ role: z.enum(["worker", "company", "academy"]), id: idSchema }),
  z.strictObject({ role: z.literal("admin"), key: z.string().min(1).max(MAX_KEY_LENGTH) }),
]);

export const stateRoutes = (runtime: RuntimeProvider) => ({
  /** Personajes disponibles, persona activa por vista y banderas de la demo. */
  get: endpoint({ access: "public" }, ({ context, sessions }) => getDemoState(context, sessions), runtime),

  /** Entra como un personaje del seed, o como equipo con la clave de la demo. */
  select: endpoint(
    { access: "public", body: selectionSchema },
    async ({ body, context, sessions, issueSession, isDemoKey }) => {
      let actor;
      if (body.role === "admin") {
        if (!isDemoKey(body.key)) throw new UnauthorizedError("La clave no es correcta.");
        actor = { role: "admin" } as const;
      } else {
        actor = await resolvePersona(context, body);
      }
      const state = await getDemoState(context, { ...sessions, [actor.role]: actor });
      return new ApiResponse(state, { headers: { "Set-Cookie": issueSession(actor) } });
    },
    runtime,
  ),
});
