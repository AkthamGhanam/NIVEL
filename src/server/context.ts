import { createHmac } from "node:crypto";

import { customAlphabet } from "nanoid";

import type { TelegramApi } from "./adapters/telegram";
import type { Database } from "./db/client";

/** Canal de Telegram, si el bot está configurado: el cliente y la dirección pública de la app para los enlaces. */
export interface TelegramChannel {
  readonly api: TelegramApi;
  readonly appUrl: string | undefined;
}

/**
 * Dependencias de los casos de uso. El reloj y el generador de ids se
 * inyectan para que las pruebas sean deterministas.
 */
export interface AppContext {
  readonly db: Database;
  readonly now: () => Date;
  readonly newId: (prefix: string) => string;
  /** HMAC con el secreto del servidor: para guardar códigos sin dejarlos en claro. */
  readonly sign: (value: string) => string;
  /** Ausente si no hay bot configurado: entonces nadie recibe avisos por Telegram y nada falla. */
  readonly telegram?: TelegramChannel | undefined;
}

const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const ID_LENGTH = 16;
const randomId = customAlphabet(ID_ALPHABET, ID_LENGTH);

export interface ContextOptions {
  readonly db: Database;
  readonly secret: string;
  readonly now?: () => Date;
  readonly telegram?: TelegramChannel | undefined;
}

export function createContext({ db, secret, now = () => new Date(), telegram }: ContextOptions): AppContext {
  return {
    db,
    now,
    telegram,
    newId: (prefix) => `${prefix}-${randomId()}`,
    sign: (value) => createHmac("sha256", secret).update(value).digest("hex"),
  };
}
