// Registro desde Telegram: una persona nueva crea su cuenta de trabajador o de empresa sin salir del chat.
import { eq } from "drizzle-orm";

import { readBareNumber, readRequestHints } from "@/lib/chat-intent";
import { normalizeSpanish } from "@/lib/dates";
import { TRADE_LABELS, TRADES } from "@/lib/trades";
import { ZONES } from "@/lib/zones";

import type { Actor } from "../actor";
import type { TelegramButton, TelegramMessageOptions } from "../adapters/telegram";
import type { AppContext } from "../context";
import { telegramCodes, telegramLinks, type TelegramSignupDraft, telegramSignups } from "../db/schema";
import { setMyConsent } from "./profile";
import { normalizeRif, registerCompany, registerWorkerByForm } from "./registration";
import { appLink } from "./telegram-notify";

type Reply = (text: string, options?: TelegramMessageOptions) => Promise<void>;
type Rows = ReadonlyArray<readonly TelegramButton[]>;
type LinkedActor = Extract<Actor, { role: "worker" | "company" }>;

export interface SignupTurn {
  readonly context: AppContext;
  readonly chatId: string;
  readonly reply: Reply;
}

/** Lo que llegó en este mensaje: un botón tocado o un texto (escrito o dictado). */
export interface SignupAnswer {
  readonly data?: string | undefined;
  readonly text?: string | undefined;
}

export const SIGNUP_CHOICE: Rows = [
  [{ text: "Busco trabajo", data: "rg:worker" }],
  [{ text: "Busco personal", data: "rg:company" }],
];

export const WELCOME =
  "Hola, soy el bot de NIVEL. ¿Qué buscas?\n" +
  "Si ya tienes cuenta, entra a NIVEL y toca «Conectar Telegram».";

const CANCEL: TelegramButton = { text: "Cancelar", data: "rg:no" };
const ENTRY_TTL_MS = 15 * 60 * 1000;
/** Los códigos para entrar a la app se distinguen de los de conectar el chat: uno no sirve para lo otro. */
export const ENTRY_PREFIX = "en";

const PERMISSION: Readonly<Record<TelegramSignupDraft["kind"], string>> = {
  worker:
    "Para crear tu perfil guardo tu nombre, tu oficio y tu zona, y las empresas podrán encontrarte. " +
    "Es gratis. ¿Tienes 18 años o más y estás de acuerdo?",
  company:
    "Para registrar tu empresa guardo su nombre, su RIF y su zona. NIVEL es la plataforma: " +
    "el patrono siempre es tu empresa. ¿Estás de acuerdo?",
};

const zoneButtons = (): Rows => {
  const names = Object.values(ZONES).map((zone) => ({ text: zone.name, data: `rg:z:${zone.name}` }));
  return [names.slice(0, 3), names.slice(3, 6), names.slice(6), [CANCEL]];
};

const tradeButtons = (): Rows => {
  const all = TRADES.map((trade) => ({ text: TRADE_LABELS[trade].singular, data: `rg:t:${trade}` }));
  return [all.slice(0, 3), all.slice(3), [CANCEL]];
};

function promptFor(draft: TelegramSignupDraft): { text: string; buttons: Rows } {
  switch (draft.step) {
    case "permiso":
      return { text: PERMISSION[draft.kind], buttons: [[{ text: "Sí, acepto", data: "rg:ok" }], [CANCEL]] };
    case "nombre":
      return {
        text: draft.kind === "worker" ? "¿Cómo te llamas? Nombre y apellido." : "¿Cómo se llama tu empresa?",
        buttons: [[CANCEL]],
      };
    case "oficio":
      return { text: "¿Cuál es tu oficio?", buttons: tradeButtons() };
    case "anos":
      return {
        text: "¿Cuántos años de experiencia tienes?",
        buttons: [[1, 3, 5, 10, 20].map((years) => ({ text: `${years}`, data: `rg:a:${years}` })), [CANCEL]],
      };
    case "rif":
      return { text: "¿Cuál es el RIF? Por ejemplo J-12345678-9.", buttons: [[CANCEL]] };
    case "zona":
      return {
        text: draft.kind === "worker" ? "¿En qué zona vives?" : "¿En qué zona trabajan normalmente?",
        buttons: zoneButtons(),
      };
  }
}

