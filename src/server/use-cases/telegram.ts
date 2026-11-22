// El bot de Telegram de NIVEL: conectar un chat a una cuenta y atender lo que la persona toca o escribe.
import { and, eq, lt } from "drizzle-orm";
import { z } from "zod";

import { type ChatIntent, readBareNumber, readIntent, readRequestHints } from "@/lib/chat-intent";
import { addDays, localDate, resolveStartDate } from "@/lib/dates";
import { DomainValidationError } from "@/lib/errors";
import { formatDay, formatUsd, plural } from "@/lib/format";
import { type Level, LEVEL_NAMES } from "@/lib/level";
import { CONTRACT_TYPE_LABELS, TRADE_LABELS, TRADES, tradeCount } from "@/lib/trades";

import type { Actor } from "../actor";
import type { TelegramButton, TelegramMessageOptions } from "../adapters/telegram";
import type { AppContext } from "../context";
import { companies, telegramCodes, type TelegramDraft, telegramLinks, workers } from "../db/schema";
import { AppError, ConflictError } from "../errors";
import { log } from "../log";
import { workerIsActive } from "../repos/accounts";
import { listMyOffers, respondToInvitation, type WorkerOffer } from "./invitations";
import { getLevelStatus } from "./levels";
import { correctMyProfile, getMyProfile } from "./profile";
import { activeRequestBoard, createJobRequest, inviteCandidates, pinRequestSite } from "./requests";
import { appLink, openAppButton, sendToChat } from "./telegram-notify";
import { ENTRY_PREFIX, handleSignup, SIGNUP_CHOICE, WELCOME } from "./telegram-signup";

type LinkedActor = Extract<Actor, { role: "worker" | "company" }>;
type Link = typeof telegramLinks.$inferSelect;
type Reply = (text: string, options?: TelegramMessageOptions) => Promise<void>;
type Rows = ReadonlyArray<readonly TelegramButton[]>;

/** El código para conectar un chat dura lo justo para abrir Telegram y tocar "Iniciar". */
export const LINK_CODE_TTL_MS = 15 * 60 * 1000;

const subjectOf = (actor: LinkedActor) => (actor.role === "worker" ? actor.workerId : actor.companyId);
const actorOf = (link: Pick<Link, "role" | "subjectId">): LinkedActor =>
  link.role === "worker"
    ? { role: "worker", workerId: link.subjectId }
    : { role: "company", companyId: link.subjectId };

/** Secreto con el que Telegram firma cada llamada al webhook. Sale del secreto del servidor: no es otra variable. */
export const webhookSecret = (context: AppContext) => context.sign("telegram-webhook");

export const TELEGRAM_WEBHOOK_PATH = "/api/telegram/webhook";

export interface TelegramLinkStatus {
  /** El bot está configurado en el servidor. */
  readonly available: boolean;
  readonly linked: boolean;
}

export async function telegramLinkStatus(
  context: AppContext,
  actor: LinkedActor,
): Promise<TelegramLinkStatus> {
  if (!context.telegram) return { available: false, linked: false };
  const [link] = await context.db
    .select({ chatId: telegramLinks.chatId })
    .from(telegramLinks)
    .where(and(eq(telegramLinks.role, actor.role), eq(telegramLinks.subjectId, subjectOf(actor))));
  return { available: true, linked: link !== undefined };
}

/** Enlace de un solo uso que abre el bot ya conectado a la cuenta de quien tiene la sesión. */
export async function createTelegramLink(context: AppContext, actor: LinkedActor): Promise<{ url: string }> {
  if (!context.telegram) throw new ConflictError("Telegram aún no está configurado en NIVEL.");
  const now = context.now();
  const code = context.newId("tg");
  await context.db.delete(telegramCodes).where(lt(telegramCodes.expiresAt, now.toISOString()));
  await context.db.insert(telegramCodes).values({
    code,
    role: actor.role,
    subjectId: subjectOf(actor),
    expiresAt: new Date(now.getTime() + LINK_CODE_TTL_MS).toISOString(),
  });
  const bot = await context.telegram.api.botUsername();
  return { url: `https://t.me/${bot}?start=${code}` };
}

export async function unlinkTelegram(context: AppContext, actor: LinkedActor): Promise<TelegramLinkStatus> {
  await context.db
    .delete(telegramLinks)
    .where(and(eq(telegramLinks.role, actor.role), eq(telegramLinks.subjectId, subjectOf(actor))));
  return { available: context.telegram !== undefined, linked: false };
}

