import { normalizeSpanish } from "./dates";
import { type Trade, TRADES } from "./trades";

/**
 * Entender lo que una persona escribe o dicta en el chat, con reglas simples y
 * sin IA: qué quiere hacer y qué datos de un pedido de personal dijo. Lo que
 * no se entiende no se inventa: el bot pregunta solo lo que falta.
 */

const NUMBER_WORDS: Readonly<Record<string, number>> = Object.freeze({
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  quince: 15,
  veinte: 20,
  veinticinco: 25,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
});

const NUMBER = `(\\d{1,4}(?:[.,]\\d{1,2})?|${Object.keys(NUMBER_WORDS).join("|")})`;

function toNumber(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const value = NUMBER_WORDS[raw] ?? Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : undefined;
}

const TRADE_WORDS: ReadonlyArray<readonly [pattern: string, trade: Trade]> = [
  ["soldador(?:es|a|as)?", "soldador"],
  ["electricistas?", "electricista"],
  ["albanil(?:es)?", "albanil"],
  ["plomer[oa]s?", "plomero"],
  ["pintor(?:es|a|as)?", "pintor"],
];

const WEEKDAYS = "lunes|martes|miercoles|jueves|viernes|sabado|domingo";
const START = new RegExp(`\\b(pasado manana|manana|hoy|${WEEKDAYS})\\b`);

export interface RequestHints {
  readonly trade?: Trade;
  readonly quantity?: number;
  readonly minLevel?: number;
  readonly days?: number;
  readonly dailyPayUsd?: number;
  /** Tal como se dijo ("manana", "lunes"): la fecha concreta la resuelve quien conoce el día de hoy. */
  readonly startPhrase?: string;
}

const first = (text: string, pattern: RegExp) => toNumber(text.match(pattern)?.[1]);

function findTrade(text: string): { trade: Trade; quantity?: number } | undefined {
  for (const [word, trade] of TRADE_WORDS) {
    const match = text.match(new RegExp(`(?:\\b${NUMBER}\\s+)?\\b${word}\\b`));
    if (!match) continue;
    const quantity = toNumber(match[1]);
    return quantity === undefined ? { trade } : { trade, quantity };
  }
  return undefined;
}

const PAY_PATTERNS = [
  new RegExp(`\\b${NUMBER}\\s*(?:dolares|dolar|usd)\\b`),
  new RegExp(`\\b(?:pago|pagando|pagar|a)\\s+${NUMBER}\\s*(?:diarios?|al dia|por dia|el dia)?$`),
  new RegExp(`\\b(?:pago|pagando|pagar|a)\\s+${NUMBER}\\s*(?:diarios?|al dia|por dia|el dia)\\b`),
];

/** Los datos de un pedido que aparecen en una frase como "3 soldadores nivel 2 para el lunes, 5 días a 25 dólares". */
export function readRequestHints(spoken: string): RequestHints {
  // El signo de dólar se conserva como palabra antes de quitar la puntuación.
  const text = normalizeSpanish(
    spoken.replace(/\$\s*(\d+(?:[.,]\d+)?)/g, "$1 dolares ").replace(/(\d)\s*\$/g, "$1 dolares "),
  );
  const found = findTrade(text);
  const people = first(text, new RegExp(`\\b${NUMBER}\\s+(?:personas?|trabajador(?:es)?|obreros?)\\b`));
  const hints: Record<string, unknown> = {
    trade: found?.trade,
    quantity: found?.quantity ?? people,
    minLevel: first(text, new RegExp(`\\bnivel\\s+${NUMBER}\\b`)),
    days: first(text, new RegExp(`\\b${NUMBER}\\s+dias?\\b`)),
    dailyPayUsd: PAY_PATTERNS.map((pattern) => first(text, pattern)).find((value) => value !== undefined),
    startPhrase: text.match(START)?.[1],
  };
  return Object.fromEntries(Object.entries(hints).filter(([, value]) => value !== undefined)) as RequestHints;
}

/** El número de una respuesta corta ("3", "tres", "$25"), para el dato que el bot acaba de preguntar. */
export function readBareNumber(spoken: string): number | undefined {
  const text = normalizeSpanish(spoken.replace(/\$/g, " "));
  const match = text.match(new RegExp(`^${NUMBER}(?:\\s+\\p{Letter}+){0,2}$`, "u"));
  return toNumber(match?.[1]);
}

export type ChatIntent =
  | "ofertas"
  | "nivel"
  | "aceptar"
  | "rechazar"
  | "disponibilidad"
  | "pedir"
  | "cuadrilla"
  | "ubicacion"
  | "cancelar"
  | "confirmar"
  | "menu";

const INTENTS: ReadonlyArray<readonly [intent: ChatIntent, pattern: RegExp]> = [
  ["cancelar", /\b(cancel\w*|olvidalo|ya no)\b/],
  ["rechazar", /\b(rechaz\w*|no (la |lo )?(acepto|quiero)|no me interesa)\b/],
  ["aceptar", /\b(acept\w*|la tomo|me interesa|voy)\b/],
  ["ofertas", /\b(ofertas?|trabajos?|chambas?|invitaci\w+)\b/],
  ["nivel", /\b(nivel|subir|escalafon)\b/],
  ["disponibilidad", /\b(disponible|abierto a trabajar|no (quiero|puedo) trabajar|pausar)\b/],
  ["cuadrilla", /\b(cuadrilla|quien acepto|como va|estado)\b/],
  ["ubicacion", /\b(ubicacion|donde es la obra|direccion)\b/],
  ["pedir", /\b(necesito|busco|pedir|quiero contratar|contratar|personal|gente)\b/],
  ["confirmar", /^(si|dale|ok|okey|listo|correcto|esta bien|de acuerdo|confirmo)\b/],
];

/** Qué quiere hacer la persona. Si no queda claro, el bot muestra el menú en vez de adivinar. */
export function readIntent(spoken: string): ChatIntent {
  const text = normalizeSpanish(spoken);
  if (TRADES.some((trade) => findTrade(text)?.trade === trade)) return "pedir";
  return INTENTS.find(([, pattern]) => pattern.test(text))?.[0] ?? "menu";
}
