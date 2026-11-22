// Rutas de solicitudes de personal: crear, tablero activo e invitar.
import { z } from "zod";

import { CONTRACT_TYPES, TRADES } from "@/lib/trades";

import { activeRequestBoard, createJobRequest, inviteCandidates } from "../../use-cases/requests";
import { endpoint, type RuntimeProvider } from "../endpoint";
import { idSchema, pathId } from "./schemas";

const LIMITS = Object.freeze({
  quantity: 50,
  days: 90,
  dailyPayUsd: 1000,
  zone: 80,
  startDate: 40,
  notes: 500,
});

const newRequestSchema = z.strictObject({
  trade: z.enum(TRADES),
  quantity: z.int().min(1).max(LIMITS.quantity),
  minLevel: z.literal([1, 2, 3, 4, 5]),
  zone: z.string().trim().min(2).max(LIMITS.zone),
  startDate: z.string().trim().min(1).max(LIMITS.startDate),
  days: z.int().min(1).max(LIMITS.days),
  dailyPayUsd: z.number().positive().max(LIMITS.dailyPayUsd),
  contractType: z.enum(CONTRACT_TYPES),
  notes: z.string().trim().max(LIMITS.notes).optional(),
  /** Cómo se pidió en pantalla: el formulario, o el guion de voz del plan B. */
  via: z.enum(["voz", "web"]).optional(),
});

const inviteSchema = z.union([
  z.strictObject({ quantity: z.int().min(1).max(10) }),
  z.strictObject({ workerIds: z.array(idSchema).min(1).max(10) }),
]);

export const requestRoutes = (runtime: RuntimeProvider) => ({
  create: endpoint(
    { access: "company", body: newRequestSchema },
    ({ actor, body: { via = "web", ...request }, context }) =>
      createJobRequest(context, actor, { ...request, createdVia: via }),
    runtime,
  ),

  active: endpoint(
    { access: "company" },
    async ({ actor, context }) => ({ board: await activeRequestBoard(context, actor) }),
    runtime,
  ),

  invite: endpoint(
    { access: "company", body: inviteSchema },
    async ({ actor, body, params, context }) => ({
      invitations: await inviteCandidates(context, actor, { requestId: pathId(params), ...body }),
    }),
    runtime,
  ),
});
