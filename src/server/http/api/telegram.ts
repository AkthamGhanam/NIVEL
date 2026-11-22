// Rutas de Telegram: conectar el chat desde la app, recibir lo que manda el bot y registrar el webhook.
import { z } from "zod";

import { UnauthorizedError } from "../../errors";
import {
  createTelegramLink,
  handleTelegramUpdate,
  setupTelegramWebhook,
  telegramLinkStatus,
  unlinkTelegram,
  webhookSecret,
} from "../../use-cases/telegram";
import { endpoint, type RuntimeProvider } from "../endpoint";
import type { RateRule } from "../rate-limit";
import { secretMatches } from "../session";
import { emptyBody } from "./schemas";

/** Cabecera con la que Telegram demuestra que la llamada es suya. */
export const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";

/** Cada enlace abre un código de un solo uso: no hace falta pedir muchos. */
const LINK_LIMIT: RateRule & { bucket: string } = Object.freeze({
  bucket: "telegram-enlace",
  limit: 20,
  windowSeconds: 300,
});

const ACCOUNT = ["worker", "company"] as const;

export const telegramRoutes = (runtime: RuntimeProvider) => ({
  status: endpoint({ access: ACCOUNT }, ({ actor, context }) => telegramLinkStatus(context, actor), runtime),

  link: endpoint(
    { access: ACCOUNT, body: emptyBody, limit: LINK_LIMIT },
    ({ actor, context }) => createTelegramLink(context, actor),
    runtime,
  ),

  unlink: endpoint({ access: ACCOUNT }, ({ actor, context }) => unlinkTelegram(context, actor), runtime),

  /**
   * Lo que manda Telegram. Solo se atiende si trae la firma acordada al registrar
   * el webhook; quién es la persona sale del chat conectado, no del mensaje.
   */
  webhook: endpoint(
    { access: "public", body: z.looseObject({}) },
    async ({ body, header, context }) => {
      if (!secretMatches(header(TELEGRAM_SECRET_HEADER), webhookSecret(context)))
        throw new UnauthorizedError();
      await handleTelegramUpdate(context, body);
      return { ok: true };
    },
    runtime,
  ),

  /** El equipo registra el webhook una vez por despliegue, desde el panel de datos. */
  setup: endpoint(
    { access: "admin", body: emptyBody },
    ({ context }) => setupTelegramWebhook(context),
    runtime,
  ),
});
