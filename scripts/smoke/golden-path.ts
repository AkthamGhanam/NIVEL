import { IDS } from "../../src/server/db/seed/cast";
import type { ApiClient } from "./client";

/**
 * Camino dorado por API, sin voz (docs/spec.md, secciones 3 y 10): los 17
 * pasos de la demo en orden. Lanza un error en el primer paso que no cuadra.
 */

export class SmokeFailure extends Error {
  override readonly name = "SmokeFailure";
}

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new SmokeFailure(message);
}

interface Candidate {
  readonly workerId: string;
  readonly shortName: string;
}
interface Offer {
  readonly invitationId: string;
  readonly contractId: string | null;
}
interface CrewMember {
  readonly workerId: string;
  readonly status: string;
  readonly daysAttended: number;
}
interface Board {
  readonly accepted: number;
  readonly crew: readonly CrewMember[];
  readonly suggestedReplacement: Candidate | null;
}

const SCRIPT_REQUEST = {
  trade: "soldador",
  quantity: 3,
  minLevel: 2,
  zone: "Los Guayos",
  startDate: "el martes",
  days: 5,
  dailyPayUsd: 25,
  contractType: "obra_determinada",
} as const;

const TOP_SCORE = { quality: 5, punctuality: 5, safety: 5, attitude: 5 };

export type Step = (title: string) => void;

/** Cada trabajador usa su propio cliente: en la vida real son teléfonos distintos. */
export interface SmokeClients {
  readonly company: ApiClient;
  readonly team: ApiClient;
  readonly worker: (workerId: string) => Promise<ApiClient>;
}

async function respond(worker: ApiClient, accept: boolean) {
  const { offers } = await worker.get<{ offers: Offer[] }>("/api/invitations");
  const [offer] = offers;
  check(offer !== undefined, "El trabajador no recibió la invitación");
  return worker.post<{ offer: Offer; otp: string | null }>(`/api/invitations/${offer.invitationId}/respond`, {
    body: { accept },
  });
}

async function assembleCrew(clients: SmokeClients, step: Step): Promise<{ requestId: string }> {
  const { company } = clients;
  step("2. La empresa pide 3 soldadores nivel 2+ y 6 cumplen");
  const created = await company.post<{
    request: { id: string };
    matching: number;
    candidates: Candidate[];
  }>("/api/requests", { body: SCRIPT_REQUEST });
  check(created.matching === 6, `Deben cumplir 6 y cumplen ${created.matching}`);
  const top = created.candidates.slice(0, 4).map((candidate) => candidate.shortName);
  check(top.join(", ") === "Rafael T., José P., Luis M., Carlos R.", `Orden inesperado: ${top.join(", ")}`);
  const requestId = created.request.id;

  step("3. Invita a los 3 mejores");
  const first = await company.post<{ invitations: unknown[] }>(`/api/requests/${requestId}/invite`, {
    body: { quantity: 3 },
  });
  check(first.invitations.length === 3, "Debieron salir 3 invitaciones");

  step("4. Rafael y José aceptan; Luis rechaza");
  await respond(await clients.worker(IDS.rafael), true);
  await respond(await clients.worker(IDS.jose), true);
  await respond(await clients.worker(IDS.luis), false);
  const { board } = await company.get<{ board: Board }>("/api/requests/active");
  check(board.accepted === 2, `Deben ir 2 aceptados y van ${board.accepted}`);
  check(board.suggestedReplacement?.workerId === IDS.carlos, "El reemplazo sugerido debe ser Carlos R.");

  step("5. Invita 1 más: le llega a Carlos");
  const second = await company.post<{ invitations: Array<{ candidate: Candidate }> }>(
    `/api/requests/${requestId}/invite`,
    { body: { quantity: 1 } },
  );
  check(second.invitations[0]?.candidate.workerId === IDS.carlos, "La cuarta invitación debe ser de Carlos");
  return { requestId };
}

