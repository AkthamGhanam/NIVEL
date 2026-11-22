import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DomainValidationError } from "@/lib/errors";

import { contracts, fees, jobRequests, workers } from "../db/schema";
import { IDS, SITE } from "../db/seed/cast";
import { ConflictError, ForbiddenError } from "../errors";
import { ACTORS, createTestApp, DEMO_NOW, type TestApp } from "../testing/test-app";
import { checkIn, checkOut, fastForwardAttendance } from "./attendance";
import { getContract, issueContractOtp, NOT_EMPLOYER_NOTICE, signContract } from "./contracts";
import { listEventsSince } from "./events";
import { listMyOffers, respondToInvitation } from "./invitations";
import { getLevelStatus, recalculateLevel } from "./levels";
import { confirmPayment, getReceipt, registerPayment } from "./payments";
import { submitRating } from "./ratings";
import { createReport, listReportsInReview, resolveReport } from "./reports";
import { activeRequestBoard, createJobRequest, inviteCandidates, type NewJobRequest } from "./requests";

/**
 * Camino dorado completo (docs/spec.md, secciones 3 y 10), paso a paso y en
 * orden: cada prueba parte del estado que dejó la anterior, como en la demo.
 */

const SCRIPT_REQUEST: NewJobRequest = {
  trade: "soldador",
  quantity: 3,
  minLevel: 2,
  zone: "Los Guayos",
  startDate: "el martes",
  days: 5,
  dailyPayUsd: 25,
  contractType: "obra_determinada",
  createdVia: "voz",
};

const GOOD_RATING = { quality: 5, punctuality: 5, safety: 5, attitude: 5 };
const WRONG_OTP = "000000";

let app: TestApp;
let requestId: string;
let carlosContractId: string;
let carlosOtp: string;
let paymentId: string;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(() => app.close());

const offerFor = async (actor: (typeof ACTORS)["carlos" | "rafael" | "jose" | "luis"]) => {
  const [offer] = await listMyOffers(app.context, actor);
  if (!offer) throw new Error("El trabajador no tiene invitaciones");
  return offer;
};