/** Registra en Telegram a dónde debe mandar los mensajes del bot. Se hace una vez por despliegue. */
export async function setupTelegramWebhook(context: AppContext): Promise<{ bot: string; webhook: string }> {
  if (!context.telegram) throw new ConflictError("Falta TELEGRAM_BOT_TOKEN en el servidor.");
  const webhook = appLink(context, TELEGRAM_WEBHOOK_PATH);
  if (!webhook) throw new ConflictError("NEXT_PUBLIC_APP_URL debe ser la dirección https de la app.");
  const bot = await context.telegram.api.botUsername();
  await context.telegram.api.setWebhook(webhook, webhookSecret(context));
  return { bot, webhook };
}

// ───────── Lo que llega de Telegram ─────────

const chatSchema = z.object({ id: z.number(), type: z.string() });

const updateSchema = z.object({
  message: z
    .object({
      chat: chatSchema,
      text: z.string().max(4096).optional(),
      voice: z.object({ file_id: z.string().max(200), duration: z.number().optional() }).optional(),
      location: z
        .object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
          horizontal_accuracy: z.number().positive().optional(),
        })
        .optional(),
    })
    .optional(),
  callback_query: z
    .object({
      id: z.string(),
      data: z.string().max(64).optional(),
      message: z.object({ chat: chatSchema }).optional(),
    })
    .optional(),
});

const PRIVATE_ONLY = "Por seguridad solo atiendo en chats privados. Escríbeme directo.";
const BAD_CODE = "Ese enlace ya venció o ya se usó. Vuelve a NIVEL y toca «Conectar Telegram» otra vez.";
const GENERIC_FAILURE = "Algo falló de nuestro lado. Intenta de nuevo en un momento.";
const MENU_BUTTON: TelegramButton = { text: "Menú", data: "menu" };

const friendly = (error: unknown) =>
  error instanceof AppError || error instanceof DomainValidationError ? error.message : GENERIC_FAILURE;

// ───────── Trabajador ─────────

const WORKER_MENU: Rows = [
  [{ text: "Ver mis ofertas", data: "of" }],
  [
    { text: "Mi nivel", data: "nv" },
    { text: "Abierto a trabajar", data: "ab" },
  ],
];

const offerLine = (offer: WorkerOffer) =>
  `${offer.company.name}${offer.company.verified ? " (verificada)" : ""}\n` +
  `${TRADE_LABELS[offer.trade].singular} en ${offer.zone} · desde ${formatDay(offer.startDate)} · ` +
  `${plural(offer.days, "día", "días")} · ${formatUsd(offer.dailyPayUsd)} al día · ` +
  `${CONTRACT_TYPE_LABELS[offer.contractType]}`;

async function showOffers(context: AppContext, actor: LinkedActor, reply: Reply): Promise<void> {
  const pending = (await listMyOffers(context, actor)).filter((offer) => offer.status === "enviada");
  if (pending.length === 0) {
    await reply("No tienes ofertas nuevas. Te aviso aquí apenas llegue una.", { buttons: [[MENU_BUTTON]] });
    return;
  }
  for (const offer of pending) {
    await reply(`${offerLine(offer)}\n${offer.notice}`, {
      buttons: [
        [
          { text: "Aceptar", data: `ac:${offer.invitationId}` },
          { text: "Rechazar", data: `re:${offer.invitationId}` },
        ],
      ],
    });
  }
}

interface WorkerTurn {
  readonly context: AppContext;
  readonly actor: LinkedActor;
  readonly reply: Reply;
}

async function answerOffer(
  { context, actor, reply }: WorkerTurn,
  input: { readonly invitationId: string; readonly accept: boolean },
): Promise<void> {
  const { offer, otp } = await respondToInvitation(context, actor, input);
  if (!input.accept) {
    await reply("Listo, rechazaste la oferta. No afecta tu nivel.", { buttons: [[MENU_BUTTON]] });
    return;
  }
  const signPath = `/t/contrato/${offer.contractId ?? ""}`;
  await reply(
    `Aceptaste la oferta de ${offer.company.name}.\n` +
      `Falta un paso: firmar tu contrato en NIVEL. Tu código de firma es ${otp ?? "el que ves en la app"}. ` +
      "No lo compartas con nadie.",
    { buttons: [openAppButton(context, "Firmar mi contrato", signPath)].filter((row) => row.length > 0) },
  );
}

