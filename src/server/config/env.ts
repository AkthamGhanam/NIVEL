import "server-only";

import { z } from "zod";

/**
 * Contrato de configuración (12-Factor). Todo viene del entorno; nada de
 * secretos en el código. Cada variable es opcional al arrancar para que la
 * app levante por fases, pero `requireEnv` falla con un mensaje claro en
 * cuanto una función necesita una que falta o es inválida.
 */

const MIN_SECRET_LENGTH = 32;

const secret = z
  .string()
  .trim()
  .min(MIN_SECRET_LENGTH, `debe tener al menos ${MIN_SECRET_LENGTH} caracteres`);
const firstToken = z.string().transform((value) => value.trim().split(/\s+/)[0] ?? "");
const nonEmpty = z.string().trim().min(1);

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ELEVENLABS_API_KEY: nonEmpty.optional(),
  EL_AGENT_WORKER_ID: nonEmpty.optional(),
  EL_AGENT_CONTRACTOR_ID: nonEmpty.optional(),
  EL_VOICE_ID: nonEmpty.optional(),
  TOOL_SECRET: firstToken.pipe(secret).optional(),
  DEMO_RESET_KEY: secret.optional(),
  SESSION_SECRET: secret.optional(),
  TURSO_DATABASE_URL: z
    .string()
    .regex(/^(file:|libsql:\/\/|https:\/\/)/, "debe empezar por file:, libsql:// o https://")
    .optional(),
  TURSO_AUTH_TOKEN: nonEmpty.optional(),
  NEXT_PUBLIC_APP_URL: z.url({ protocol: /^https?$/ }).optional(),
  BLOB_READ_WRITE_TOKEN: nonEmpty.optional(),
  ANTHROPIC_API_KEY: nonEmpty.optional(),
  /** Token del bot que entrega @BotFather. Solo cuenta su primera palabra, por si se pegó texto de más. */
  TELEGRAM_BOT_TOKEN: firstToken
    .pipe(z.string().regex(/^\d+:[A-Za-z0-9_-]{30,}$/, "no tiene la forma de un token de bot"))
    .optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
type EnvKey = Exclude<keyof ServerEnv, "NODE_ENV">;

export class ConfigError extends Error {
  override readonly name = "ConfigError";
}

/** Valida un entorno arbitrario. Pura: útil en pruebas. */
export function parseServerEnv(source: Readonly<Record<string, string | undefined>>): ServerEnv {
  const blankToUndefined = Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, value === "" ? undefined : value]),
  );
  const result = serverEnvSchema.safeParse(blankToUndefined);
  if (!result.success) {
    // Solo nombres de variables y el problema: nunca el valor (podría ser un secreto).
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new ConfigError(`Configuración inválida → ${problems.join("; ")}`);
  }
  return result.data;
}

let cachedEnv: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cachedEnv ??= parseServerEnv(process.env);
  return cachedEnv;
}

/** Devuelve una variable obligatoria para la función que la pide, o falla con un error claro. */
export function requireEnv<K extends EnvKey>(
  key: K,
  env: ServerEnv = serverEnv(),
): NonNullable<ServerEnv[K]> {
  const value = env[key];
  if (value === undefined) {
    throw new ConfigError(`Falta la variable de entorno ${key}`);
  }
  return value as NonNullable<ServerEnv[K]>;
}
