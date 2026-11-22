import { z } from "zod";

/**
 * Variables de entorno de los scripts de voz. Los scripts no pueden importar
 * `src/server/config/env.ts` (es `server-only`), así que validan aquí lo que
 * usan. Los mensajes nombran la variable, nunca su valor.
 */

const MIN_SECRET_LENGTH = 32;

const RULES = {
  ELEVENLABS_API_KEY: z.string().trim().min(1),
  EL_VOICE_ID: z.string().trim().min(1),
  EL_AGENT_WORKER_ID: z.string().trim().min(1),
  TOOL_SECRET: z.string().min(MIN_SECRET_LENGTH, `debe tener al menos ${MIN_SECRET_LENGTH} caracteres`),
  NEXT_PUBLIC_APP_URL: z.url({ protocol: /^https$/, error: "debe ser una URL https pública" }),
} as const;

export type ScriptEnvKey = keyof typeof RULES;

export function scriptEnv(
  key: ScriptEnvKey,
  source: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const value = source[key];
  if (value === undefined || value === "") throw new Error(`Falta la variable de entorno ${key}`);
  const result = RULES[key].safeParse(value);
  if (!result.success) throw new Error(`${key}: ${result.error.issues[0]?.message ?? "valor inválido"}`);
  return result.data;
}
