// La obra fijada con la ubicación del contratista y lo que Nivi sabe de quien le habla.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SITE } from "../db/seed/cast";
import { ConflictError, ForbiddenError } from "../errors";
import { ACTORS, createTestApp, type TestApp } from "../testing/test-app";
import { checkIn } from "./attendance";
import { issueContractOtp, signContract } from "./contracts";
import { listMyOffers, respondToInvitation } from "./invitations";
import { createJobRequest, inviteCandidates, type NewJobRequest, pinRequestSite } from "./requests";
import { identityVariables, voiceIdentity } from "./voice-identity";

const REQUEST: NewJobRequest = {
  trade: "soldador",
  quantity: 3,
  minLevel: 2,
  zone: "Los Guayos",
  startDate: "hoy",
  days: 5,
  dailyPayUsd: 25,
  contractType: "obra_determinada",
  createdVia: "web",
};

/** Un punto a 3 km de la sede: una obra que no queda donde está la empresa. */
const REAL_SITE = { lat: SITE.point.lat + 0.027, lng: SITE.point.lng };
const near = (meters: number) => ({ lat: REAL_SITE.lat + meters / 111_195, lng: REAL_SITE.lng });

let app: TestApp;
let requestId: string;
let contractId: string;

beforeAll(async () => {
  app = await createTestApp();
});
afterAll(() => app.close());

describe("ubicación exacta de la obra", () => {
  it("sin ubicación del contratista, la obra queda en la sede y no figura como fijada", async () => {
    const created = await createJobRequest(app.context, ACTORS.company, REQUEST);
    requestId = created.request.id;

    expect(created.request.sitePinnedAt).toBeNull();
    expect(created.request).toMatchObject({ lat: SITE.point.lat, lng: SITE.point.lng });
  });

  it("no acepta fijar la obra con una señal débil ni desde otra empresa", async () => {
    const weak = { ...REAL_SITE, accuracyM: 400 };

    await expect(pinRequestSite(app.context, ACTORS.company, { requestId, site: weak })).rejects.toThrow(
      /señal de ubicación está débil/,
    );
    await expect(
      pinRequestSite(app.context, ACTORS.otherCompany, { requestId, site: REAL_SITE }),
    ).rejects.toThrow(ForbiddenError);
    await expect(pinRequestSite(app.context, ACTORS.carlos, { requestId, site: REAL_SITE })).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("el contratista fija la obra donde está parado y las llegadas se verifican contra ese punto", async () => {
    const pinned = await pinRequestSite(app.context, ACTORS.company, {
      requestId,
      site: { ...REAL_SITE, accuracyM: 12 },
    });
    await inviteCandidates(app.context, ACTORS.company, { requestId, workerIds: [ACTORS.rafael.workerId] });
    const [offer] = await listMyOffers(app.context, ACTORS.rafael);
    const accepted = await respondToInvitation(app.context, ACTORS.rafael, {
      invitationId: offer?.invitationId ?? "",
      accept: true,
    });
    contractId = accepted.offer.contractId ?? "";
    const { otp } = await issueContractOtp(app.context, ACTORS.rafael, contractId);
    await signContract(app.context, ACTORS.rafael, { contractId, otp });

    expect(pinned.sitePinnedAt).not.toBeNull();
    // En la sede de la empresa ya no vale: la obra es otro punto.
    await expect(checkIn(app.context, ACTORS.rafael, { contractId, position: SITE.point })).rejects.toThrow(
      /Estás a unos 3,0 km de la obra/,
    );
    await expect(
      checkIn(app.context, ACTORS.rafael, { contractId, position: { ...near(300), accuracyM: 500 } }),
    ).rejects.toThrow(/señal de ubicación está débil/);
    const row = await checkIn(app.context, ACTORS.rafael, {
      contractId,
      position: { ...near(150), accuracyM: 45 },
    });
    expect(row.insideGeofence).toBe(true);
  });

  it("una solicitud nueva puede nacer ya con la obra fijada", async () => {
    const other = await createJobRequest(app.context, ACTORS.otherCompany, {
      ...REQUEST,
      site: { ...REAL_SITE, accuracyM: 20 },
    });

    expect(other.request).toMatchObject({ lat: REAL_SITE.lat, lng: REAL_SITE.lng });
    expect(other.request.sitePinnedAt).not.toBeNull();
    await expect(
      createJobRequest(app.context, ACTORS.otherCompany, {
        ...REQUEST,
        site: { ...REAL_SITE, accuracyM: 900 },
      }),
    ).rejects.toThrow(/señal de ubicación está débil/);
    await expect(
      pinRequestSite(app.context, ACTORS.otherCompany, { requestId: "jr-no-existe", site: REAL_SITE }),
    ).rejects.not.toThrow(ConflictError);
  });
});

describe("con quién habla Nivi", () => {
  it("a una persona con perfil la saluda por su nombre y sabe su oficio, nivel y ofertas", async () => {
    const identity = await voiceIdentity(app.context, "worker", { kind: "actor", actor: ACTORS.carlos });

    expect(identity.greeting).toMatch(/^¡Hola, Carlos!/);
    expect(identity.person).toMatch(/ya tiene perfil en NIVEL: soldador, Nivel 2 \(Verificado\)/);
    expect(identity.person).toContain("No tiene ofertas pendientes.");
    // Solo nombre de pila e inicial: nunca teléfono ni apellido completo.
    expect(identity.person).toMatch(/^Carlos R\./);
  });

  it("le cuenta a quien tiene ofertas que lo esperan", async () => {
    await inviteCandidates(app.context, ACTORS.company, { requestId, workerIds: [ACTORS.jose.workerId] });
    const identity = await voiceIdentity(app.context, "worker", { kind: "actor", actor: ACTORS.jose });

    expect(identity.greeting).toContain("Tienes una oferta de trabajo esperando");
    expect(identity.person).toContain("Tiene 1 oferta pendiente por responder.");
  });

  it("a la empresa la atiende por su nombre y sabe si ya tiene una solicitud abierta", async () => {
    const identity = await voiceIdentity(app.context, "contractor", { kind: "actor", actor: ACTORS.company });

    expect(identity.greeting).toContain("Te atiendo por Constructora Los Guayos");
    expect(identity.person).toContain("Ya tiene una solicitud abierta.");
  });

  it("sin sesión, o si la cuenta ya no existe, la trata como una persona nueva", async () => {
    const registration = {
      kind: "registration",
      real: false,
      consentAt: "2026-11-22T06:30:00.000Z",
    } as const;
    const fresh = await voiceIdentity(app.context, "worker", registration);
    const ghost = await voiceIdentity(app.context, "worker", {
      kind: "actor",
      actor: { role: "worker", workerId: "w-no-existe" },
    });

    expect(fresh.greeting).toContain("¿Cómo te llamas?");
    expect(fresh.person).toBe("Una persona nueva: todavía no tiene perfil en NIVEL.");
    expect(ghost).toEqual(fresh);
    expect(identityVariables(fresh)).toEqual({ nivi_saludo: fresh.greeting, nivi_persona: fresh.person });
  });
});
