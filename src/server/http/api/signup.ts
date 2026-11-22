// Rutas de registro desde la web: trabajador y empresa.
import { z } from "zod";

import { TRADES } from "@/lib/trades";

import { COMPANY_KINDS, registerCompany, registerWorkerByForm } from "../../use-cases/registration";
import { ApiResponse, endpoint, type RuntimeProvider } from "../endpoint";
import type { RateRule } from "../rate-limit";

const SIGNUP_LIMIT: RateRule & { bucket: string } = Object.freeze({
  bucket: "registro",
  limit: 20,
  windowSeconds: 600,
});

const accepted = z.literal(true, { error: "Necesitamos tu permiso para guardar tus datos." });

const workerSignupSchema = z.strictObject({
  name: z.string().trim().min(2).max(80),
  isAdult: z.literal(true, { error: "Por ahora NIVEL es solo para personas mayores de 18 años." }),
  trade: z.enum(TRADES),
  yearsExp: z.number().int().min(0).max(60),
  skills: z.array(z.string().trim().max(40)).max(10),
  zone: z.string().trim().min(1).max(80),
  availability: z.string().trim().min(1).max(80),
  consent: accepted,
});

const companySignupSchema = z.strictObject({
  name: z.string().trim().min(2).max(80),
  rif: z.string().trim().min(10).max(14),
  zone: z.string().trim().min(1).max(80),
  kind: z.enum(COMPANY_KINDS),
  consent: accepted,
});

export const signupRoutes = (runtime: RuntimeProvider) => ({
  worker: endpoint(
    { access: "public", body: workerSignupSchema, limit: SIGNUP_LIMIT },
    async ({ body, context, issueSession }) => {
      const { consent: _consent, ...profile } = body;
      const { actor, profile: created } = await registerWorkerByForm(context, {
        ...profile,
        consentAt: context.now().toISOString(),
      });
      return new ApiResponse(
        { profile: created },
        { status: 201, headers: { "Set-Cookie": issueSession(actor) } },
      );
    },
    runtime,
  ),

  company: endpoint(
    { access: "public", body: companySignupSchema, limit: SIGNUP_LIMIT },
    async ({ body, context, issueSession }) => {
      const { consent: _consent, ...signup } = body;
      const { actor, company } = await registerCompany(context, signup);
      return new ApiResponse({ company }, { status: 201, headers: { "Set-Cookie": issueSession(actor) } });
    },
    runtime,
  ),
});