const save = (context: AppContext, chatId: string, draft: TelegramSignupDraft) =>
  context.db
    .insert(telegramSignups)
    .values({ chatId, draft, updatedAt: context.now().toISOString() })
    .onConflictDoUpdate({
      target: telegramSignups.chatId,
      set: { draft, updatedAt: context.now().toISOString() },
    });

const discard = (context: AppContext, chatId: string) =>
  context.db.delete(telegramSignups).where(eq(telegramSignups.chatId, chatId));

/** Enlace de un solo uso que abre la app con la sesión de esa cuenta ya iniciada. */
export async function createEntryLink(context: AppContext, actor: LinkedActor): Promise<string | undefined> {
  const base = appLink(context, "/api/telegram/enter");
  if (!base) return undefined;
  const code = context.newId(ENTRY_PREFIX);
  await context.db.insert(telegramCodes).values({
    code,
    role: actor.role,
    subjectId: actor.role === "worker" ? actor.workerId : actor.companyId,
    expiresAt: new Date(context.now().getTime() + ENTRY_TTL_MS).toISOString(),
  });
  return `${base}?c=${code}`;
}

/** Canjea el código de entrada: una sola vez y antes de que venza. */
export async function redeemEntryCode(context: AppContext, code: string): Promise<LinkedActor | undefined> {
  if (!code.startsWith(`${ENTRY_PREFIX}-`)) return undefined;
  const [claimed] = await context.db.delete(telegramCodes).where(eq(telegramCodes.code, code)).returning();
  if (!claimed || claimed.expiresAt < context.now().toISOString()) return undefined;
  return claimed.role === "worker"
    ? { role: "worker", workerId: claimed.subjectId }
    : { role: "company", companyId: claimed.subjectId };
}

async function linkChat({ context, chatId }: SignupTurn, actor: LinkedActor): Promise<void> {
  const subjectId = actor.role === "worker" ? actor.workerId : actor.companyId;
  const linkedAt = context.now().toISOString();
  await context.db
    .insert(telegramLinks)
    .values({ chatId, role: actor.role, subjectId, draft: null, linkedAt })
    .onConflictDoUpdate({
      target: telegramLinks.chatId,
      set: { role: actor.role, subjectId, draft: null, linkedAt },
    });
  await discard(context, chatId);
}

async function openAppRow(context: AppContext, actor: LinkedActor): Promise<Rows> {
  const url = await createEntryLink(context, actor);
  return url ? [[{ text: "Abrir NIVEL con mi cuenta", url }]] : [];
}

async function finishWorker(turn: SignupTurn, draft: TelegramSignupDraft, zone: string): Promise<void> {
  const { context, reply } = turn;
  const consentAt = draft.consentAt ?? context.now().toISOString();
  const { actor, profile } = await registerWorkerByForm(context, {
    name: draft.name ?? "",
    isAdult: true,
    trade: draft.trade ?? "otro",
    yearsExp: draft.yearsExp ?? 0,
    skills: [],
    zone,
    availability: "Inmediata",
    consentAt,
  });
  // Aceptó en el chat que las empresas lo encuentren: sin esto no aparecería en ninguna búsqueda.
  await setMyConsent(context, actor, { kind: "share_profile", granted: true });
  await linkChat(turn, actor);
  await reply(
    `¡Listo, ${profile.firstName}! Tu perfil quedó en Nivel ${profile.level}. Las empresas ya pueden encontrarte ` +
      "y aquí te aviso de cada oferta.",
    {
      buttons: [
        ...(await openAppRow(context, actor)),
        [{ text: "Ver mis ofertas", data: "of" }],
        [{ text: "Mi nivel", data: "nv" }],
      ],
    },
  );
}

