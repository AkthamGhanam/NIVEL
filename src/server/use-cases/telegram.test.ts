// El bot de Telegram de punta a punta, con un Telegram de mentira que guarda lo que el bot envía.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { TelegramApi, TelegramMessageOptions } from "../adapters/telegram";
import { type AppContext, createContext } from "../context";
import { jobRequests, telegramCodes, telegramLinks } from "../db/schema";
import { ConflictError } from "../errors";
import { ACTORS, createTestApp, DEMO_NOW, TEST_SECRET, type TestApp } from "../testing/test-app";
import { activeRequestBoard } from "./requests";
import {
  createTelegramLink,
  handleTelegramUpdate,
  LINK_CODE_TTL_MS,
  setupTelegramWebhook,
  telegramLinkStatus,
  unlinkTelegram,
  webhookSecret,
} from "./telegram";

interface Sent {
  readonly chatId: string;
  readonly text: string;
  readonly options: TelegramMessageOptions;
}

const CARLOS_CHAT = 111;
const RAFAEL_CHAT = 222;
const COMPANY_CHAT = 333;

let app: TestApp;
let context: AppContext;
let now = DEMO_NOW;
let sent: Sent[] = [];
const webhooks: Array<{ url: string; secret: string }> = [];

const fakeTelegram: TelegramApi = {
  sendMessage: async (chatId, text, options = {}) => {
    sent.push({ chatId, text, options });
  },
  answerCallback: async () => undefined,
  setWebhook: async (url, secret) => {
    webhooks.push({ url, secret });
  },
  botUsername: async () => "nivel_demo_bot",
};

const message = (chat: number, text: string) => ({ message: { chat: { id: chat, type: "private" }, text } });
const tap = (chat: number, data: string) => ({
  callback_query: { id: "cb", data, message: { chat: { id: chat, type: "private" } } },
});
const buttonsOf = (entry: Sent | undefined) => (entry?.options.buttons ?? []).flat();
const dataOf = (entry: Sent | undefined, label: RegExp) => {
  const button = buttonsOf(entry).find((candidate) => label.test(candidate.text));
  return button && "data" in button ? button.data : "";
};
const last = () => sent.at(-1);
const to = (chat: number) => sent.filter((entry) => entry.chatId === String(chat));

async function connect(actor: Parameters<typeof createTelegramLink>[1], chat: number) {
  const { url } = await createTelegramLink(context, actor);
  await handleTelegramUpdate(context, message(chat, `/start ${new URL(url).searchParams.get("start")}`));
  return url;
}