async function showLevel(context: AppContext, actor: LinkedActor, reply: Reply): Promise<void> {
  const level = await getLevelStatus(context, actor, subjectOf(actor));
  await reply(
    `Estás en Nivel ${level.level}: ${LEVEL_NAMES[level.level]}.\n${level.explanation}\n` +
      `Trabajos de este nivel pagan de ${formatUsd(level.referenceBand.min)} a ${formatUsd(level.referenceBand.max)} ` +
      "al mes. Es una referencia de mercado, no una promesa de salario.",
    { buttons: [[MENU_BUTTON]] },
  );
}

async function toggleOpenToWork(context: AppContext, actor: LinkedActor, reply: Reply): Promise<void> {
  const current = await getMyProfile(context, actor);
  const updated = await correctMyProfile(context, actor, { openToWork: !current.openToWork });
  await reply(
    updated.openToWork
      ? "Quedaste abierto a trabajar: las empresas pueden invitarte."
      : "Listo: no recibirás invitaciones nuevas hasta que lo actives otra vez.",
    { buttons: [[MENU_BUTTON]] },
  );
}

async function workerAction(turn: WorkerTurn, data: string): Promise<void> {
  const { context, actor, reply } = turn;
  const [verb, id = ""] = data.split(":");
  if (verb === "of") return showOffers(context, actor, reply);
  if (verb === "nv") return showLevel(context, actor, reply);
  if (verb === "ab") return toggleOpenToWork(context, actor, reply);
  if (verb === "ac" || verb === "re") {
    return answerOffer(turn, { invitationId: id, accept: verb === "ac" });
  }
  return reply("¿Qué necesitas?", { buttons: WORKER_MENU });
}

const WORKER_INTENT_BUTTON: Partial<Record<ChatIntent, string>> = {
  ofertas: "of",
  nivel: "nv",
  disponibilidad: "ab",
};

/** Lo que el trabajador escribió o dictó. "Acepto" vale solo si hay una única oferta: nunca se adivina cuál. */
async function workerText(turn: WorkerTurn, text: string): Promise<void> {
  if (text === "/ofertas") return workerAction(turn, "of");
  const intent = readIntent(text);
  if (intent === "aceptar" || intent === "rechazar") {
    const pending = (await listMyOffers(turn.context, turn.actor)).filter(
      (offer) => offer.status === "enviada",
    );
    const [only] = pending;
    if (pending.length !== 1 || !only) return showOffers(turn.context, turn.actor, turn.reply);
    return answerOffer(turn, { invitationId: only.invitationId, accept: intent === "aceptar" });
  }
  const button = WORKER_INTENT_BUTTON[intent];
  return button
    ? workerAction(turn, button)
    : turn.reply("¿Qué necesitas? Toca una opción, escríbeme o mándame una nota de voz.", {
        buttons: WORKER_MENU,
      });
}

// ───────── Contratista ─────────

const COMPANY_MENU: Rows = [
  [{ text: "Pedir personal", data: "pe" }],
  [
    { text: "Ver mi cuadrilla", data: "cu" },
    { text: "Fijar ubicación de la obra", data: "ub" },
  ],
];

const CANCEL: TelegramButton = { text: "Cancelar", data: "no" };
const choices = (
  prefix: string,
  values: readonly (string | number)[],
  label = (value: string | number) => `${value}`,
) => values.map((value) => ({ text: label(value), data: `${prefix}:${value}` }));
const LIMITS = Object.freeze({ quantity: 50, days: 90, dailyPayUsd: 1000 });

const tradeLabel = (trade: string | number) => TRADE_LABELS[trade as (typeof TRADES)[number]].singular;
const TRADE_BUTTONS: Rows = [
  choices("t", TRADES.slice(0, 3), tradeLabel),
  choices("t", TRADES.slice(3), tradeLabel),
  [CANCEL],
];

const DURATION_QUESTION =
  "¿Por cuánto tiempo quieres contratar? Si son menos de 3 meses, las prestaciones son 5 días de " +
  "salario por mes (LOTTT, art. 142, literal e). También puedes escribir los días exactos.";
const DURATION_BUTTONS: Rows = [
  [
    { text: "Una semana", data: "d:7" },
    { text: "Más de un mes", data: "d:30" },
  ],
  [
    { text: "Más de 3 meses", data: "d:90" },
    { text: "Contrato indefinido", data: "d:90" },
  ],
  [CANCEL],
];

interface Prompt {
  readonly text: string;
  readonly buttons: Rows;
}

