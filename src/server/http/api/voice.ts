import { z } from "zod";

import { ensure } from "@/lib/errors";

import { UnauthorizedError } from "../../errors";
import { claimProfile } from "../../use-cases/registration";
import { ApiResponse, endpoint, type RuntimeProvider } from "../endpoint";
import type { RateRule } from "../rate-limit";
import { conversationIdSchema } from "../tool";
import type { ToolContext } from "../tool-context";

/** Cada token abre una conversación que consume créditos de voz: tope propio por IP. */
const TOKEN_LIMIT: RateRule & { bucket: string } = Object.freeze({
  bucket: "token-voz",
  limit: 60,
  windowSeconds: 300,
});

const flag = z.enum(["1"]).optional();
const tokenQuery = z.object({
  agent: z.enum(["worker", "contractor"]),
  /** Registro de una persona nueva, aunque haya un personaje de ejemplo con sesión. */
  registro: flag,
  /** Persona real del evento: su perfil sobrevive al reset. */
  real: flag,
  /** La persona aceptó en pantalla el uso de su voz y sus datos. */
  consent: flag,
});

const query = (url: URL) => tokenQuery.parse(Object.fromEntries(url.searchParams));

export const voiceRoutes = (runtime: RuntimeProvider) => ({
  /**
   * Entrega el token para hablar con un agente y el contexto firmado que
   * viajará con cada herramienta: así el agente actúa en nombre de quien
   * tiene la sesión, no de quien diga ser durante la conversación.
   */
  token: endpoint(
    { access: "public", limit: TOKEN_LIMIT },
    async ({ url, sessions, context, issueToolContext, services }) => {
      const { agent, registro, real, consent } = query(url);
      const { company, worker } = sessions;
      let toolContext: ToolContext;
      if (agent === "contractor") {
        if (company?.role !== "company") throw new UnauthorizedError("Primero entra como empresa.");
        toolContext = { kind: "actor", actor: company };
      } else if (worker?.role === "worker" && !registro) {
        toolContext = { kind: "actor", actor: worker };
      } else {
        ensure(consent === "1", "Necesitamos tu permiso para usar tu voz y guardar tu perfil.");
        toolContext = { kind: "registration", real: real === "1", consentAt: context.now().toISOString() };
      }
      return {
        token: await services.conversationToken(agent),
        // Variable secreta del agente: se envía solo como cabecera de las herramientas, nunca al modelo.
        dynamicVariables: { secret__nivel_contexto: issueToolContext(toolContext) },
      };
    },
    runtime,
  ),

  /** La pantalla que habló con Nivi recoge su perfil recién creado y queda con la sesión abierta. */
  profileByConversation: endpoint(
    { access: "public" },
    async ({ params, context, issueSession }) => {
      const { actor, profile } = await claimProfile(context, conversationIdSchema.parse(params.id));
      return new ApiResponse({ profile }, { headers: { "Set-Cookie": issueSession(actor) } });
    },
    runtime,
  ),
});
