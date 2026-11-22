// Conectar el chat de Telegram de quien tiene la sesión (trabajador o empresa).
import type { TelegramLinkStatus } from "@/server/use-cases/telegram";

import type { ApiRequest, ViewRole } from "./api";

export type { TelegramLinkStatus };

const PATH = "/api/telegram/link";

export function createTelegramApi(request: ApiRequest, as: Extract<ViewRole, "worker" | "company">) {
  return {
    status: (signal?: AbortSignal) => request<TelegramLinkStatus>(PATH, signal ? { as, signal } : { as }),
    /** Enlace de un solo uso que abre el bot ya conectado a esta cuenta. */
    link: () => request<{ url: string }>(PATH, { as, method: "POST", body: {} }),
    unlink: () => request<TelegramLinkStatus>(PATH, { as, method: "DELETE" }),
  };
}

export type TelegramClient = ReturnType<typeof createTelegramApi>;
