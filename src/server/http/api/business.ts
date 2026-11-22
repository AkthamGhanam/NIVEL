import { z } from "zod";

import { FEE_PAYMENT_METHODS } from "@/lib/pricing";

import { listMyFees, payFee } from "../../use-cases/billing";
import { getMetrics, realProfilesToday } from "../../use-cases/metrics";
import { endpoint, type RuntimeProvider } from "../endpoint";
import { pathId } from "./schemas";

const feePaymentSchema = z.strictObject({ method: z.enum(FEE_PAYMENT_METHODS) });

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
      payFee(context, actor, { feeId: pathId(params), method: body.method }),
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
