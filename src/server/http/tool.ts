import { z, ZodError } from "zod";

import { DomainValidationError } from "@/lib/errors";

import type { Actor } from "../actor";
import type { AppContext } from "../context";
import { AppError, ForbiddenError } from "../errors";
import { logEvent } from "../use-cases/events";
import { workerOfConversation } from "../use-cases/registration";
import { endpoint, type RouteHandler, type RuntimeProvider } from "./endpoint";
import type { ToolContext } from "./tool-context";

/**
 * Envoltorio de las herramientas que llaman los agentes de voz (webhooks).
 * Autentica con `x-tool-secret`, valida el cuerpo y responde siempre un JSON
 * corto con `say`: la frase que el agente lee en voz alta. Un dato inválido o
 * una regla de negocio no son un fallo HTTP: vuelven como `ok: false` con una
 * frase que el agente puede decir para corregir el rumbo.
 *
 * En nombre de quién actúa la herramienta sale del contexto firmado por el
 * servidor (cabecera `x-nivel-context`), nunca de lo que diga el modelo.
 */

/** Id de conversación de ElevenLabs (variable de sistema `system__conversation_id`). */
export const conversationIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,80}$/, "id de conversación inválido");

export interface ToolResult {
  readonly say: string;
  readonly [field: string]: unknown;
}

type WorkerActor = Extract<Actor, { role: "worker" }>;
type CompanyActor = Extract<Actor, { role: "company" }>;

export interface ToolInput<Body> {
  readonly body: Body;
  readonly context: AppContext;
  /** Contexto firmado de la conversación; indefinido si no vino o no es válido. */
  readonly toolContext: ToolContext | undefined;
  /** Empresa con sesión que abrió la conversación. Lanza si no la hay. */
  readonly company: () => CompanyActor;
  /** Trabajador de la conversación: el de la sesión o el que se registró en ella. */
  readonly worker: (conversationId: string | undefined) => Promise<WorkerActor | undefined>;
}

interface ToolSpec<Schema extends z.ZodType> {
  readonly name: string;
  readonly body: Schema;
}

const looseBody = z.record(z.string(), z.unknown());

function sayForInvalidBody(error: ZodError): string {
  const fields = [...new Set(error.issues.map((issue) => String(issue.path[0] ?? "datos")))];
  return `Me faltan o no entendí estos datos: ${fields.join(", ")}. Pregúntalos de nuevo y vuelve a intentarlo.`;
}

/** Errores que el agente puede explicar hablando; el resto son fallos reales. */
function sayForFailure(error: unknown): string | undefined {
  if (error instanceof ZodError) return sayForInvalidBody(error);
  if (error instanceof DomainValidationError) return error.message;
  if (error instanceof AppError && error.status < 500 && error.status !== 429) return error.message;
  return undefined;
}

function actorsFrom(context: AppContext, toolContext: ToolContext | undefined) {
  const sessionActor = toolContext?.kind === "actor" ? toolContext.actor : undefined;
  return {
    company: (): CompanyActor => {
      if (sessionActor?.role === "company") return sessionActor;
      throw new ForbiddenError("Para esto primero entra a NIVEL como empresa.");
    },
    worker: async (conversationId: string | undefined): Promise<WorkerActor | undefined> => {
      if (sessionActor?.role === "worker") return sessionActor;
      return conversationId ? workerOfConversation(context, conversationId) : undefined;
    },
  };
}

export function tool<Schema extends z.ZodType>(
  spec: ToolSpec<Schema>,
  handler: (input: ToolInput<z.infer<Schema>>) => Promise<ToolResult>,
  runtime: RuntimeProvider,
): RouteHandler {
  return endpoint(
    { access: "tool", body: looseBody },
    async ({ body, context, toolContext }) => {
      const startedAt = performance.now();
      let result: ToolResult & { ok: boolean };
      try {
        const parsed = spec.body.parse(body) as z.infer<Schema>;
        const answer = await handler({
          body: parsed,
          context,
          toolContext,
          ...actorsFrom(context, toolContext),
        });
        result = { ok: true, ...answer };
      } catch (error) {
        const say = sayForFailure(error);
        if (say === undefined) throw error;
        result = { ok: false, say };
      }
      // Solo el nombre de la herramienta y su latencia: nunca lo que se dijo.
      await logEvent(context, {
        actor: "Nivi",
        type: `herramienta_${spec.name}`,
        label: `Nivi usó ${spec.name}${result.ok ? "" : " · pidió corregir un dato"}`,
        latencyMs: performance.now() - startedAt,
        product: "agents",
      });
      return result;
    },
    runtime,
  );
}
