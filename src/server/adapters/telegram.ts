/**
 * Cliente mínimo de la API de bots de Telegram: enviar mensajes con botones,
 * responder toques y registrar el webhook. El token va en la dirección de cada
 * llamada, así que ni la dirección ni el token entran jamás en un error o un log.
 */

export const TELEGRAM_API_BASE = "https://api.telegram.org";
/** Un mensaje no debe frenar a quien espera la respuesta de la app. */
export const TELEGRAM_TIMEOUT_MS = 4000;
/** Límite de Telegram para el texto de un mensaje. */
export const MAX_MESSAGE_LENGTH = 4096;

/** Botón bajo un mensaje: avisa al bot (`data`) o abre una dirección (`url`). */
export type TelegramButton =
  { readonly text: string; readonly data: string } | { readonly text: string; readonly url: string };

export interface TelegramMessageOptions {
  readonly buttons?: ReadonlyArray<readonly TelegramButton[]> | undefined;
  /** Muestra un botón grande para que la persona envíe su ubicación de un toque. */
  readonly askLocation?: string | undefined;
  /** Quita el botón de ubicación si estaba a la vista. */
  readonly clearKeyboard?: boolean | undefined;
}

export interface TelegramApi {
  readonly sendMessage: (chatId: string, text: string, options?: TelegramMessageOptions) => Promise<void>;
  readonly answerCallback: (callbackId: string, text?: string) => Promise<void>;
  readonly setWebhook: (url: string, secret: string) => Promise<void>;
  /** Descarga un archivo que la persona envió al bot (una nota de voz). Tiene tope de tamaño. */
  readonly downloadFile: (fileId: string) => Promise<Blob>;
  /** Nombre de usuario del bot, sin arroba. Se pide una vez y se recuerda. */
  readonly botUsername: () => Promise<string>;
}

export class TelegramError extends Error {
  override readonly name = "TelegramError";
  constructor(
    readonly method: string,
    readonly status: number | undefined,
    detail: string,
  ) {
    super(`Telegram ${method} falló${status === undefined ? "" : ` (${status})`}: ${detail}`);
  }
}

export interface TelegramOptions {
  readonly token: string;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
}

const MAX_DETAIL_LENGTH = 200;

function replyMarkup(options: TelegramMessageOptions): Record<string, unknown> | undefined {
  if (options.buttons && options.buttons.length > 0) {
    return {
      inline_keyboard: options.buttons.map((row) =>
        row.map((button) =>
          "url" in button
            ? { text: button.text, url: button.url }
            : { text: button.text, callback_data: button.data },
        ),
      ),
    };
  }
  if (options.askLocation) {
    return {
      keyboard: [[{ text: options.askLocation, request_location: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    };
  }
  return options.clearKeyboard ? { remove_keyboard: true } : undefined;
}

type Call = (method: string, payload: Record<string, unknown>) => Promise<unknown>;

/** Una llamada a la API con tiempo límite. Los errores nunca llevan la dirección, que contiene el token. */
function createCall(options: TelegramOptions): Call {
  const send = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? TELEGRAM_TIMEOUT_MS;
  return async (method, payload) => {
    let response: Response;
    try {
      response = await send(`${TELEGRAM_API_BASE}/bot${options.token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new TelegramError(method, undefined, error instanceof Error ? error.name : "sin respuesta");
    }
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      description?: string;
      result?: unknown;
    } | null;
    if (!response.ok || !body?.ok) {
      const detail = (body?.description ?? "respuesta inesperada")
        .replaceAll(options.token, "[token]")
        .slice(0, MAX_DETAIL_LENGTH);
      throw new TelegramError(method, response.status, detail);
    }
    return body.result;
  };
}

/** Una nota de voz de un minuto pesa mucho menos; el tope evita descargar archivos enormes. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
const FILE_PATH = /^[A-Za-z0-9_\-./]{1,200}$/;

async function download(options: TelegramOptions, call: Call, fileId: string): Promise<Blob> {
  const info = (await call("getFile", { file_id: fileId })) as {
    file_path?: unknown;
    file_size?: unknown;
  } | null;
  const path = info?.file_path;
  if (typeof path !== "string" || !FILE_PATH.test(path) || path.includes("..")) {
    throw new TelegramError("getFile", 200, "ruta inesperada");
  }
  if (typeof info?.file_size === "number" && info.file_size > MAX_FILE_BYTES) {
    throw new TelegramError("getFile", 200, "archivo demasiado grande");
  }
  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(`${TELEGRAM_API_BASE}/file/bot${options.token}/${path}`, {
      signal: AbortSignal.timeout(options.timeoutMs ?? TELEGRAM_TIMEOUT_MS),
    });
  } catch (error) {
    throw new TelegramError("download", undefined, error instanceof Error ? error.name : "sin respuesta");
  }
  if (!response.ok) throw new TelegramError("download", response.status, "no se pudo descargar");
  const audio = await response.blob();
  if (audio.size > MAX_FILE_BYTES) throw new TelegramError("download", 200, "archivo demasiado grande");
  return new Blob([audio], { type: "audio/ogg" });
}

async function fetchUsername(call: Call): Promise<string> {
  const result = await call("getMe", {});
  const name = (result as { username?: unknown } | null)?.username;
  if (typeof name !== "string" || name === "") throw new TelegramError("getMe", 200, "sin usuario");
  return name;
}

export function createTelegram(options: TelegramOptions): TelegramApi {
  const call = createCall(options);
  let username: Promise<string> | undefined;
  return {
    sendMessage: async (chatId, text, messageOptions = {}) => {
      const markup = replyMarkup(messageOptions);
      await call("sendMessage", {
        chat_id: chatId,
        text: text.slice(0, MAX_MESSAGE_LENGTH),
        link_preview_options: { is_disabled: true },
        ...(markup ? { reply_markup: markup } : {}),
      });
    },
    answerCallback: async (callbackId, text) => {
      await call("answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text } : {}) });
    },
    setWebhook: async (url, secret) => {
      await call("setWebhook", {
        url,
        secret_token: secret,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true,
      });
    },
    downloadFile: (fileId) => download(options, call, fileId),
    botUsername: () => {
      username ??= fetchUsername(call).catch((error: unknown) => {
        username = undefined; // Un fallo pasajero no debe quedar recordado.
        throw error;
      });
      return username;
    },
  };
}