async function finishCompany(turn: SignupTurn, draft: TelegramSignupDraft, zone: string): Promise<void> {
  const { context, reply } = turn;
  const { actor, company } = await registerCompany(context, {
    name: draft.name ?? "",
    rif: draft.rif ?? "",
    zone,
    kind: "contratista",
  });
  await linkChat(turn, actor);
  await reply(`Listo. ${company.name} ya está registrada. Desde aquí puedes pedir personal.`, {
    buttons: [...(await openAppRow(context, actor)), [{ text: "Pedir personal", data: "pe" }]],
  });
}

const NAME = /^\p{L}[\p{L} .'&-]{1,79}$/u;

/** Aplica la respuesta al paso actual. Devuelve el borrador siguiente, "listo" con la zona, o nada si no sirve. */
function advance(
  draft: TelegramSignupDraft,
  { data, text }: SignupAnswer,
  now: Date,
): TelegramSignupDraft | { readonly zone: string } | undefined {
  const [, key = "", value = ""] = (data ?? "").split(":");
  const typed = text?.trim() ?? "";
  switch (draft.step) {
    case "permiso":
      return key === "ok" || /^(si|acepto|dale|ok|de acuerdo)\b/.test(normalizeSpanish(typed))
        ? { ...draft, consentAt: now.toISOString(), step: "nombre" }
        : undefined;
    case "nombre":
      return NAME.test(typed)
        ? { ...draft, name: typed, step: draft.kind === "worker" ? "oficio" : "rif" }
        : undefined;
    case "oficio": {
      const trade = TRADES.find((candidate) => candidate === value) ?? readRequestHints(typed).trade;
      return trade ? { ...draft, trade, step: "anos" } : undefined;
    }
    case "anos": {
      const years = key === "a" ? Number(value) : readBareNumber(typed);
      return years !== undefined && years >= 0 && years <= 60
        ? { ...draft, yearsExp: years, step: "zona" }
        : undefined;
    }
    case "rif":
      try {
        return { ...draft, rif: normalizeRif(typed), step: "zona" };
      } catch {
        return undefined;
      }
    case "zona": {
      const zone = key === "z" ? value : typed;
      return zone.length >= 2 ? { zone: zone.slice(0, 80) } : undefined;
    }
  }
}

const isSignupButton = (data: string | undefined) => data?.startsWith("rg:") ?? false;

/**
 * Atiende a un chat que todavía no tiene cuenta. Devuelve falso si el mensaje
 * no es parte de un registro, para que quien llama muestre la bienvenida.
 */
export async function handleSignup(turn: SignupTurn, answer: SignupAnswer): Promise<boolean> {
  const { context, chatId, reply } = turn;
  const [, key = "", value = ""] = (answer.data ?? "").split(":");
  if (isSignupButton(answer.data) && (value === "" || key === "no") && key !== "ok") {
    if (key === "worker" || key === "company") {
      const draft: TelegramSignupDraft = { kind: key, step: "permiso" };
      await save(context, chatId, draft);
      await reply(promptFor(draft).text, { buttons: promptFor(draft).buttons });
      return true;
    }
    if (key === "no") {
      await discard(context, chatId);
      await reply("Cancelado. No guardé nada.", { buttons: SIGNUP_CHOICE });
      return true;
    }
  }
  const [row] = await context.db.select().from(telegramSignups).where(eq(telegramSignups.chatId, chatId));
  if (!row) return false;
  const next = advance(row.draft, answer, context.now());
  if (next === undefined) {
    const prompt = promptFor(row.draft);
    await reply(`No entendí. ${prompt.text}`, { buttons: prompt.buttons });
    return true;
  }
  if ("zone" in next) {
    await (row.draft.kind === "worker"
      ? finishWorker(turn, row.draft, next.zone)
      : finishCompany(turn, row.draft, next.zone));
    return true;
  }
  await save(context, chatId, next);
  await reply(promptFor(next).text, { buttons: promptFor(next).buttons });
  return true;
}
