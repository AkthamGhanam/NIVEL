import { describe, expect, it } from "vitest";

import type { RequestBoard } from "./company-api";
import {
  attendanceLine,
  candidateFacts,
  canRate,
  contractStatus,
  crewProgress,
  type CrewMember,
  invitationStatus,
  paymentStage,
  requestFacts,
  seatsToFill,
  siteLog,
  uninvitedCandidates,
  wageOwed,
} from "./company-view";

type Candidate = RequestBoard["candidates"][number];

const candidate = (workerId: string, changes: Partial<Candidate> = {}): Candidate => ({
  workerId,
  shortName: `${workerId} P.`,
  level: 2,
  confirmedJobs: 2,
  practicalPassed: true,
  certificates: 1,
  distanceKm: 1.2,
  ...changes,
});

const request: RequestBoard["request"] = {
  id: "jr-1",
  companyId: "co-guayos",
  trade: "soldador",
  quantity: 3,
  minLevel: 2,
  zone: "Los Guayos",
  lat: 10.19,
  lng: -67.93,
  startDate: "2026-11-24",
  days: 5,
  dailyPayUsd: 25,
  contractType: "obra_determinada",
  status: "abierta",
  createdVia: "web",
  createdAt: "2026-11-22T10:30:00.000Z",
};

const day = (date: string, changes: Partial<CrewMember["attendance"][number]> = {}) => ({
  date,
  checkInAt: `${date}T11:02:00.000Z`,
  checkOutAt: `${date}T19:30:00.000Z`,
  insideGeofence: true,
  note: null,
  ...changes,
});

const member = (changes: Partial<CrewMember> = {}): CrewMember => ({
  contractId: "ct-1",
  workerId: "w-carlos",
  shortName: "Carlos R.",
  level: 2,
  status: "activo",
  signedWorkerAt: "2026-11-22T10:40:00.000Z",
  days: 5,
  daysAttended: 0,
  lastAttendance: null,
  attendance: [],
  payment: null,
  ratedByCompany: false,
  ...changes,
});

const board = (changes: Partial<RequestBoard> = {}): RequestBoard => ({
  request,
  matching: 3,
  candidates: [candidate("a"), candidate("b"), candidate("c")],
  legalCost: {
    perWorker: {
      salary: 125,
      utilidades: 10.42,
      vacacionesBono: 10.42,
      prestaciones: 20.83,
      pensiones: 11.25,
      aportes: 18.75,
      total: 196.67,
    },
    quantity: 3,
    totalForQuantity: 590,
  },
  feeRange: null,
  invitations: [],
  accepted: 0,
  crew: [],
  suggestedReplacement: null,
  ...changes,
});

describe("lectura de la solicitud", () => {
  it("resume la solicitud con concordancia y fechas legibles", () => {
    expect(requestFacts(request)).toEqual([
      "3 soldadores",
      "Nivel 2 o más",
      "desde mar 24 nov",
      "5 días",
      "$25 al día",
    ]);
    expect(requestFacts({ ...request, quantity: 1, trade: "albanil", minLevel: 5, days: 1 })).toEqual([
      "1 albañil",
      "Nivel 5",
      "desde mar 24 nov",
      "1 día",
      "$25 al día",
    ]);
  });

  it("de una persona solo cuenta hechos verificables", () => {
    expect(candidateFacts(candidate("a"))).toEqual([
      "2 trabajos confirmados",
      "Prueba práctica aprobada",
      "1 constancia",
      "a 1,2 km",
    ]);
    expect(
      candidateFacts(candidate("a", { confirmedJobs: 1, practicalPassed: false, certificates: 0 })),
    ).toEqual(["1 trabajo confirmado", "a 1,2 km"]);
    expect(candidateFacts(candidate("a", { certificates: 2 }))).toContain("2 constancias");
  });

  it("cada estado tiene su palabra y su color", () => {
    expect(invitationStatus("enviada")).toEqual({ label: "Invitación enviada", tone: "pending" });
    expect(invitationStatus("aceptada")).toEqual({ label: "Aceptó", tone: "ok" });
    expect(invitationStatus("rechazada")).toEqual({ label: "Rechazó", tone: "alert" });
    expect(contractStatus("pendiente_firma").tone).toBe("pending");
    expect(contractStatus("activo")).toEqual({ label: "Contrato firmado", tone: "ok" });
    expect(contractStatus("completado").label).toBe("Trabajo terminado y pagado");
    expect(contractStatus("terminado").tone).toBe("neutral");
  });
});