async function workTheJob(clients: SmokeClients, step: Step): Promise<{ contractId: string }> {
  const carlos = await clients.worker(IDS.carlos);
  step("6. Carlos acepta: cuadrilla 3 de 3");
  const accepted = await respond(carlos, true);
  const contractId = accepted.offer.contractId;
  check(contractId !== null && accepted.otp !== null, "Al aceptar debe nacer el contrato con su código");

  step("7. Carlos firma el contrato con su código");
  const signed = await carlos.post<{ status: string; notice: string }>(`/api/contracts/${contractId}/sign`, {
    body: { otp: accepted.otp },
  });
  check(signed.status === "activo", "El contrato firmado debe quedar activo");
  check(signed.notice.includes("no el patrono"), "El contrato debe decir que NIVEL no es el patrono");

  step("8. Carlos marca su entrada a la obra");
  await carlos.post("/api/attendance/checkin", { body: { contractId, simulated: true } });

  step("9. Modo Jurado: avanzar a fin de obra");
  const forwarded = await clients.team.post<{ daysAdded: number }>("/api/demo/fast-forward", { as: "admin" });
  check(forwarded.daysAdded > 0, "Avanzar a fin de obra debe completar días de asistencia");

  step("10. Carlos marca su salida");
  await carlos.post("/api/attendance/checkout", { body: { contractId, simulated: true } });
  return { contractId };
}

async function closeTheJob(clients: SmokeClients, step: Step, contractId: string): Promise<void> {
  const { company } = clients;
  const carlos = await clients.worker(IDS.carlos);
  step("11. La empresa registra el pago por Pago Móvil");
  const payment = await company.post<{ id: string; amountUsd: number }>("/api/payments", {
    body: { contractId, method: "pago_movil", reference: "0102-123456" },
  });
  check(payment.amountUsd === 270.83, `La liquidación debe ser de 270,83 USD y es de ${payment.amountUsd}`);

  step("12. Carlos confirma que recibió el pago");
  await carlos.post(`/api/payments/${payment.id}/confirm`);
  const receipt = await carlos.get<{ receiptNumber: string }>(`/api/payments/${payment.id}/receipt`);
  check(receipt.receiptNumber.startsWith("R-"), "Debe existir el recibo de pago");

  step("13. La empresa califica en privado (doble ciega)");
  const rating = { contractId, ...TOP_SCORE };
  const first = await company.post<{ revealed: boolean }>("/api/ratings", {
    as: "company",
    body: { ...rating, tags: ["Trabajo prolijo"] },
  });
  check(!first.revealed, "La primera calificación no debe revelarse todavía");

  step("14. Carlos califica y ambas notas se revelan");
  const second = await carlos.post<{ revealed: boolean }>("/api/ratings", {
    as: "worker",
    body: { ...rating, tags: ["Pagó a tiempo"] },
  });
  check(second.revealed, "Con las dos calificaciones deben revelarse");

  step("15. Se recalcula el nivel: Carlos sube a Nivel 3");
  const level = await carlos.post<{ level: number; leveledUp: boolean }>("/api/level/recalc");
  check(level.level === 3 && level.leveledUp, `Carlos debe quedar en nivel 3 y quedó en ${level.level}`);
}

async function reportAndReview(clients: SmokeClients, step: Step): Promise<void> {
  const carlos = await clients.worker(IDS.carlos);
  step("16. Carlos envía un reporte confidencial de inseguridad");
  const report = await carlos.post<{ reportId: string; guidance: string | null }>("/api/reports", {
    body: {
      kind: "inseguridad",
      text: "No había extintor en el área de soldadura",
      companyId: IDS.activeCompany,
    },
  });
  check(
    report.guidance?.includes("INPSASEL") === true,
    "Un reporte de inseguridad debe orientar al INPSASEL",
  );

  step("17. Una persona del equipo lo revisa y lo resuelve");
  const resolved = await clients.team.post<{ status: string }>(`/api/reports/${report.reportId}/resolve`, {
    as: "admin",
    body: { outcome: "resuelto", note: "Se habló con la empresa y colocó el extintor." },
  });
  check(resolved.status === "resuelto", "El reporte debe quedar resuelto");
}

export interface SmokeResult {
  readonly requestId: string;
  readonly contractId: string;
}

/** Recorre el camino dorado completo. Deja la base en el estado final de la demo. */
export async function runGoldenPath(clients: SmokeClients, step: Step): Promise<SmokeResult> {
  step("1. Reinicia la demo al seed");
  await clients.team.post("/api/demo/reset", { as: "admin" });
  // El smoke responde por cada trabajador; el bot de demo queda apagado para que no se le adelante.
  await clients.team.post("/api/demo/bot", { as: "admin", body: { state: "off" } });
  await clients.company.enterAs("company", IDS.activeCompany);
  const { requestId } = await assembleCrew(clients, step);
  const { contractId } = await workTheJob(clients, step);
  await closeTheJob(clients, step, contractId);
  await reportAndReview(clients, step);
  return { requestId, contractId };
}