/** Qué se pregunta en cada paso. Un dato por mensaje, con botones grandes: se puede pedir personal sin escribir. */
function promptFor(draft: TelegramDraft, today: ReturnType<typeof localDate>): Prompt {
  switch (draft.step) {
    case "oficio":
      return {
        text: "¿Qué oficio necesitas?",
        buttons: TRADE_BUTTONS,
      };
    case "cantidad":
      return {
        text: "¿Cuántas personas?",
        buttons: [choices("q", [1, 2, 3, 4]), choices("q", [5, 6, 8, 10]), [CANCEL]],
      };
    case "nivel":
      return {
        text: "¿Desde qué nivel?",
        buttons: [
          choices("l", [1, 2, 3], (level) => `Nivel ${level}`),
          choices("l", [4, 5], (level) => `Nivel ${level}`),
          [CANCEL],
        ],
      };
    case "inicio":
      return {
        text: "¿Cuándo empieza la obra?",
        buttons: [
          [1, 2, 3].map((offset) => ({
            text: offset === 1 ? "Mañana" : formatDay(addDays(today, offset)),
            data: `s:${offset}`,
          })),
          [CANCEL],
        ],
      };
    case "dias":
      return {
        text: DURATION_QUESTION,
        buttons: DURATION_BUTTONS,
      };
    case "pago":
      return {
        text: "¿Cuánto pagas al día por persona, en dólares?",
        buttons: [
          choices("p", [15, 20, 25, 30], (pay) => `$${pay}`),
          choices("p", [35, 40, 50], (pay) => `$${pay}`),
          [CANCEL],
        ],
      };
    case "confirmar":
      return {
        text:
          `Vas a pedir: ${tradeCount(draft.trade ?? "otro", draft.quantity ?? 1)}, Nivel ${draft.minLevel} o más, ` +
          `desde ${formatDay(draft.startDate ?? today)}, ${plural(draft.days ?? 1, "día", "días")}, ` +
          `${formatUsd(draft.dailyPayUsd ?? 0)} al día. ¿Busco personas?`,
        buttons: [[{ text: "Sí, buscar personas", data: "ok" }], [CANCEL]],
      };
  }
}

const inRange = (value: number | undefined, max: number): value is number =>
  value !== undefined && Number.isFinite(value) && value >= 1 && value <= max;

const STEP_ORDER = ["oficio", "cantidad", "nivel", "inicio", "dias", "pago"] as const;
type AskStep = (typeof STEP_ORDER)[number];

const FILLED: Readonly<Record<AskStep, (draft: TelegramDraft) => boolean>> = {
  oficio: (draft) => draft.trade !== undefined,
  cantidad: (draft) => draft.quantity !== undefined,
  nivel: (draft) => draft.minLevel !== undefined,
  inicio: (draft) => draft.startDate !== undefined,
  dias: (draft) => draft.days !== undefined,
  pago: (draft) => draft.dailyPayUsd !== undefined,
};

/** El siguiente dato que falta. Con todo completo, toca confirmar. */
function withNextStep(draft: TelegramDraft): TelegramDraft {
  const missing = STEP_ORDER.find((step) => !FILLED[step](draft));
  return { ...draft, step: missing ?? "confirmar" };
}

type Fields = Omit<TelegramDraft, "step">;

/** Solo entran los datos dentro de los mismos topes que valida la app. */
function validFields(fields: Fields): Fields {
  const { trade, quantity, minLevel, startDate, days, dailyPayUsd } = fields;
  return {
    ...(trade ? { trade } : {}),
    ...(inRange(quantity, LIMITS.quantity) && Number.isInteger(quantity) ? { quantity } : {}),
    ...(inRange(minLevel, 5) && Number.isInteger(minLevel) ? { minLevel } : {}),
    ...(startDate ? { startDate } : {}),
    ...(inRange(days, LIMITS.days) && Number.isInteger(days) ? { days } : {}),
    ...(dailyPayUsd !== undefined && dailyPayUsd > 0 && dailyPayUsd <= LIMITS.dailyPayUsd
      ? { dailyPayUsd }
      : {}),
  };
}

function startDateOf(phrase: string | undefined, now: Date): string | undefined {
  if (!phrase) return undefined;
  try {
    return resolveStartDate(phrase, now);
  } catch {
    return undefined;
  }
}

