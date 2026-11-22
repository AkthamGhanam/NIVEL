import { formatDay, formatKm, formatTime, formatUsd, plural } from "@/lib/format";
import { round2 } from "@/lib/money";
import { tradeCount } from "@/lib/trades";

import type { RequestBoard } from "./company-api";

/**
 * Cómo se lee el tablero del contratista: frases y estados listos para pintar.
 * Funciones puras, sin React, para probarlas con datos exactos.
 */

export type StatusTone = "neutral" | "ok" | "pending" | "alert";

export interface Status {
  readonly label: string;
  readonly tone: StatusTone;
}

type Request = RequestBoard["request"];
type Candidate = RequestBoard["candidates"][number];
type Invitation = RequestBoard["invitations"][number];
export type CrewMember = RequestBoard["crew"][number];
type AttendanceDay = CrewMember["attendance"][number];

/** "3 soldadores", "Nivel 2 o más", "desde mar 24 nov", "5 días", "$25 al día". */
export function requestFacts(request: Request): string[] {
  return [
    tradeCount(request.trade, request.quantity),
    request.minLevel >= 5 ? "Nivel 5" : `Nivel ${request.minLevel} o más`,
    `desde ${formatDay(request.startDate)}`,
    plural(request.days, "día", "días"),
    `${formatUsd(request.dailyPayUsd)} al día`,
  ];
}

const INVITATION_STATUS: Readonly<Record<Invitation["status"], Status>> = {
  enviada: { label: "Invitación enviada", tone: "pending" },
  aceptada: { label: "Aceptó", tone: "ok" },
  rechazada: { label: "Rechazó", tone: "alert" },
};

export const invitationStatus = (status: Invitation["status"]): Status => INVITATION_STATUS[status];

const CONTRACT_STATUS: Readonly<Record<CrewMember["status"], Status>> = {
  pendiente_firma: { label: "Falta la firma del trabajador", tone: "pending" },
  activo: { label: "Contrato firmado", tone: "ok" },
  completado: { label: "Trabajo terminado y pagado", tone: "ok" },
  terminado: { label: "Contrato terminado", tone: "neutral" },
};

export const contractStatus = (status: CrewMember["status"]): Status => CONTRACT_STATUS[status];

/**
 * Lo único que la empresa ve de una persona antes de invitarla: hechos
 * verificables. Nunca calificaciones, foto, edad ni sexo (regla legal 8.6).
 */
export function candidateFacts(candidate: Candidate): string[] {
  const facts = [plural(candidate.confirmedJobs, "trabajo confirmado", "trabajos confirmados")];
  if (candidate.practicalPassed) facts.push("Prueba práctica aprobada");
  if (candidate.certificates > 0) facts.push(plural(candidate.certificates, "constancia", "constancias"));
  facts.push(`a ${formatKm(candidate.distanceKm)}`);
  return facts;
}

/** Personas que cumplen y aún no fueron invitadas, en el orden del servidor (las mejores primero). */
export function uninvitedCandidates(board: RequestBoard): Candidate[] {
  const invited = new Set(board.invitations.map((invitation) => invitation.candidate?.workerId));
  return board.candidates.filter((candidate) => !invited.has(candidate.workerId));
}

/** Puestos sin cubrir: los que no tienen ni una aceptación ni una invitación esperando respuesta. */
export function seatsToFill(board: RequestBoard): number {
  const waiting = board.invitations.filter((invitation) => invitation.status === "enviada").length;
  return Math.max(0, board.request.quantity - board.accepted - waiting);
}

export interface CrewProgress {
  readonly complete: boolean;
  /** "Cuadrilla 2 de 3" o "Cuadrilla completa · 3 de 3". */
  readonly label: string;
}

export function crewProgress(board: RequestBoard): CrewProgress {
  const { quantity } = board.request;
  const complete = board.accepted >= quantity;
  const count = `${Math.min(board.accepted, quantity)} de ${quantity}`;
  return { complete, label: complete ? `Cuadrilla completa · ${count}` : `Cuadrilla ${count}` };
}

/** "Llegó 7:02 a. m. · Salió 3:30 p. m." con las horas reales que marcó la persona. */
export function attendanceLine(day: AttendanceDay): string {
  const parts: string[] = [];
  if (day.checkInAt) parts.push(`Llegó ${formatTime(day.checkInAt)}`);
  parts.push(day.checkOutAt ? `Salió ${formatTime(day.checkOutAt)}` : "Sigue en la obra");
  return parts.join(" · ");
}

/** Salario que la empresa le debe a esa persona por todos sus días. El dinero no pasa por NIVEL. */
export function wageOwed(request: Request, member: CrewMember): number {
  return round2(request.dailyPayUsd * member.days);
}

export type PaymentStage = "sin_firma" | "por_pagar" | "por_confirmar" | "confirmado";

/** En qué va el pago del salario de una persona de la cuadrilla. */
export function paymentStage(member: CrewMember): PaymentStage {
  if (member.payment?.confirmedByWorkerAt) return "confirmado";
  if (member.payment) return "por_confirmar";
  return member.status === "activo" ? "por_pagar" : "sin_firma";
}

/** La calificación se abre cuando el trabajador confirmó el pago, y se envía una sola vez. */
export function canRate(member: CrewMember): boolean {
  return member.status === "completado" && !member.ratedByCompany;
}

export interface SiteLogEntry {
  readonly key: string;
  readonly date: string;
  readonly shortName: string;
  readonly line: string;
  readonly insideGeofence: boolean;
  readonly note: string | null;
}

/** Bitácora de la obra: cada jornada de cada persona, de la más reciente a la más antigua. */
export function siteLog(crew: readonly CrewMember[]): SiteLogEntry[] {
  return crew
    .flatMap((member) =>
      member.attendance.map((day) => ({
        key: `${member.contractId}:${day.date}`,
        date: day.date,
        shortName: member.shortName,
        line: attendanceLine(day),
        insideGeofence: day.insideGeofence,
        note: day.note,
      })),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.shortName.localeCompare(b.shortName, "es"));
}
