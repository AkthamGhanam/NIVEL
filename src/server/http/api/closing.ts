import { z } from "zod";

import { FEE_PAYMENT_METHODS } from "@/lib/pricing";

import { getLevelStatus, recalculateLevel } from "../../use-cases/levels";
import { confirmPayment, getReceipt, registerPayment } from "../../use-cases/payments";
import { submitRating } from "../../use-cases/ratings";
import { endpoint, type RuntimeProvider } from "../endpoint";
import { emptyBody, idSchema, pathId } from "./schemas";

const MAX_TAGS = 5;
const score = z.int().min(1).max(5);

const paymentSchema = z.strictObject({
  contractId: idSchema,
  method: z.enum(FEE_PAYMENT_METHODS),
  reference: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{4,30}$/, "la referencia tiene de 4 a 30 letras o números"),
});

const ratingSchema = z.strictObject({
  contractId: idSchema,
  quality: score,
  punctuality: score,
  safety: score,
  attitude: score,
  tags: z.array(z.string().max(60)).max(MAX_TAGS).default([]),
  comment: z.string().trim().max(500).optional(),
});

export const paymentRoutes = (runtime: RuntimeProvider) => ({
  /** La empresa deja constancia de que pagó. El dinero no pasa por NIVEL. */
  register: endpoint(
    { access: "company", body: paymentSchema },
    ({ actor, body, context }) => registerPayment(context, actor, body),
    runtime,
  ),

  confirm: endpoint(
    { access: "worker", body: emptyBody },
    ({ actor, params, context }) => confirmPayment(context, actor, pathId(params)),
    runtime,
  ),

  receipt: endpoint(
    { access: ["worker", "company", "admin"] },
    ({ actor, params, context }) => getReceipt(context, actor, pathId(params)),
    runtime,
  ),
});

export const ratingRoutes = (runtime: RuntimeProvider) => ({
  submit: endpoint(
    { access: ["worker", "company"], body: ratingSchema },
    ({ actor, body, context }) => submitRating(context, actor, body),
    runtime,
  ),
});

export const levelRoutes = (runtime: RuntimeProvider) => ({
  /** Nivel del trabajador con sesión. El id nunca viene del cliente. */
  mine: endpoint(
    { access: "worker" },
    ({ actor, context }) => getLevelStatus(context, actor, actor.workerId),
    runtime,
  ),

  recalculate: endpoint(
    { access: "worker", body: emptyBody },
    ({ actor, context }) => recalculateLevel(context, actor, actor.workerId),
    runtime,
  ),
});
