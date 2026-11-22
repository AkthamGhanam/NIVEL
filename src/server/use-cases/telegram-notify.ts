// Avisos por Telegram a quien conectó su chat. Nunca frenan ni rompen la acción que los origina.
import { and, eq } from "drizzle-orm";

import type { TelegramButton, TelegramMessageOptions } from "../adapters/telegram";
import type { AppContext } from "../context";
import { telegramLinks } from "../db/schema";
import { log } from "../log";

/** Un mensaje del bot: el texto y, si hace falta, sus botones. */
export type TelegramNote = { readonly text: string } & TelegramMessageOptions;

export interface TelegramTarget {
  readonly role: "worker" | "company";
  readonly subjectId: string;
}

/** Enlace a una pantalla de la app, solo si la dirección pública es https (Telegram no acepta otras). */
export function appLink(context: AppContext, path: string): string | undefined {
  const base = context.telegram?.appUrl;
  return base?.startsWith("https://") ? new URL(path, base).href : undefined;
}

/** Botón que abre la app. Sin dirección pública, no hay botón. */
export function openAppButton(context: AppContext, text: string, path: string): TelegramButton[] {
  const url = appLink(context, path);
  return url ? [{ text, url }] : [];
}

/** Envía un mensaje a un chat. Si Telegram falla, se anota y se sigue: es un aviso, no la operación. */
export async function sendToChat(context: AppContext, chatId: string, message: TelegramNote): Promise<void> {
  if (!context.telegram) return;
  const { text, ...options } = message;
  try {
    await context.telegram.api.sendMessage(chatId, text, options);
  } catch (error) {
    log("warn", "telegram_send_failed", { error: error instanceof Error ? error.message : "desconocido" });
  }
}

/** Avisa a todos los chats conectados a esa cuenta. Sin bot o sin chat conectado, no hace nada. */
export async function notifyByTelegram(
  context: AppContext,
  target: TelegramTarget,
  message: TelegramNote,
): Promise<void> {
  if (!context.telegram) return;
  try {
    const chats = await context.db
      .select({ chatId: telegramLinks.chatId })
      .from(telegramLinks)
      .where(and(eq(telegramLinks.role, target.role), eq(telegramLinks.subjectId, target.subjectId)));
    await Promise.all(chats.map(({ chatId }) => sendToChat(context, chatId, message)));
  } catch (error) {
    log("warn", "telegram_notify_failed", { error: error instanceof Error ? error.name : "desconocido" });
  }
}