const BUTTON_FIELD: Readonly<Record<string, AskStep>> = {
  t: "oficio",
  q: "cantidad",
  l: "nivel",
  s: "inicio",
  d: "dias",
  p: "pago",
};

/** Lo que aporta un botón ("q:3") al borrador. */
function fieldsFromButton(data: string, today: ReturnType<typeof localDate>): Fields {
  const [prefix = "", raw = ""] = data.split(":");
  const value = Number(raw);
  switch (BUTTON_FIELD[prefix]) {
    case "oficio":
      return { ...(TRADES.find((trade) => trade === raw) ? { trade: raw as (typeof TRADES)[number] } : {}) };
    case "cantidad":
      return { quantity: value };
    case "nivel":
      return { minLevel: value };
    case "inicio":
      return inRange(value, 3) ? { startDate: addDays(today, value) } : {};
    case "dias":
      return { days: value };
    case "pago":
      return { dailyPayUsd: value };
    default:
      return {};
  }
}

const NUMBER_FIELD: Partial<Record<TelegramDraft["step"], "quantity" | "minLevel" | "days" | "dailyPayUsd">> =
  {
    cantidad: "quantity",
    nivel: "minLevel",
    dias: "days",
    pago: "dailyPayUsd",
  };

/**
 * Lo que aporta una frase escrita o dictada: todos los datos que traiga
 * ("3 soldadores para el lunes") o, si es solo un número, el dato que se acaba de preguntar.
 */
function fieldsFromText(draft: TelegramDraft, text: string, now: Date): Fields {
  const { startPhrase, ...hints } = readRequestHints(text);
  const startDate = startDateOf(startPhrase, now);
  const said: Fields = { ...hints, ...(startDate ? { startDate } : {}) };
  if (Object.keys(said).length > 0) return said;
  const field = NUMBER_FIELD[draft.step];
  const bare = readBareNumber(text);
  return field && bare !== undefined ? { [field]: bare } : {};
}

/** Suma al borrador lo nuevo que sea válido. Devuelve nada si la respuesta no aportó ningún dato. */
function advance(draft: TelegramDraft, added: Fields): TelegramDraft | undefined {
  const valid = validFields(added);
  if (Object.keys(valid).length === 0) return undefined;
  return withNextStep({ ...draft, ...valid });
}

const saveDraft = (context: AppContext, chatId: string, draft: TelegramDraft | null) =>
  context.db.update(telegramLinks).set({ draft }).where(eq(telegramLinks.chatId, chatId));

interface CompanyTurn {
  readonly context: AppContext;
  readonly link: Link;
  readonly actor: LinkedActor;
  readonly reply: Reply;
}

async function publishDraft(
  { context, link, actor, reply }: CompanyTurn,
  draft: TelegramDraft,
): Promise<void> {
  const [company] = await context.db.select().from(companies).where(eq(companies.id, link.subjectId));
  const { trade, quantity, minLevel, startDate, days, dailyPayUsd } = draft;
  if (!company || !trade || !quantity || !minLevel || !startDate || !days || !dailyPayUsd) {
    await saveDraft(context, link.chatId, null);
    await reply("Faltó algún dato. Empecemos de nuevo.", { buttons: COMPANY_MENU });
    return;
  }
  const created = await createJobRequest(context, actor, {
    trade,
    quantity,
    minLevel: minLevel as Level,
    zone: company.zone,
    startDate,
    days,
    dailyPayUsd,
    contractType: "obra_determinada",
    createdVia: "web",
  });
  await saveDraft(context, link.chatId, null);
  const best = Math.min(quantity, created.matching, 10);
  const cost = `Costo legal estimado: ${formatUsd(created.legalCost.perWorker.total)} por persona. Valídalo con tu contador.`;
  if (best === 0) {
    await reply(
      `Publiqué tu solicitud, pero nadie cumple todavía con ese nivel cerca de ${company.zone}.\n${cost}`,
      {
        buttons: COMPANY_MENU,
      },
    );
    return;
  }
  await reply(
    `Listo. ${plural(created.matching, "persona cumple", "personas cumplen")} en ${company.zone}.\n${cost}\n` +
      "La empresa contrata directo y es el patrono.",
    {
      buttons: [
        [
          {
            text: best === 1 ? "Invitar al mejor" : `Invitar a los ${best} mejores`,
            data: `iv:${created.request.id}:${best}`,
          },
        ],
        openAppButton(context, "Elegir a quién invitar", "/c"),
      ].filter((row) => row.length > 0),
    },
  );
}

