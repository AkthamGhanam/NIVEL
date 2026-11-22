import "server-only";

import { createElevenLabs } from "./adapters/elevenlabs";
import { createTelegram } from "./adapters/telegram";
import { requireEnv, serverEnv } from "./config/env";
import { type AppContext, createContext } from "./context";
import { type DatabaseHandle, migrate, openDatabase } from "./db/client";

/**
 * Composición de la aplicación: una conexión y un contexto por proceso.
 * Las tablas se crean en el primer uso (idempotente), así un despliegue
 * nuevo funciona sin pasos manuales.
 */

interface App {
  readonly handle: DatabaseHandle;
  readonly context: AppContext;
}

let appPromise: Promise<App> | undefined;

async function start(): Promise<App> {
  const handle = openDatabase({
    url: requireEnv("TURSO_DATABASE_URL"),
    authToken: serverEnv().TURSO_AUTH_TOKEN,
  });
  await migrate(handle);
  const env = serverEnv();
  const voiceKey = env.ELEVENLABS_API_KEY;
  const telegram = env.TELEGRAM_BOT_TOKEN
    ? {
        api: createTelegram({ token: env.TELEGRAM_BOT_TOKEN }),
        appUrl: env.NEXT_PUBLIC_APP_URL,
        transcribe: voiceKey
          ? (audio: Blob) => createElevenLabs({ apiKey: voiceKey }).transcribe(audio)
          : undefined,
      }
    : undefined;
  return {
    handle,
    context: createContext({ db: handle.db, secret: requireEnv("SESSION_SECRET"), telegram }),
  };
}

export function app(): Promise<App> {
  appPromise ??= start().catch((error: unknown) => {
    appPromise = undefined; // Permite reintentar en la siguiente petición.
    throw error;
  });
  return appPromise;
}
