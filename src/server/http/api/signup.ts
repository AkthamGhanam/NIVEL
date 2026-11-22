// Rutas de registro desde la web: trabajador y empresa.
import { z } from "zod";

import { AVAILABILITY_OPTIONS, birthDateProblem, COMPANY_SECTORS } from "@/lib/profile-options";
import { localDate } from "@/lib/dates";
import { DomainValidationError, ensure } from "@/lib/errors";
import { TRADES } from "@/lib/trades";

import { COMPANY_KINDS, registerCompany, registerWorkerByForm } from "../../use-cases/registration";
import { ApiResponse, endpoint, type RuntimeProvider } from "../endpoint";
import type { RateRule } from "../rate-limit";
import { workAreaSchema } from "./schemas";

const SIGNUP_LIMIT: RateRule & { bucket: string } = Object.freeze({
  bucket: "registro",
  limit: 20,
  windowSeconds: 600,
});

const accepted = z.literal(true, { error: "Necesitamos tu permiso para guardar tus datos." });

/**
 * La fecha de nacimiento solo sirve para comprobar la mayoría de edad: no se
 * guarda. La cédula y la contraseña no viajan al servidor en la demo.
 */
const workerSignupSchema = z.strictObject({
  name: z.string().trim().min(2).max(80),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige tu fecha de nacimiento."),
  trades: z.array(z.enum(TRADES)).max(TRADES.length).nonempty("Elige al menos un oficio."),
  yearsExp: z.number().int().min(0).max(60),
  skills: z.array(z.string().trim().max(40)).max(16),
  workArea: workAreaSchema,
  availability: z.enum(AVAILABILITY_OPTIONS),
  nightShift: z.boolean().default(false),
  consent: accepted,
});

const companySignupSchema = z.strictObject({
  name: z.string().trim().min(2).max(80),
  rif: z.string().trim().min(10).max(14),
  zone: z.string().trim().min(1).max(80),
  kind: z.enum(COMPANY_KINDS).default("contratista"),
  sector: z.enum(COMPANY_SECTORS).optional(),
  workArea: workAreaSchema.optional(),
  consent: accepted,
});

export const signupRoutes = (runtime: RuntimeProvider) => ({
  worker: endpoint(
    { access: "public", body: workerSignupSchema, limit: SIGNUP_LIMIT },
    async ({ body, context, issueSession }) => {
      const { consent: _consent, birthDate, trades, workArea, ...profile } = body;
      const ageProblem = birthDateProblem(birthDate, localDate(context.now()));
      ensure(ageProblem === undefined, ageProblem ?? "");
      const [trade] = trades;
      if (trade === undefined) throw new DomainValidationError("Elige al menos un oficio.");
      const { actor, profile: created } = await registerWorkerByForm(context, {
        ...profile,
        isAdult: true,
        trade,
        trades,
        workArea,
        zone: workArea.scope,
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