async function showCrew({ context, actor, reply }: CompanyTurn): Promise<void> {
  const board = await activeRequestBoard(context, actor);
  if (!board) {
    await reply("Aún no has pedido personal.", { buttons: COMPANY_MENU });
    return;
  }
  const { request } = board;
  const lines = board.invitations.map((invitation) => {
    const status = { enviada: "sin responder", aceptada: "aceptó", rechazada: "rechazó" }[invitation.status];
    return `· ${invitation.candidate?.shortName ?? "Una persona"}: ${status}`;
  });
  await reply(
    `${tradeCount(request.trade, request.quantity)} en ${request.zone}, desde ${formatDay(request.startDate)}.\n` +
      `Cuadrilla ${Math.min(board.accepted, request.quantity)} de ${request.quantity}.\n` +
      (lines.length > 0 ? lines.join("\n") : "Todavía no has invitado a nadie.") +
      (request.sitePinnedAt
        ? ""
        : "\nLa obra aún no tiene ubicación exacta: fíjala para verificar las llegadas."),
    {
      buttons: [openAppButton(context, "Abrir mi tablero", "/c"), [MENU_BUTTON]].filter(
        (row) => row.length > 0,
      ),
    },
  );
}

async function askNext(turn: CompanyTurn, draft: TelegramDraft, misunderstood = false): Promise<void> {
  const prompt = promptFor(draft, localDate(turn.context.now()));
  await turn.reply(misunderstood ? `No entendí ese dato. ${prompt.text}` : prompt.text, {
    buttons: prompt.buttons,
  });
}

async function continueDraft(turn: CompanyTurn, draft: TelegramDraft, added: Fields): Promise<void> {
  const next = advance(draft, added);
  if (next) await saveDraft(turn.context, turn.link.chatId, next);
  await askNext(turn, next ?? draft, next === undefined);
}

async function inviteBest(turn: CompanyTurn, requestId: string, quantity: number): Promise<void> {
  const sent = await inviteCandidates(turn.context, turn.actor, { requestId, quantity });
  await turn.reply(
    sent.length === 0
      ? "No quedó nadie por invitar."
      : `Invité a ${sent.map((entry) => entry.candidate.shortName).join(", ")}. Te aviso aquí cuando respondan.`,
    { buttons: [[{ text: "Ver mi cuadrilla", data: "cu" }]] },
  );
}

const ASK_LOCATION = "Párate en la obra y toca el botón de abajo. Con ese punto verifico las llegadas.";

/** Un botón tocado por el contratista. */
async function companyAction(turn: CompanyTurn, data: string): Promise<void> {
  const { context, link, reply } = turn;
  const [verb, first = "", second = ""] = data.split(":");
  if (verb === "pe") return startDraft(turn, {});
  if (verb === "no") {
    await saveDraft(context, link.chatId, null);
    return reply("Cancelado. No publiqué nada.", { buttons: COMPANY_MENU });
  }
  if (verb === "cu") return showCrew(turn);
  if (verb === "ub") return reply(ASK_LOCATION, { askLocation: "Enviar mi ubicación" });
  if (verb === "iv") return inviteBest(turn, first, Number(second));
  if (verb === "ok" && link.draft?.step === "confirmar") return publishDraft(turn, link.draft);
  if (link.draft) return continueDraft(turn, link.draft, fieldsFromButton(data, localDate(context.now())));
  return reply("¿Qué necesitas?", { buttons: COMPANY_MENU });
}

async function startDraft(turn: CompanyTurn, said: Fields): Promise<void> {
  const draft = withNextStep({ step: "oficio", ...validFields(said) });
  await saveDraft(turn.context, turn.link.chatId, draft);
  await askNext(turn, draft);
}

const COMPANY_COMMANDS: Readonly<Record<string, string>> = { "/pedir": "pe", "/cuadrilla": "cu" };
const COMPANY_INTENT_BUTTON: Partial<Record<ChatIntent, string>> = {
  cuadrilla: "cu",
  ubicacion: "ub",
  cancelar: "no",
};

