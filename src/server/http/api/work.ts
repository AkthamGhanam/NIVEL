import { z } from "zod";

import { checkIn, checkOut } from "../../use-cases/attendance";
import { getContract, issueContractOtp, signContract } from "../../use-cases/contracts";
import { listMyOffers, respondToInvitation } from "../../use-cases/invitations";
import { endpoint, type RuntimeProvider } from "../endpoint";
import { geoFixSchema } from "./requests";
import { emptyBody, idSchema, pathId } from "./schemas";

const respondSchema = z.strictObject({ accept: z.boolean() });
const signSchema = z.strictObject({ otp: z.string().regex(/^\d{6}$/, "el código tiene 6 dígitos") });

const markSchema = z.strictObject({
  contractId: idSchema,
  position: geoFixSchema.optional(),
  simulated: z.boolean().optional(),
});

export const invitationRoutes = (runtime: RuntimeProvider) => ({
  /** Invitaciones del trabajador con sesión: nunca las de otra persona. */
  mine: endpoint(
    { access: "worker" },
    async ({ actor, context }) => ({ offers: await listMyOffers(context, actor) }),
    runtime,
  ),

  respond: endpoint(
    { access: "worker", body: respondSchema },
    ({ actor, body, params, context }) =>
      respondToInvitation(context, actor, { invitationId: pathId(params), accept: body.accept }),
    runtime,
  ),
});

export const contractRoutes = (runtime: RuntimeProvider) => ({
  get: endpoint(
    { access: ["worker", "company", "admin"] },
    ({ actor, params, context }) => getContract(context, actor, pathId(params)),
    runtime,
  ),

  /** Pide un código de firma nuevo ("enviado por SMS", simulado). */
  otp: endpoint(
    { access: "worker", body: emptyBody },
    ({ actor, params, context }) => issueContractOtp(context, actor, pathId(params)),
    runtime,
  ),

  sign: endpoint(
    { access: "worker", body: signSchema },
    ({ actor, body, params, context }) =>
      signContract(context, actor, { contractId: pathId(params), otp: body.otp }),
    runtime,
  ),
});

export const attendanceRoutes = (runtime: RuntimeProvider) => ({
  checkIn: endpoint(
    { access: "worker", body: markSchema },
    ({ actor, body, context }) => checkIn(context, actor, body),
    runtime,
  ),

  checkOut: endpoint(
    { access: "worker", body: markSchema },
    ({ actor, body, context }) => checkOut(context, actor, body),
    runtime,
  ),
});
