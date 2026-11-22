import { z } from "zod";

import { INSTITUTIONS } from "@/lib/legal-cost";

import { FEE_PAYMENT_METHODS } from "@/lib/pricing";

import { getInvoice, listMyFees, payFee } from "../../use-cases/billing";
import { declareContribution, listContributions } from "../../use-cases/contributions";
import { getMetrics, realProfilesToday } from "../../use-cases/metrics";
import { endpoint, type RuntimeProvider } from "../endpoint";
import { pathId } from "./schemas";

const feePaymentSchema = z.strictObject({
  method: z.enum(FEE_PAYMENT_METHODS),
  reference: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{4,30}$/, "de 4 a 30 letras o números")
    .optional(),
});

const declareSchema = z.strictObject({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  institution: z.enum(INSTITUTIONS),
  reference: z.string().trim().min(4).max(30),
});

/** Tarifas de NIVEL: cada empresa o academia ve y paga solo las suyas. */
export const feeRoutes = (runtime: RuntimeProvider) => ({
  mine: endpoint(
    { access: ["company", "academy"] },
    ({ actor, context }) => listMyFees(context, actor),
    runtime,
  ),

  pay: endpoint(
    { access: ["company", "academy"], body: feePaymentSchema },
    ({ actor, body, params, context }) =>
      payFee(context, actor, { feeId: pathId(params), method: body.method, reference: body.reference }),
    runtime,
  ),

  /** Factura digital (simulada) de una tarifa: solo su dueño y el equipo la ven. */
  invoice: endpoint(
    { access: ["company", "academy", "admin"] },
    ({ actor, params, context }) => getInvoice(context, actor, pathId(params)),
    runtime,
  ),
});

/** Aportes al Estado de la empresa: cuánto le toca a cada institución y sus comprobantes. */
export const contributionRoutes = (runtime: RuntimeProvider) => ({
  mine: endpoint(
    { access: "company" },
    async ({ actor, context }) => ({ periods: await listContributions(context, actor) }),
    runtime,
  ),

  declare: endpoint(
    { access: "company", body: declareSchema },
    async ({ actor, body, context }) => ({ periods: await declareContribution(context, actor, body) }),
    runtime,
  ),
});

/** Números del panel interno y del Modo Jurado: solo el equipo de NIVEL. */
export const metricRoutes = (runtime: RuntimeProvider) => ({
  summary: endpoint({ access: "admin" }, ({ actor, context }) => getMetrics(context, actor), runtime),

  realProfiles: endpoint(
    { access: "admin" },
    ({ actor, context }) => realProfilesToday(context, actor),
    runtime,
  ),
});
