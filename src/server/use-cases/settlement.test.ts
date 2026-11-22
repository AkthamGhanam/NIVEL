// Liquidación, aportes al Estado, sello "Paga en regla" y pago simulado de la factura de NIVEL.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ConflictError, ForbiddenError } from "../errors";
import { ACTORS, createTestApp, type TestApp } from "../testing/test-app";
import { checkIn, checkOut } from "./attendance";
import { getInvoice, listMyFees, payFee } from "./billing";
import { issueContractOtp, signContract } from "./contracts";
import { declareContribution, listContributions, paysInRegla } from "./contributions";
import { listMyOffers, respondToInvitation } from "./invitations";
import { confirmPayment, getReceipt, registerPayment } from "./payments";
import { createJobRequest, inviteCandidates } from "./requests";

let app: TestApp;
let contractId: string;
let paymentId: string;
const company = ACTORS.company;

beforeAll(async () => {
  app = await createTestApp();
  const { request } = await createJobRequest(app.context, company, {
    trade: "soldador",
    quantity: 1,
    minLevel: 2,
    zone: "Los Guayos",
    startDate: "hoy",
    days: 20,
    dailyPayUsd: 50,
    contractType: "obra_determinada",
    createdVia: "web",
  });
  await inviteCandidates(app.context, company, {
    requestId: request.id,
    workerIds: [ACTORS.rafael.workerId],
  });
  const [offer] = await listMyOffers(app.context, ACTORS.rafael);
  const accepted = await respondToInvitation(app.context, ACTORS.rafael, {
    invitationId: offer?.invitationId ?? "",
    accept: true,
  });
  contractId = accepted.offer.contractId ?? "";
  const { otp } = await issueContractOtp(app.context, ACTORS.rafael, contractId);
  await signContract(app.context, ACTORS.rafael, { contractId, otp });
  await checkIn(app.context, ACTORS.rafael, { contractId, simulated: true }).catch(() => undefined);
  await checkOut(app.context, ACTORS.rafael, { contractId, simulated: true }).catch(() => undefined);
});
afterAll(() => app.close());

describe("liquidación al terminar la obra", () => {
  it("el pago registrado es la liquidación completa, con cada concepto en el recibo", async () => {
    const payment = await registerPayment(app.context, company, {
      contractId,
      method: "pago_movil",
      reference: "REF12345",
    });
    paymentId = payment.id;
    const receipt = await getReceipt(app.context, ACTORS.rafael, paymentId);

    expect(payment.amountUsd).toBe(1333.33);
    expect(receipt.items).toEqual([
      { label: "Salario", amountUsd: 1000 },
      { label: "Utilidades proporcionales", amountUsd: 83.33 },
      { label: "Vacaciones y bono vacacional", amountUsd: 83.33 },
      { label: "Prestaciones sociales", amountUsd: 166.67 },
    ]);
    expect(receipt.concept).toMatch(/^Liquidación por 20 días/);
  });

  it("los aportes del mes se calculan solos sobre el salario, no sobre la liquidación", async () => {
    const [period] = await listContributions(app.context, company);

    expect(period?.salariesUsd).toBe(1000);
    expect(period?.lines.map((line) => [line.institution, line.amountUsd])).toEqual([
      ["ivss", 110],
      ["faov", 20],
      ["inces", 20],
      ["pensiones", 90],
    ]);
    expect(period?.totalUsd).toBe(240);
    expect(period?.complete).toBe(false);
    await expect(listContributions(app.context, ACTORS.rafael)).rejects.toThrow(ForbiddenError);
  });
});

describe("sello «Paga en regla»", () => {
  it("no aparece mientras falte la confirmación del trabajador o algún aporte", async () => {
    expect(await paysInRegla(app.context, [company.companyId])).toEqual(new Set());
    await confirmPayment(app.context, ACTORS.rafael, paymentId);
    expect(await paysInRegla(app.context, [company.companyId])).toEqual(new Set());
  });

  it("aparece cuando la empresa registra el comprobante de cada institución", async () => {
    const [period] = await listContributions(app.context, company);
    const month = period?.period ?? "";
    await expect(
      declareContribution(app.context, company, { period: month, institution: "ivss", reference: "x" }),
    ).rejects.toThrow(/comprobante/);
    await expect(
      declareContribution(app.context, company, {
        period: "1999-01",
        institution: "ivss",
        reference: "IV-123",
      }),
    ).rejects.toThrow(ConflictError);
    for (const institution of ["ivss", "faov", "inces"] as const) {
      await declareContribution(app.context, company, {
        period: month,
        institution,
        reference: `C-${institution}`,
      });
    }
    expect(await paysInRegla(app.context, [company.companyId])).toEqual(new Set());
    const after = await declareContribution(app.context, company, {
      period: month,
      institution: "pensiones",
      reference: "SENIAT-998",
    });

    expect(after[0]?.complete).toBe(true);
    expect(await paysInRegla(app.context, [company.companyId])).toEqual(new Set([company.companyId]));
    // Un segundo comprobante para la misma institución no reemplaza al primero.
    const again = await declareContribution(app.context, company, {
      period: month,
      institution: "pensiones",
      reference: "OTRO-1",
    });
    expect(again[0]?.lines.find((line) => line.institution === "pensiones")?.reference).toBe("SENIAT-998");
  });

  it("una empresa sin liquidaciones no lleva sello", async () => {
    expect(await paysInRegla(app.context, ["co-moron", "co-no-existe"])).toEqual(new Set());
    expect(await paysInRegla(app.context, [])).toEqual(new Set());
  });
});

describe("pago simulado de la factura de NIVEL", () => {
  it("la tarifa se paga con referencia y queda su factura digital, solo para su dueño", async () => {
    const { fees } = await listMyFees(app.context, company);
    const fee = fees[0];
    if (!fee) throw new Error("falta la tarifa");
    const paid = await payFee(app.context, company, {
      feeId: fee.id,
      method: "pago_movil",
      reference: "PM-7788",
    });
    const invoice = await getInvoice(app.context, company, fee.id);

    expect(paid).toMatchObject({ status: "pagado", reference: "PM-7788" });
    expect(paid.paidAt).not.toBeNull();
    expect(invoice).toMatchObject({
      customer: { name: "Constructora Los Guayos", rif: "J-50123456-7" },
      base: 30,
      iva: 4.8,
      total: 34.8,
      totalBs: 1270.2,
      rateBsPerUsd: 36.5,
      method: "pago_movil",
      reference: "PM-7788",
    });
    expect(invoice.issuer.rif).toBe("J-00000000-0");
    expect(invoice.controlNumber).toMatch(/^00-\d{8}$/);
    await expect(getInvoice(app.context, ACTORS.otherCompany, fee.id)).rejects.toThrow(ForbiddenError);
    await expect(getInvoice(app.context, ACTORS.rafael, fee.id)).rejects.toThrow(ForbiddenError);
  });
});
