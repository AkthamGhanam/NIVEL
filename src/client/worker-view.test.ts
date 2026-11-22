import { describe, expect, it } from "vitest";

import type { ContractDetail, MyData, WorkerOffer } from "./worker-api";
import {
  CONSENT_OPTIONS,
  currentJob,
  jobStep,
  levelFacts,
  offerFacts,
  offerTitle,
  paysOnTimeLabel,
  pendingOffers,
  receivedRatingLines,
  stepAction,
} from "./worker-view";

const offer = (changes: Partial<WorkerOffer> = {}): WorkerOffer => ({
  invitationId: "inv-1",
  status: "enviada",
  audioUrl: null,
  company: { name: "Constructora Los Guayos", verified: true, paysOnTimePercent: 96 },
  trade: "soldador",
  zone: "Los Guayos",
  startDate: "2026-11-24",
  days: 5,
  dailyPayUsd: 25,
  totalUsd: 125,
  contractType: "obra_determinada",
  contractId: null,
  notice: "",
  ...changes,
});

const contract = (changes: Partial<ContractDetail> = {}): ContractDetail =>
  ({
    id: "con 1",
    status: "activo",
    days: 2,
    attendance: [],
    payment: null,
    ratedByMe: false,
    ...changes,
  }) as ContractDetail;

const day = (date: string, out: boolean) => ({
  date,
  checkInAt: `${date}T12:00:00.000Z`,
  checkOutAt: out ? `${date}T21:00:00.000Z` : null,
});

const payment = {
  id: "pay-1",
  receiptNumber: "R-0001",
  amountUsd: 125,
  registeredAt: "2026-11-28T20:00:00.000Z",
  confirmedByWorkerAt: null,
};

describe("ofertas", () => {
  it("separa las que esperan respuesta y encuentra el trabajo aceptado con contrato", () => {
    const offers = [
      offer({ invitationId: "a", status: "rechazada" }),
      offer({ invitationId: "b" }),
      offer({ invitationId: "c", status: "aceptada", contractId: "con-9" }),
      offer({ invitationId: "d", status: "aceptada" }),
    ];

    expect(pendingOffers(offers).map((item) => item.invitationId)).toEqual(["b"]);
    expect(currentJob(offers)?.contractId).toBe("con-9");
    expect(currentJob([offer()])).toBeNull();
  });

  it("dice el trabajo con las cifras exactas", () => {
    expect(offerTitle(offer())).toBe("Soldador en Los Guayos");
    expect(offerFacts(offer())).toEqual(["5 días desde mar 24 nov", "$25 al día", "Total $125"]);
    expect(offerFacts(offer({ days: 1, totalUsd: 25 }))[0]).toBe("1 día desde mar 24 nov");
  });

  it("la puntualidad de pago solo aparece cuando hay un dato medido", () => {
    expect(paysOnTimeLabel(96)).toBe("Paga a tiempo 96 %");
    expect(paysOnTimeLabel(null)).toBeNull();
  });
});

describe("paso del trabajo", () => {
  it("sigue el camino completo: firmar, marcar, esperar el pago, confirmarlo y calificar", () => {
    expect(jobStep(contract({ status: "pendiente_firma" }))).toBe("firmar");
    expect(jobStep(contract())).toBe("marcar_entrada");
    expect(jobStep(contract({ attendance: [day("2026-11-24", false)] }))).toBe("marcar_salida");
    expect(jobStep(contract({ attendance: [day("2026-11-24", true)] }))).toBe("marcar_entrada");
    expect(jobStep(contract({ attendance: [day("2026-11-24", true), day("2026-11-25", true)] }))).toBe(
      "esperar_pago",
    );
    expect(jobStep(contract({ payment }))).toBe("confirmar_pago");
    expect(jobStep(contract({ status: "completado", payment }))).toBe("calificar");
    expect(jobStep(contract({ status: "completado", payment, ratedByMe: true }))).toBe("terminado");
    expect(jobStep(contract({ status: "terminado" }))).toBe("cerrado");
  });

  it("cada paso lleva a su pantalla, y cuando toca esperar no ofrece un enlace", () => {
    expect(stepAction("firmar", "con 1")).toEqual({
      label: "Firmar mi contrato",
      href: "/t/contrato/con%201",
    });
    expect(stepAction("marcar_entrada", "c").href).toBe("/t/obra");
    expect(stepAction("marcar_salida", "c").label).toBe("Marcar mi salida");
    expect(stepAction("confirmar_pago", "c").href).toBe("/t/fin/c");
    expect(stepAction("calificar", "c").href).toBe("/t/fin/c");
    for (const waiting of ["esperar_pago", "terminado", "cerrado"] as const) {
      expect(stepAction(waiting, "c").href).toBeNull();
    }
  });
});

describe("nivel, permisos y calificaciones", () => {
  it("los hechos del nivel usan las mismas palabras que la fórmula pública", () => {
    expect(
      levelFacts({ confirmedJobs: 1, practicalPassed: true, certificates: 2, attendanceRate: 0.95 }),
    ).toEqual([
      "1 trabajo confirmado",
      "Prueba práctica aprobada",
      "2 constancias de academia",
      "Asistencia de 95 %",
    ]);
    expect(
      levelFacts({ confirmedJobs: 0, practicalPassed: false, certificates: 1, attendanceRate: 1 }),
    ).toEqual([
      "0 trabajos confirmados",
      "Prueba práctica pendiente",
      "1 constancia de academia",
      "Asistencia de 100 %",
    ]);
  });

  it("hay un permiso por cada uso de datos, cada uno con su explicación", () => {
    expect(CONSENT_OPTIONS.map((option) => option.kind).sort()).toEqual([
      "gps",
      "notifications",
      "selfie",
      "share_profile",
      "voice",
    ]);
    expect(CONSENT_OPTIONS.every((option) => option.hint.length > 20)).toBe(true);
    expect(CONSENT_OPTIONS.find((option) => option.kind === "share_profile")?.hint).toContain(
      "Nunca tu foto, edad ni sexo",
    );
  });

  it("una calificación recibida se lee por categoría, con nota sobre 5", () => {
    const rating = {
      quality: 5,
      punctuality: 4,
      safety: 3,
      attitude: 5,
    } as MyData["ratingsReceived"][number];

    expect(receivedRatingLines(rating)).toEqual([
      { label: "Calidad del trabajo", score: "5 de 5" },
      { label: "Puntualidad", score: "4 de 5" },
      { label: "Seguridad", score: "3 de 5" },
      { label: "Actitud", score: "5 de 5" },
    ]);
  });
});