describe("avance de la cuadrilla", () => {
  const sent = (workerId: string, status: "enviada" | "aceptada" | "rechazada") => ({
    id: `in-${workerId}`,
    status,
    candidate: candidate(workerId),
  });

  it("los puestos por cubrir descuentan aceptaciones e invitaciones en espera", () => {
    expect(seatsToFill(board())).toBe(3);
    expect(seatsToFill(board({ invitations: [sent("a", "enviada")] }))).toBe(2);
    expect(
      seatsToFill(
        board({
          accepted: 2,
          invitations: [sent("a", "aceptada"), sent("b", "aceptada"), sent("c", "rechazada")],
        }),
      ),
    ).toBe(1);
    expect(seatsToFill(board({ accepted: 4 }))).toBe(0);
  });

  it("no vuelve a ofrecer a quien ya fue invitado, aunque ya no aparezca como candidato", () => {
    const invitations = [
      sent("a", "rechazada"),
      { id: "in-x", status: "enviada" as const, candidate: undefined },
    ];

    expect(uninvitedCandidates(board({ invitations })).map((item) => item.workerId)).toEqual(["b", "c"]);
  });

  it("dice cuántos van y cuándo está completa", () => {
    expect(crewProgress(board({ accepted: 2 }))).toEqual({ complete: false, label: "Cuadrilla 2 de 3" });
    expect(crewProgress(board({ accepted: 3 }))).toEqual({
      complete: true,
      label: "Cuadrilla completa · 3 de 3",
    });
    expect(crewProgress(board({ accepted: 4 })).label).toBe("Cuadrilla completa · 3 de 3");
  });
});

describe("obra, pago y calificación", () => {
  it("la asistencia usa las horas reales en la hora de Caracas", () => {
    expect(attendanceLine(day("2026-11-24"))).toBe("Llegó 7:02 a. m. · Salió 3:30 p. m.");
    expect(attendanceLine(day("2026-11-24", { checkOutAt: null }))).toBe(
      "Llegó 7:02 a. m. · Sigue en la obra",
    );
    expect(attendanceLine(day("2026-11-24", { checkInAt: null }))).toBe("Salió 3:30 p. m.");
  });

  it("la bitácora ordena por día, del más reciente al más antiguo, y luego por nombre", () => {
    const crew = [
      member({
        attendance: [day("2026-11-24"), day("2026-11-25", { note: "Lluvia", insideGeofence: false })],
      }),
      member({ contractId: "ct-2", shortName: "Ana P.", attendance: [day("2026-11-25")] }),
    ];

    expect(siteLog(crew).map((entry) => `${entry.date} ${entry.shortName}`)).toEqual([
      "2026-11-25 Ana P.",
      "2026-11-25 Carlos R.",
      "2026-11-24 Carlos R.",
    ]);
    expect(siteLog(crew)[1]).toMatchObject({ key: "ct-1:2026-11-25", note: "Lluvia", insideGeofence: false });
    expect(siteLog([])).toEqual([]);
  });

  it("el salario es el pago diario por los días de esa persona", () => {
    expect(wageOwed(request, member())).toBe(125);
    expect(wageOwed({ ...request, dailyPayUsd: 27.35 }, member({ days: 3 }))).toBe(82.05);
  });

  it("el pago avanza de por pagar a por confirmar y a confirmado", () => {
    const payment = { id: "pa-1", receiptNumber: "R-1", confirmedByWorkerAt: null };

    expect(paymentStage(member({ status: "pendiente_firma" }))).toBe("sin_firma");
    expect(paymentStage(member())).toBe("por_pagar");
    expect(paymentStage(member({ payment }))).toBe("por_confirmar");
    expect(
      paymentStage(member({ payment: { ...payment, confirmedByWorkerAt: "2026-11-28T20:00:00.000Z" } })),
    ).toBe("confirmado");
  });

  it("solo se califica un trabajo completado, y una sola vez", () => {
    expect(canRate(member())).toBe(false);
    expect(canRate(member({ status: "completado" }))).toBe(true);
    expect(canRate(member({ status: "completado", ratedByCompany: true }))).toBe(false);
  });
});
