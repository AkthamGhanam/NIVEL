import type { IsoDate } from "./dates";
import { LEGAL_COST_DISCLAIMER, type LegalCostEstimate } from "./legal-cost";
import { type Level, LEVEL_NAMES, MARKET_REFERENCE_BANDS } from "./level";
import { explainLevel } from "./level-explanation";
import type { PriceWithIva } from "./pricing";
import { type Trade, TRADE_LABELS } from "./trades";

/**
 * Frases que Nivi lee en voz alta tras cada herramienta (campo `say`).
 * Cortas, sin tecnicismos y dentro de las reglas legales: nunca prometen
 * empleo ni salario, los precios van "más IVA" y el costo legal es un estimado.
 */

const dollars = (amount: number) => `${Math.round(amount)} dólares`;

function joinSpanish(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}`;
}

const SPOKEN_DATE = new Intl.DateTimeFormat("es-VE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "2026-11-24" → "martes, 24 de noviembre". */
export const spokenDate = (date: IsoDate | string): string =>
  SPOKEN_DATE.format(new Date(`${date}T00:00:00Z`));

export interface RequestSummary {
  readonly trade: Trade;
  readonly quantity: number;
  readonly minLevel: Level;
  readonly zone: string;
  readonly days: number;
  readonly matching: number;
  readonly legalCost: LegalCostEstimate;
  readonly feeRange: { readonly min: PriceWithIva; readonly max: PriceWithIva } | null;
}

function sayFee({ min, max }: NonNullable<RequestSummary["feeRange"]>): string {
  const amount =
    min.base === max.base ? `es de ${dollars(min.base)}` : `va de ${min.base} a ${dollars(max.base)}`;
  return `La tarifa de NIVEL ${amount} por contratación según el nivel, más IVA.`;
}

function sayInviteQuestion(available: number): string {
  if (available === 1) return "¿Invito a esa persona?";
  return `¿Invito a los ${available} mejores?`;
}

export function sayRequestCreated(summary: RequestSummary): string {
  const { matching, quantity, minLevel, zone, days, legalCost, feeRange } = summary;
  const label = TRADE_LABELS[summary.trade];
  const level = minLevel === 5 ? "nivel 5" : `nivel ${minLevel} o más`;
  if (matching === 0 || feeRange === null) {
    return `No encontré ${label.plural} de ${level} disponibles cerca de ${zone} para esas fechas. ¿Probamos con otro nivel mínimo o con otra fecha?`;
  }
  const found =
    matching === 1
      ? `1 ${label.singular} de ${level} cumple cerca de ${zone}.`
      : `${matching} ${label.plural} de ${level} cumplen cerca de ${zone}.`;
  const short =
    matching < quantity ? ` Pediste ${quantity}, así que por ahora faltarían ${quantity - matching}.` : "";
  const cost = `El costo legal estimado es de unos ${dollars(legalCost.perWorker.total)} por persona por ${days === 1 ? "1 día" : `los ${days} días`}.`;
  return `Listo. ${found}${short} ${cost} ${sayFee(feeRange)} ${sayInviteQuestion(Math.min(quantity, matching))}`;
}

export function sayInvited(shortNames: readonly string[]): string {
  if (shortNames.length === 0) return "Ya no quedan candidatos sin invitar que cumplan con esta solicitud.";
  // Los nombres cortos ya terminan en punto ("Luis M."): no se duplica.
  const names = joinSpanish(shortNames).replace(/\.$/, "");
  return `Invité a ${names}. Te aviso en pantalla cuando respondan.`;
}

export function sayLegalCost(estimate: LegalCostEstimate, days: number): string {
  const people = estimate.quantity === 1 ? "1 persona" : `${estimate.quantity} personas`;
  const span = days === 1 ? "1 día" : `${days} días`;
  return (
    `Para ${people} durante ${span}, el costo legal estimado es de unos ${dollars(estimate.totalForQuantity)} en total, ` +
    `unos ${dollars(estimate.perWorker.total)} por persona. Incluye salario, utilidades, vacaciones, prestaciones y aportes. ` +
    LEGAL_COST_DISCLAIMER
  );
}

export interface SpokenOffer {
  readonly companyName: string;
  readonly trade: Trade;
  readonly zone: string;
  readonly startDate: string;
  readonly days: number;
  readonly dailyPayUsd: number;
}

/** Una invitación en una frase: quién invita, para qué, dónde, cuándo y cuánto paga al día. */
export function sayOffer(offer: SpokenOffer): string {
  const span = offer.days === 1 ? "1 día" : `${offer.days} días`;
  return (
    `${offer.companyName} te invita como ${TRADE_LABELS[offer.trade].singular} en ${offer.zone}: ` +
    `${span} desde el ${spokenDate(offer.startDate)}, a ${dollars(offer.dailyPayUsd)} diarios.`
  );
}

export function sayOffers(offers: readonly SpokenOffer[]): string {
  const [first] = offers;
  if (!first) return "No tienes invitaciones abiertas por ahora. Te aviso cuando llegue una.";
  const count =
    offers.length === 1
      ? "Tienes 1 invitación."
      : `Tienes ${offers.length} invitaciones. Te cuento la primera.`;
  return `${count} ${sayOffer(first)} ¿La aceptas?`;
}

export function sayOfferAnswered(accepted: boolean, companyName: string): string {
  if (!accepted) return "Listo, rechazaste la invitación. No pasa nada: te aviso cuando llegue otra.";
  return `Listo, aceptaste. Tu contrato es directo con ${companyName}; NIVEL no es tu patrono. Revísalo y fírmalo en tu pantalla.`;
}

export interface ProfileRoute {
  readonly firstName: string;
  readonly freeCourse: string | null;
  readonly recommendedCourse: string | null;
}

const EMPTY_HISTORY = Object.freeze({
  confirmedJobs: 0,
  practicalPassed: false,
  certificates: 0,
  attendanceRate: 1,
  verifiedIncidents: 0,
  ratings: [],
});

export function sayProfileCreated(route: ProfileRoute): string {
  const band = MARKET_REFERENCE_BANDS[1];
  const courses = [
    route.freeCourse && `Puedes empezar hoy con el curso gratis "${route.freeCourse}".`,
    route.recommendedCourse && `Para tu oficio te recomiendo el curso "${route.recommendedCourse}".`,
  ].filter(Boolean);
  return [
    `Listo, ${route.firstName}. Tu perfil quedó en Nivel 1: ${LEVEL_NAMES[1]}.`,
    explainLevel(EMPTY_HISTORY, 1),
    ...courses,
    `La referencia de mercado para tu nivel va de ${band.min} a ${dollars(band.max)} al mes. Es solo una referencia, no una promesa de salario.`,
  ].join(" ");
}

export const SAY_UNDERAGE =
  "Gracias por tu interés. Por ahora NIVEL es solo para personas mayores de 18 años. ¡Te esperamos más adelante!";
