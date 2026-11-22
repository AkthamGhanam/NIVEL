import type { Actor } from "../actor";
import { isActor } from "./session";
import { seal, unseal } from "./signed-token";

/**
 * Contexto de una conversación de voz. El servidor lo firma al entregar el
 * token de conversación y vuelve en cada llamada de herramienta como cabecera
 * (variable secreta del agente): así el modelo de lenguaje nunca elige ni ve
 * en nombre de quién actúa, y nadie puede hacerse pasar por otra persona hablando.
 */
export type ToolContext =
  | { readonly kind: "actor"; readonly actor: Extract<Actor, { role: "worker" | "company" }> }
  /**
   * Registro de una persona nueva. `real` marca a quien se registra de verdad en el
   * evento; `consentAt` es cuándo aceptó en pantalla el uso de su voz y sus datos.
   */
  | { readonly kind: "registration"; readonly real: boolean; readonly consentAt: string };

export const TOOL_CONTEXT_HEADER = "x-nivel-context";
/** Una conversación de voz dura minutos; el contexto vence a la media hora. */
const TTL_MS = 30 * 60 * 1000;
const PURPOSE = "contexto-herramientas";

export function encodeToolContext(context: ToolContext, secret: string, now: Date): string {
  return seal(context, { purpose: PURPOSE, secret, now, ttlMs: TTL_MS });
}

function isToolContext(value: unknown): value is ToolContext {
  if (typeof value !== "object" || value === null) return false;
  const context = value as Record<string, unknown>;
  if (context.kind === "registration") {
    return typeof context.real === "boolean" && typeof context.consentAt === "string";
  }
  if (context.kind !== "actor" || !isActor(context.actor)) return false;
  return context.actor.role === "worker" || context.actor.role === "company";
}

export function decodeToolContext(token: string | null, secret: string, now: Date): ToolContext | undefined {
  const value = unseal(token, { purpose: PURPOSE, secret, now });
  return isToolContext(value) ? value : undefined;
}