beforeAll(async () => {
  app = await createTestApp();
  context = createContext({
    db: app.handle.db,
    secret: TEST_SECRET,
    now: () => now,
    telegram: { api: fakeTelegram, appUrl: "https://nivel.example" },
  });
});
afterAll(() => app.close());
beforeEach(() => {
  sent = [];
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("conectar el chat", () => {
  it("sin bot configurado no ofrece Telegram y nada falla", async () => {
    const plain = app.context;

    expect(await telegramLinkStatus(plain, ACTORS.carlos)).toEqual({ available: false, linked: false });
    await expect(createTelegramLink(plain, ACTORS.carlos)).rejects.toThrow(ConflictError);
    await expect(handleTelegramUpdate(plain, message(CARLOS_CHAT, "/start"))).resolves.toBeUndefined();
  });

  it("a un chat sin conectar le explica cómo conectarse y no revela nada", async () => {
    await handleTelegramUpdate(context, message(CARLOS_CHAT, "/ofertas"));
    await handleTelegramUpdate(context, tap(CARLOS_CHAT, "ac:in-cualquiera"));

    expect(to(CARLOS_CHAT)).toHaveLength(2);
    for (const entry of sent) expect(entry.text).toContain("toca «Conectar Telegram»");
  });

  it("el enlace de la app conecta el chat a la cuenta de quien tenía la sesión, una sola vez", async () => {
    const url = await connect(ACTORS.carlos, CARLOS_CHAT);
    const code = new URL(url).searchParams.get("start") ?? "";

    expect(url).toMatch(/^https:\/\/t\.me\/nivel_demo_bot\?start=tg-[a-z0-9]{16}$/);
    expect(last()?.text).toContain("¡Listo, Carlos!");
    expect(await telegramLinkStatus(context, ACTORS.carlos)).toEqual({ available: true, linked: true });
    // El mismo código en otro chat ya no sirve.
    await handleTelegramUpdate(context, message(999, `/start ${code}`));
    expect(last()).toMatchObject({ chatId: "999", text: expect.stringContaining("ya venció o ya se usó") });
  });

  it("un código vencido no conecta nada", async () => {
    const { url } = await createTelegramLink(context, ACTORS.rafael);
    now = new Date(DEMO_NOW.getTime() + LINK_CODE_TTL_MS + 1000);
    await handleTelegramUpdate(
      context,
      message(RAFAEL_CHAT, `/start ${new URL(url).searchParams.get("start")}`),
    );
    now = DEMO_NOW;

    expect(last()?.text).toContain("ya venció");
    expect((await telegramLinkStatus(context, ACTORS.rafael)).linked).toBe(false);
  });

  it("no atiende en grupos ni se cae con mensajes raros", async () => {
    await handleTelegramUpdate(context, { message: { chat: { id: -5, type: "group" }, text: "/start" } });
    await expect(handleTelegramUpdate(context, { foo: "bar" })).resolves.toBeUndefined();
    await expect(handleTelegramUpdate(context, null)).resolves.toBeUndefined();

    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain("solo atiendo en chats privados");
  });
});

describe("el contratista pide personal desde Telegram", () => {
  it("lo guía dato por dato con botones y publica la solicitud al confirmar", async () => {
    await connect(ACTORS.company, COMPANY_CHAT);
    expect(last()?.text).toContain("conectado a Constructora Los Guayos");

    await handleTelegramUpdate(context, tap(COMPANY_CHAT, "pe"));
    expect(last()?.text).toBe("¿Qué oficio necesitas?");
    await handleTelegramUpdate(context, tap(COMPANY_CHAT, "t:soldador"));
    await handleTelegramUpdate(context, message(COMPANY_CHAT, "muchos"));
    expect(last()?.text).toMatch(/^No entendí ese dato\. ¿Cuántas personas\?/);
    await handleTelegramUpdate(context, message(COMPANY_CHAT, "3"));
    await handleTelegramUpdate(context, tap(COMPANY_CHAT, "l:2"));
    await handleTelegramUpdate(context, tap(COMPANY_CHAT, "s:2"));
    await handleTelegramUpdate(context, tap(COMPANY_CHAT, "d:5"));
    await handleTelegramUpdate(context, message(COMPANY_CHAT, "25"));
    expect(last()?.text).toBe(
      "Vas a pedir: 3 soldadores, Nivel 2 o más, desde mar 24 nov, 5 días, $25 al día. ¿Busco personas?",
    );
    await handleTelegramUpdate(context, tap(COMPANY_CHAT, "ok"));

    const board = await activeRequestBoard(context, ACTORS.company);
    expect(board?.request).toMatchObject({ trade: "soldador", quantity: 3, startDate: "2026-11-24" });
    expect(last()?.text).toContain("6 personas cumplen en Los Guayos");
    expect(last()?.text).toContain("Costo legal estimado: $196,67 por persona");
    expect(dataOf(last(), /Invitar a los 3 mejores/)).toBe(`iv:${board?.request.id}:3`);
  });

  it("cancelar no publica nada", async () => {
    const before = await context.db.select().from(jobRequests);
    await handleTelegramUpdate(context, message(COMPANY_CHAT, "/pedir"));
    await handleTelegramUpdate(context, tap(COMPANY_CHAT, "no"));

    expect(last()?.text).toBe("Cancelado. No publiqué nada.");
    expect(await context.db.select().from(jobRequests)).toHaveLength(before.length);
  });

  it("al invitar, quien conectó su Telegram recibe la oferta con botones", async () => {
    const board = await activeRequestBoard(context, ACTORS.company);
    await handleTelegramUpdate(context, tap(COMPANY_CHAT, `iv:${board?.request.id}:3`));

    // De los 3 invitados (Rafael, José, Luis), ninguno conectó Telegram todavía: solo responde al contratista.
    expect(to(COMPANY_CHAT).at(-1)?.text).toBe(
      "Invité a Rafael T., José P., Luis M.. Te aviso aquí cuando respondan.",
    );
    expect(to(CARLOS_CHAT)).toHaveLength(0);
    sent = [];
    await handleTelegramUpdate(context, tap(COMPANY_CHAT, `iv:${board?.request.id}:1`));
    const offer = to(CARLOS_CHAT)[0];
    expect(offer?.text).toContain("Tienes una oferta de trabajo de Constructora Los Guayos.");
    expect(offer?.text).toContain("NIVEL es la plataforma, no el patrono.");
    expect(dataOf(offer, /Aceptar/)).toMatch(/^ac:in-/);
    expect(buttonsOf(offer)).toContainEqual(
      expect.objectContaining({ url: expect.stringMatching(/^https:\/\/nivel\.example\/t\/oferta\/in-/) }),
    );
  });

  it("el trabajador acepta con un toque, recibe su código de firma y la empresa se entera", async () => {
    await handleTelegramUpdate(context, message(CARLOS_CHAT, "/ofertas"));
    const accept = dataOf(to(CARLOS_CHAT).at(-1), /Aceptar/);
    sent = [];
    await handleTelegramUpdate(context, tap(CARLOS_CHAT, accept));

    expect(to(CARLOS_CHAT)[0]?.text).toMatch(
      /Aceptaste la oferta de Constructora Los Guayos\.[\s\S]*código de firma es \d{6}/,
    );
    expect(to(COMPANY_CHAT)[0]?.text).toBe("Carlos R. aceptó tu invitación.");
    // Un segundo toque sobre el mismo botón no acepta dos veces: explica por qué.
    await handleTelegramUpdate(context, tap(CARLOS_CHAT, accept));
    expect(to(CARLOS_CHAT).at(-1)?.text).toBe("Esta invitación ya fue respondida.");
  });

  it("nadie responde la oferta de otra persona", async () => {
    await connect(ACTORS.rafael, RAFAEL_CHAT);
    await handleTelegramUpdate(context, message(RAFAEL_CHAT, "/ofertas"));
    const rafaelOffer = dataOf(to(RAFAEL_CHAT).at(-1), /Rechazar/);
    sent = [];
    await handleTelegramUpdate(context, tap(CARLOS_CHAT, rafaelOffer));

    expect(to(CARLOS_CHAT)[0]?.text).toBe("No tienes permiso para hacer esto.");
    expect(to(COMPANY_CHAT)).toHaveLength(0);
  });

  it("el contratista fija la obra enviando su ubicación al chat", async () => {
    await handleTelegramUpdate(context, tap(COMPANY_CHAT, "ub"));
    expect(last()?.options.askLocation).toBe("Enviar mi ubicación");
    await handleTelegramUpdate(context, {
      message: {
        chat: { id: COMPANY_CHAT, type: "private" },
        location: { latitude: 10.2, longitude: -67.95, horizontal_accuracy: 14 },
      },
    });

    const board = await activeRequestBoard(context, ACTORS.company);
    expect(last()?.text).toContain("fijé la obra en ese punto");
    expect(board?.request).toMatchObject({ lat: 10.2, lng: -67.95 });
    expect(board?.request.sitePinnedAt).not.toBeNull();
  });

  it("muestra la cuadrilla con quién aceptó y quién falta", async () => {
    await handleTelegramUpdate(context, message(COMPANY_CHAT, "/cuadrilla"));

    expect(last()?.text).toContain("3 soldadores en Los Guayos");
    expect(last()?.text).toContain("Cuadrilla 1 de 3");
    expect(last()?.text).toContain("· Carlos R.: aceptó");
    expect(last()?.text).toContain("· Rafael T.: sin responder");
  });
});

describe("el trabajador en Telegram", () => {
  it("consulta su nivel y enciende o apaga 'abierto a trabajar'", async () => {
    await handleTelegramUpdate(context, tap(CARLOS_CHAT, "nv"));
    expect(last()?.text).toMatch(/^Estás en Nivel 2: Verificado\./);
    expect(last()?.text).toContain("no una promesa de salario");
    await handleTelegramUpdate(context, tap(CARLOS_CHAT, "ab"));
    expect(last()?.text).toContain("no recibirás invitaciones nuevas");
    await handleTelegramUpdate(context, tap(CARLOS_CHAT, "ab"));
    expect(last()?.text).toContain("Quedaste abierto a trabajar");
  });

  it("al desconectar desde la app, el chat deja de tener acceso", async () => {
    expect(await unlinkTelegram(context, ACTORS.carlos)).toEqual({ available: true, linked: false });
    await handleTelegramUpdate(context, tap(CARLOS_CHAT, "of"));

    expect(last()?.text).toContain("toca «Conectar Telegram»");
  });

  it("conectar otro teléfono desconecta el anterior", async () => {
    await connect(ACTORS.rafael, 444);
    const links = await context.db.select().from(telegramLinks).where(eq(telegramLinks.role, "worker"));

    expect(links.map((link) => link.chatId)).toEqual(["444"]);
  });
});

describe("registrar el webhook", () => {
  it("apunta Telegram a la app con un secreto que sale del servidor", async () => {
    const result = await setupTelegramWebhook(context);

    expect(result).toEqual({ bot: "nivel_demo_bot", webhook: "https://nivel.example/api/telegram/webhook" });
    expect(webhooks.at(-1)).toEqual({ url: result.webhook, secret: webhookSecret(context) });
    expect(webhookSecret(context)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("exige el token y una dirección https", async () => {
    const local = createContext({
      db: app.handle.db,
      secret: TEST_SECRET,
      telegram: { api: fakeTelegram, appUrl: "http://localhost:3000" },
    });

    await expect(setupTelegramWebhook(app.context)).rejects.toThrow(/TELEGRAM_BOT_TOKEN/);
    await expect(setupTelegramWebhook(local)).rejects.toThrow(/https/);
  });

  it("los códigos vencidos se limpian al pedir uno nuevo", async () => {
    await createTelegramLink(context, ACTORS.jose);
    now = new Date(DEMO_NOW.getTime() + LINK_CODE_TTL_MS + 1000);
    await createTelegramLink(context, ACTORS.jose);
    now = DEMO_NOW;

    expect(await context.db.select().from(telegramCodes)).toHaveLength(1);
  });
});
