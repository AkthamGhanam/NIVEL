import { formatDay, formatRate, formatUsd, plural } from "@/lib/format";
import { RATING_CATEGORIES } from "@/lib/rating-tags";
import { TRADE_LABELS } from "@/lib/trades";

import type { ConsentKind, ContractDetail, LevelStatus, MyData, WorkerOffer } from "./worker-api";

/**
 * Cómo se lee la app del trabajador: en qué paso va su trabajo y qué frases
 * se muestran. Funciones puras, sin React, para probarlas con datos exactos.
 */

export const pendingOffers = (offers: readonly WorkerOffer[]): WorkerOffer[] =>
  offers.filter((offer) => offer.status === "enviada");

/** El trabajo más reciente que la persona aceptó, si tiene alguno. */
export const currentJob = (offers: readonly WorkerOffer[]): (WorkerOffer & { contractId: string }) | null =>
  offers.find(
    (offer): offer is WorkerOffer & { contractId: string } =>
      offer.status === "aceptada" && offer.contractId !== null,
  ) ?? null;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "Soldador en Los Guayos". */
export const offerTitle = (offer: Pick<WorkerOffer, "trade" | "zone">): string =>
  `${capitalize(TRADE_LABELS[offer.trade].singular)} en ${offer.zone}`;

/** "5 días desde mar 24 nov", "$25 al día", "Total $125". */
export function offerFacts(
  offer: Pick<WorkerOffer, "days" | "startDate" | "dailyPayUsd" | "totalUsd">,
): string[] {
  return [
    `${plural(offer.days, "día", "días")} desde ${formatDay(offer.startDate)}`,
    `${formatUsd(offer.dailyPayUsd)} al día`,
    `Total ${formatUsd(offer.totalUsd)}`,
  ];
}

/** "Paga a tiempo 96 %". Solo existe con 5 o más contrataciones terminadas: es un hecho, no una opinión. */
export const paysOnTimeLabel = (percent: number | null): string | null =>
  percent === null ? null : `Paga a tiempo ${formatRate(percent / 100)}`;

export type JobStep =
  | "firmar"
  | "marcar_entrada"
  | "marcar_salida"
  | "esperar_pago"
  | "confirmar_pago"
  | "calificar"
  | "terminado"
  | "cerrado";

/** En qué paso va un trabajo, según lo que ya quedó registrado en el servidor. */
export function jobStep(contract: ContractDetail): JobStep {
  if (contract.status === "pendiente_firma") return "firmar";
  if (contract.status === "terminado") return "cerrado";
  if (contract.status === "completado") return contract.ratedByMe ? "terminado" : "calificar";
  if (contract.payment) return "confirmar_pago";
  if (contract.attendance.some((day) => day.checkInAt !== null && day.checkOutAt === null)) {
    return "marcar_salida";
  }
  return contract.attendance.length >= contract.days ? "esperar_pago" : "marcar_entrada";
}

export interface StepAction {
  readonly label: string;
  /** A dónde lleva el siguiente paso. Nulo cuando toca esperar a la otra parte. */
  readonly href: string | null;
}

export function stepAction(step: JobStep, contractId: string): StepAction {
  const id = encodeURIComponent(contractId);
  const actions: Record<JobStep, StepAction> = {
    firmar: { label: "Firmar mi contrato", href: `/t/contrato/${id}` },
    marcar_entrada: { label: "Marcar mi entrada", href: "/t/obra" },
    marcar_salida: { label: "Marcar mi salida", href: "/t/obra" },
    esperar_pago: { label: "Terminaste la obra. Falta que la empresa registre tu pago.", href: null },
    confirmar_pago: { label: "Confirmar si recibí mi pago", href: `/t/fin/${id}` },
    calificar: { label: "Calificar a la empresa", href: `/t/fin/${id}` },
    terminado: { label: "Trabajo terminado y confirmado.", href: null },
    cerrado: { label: "Este contrato terminó.", href: null },
  };
  return actions[step];
}

/** Los hechos que cuentan para el nivel, los mismos de la fórmula pública. */
export function levelFacts(facts: LevelStatus["facts"]): string[] {
  return [
    plural(facts.confirmedJobs, "trabajo confirmado", "trabajos confirmados"),
    facts.practicalPassed ? "Prueba práctica aprobada" : "Prueba práctica pendiente",
    plural(facts.certificates, "constancia de academia", "constancias de academia"),
    `Asistencia de ${formatRate(facts.attendanceRate)}`,
  ];
}

export interface ConsentOption {
  readonly kind: ConsentKind;
  readonly label: string;
  readonly hint: string;
}

/** Los cinco permisos, cada uno con su interruptor (regla legal 8.5): nunca se piden juntos. */
export const CONSENT_OPTIONS: readonly ConsentOption[] = Object.freeze([
  { kind: "voice", label: "Hablar con Nivi", hint: "Usamos tu voz solo para entenderte. No la guardamos." },
  {
    kind: "share_profile",
    label: "Mostrar mi perfil a las empresas",
    hint: "Ven tu oficio, nivel y zona. Nunca tu foto, edad ni sexo. Si lo apagas, sales de las búsquedas.",
  },
  {
    kind: "gps",
    label: "Ubicación al marcar",
    hint: "Solo en el momento de marcar entrada y salida. No te seguimos el resto del día.",
  },
  { kind: "notifications", label: "Avisos", hint: "Te avisamos de ofertas nuevas y de tus pagos." },
  {
    kind: "selfie",
    label: "Selfie de verificación",
    hint: "Para comprobar que eres tú. Las empresas no la ven.",
  },
]);

export interface ReceivedRatingLine {
  readonly label: string;
  readonly score: string;
}

/** Una calificación privada recibida, con las categorías que usó la empresa y nota "4 de 5". */
export function receivedRatingLines(rating: MyData["ratingsReceived"][number]): ReceivedRatingLine[] {
  return RATING_CATEGORIES.empresa.map(({ key, label }) => ({ label, score: `${rating[key]} de 5` }));
}