/** Lo que el contratista escribió o dictó: se entiende la frase entera y se pregunta solo lo que falte. */
async function companyText(turn: CompanyTurn, text: string): Promise<void> {
  const command = COMPANY_COMMANDS[text];
  if (command) return companyAction(turn, command);
  if (text.startsWith("/")) return turn.reply("¿Qué necesitas?", { buttons: COMPANY_MENU });
  const { link, context } = turn;
  const intent = readIntent(text);
  if (link.draft) {
    if (intent === "cancelar") return companyAction(turn, "no");
    if (link.draft.step === "confirmar" && intent === "confirmar") return publishDraft(turn, link.draft);
    return continueDraft(turn, link.draft, fieldsFromText(link.draft, text, context.now()));
  }
  if (intent === "pedir") return startDraft(turn, fieldsFromText({ step: "oficio" }, text, context.now()));
  const button = COMPANY_INTENT_BUTTON[intent];
  return button
    ? companyAction(turn, button)
    : turn.reply("¿Qué necesitas? Toca una opción, escríbeme o mándame una nota de voz.", {
        buttons: COMPANY_MENU,
      });
}

async function pinFromChat(
  turn: CompanyTurn,
  location: {
    readonly latitude: number;
    readonly longitude: number;
    readonly horizontal_accuracy?: number | undefined;
  },
): Promise<void> {
  const board = await activeRequestBoard(turn.context, turn.actor);
  if (!board) {
    await turn.reply("Primero pide personal: la ubicación se guarda en la obra de tu solicitud.", {
      clearKeyboard: true,
    });
    return;
  }
  await pinRequestSite(turn.context, turn.actor, {
    requestId: board.request.id,
    site: { lat: location.latitude, lng: location.longitude, accuracyM: location.horizontal_accuracy },
  });
  await turn.reply("Listo: fijé la obra en ese punto. Desde ahora cada llegada se verifica ahí.", {
    clearKeyboard: true,
  });
}

// ───────── Entrada ─────────

interface ChatTurn {
  readonly context: AppContext;
  readonly chatId: string;
  readonly reply: Reply;
}

async function connectChat({ context, chatId, reply }: ChatTurn, code: string): Promise<void> {
  const now = context.now();
  // Un código de entrada a la app no sirve para conectar un chat.
  if (code.startsWith(`${ENTRY_PREFIX}-`)) return reply(BAD_CODE);
  const [claimed] = await context.db.delete(telegramCodes).where(eq(telegramCodes.code, code)).returning();
  if (!claimed || claimed.expiresAt < now.toISOString()) {
    await reply(BAD_CODE);
    return;
  }
  const { role, subjectId } = claimed;
  // Una cuenta, un chat: conectar otro teléfono desconecta el anterior.
  await context.db
    .delete(telegramLinks)
    .where(and(eq(telegramLinks.role, role), eq(telegramLinks.subjectId, subjectId)));
  await context.db
    .insert(telegramLinks)
    .values({ chatId, role, subjectId, draft: null, linkedAt: now.toISOString() })
    .onConflictDoUpdate({
      target: telegramLinks.chatId,
      set: { role, subjectId, draft: null, linkedAt: now.toISOString() },
    });
  if (role === "worker") {
    const [worker] = await context.db
      .select({ name: workers.name })
      .from(workers)
      .where(eq(workers.id, subjectId));
    const name = worker?.name.trim().split(/\s+/)[0] ?? "";
    await reply(
      `¡Listo, ${name}! Este chat quedó conectado a tu cuenta de NIVEL. Aquí te aviso de cada oferta.`,
      {
        buttons: WORKER_MENU,
      },
    );
    return;
  }
  const [company] = await context.db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, subjectId));
  await reply(
    `Listo. Este chat quedó conectado a ${company?.name ?? "tu empresa"}. Aquí pides personal y te aviso quién acepta y quién llega.`,
    { buttons: COMPANY_MENU },
  );
}

async function accountStillExists(context: AppContext, link: Link): Promise<boolean> {
  if (link.role === "worker") return workerIsActive(context.db, link.subjectId);
  const [company] = await context.db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, link.subjectId));
  return company !== undefined;
}

interface Incoming {
  readonly chatId: string;
  readonly isPrivate: boolean;
  readonly text?: string | undefined;
  readonly data?: string | undefined;
  readonly voice?: { readonly file_id: string; readonly duration?: number | undefined } | undefined;
  readonly location?:
    NonNullable<NonNullable<z.infer<typeof updateSchema>["message"]>["location"]> | undefined;
}

function readUpdate(raw: unknown): Incoming | undefined {
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  const { message, callback_query: callback } = parsed.data;
  const chat = message?.chat ?? callback?.message?.chat;
  if (!chat) return undefined;
  return {
    chatId: String(chat.id),
    isPrivate: chat.type === "private",
    text: message?.text?.trim(),
    data: callback?.data,
    voice: message?.voice,
    location: message?.location,
  };
}

