import { z } from "zod";

import {
  CONSENT_KINDS,
  correctMyProfile,
  deleteMyAccount,
  exportMyData,
  getMyProfile,
  setMyConsent,
} from "../../use-cases/profile";
import { ApiResponse, endpoint, type RuntimeProvider } from "../endpoint";
import { emptyBody } from "./schemas";

const MAX_SKILLS = 12;
const MAX_YEARS = 60;
const shortText = z.string().trim().min(2).max(80);

const correctionSchema = z.strictObject({
  name: shortText.optional(),
  zone: shortText.optional(),
  availability: shortText.optional(),
  skills: z.array(z.string().trim().min(1).max(40)).max(MAX_SKILLS).optional(),
  yearsExp: z.int().min(0).max(MAX_YEARS).optional(),
  openToWork: z.boolean().optional(),
});

const consentSchema = z.strictObject({ kind: z.enum(CONSENT_KINDS), granted: z.boolean() });

/**
 * "Mis datos" (regla legal 8.12). Todas las rutas actúan sobre la persona de
 * la sesión: ninguna acepta el id de otra.
 */
export const meRoutes = (runtime: RuntimeProvider) => ({
  profile: endpoint({ access: "worker" }, ({ actor, context }) => getMyProfile(context, actor), runtime),

  correct: endpoint(
    { access: "worker", body: correctionSchema },
    ({ actor, body, context }) => correctMyProfile(context, actor, body),
    runtime,
  ),

  /** Concede o retira un permiso, cada uno por separado (regla 8.5). */
  consent: endpoint(
    { access: "worker", body: consentSchema },
    async ({ actor, body, context }) => ({ consents: await setMyConsent(context, actor, body) }),
    runtime,
  ),

  /** Descarga de todo lo que NIVEL guarda de la persona. */
  download: endpoint(
    { access: "worker" },
    async ({ actor, context }) =>
      new ApiResponse(await exportMyData(context, actor), {
        headers: { "Content-Disposition": 'attachment; filename="mis-datos-nivel.json"' },
      }),
    runtime,
  ),

  /** Borra la cuenta y cierra la sesión en este navegador. */
  remove: endpoint(
    { access: "worker", body: emptyBody },
    async ({ actor, context, endSession }) =>
      new ApiResponse(await deleteMyAccount(context, actor), {
        headers: { "Set-Cookie": endSession("worker") },
      }),
    runtime,
  ),
});