describe("camino dorado", () => {
  it("1. el contratista pide 3 soldadores y 6 cumplen", async () => {
    const created = await createJobRequest(app.context, ACTORS.company, SCRIPT_REQUEST);
    requestId = created.request.id;

    expect(created.matching).toBe(6);
    expect(created.request.startDate).toBe("2026-11-24");
    expect(created.candidates.slice(0, 4).map((candidate) => candidate.shortName)).toEqual([
      "Rafael T.",
      "José P.",
      "Luis M.",
      "Carlos R.",
    ]);
    expect(created.legalCost.perWorker.total).toBe(196.67);
    expect(created.feeRange?.min.base).toBe(20);
    expect(created.feeRange?.max.base).toBe(30);
  });

  it("2. invita a los 3 mejores: Rafael, José y Luis", async () => {
    const sent = await inviteCandidates(app.context, ACTORS.company, { requestId, quantity: 3 });

    expect(sent.map((entry) => entry.candidate.shortName)).toEqual(["Rafael T.", "José P.", "Luis M."]);
  });

  it("3. Rafael y José aceptan; Luis rechaza; no se cobra tarifa por el rechazo", async () => {
    for (const actor of [ACTORS.rafael, ACTORS.jose]) {
      const offer = await offerFor(actor);
      const response = await respondToInvitation(app.context, actor, {
        invitationId: offer.invitationId,
        accept: true,
      });
      expect(response.otp).toMatch(/^\d{6}$/);
    }
    const luisOffer = await offerFor(ACTORS.luis);
    const rejection = await respondToInvitation(app.context, ACTORS.luis, {
      invitationId: luisOffer.invitationId,
      accept: false,
    });

    expect(rejection.otp).toBeNull();
    const requestFees = await app.handle.db
      .select()
      .from(fees)
      .innerJoin(contracts, eq(fees.contractId, contracts.id))
      .where(eq(contracts.requestId, requestId));
    expect(requestFees).toHaveLength(2);
    expect(requestFees.every((row) => row.fees.baseUsd === 30 && row.fees.status === "por_pagar")).toBe(true);
  });

  it("4. el tablero sugiere a Carlos R. como reemplazo, sin datos privados", async () => {
    const board = await activeRequestBoard(app.context, ACTORS.company);

    expect(board?.accepted).toBe(2);
    expect(board?.matching).toBe(6);
    expect(board?.suggestedReplacement).toEqual({
      workerId: IDS.carlos,
      shortName: "Carlos R.",
      level: 2,
      confirmedJobs: 2,
      practicalPassed: true,
      certificates: 1,
      distanceKm: 1.2,
    });
  });

  it("5. invita 1 más (Carlos) y Carlos acepta: cuadrilla 3 de 3", async () => {
    const [sent] = await inviteCandidates(app.context, ACTORS.company, { requestId, quantity: 1 });
    expect(sent?.candidate.workerId).toBe(IDS.carlos);

    const offer = await offerFor(ACTORS.carlos);
    expect(offer.notice).toBe(NOT_EMPLOYER_NOTICE);
    expect(offer.totalUsd).toBe(125);
    const response = await respondToInvitation(app.context, ACTORS.carlos, {
      invitationId: offer.invitationId,
      accept: true,
    });
    carlosContractId = response.offer.contractId as string;
    carlosOtp = response.otp as string;

    const [request] = await app.handle.db.select().from(jobRequests).where(eq(jobRequests.id, requestId));
    expect(request?.status).toBe("completa");
  });

  it("6. Carlos firma con su código; un código errado no firma", async () => {
    await expect(
      signContract(app.context, ACTORS.carlos, {
        contractId: carlosContractId,
        otp: WRONG_OTP === carlosOtp ? "111111" : WRONG_OTP,
      }),
    ).rejects.toThrow(ConflictError);

    const signed = await signContract(app.context, ACTORS.carlos, {
      contractId: carlosContractId,
      otp: carlosOtp,
    });

    expect(signed.status).toBe("activo");
    expect(signed.notice).toContain("NIVEL es la plataforma, no el patrono");
    expect(signed).not.toHaveProperty("otpHash");
  });

  it("7. Carlos marca entrada simulando que está en la obra", async () => {
    const entry = await checkIn(app.context, ACTORS.carlos, {
      contractId: carlosContractId,
      simulated: true,
    });

    expect(entry.date).toBe("2026-11-24");
    expect(entry.note).toContain("simulados");
  });

  it("8. Avanzar a fin de obra crea los días 2 a 5 y Carlos marca salida", async () => {
    const created = await fastForwardAttendance(app.context, ACTORS.admin, requestId);
    const exit = await checkOut(app.context, ACTORS.carlos, {
      contractId: carlosContractId,
      simulated: true,
    });

    expect(created).toBe(4);
    expect(exit.checkOutAt).not.toBeNull();
  });

  it("9. el contratista registra la liquidación y se genera el recibo del art. 106", async () => {
    const payment = await registerPayment(app.context, ACTORS.company, {
      contractId: carlosContractId,
      method: "pago_movil",
      reference: "0102-123456",
    });
    paymentId = payment.id;
    const receipt = await getReceipt(app.context, ACTORS.carlos, paymentId);

    // Liquidación: $125 de salario más utilidades, vacaciones con bono y prestaciones proporcionales.
    expect(payment.amountUsd).toBe(166.67);
    expect(payment.salaryUsd).toBe(125);
    expect(receipt.employer).toEqual({ name: "Constructora Los Guayos", rif: "J-50123456-7" });
    expect(receipt.workerName).toBe("Carlos Rodríguez");
    expect(receipt.amountBs).toBe(6083.46);
  });

  it("10. Carlos confirma que recibió el pago", async () => {
    const confirmed = await confirmPayment(app.context, ACTORS.carlos, paymentId);

    expect(confirmed.confirmedByWorkerAt).not.toBeNull();
    expect((await getContract(app.context, ACTORS.carlos, carlosContractId)).status).toBe("completado");
  });

  it("11. ambos califican: doble ciega hasta que califica el segundo", async () => {
    const first = await submitRating(app.context, ACTORS.company, {
      contractId: carlosContractId,
      ...GOOD_RATING,
      tags: ["Trabajo prolijo"],
    });
    const second = await submitRating(app.context, ACTORS.carlos, {
      contractId: carlosContractId,
      ...GOOD_RATING,
      tags: ["Pagó a tiempo"],
    });

    expect(first.revealed).toBe(false);
    expect(second.revealed).toBe(true);
  });

  it("12. al recalcular, Carlos sube a Nivel 3: Probado", async () => {
    const status = await recalculateLevel(app.context, ACTORS.carlos, IDS.carlos);

    expect(status).toMatchObject({ previousLevel: 2, level: 3, levelName: "Probado", leveledUp: true });
    const [carlos] = await app.handle.db.select().from(workers).where(eq(workers.id, IDS.carlos));
    expect(carlos?.level).toBe(3);
  });

  it("13. Carlos reporta inseguridad y una persona del equipo lo resuelve", async () => {
    const created = await createReport(app.context, ACTORS.carlos, {
      kind: "inseguridad",
      text: "No había extintor en el área de soldadura",
      companyId: IDS.activeCompany,
    });
    const queue = await listReportsInReview(app.context, ACTORS.admin);
    const resolved = await resolveReport(app.context, ACTORS.admin, {
      reportId: created.reportId,
      outcome: "resuelto",
      note: "Se habló con la empresa y colocó el extintor.",
    });

    expect(created.guidance).toContain("INPSASEL");
    expect(queue.map((report) => report.id)).toContain(created.reportId);
    expect(resolved.status).toBe("resuelto");
  });

  it("14. la bitácora cuenta la historia sin datos personales sensibles", async () => {
    const events = await listEventsSince(app.context, undefined);
    const types = events.map((event) => event.type);
    const serialized = JSON.stringify(events);

    expect(types).toEqual(
      expect.arrayContaining(["solicitud_creada", "invitaciones_enviadas", "contrato_firmado", "nivel_sube"]),
    );
    expect(serialized).not.toContain("extintor");
    expect(serialized).not.toContain(carlosOtp);
  });

  it("15. la bitácora dice cuánto tardó en armarse la cuadrilla, una sola vez", async () => {
    const events = await listEventsSince(app.context, undefined);
    const created = events.find((event) => event.type === "solicitud_creada");
    const complete = events.filter((event) => event.type === "cuadrilla_completa");

    expect(created?.label).toBe("Solicitud: 3 soldadores · 6 cumplen");
    expect(complete).toHaveLength(1);
    expect(complete[0]).toMatchObject({
      actor: "Constructora Los Guayos",
      label: "Cuadrilla completa · 3 de 3",
      detail: { requestId: created?.detail?.requestId, seconds: expect.any(Number) },
    });
    expect(Number(complete[0]?.detail?.seconds)).toBeGreaterThanOrEqual(0);
  });
});