async function route(context: AppContext, incoming: Incoming, reply: Reply): Promise<void> {
  if (!incoming.isPrivate) return reply(PRIVATE_ONLY);
  const start = incoming.text?.match(/^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{1,64}))?$/);
  if (start?.[1]) return connectChat({ context, chatId: incoming.chatId, reply }, start[1]);
  const [link] = await context.db
    .select()
    .from(telegramLinks)
    .where(eq(telegramLinks.chatId, incoming.chatId));
  if (link && !(await accountStillExists(context, link))) {
    await context.db.delete(telegramLinks).where(eq(telegramLinks.chatId, link.chatId));
    return reply(WELCOME, { buttons: SIGNUP_CHOICE });
  }
  const text = incoming.voice ? await heard(context, incoming.voice, reply) : incoming.text;
  // Una nota que no se pudo oír ya tuvo su respuesta: no se le suma el menú.
  if (incoming.voice && !text) return;
  if (!link) {
    // Sin cuenta todavía: puede registrarse aquí mismo como trabajador o como empresa.
    const signup = { context, chatId: incoming.chatId, reply };
    const handled = await handleSignup(signup, {
      data: incoming.data,
      text: text?.startsWith("/") ? "" : text,
    });
    return handled ? undefined : reply(WELCOME, { buttons: SIGNUP_CHOICE });
  }
  const actor = actorOf(link);
  if (link.role === "worker") {
    const turn = { context, actor, reply };
    if (incoming.data) return workerAction(turn, incoming.data);
    return text ? workerText(turn, text) : reply("¿Qué necesitas?", { buttons: WORKER_MENU });
  }
  const turn = { context, link, actor, reply };
  if (incoming.location) return pinFromChat(turn, incoming.location);
  if (incoming.data) return companyAction(turn, incoming.data);
  return text ? companyText(turn, text) : reply("¿Qué necesitas?", { buttons: COMPANY_MENU });
}

/** Una nota de voz dura lo que una frase: más larga sería otro uso (y otro costo). */
export const MAX_VOICE_SECONDS = 60;
const NO_VOICE = "Por ahora no puedo oír notas de voz. Escríbeme o toca una opción.";
const NOT_HEARD = "No logré entender la nota de voz. Intenta de nuevo, más cerca del teléfono, o escríbeme.";

/**
 * Nota de voz a texto. Le muestra a la persona lo que se entendió, para que
 * pueda corregir. El audio no se guarda.
 */
async function heard(
  context: AppContext,
  voice: NonNullable<Incoming["voice"]>,
  reply: Reply,
): Promise<string | undefined> {
  const channel = context.telegram;
  if (!channel?.transcribe) {
    await reply(NO_VOICE);
    return undefined;
  }
  if ((voice.duration ?? 0) > MAX_VOICE_SECONDS) {
    await reply("Esa nota es muy larga. Mándame una de menos de un minuto.");
    return undefined;
  }
  try {
    const text = (await channel.transcribe(await channel.api.downloadFile(voice.file_id))).trim();
    if (text === "") throw new Error("sin texto");
    await reply(`Entendí: «${text.slice(0, 300)}»`);
    return text;
  } catch (error) {
    log("warn", "telegram_voice_failed", { error: error instanceof Error ? error.name : "desconocido" });
    await reply(NOT_HEARD);
    return undefined;
  }
}

/**
 * Atiende una actualización de Telegram. Quién es la persona sale del chat
 * conectado, nunca de lo que escriba; cada acción pasa por los mismos casos de
 * uso y permisos que la app. Nunca lanza: Telegram reintentaría el mismo mensaje.
 */
export async function handleTelegramUpdate(context: AppContext, raw: unknown): Promise<void> {
  const incoming = readUpdate(raw);
  if (!incoming || !context.telegram) return;
  const reply: Reply = (text, options) => sendToChat(context, incoming.chatId, { text, ...options });
  const callbackId = updateSchema.safeParse(raw).data?.callback_query?.id;
  try {
    await route(context, incoming, reply);
  } catch (error) {
    if (!(error instanceof AppError) && !(error instanceof DomainValidationError)) {
      log("error", "telegram_update_failed", { error: error instanceof Error ? error.name : "desconocido" });
    }
    await reply(friendly(error));
  }
  if (callbackId) await context.telegram.api.answerCallback(callbackId).catch(() => undefined);
}