describe("control de acceso (denegado por defecto)", () => {
  it("un trabajador no puede crear solicitudes ni ver el tablero de la empresa", async () => {
    await expect(createJobRequest(app.context, ACTORS.carlos, SCRIPT_REQUEST)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(activeRequestBoard(app.context, ACTORS.carlos)).rejects.toThrow(ForbiddenError);
  });

  it("otra empresa no puede invitar, pagar ni ver contratos de esta solicitud", async () => {
    await expect(
      inviteCandidates(app.context, ACTORS.otherCompany, { requestId, quantity: 1 }),
    ).rejects.toThrow(ForbiddenError);
    await expect(getContract(app.context, ACTORS.otherCompany, carlosContractId)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(getReceipt(app.context, ACTORS.otherCompany, paymentId)).rejects.toThrow(ForbiddenError);
  });

  it("un trabajador no puede responder, firmar, cobrar ni ver el nivel de otro", async () => {
    const rafaelOffer = await offerFor(ACTORS.rafael);

    await expect(
      respondToInvitation(app.context, ACTORS.luis, { invitationId: rafaelOffer.invitationId, accept: true }),
    ).rejects.toThrow(ForbiddenError);
    await expect(issueContractOtp(app.context, ACTORS.luis, carlosContractId)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(confirmPayment(app.context, ACTORS.luis, paymentId)).rejects.toThrow(ForbiddenError);
    await expect(getLevelStatus(app.context, ACTORS.luis, IDS.carlos)).rejects.toThrow(ForbiddenError);
    await expect(getReceipt(app.context, ACTORS.luis, paymentId)).rejects.toThrow(ForbiddenError);
  });

  it("solo el equipo de NIVEL ve y resuelve reportes, y solo el Modo Jurado avanza la obra", async () => {
    await expect(listReportsInReview(app.context, ACTORS.company)).rejects.toThrow(ForbiddenError);
    await expect(fastForwardAttendance(app.context, ACTORS.company, requestId)).rejects.toThrow(
      ForbiddenError,
    );
  });
});

describe("casos borde del camino dorado", () => {
  it("responder dos veces la misma invitación (doble clic) da conflicto, no duplica", async () => {
    const offer = await offerFor(ACTORS.luis);

    await expect(
      respondToInvitation(app.context, ACTORS.luis, { invitationId: offer.invitationId, accept: true }),
    ).rejects.toThrow(ConflictError);
  });

  it("registrar el pago dos veces devuelve el mismo pago", async () => {
    const rafaelContract = (await offerFor(ACTORS.rafael)).contractId as string;
    const { otp } = await issueContractOtp(app.context, ACTORS.rafael, rafaelContract);
    await signContract(app.context, ACTORS.rafael, { contractId: rafaelContract, otp });
    const input = { contractId: rafaelContract, method: "transferencia" as const, reference: "TRF-1" };

    const first = await registerPayment(app.context, ACTORS.company, input);
    const second = await registerPayment(app.context, ACTORS.company, input);

    expect(second.id).toBe(first.id);
  });

  it("bloquea el código de firma tras 5 intentos fallidos, aunque luego sea correcto", async () => {
    const joseContract = (await offerFor(ACTORS.jose)).contractId as string;
    const { otp } = await issueContractOtp(app.context, ACTORS.jose, joseContract);
    const wrong = otp === WRONG_OTP ? "111111" : WRONG_OTP;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        signContract(app.context, ACTORS.jose, { contractId: joseContract, otp: wrong }),
      ).rejects.toThrow(/no coincide/);
    }

    await expect(signContract(app.context, ACTORS.jose, { contractId: joseContract, otp })).rejects.toThrow(
      /venció/,
    );
  });

  it("sin simulación exige estar dentro de la geocerca y dentro de las fechas de la obra", async () => {
    const joseContract = (await offerFor(ACTORS.jose)).contractId as string;
    const { otp } = await issueContractOtp(app.context, ACTORS.jose, joseContract);
    await signContract(app.context, ACTORS.jose, { contractId: joseContract, otp });
    const farAway = { lat: SITE.point.lat + 0.01, lng: SITE.point.lng };

    await expect(
      checkIn(app.context, ACTORS.jose, { contractId: joseContract, position: farAway }),
    ).rejects.toThrow(/Estás a unos 1,1 km de la obra/);
    await expect(checkIn(app.context, ACTORS.jose, { contractId: joseContract })).rejects.toThrow(
      DomainValidationError,
    );
    await expect(
      checkIn(app.context, ACTORS.jose, { contractId: joseContract, position: SITE.point }),
    ).rejects.toThrow(/La obra empieza el mar 24 nov\./);

    app.setNow(new Date("2026-11-24T11:02:00Z"));
    const entry = await checkIn(app.context, ACTORS.jose, { contractId: joseContract, position: SITE.point });
    const again = await checkIn(app.context, ACTORS.jose, { contractId: joseContract, position: SITE.point });
    app.setNow(DEMO_NOW);

    expect(entry.insideGeofence).toBe(true);
    expect(again.id).toBe(entry.id);
  });

  it("rechaza una vacante con criterios discriminatorios y explica por qué", async () => {
    await expect(
      createJobRequest(app.context, ACTORS.company, {
        ...SCRIPT_REQUEST,
        notes: "solo hombres menores de 30",
      }),
    ).rejects.toThrow(/sexo o género/);
  });

  it("no deja calificar dos veces ni con etiquetas inventadas", async () => {
    await expect(
      submitRating(app.context, ACTORS.carlos, { contractId: carlosContractId, ...GOOD_RATING, tags: [] }),
    ).rejects.toThrow(/Ya calificaste/);
    await expect(
      submitRating(app.context, ACTORS.company, {
        contractId: carlosContractId,
        ...GOOD_RATING,
        tags: ["Es joven"],
      }),
    ).rejects.toThrow(/etiquetas disponibles/);
  });

  it("un reporte ya revisado no se puede volver a resolver", async () => {
    const created = await createReport(app.context, ACTORS.carlos, {
      kind: "otro",
      text: "Quiero hablar con alguien",
    });
    const resolution = { reportId: created.reportId, outcome: "descartado" as const, note: "Se le llamó." };
    await resolveReport(app.context, ACTORS.admin, resolution);

    await expect(resolveReport(app.context, ACTORS.admin, resolution)).rejects.toThrow(/ya fue revisado/);
  });
});
