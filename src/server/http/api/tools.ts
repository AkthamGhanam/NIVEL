import { z } from "zod";

import { localDate, normalizeSpanish } from "@/lib/dates";
import { ageOn, HIRE_DURATIONS, matchAvailability, MIN_WORK_AGE } from "@/lib/profile-options";
import { estimateLegalCost } from "@/lib/legal-cost";
import type { Level } from "@/lib/level";
import {
  SAY_UNDERAGE,
  sayInvited,
  sayLegalCost,
  sayOfferAnswered,
  sayOffers,
  sayProfileCreated,
  sayRequestCreated,
} from "@/lib/say";
import { CONTRACT_TYPES, TRADES } from "@/lib/trades";
import { spokenWorkArea, WORK_SCOPES } from "@/lib/venezuela";

import { ForbiddenError } from "../../errors";
import { listMyOffers, respondToInvitation } from "../../use-cases/invitations";
import { registerWorkerByVoice } from "../../use-cases/registration";
import {
  findCompanyByName,
  INPSASEL_GUIDANCE,
  openReport,
  REPORT_KINDS,
  REPORT_RECEIVED_MESSAGE,
} from "../../use-cases/reports";
import { createJobRequest, inviteCandidates } from "../../use-cases/requests";
import type { RuntimeProvider } from "../endpoint";
import { conversationIdSchema, tool } from "../tool";
import { idSchema } from "./schemas";

/**
 * Las 7 herramientas de los agentes (docs/spec.md, secciones 7.3 y 7.4). Los
 * campos van en español porque así los nombra el agente. Los esquemas toleran
 * lo que un modelo de lenguaje suele mandar ("3" por 3, "sí" por true,
 * "albañil" por albanil) y descartan cualquier campo que no esté declarado.
 */

const TOP_CANDIDATES = 3;
const TRUE_WORDS = new Set(["true", "si", "1"]);
const FALSE_WORDS = new Set(["false", "no", "0"]);

const spokenBoolean = z.union([z.boolean(), z.string()]).transform((value, issue) => {
  if (typeof value === "boolean") return value;
  const word = normalizeSpanish(value);
  if (TRUE_WORDS.has(word)) return true;
  if (FALSE_WORDS.has(word)) return false;
  issue.addIssue({ code: "custom", message: "debe ser sí o no" });
  return z.NEVER;
});

const spokenNumber = z.union([z.number(), z.string().trim().min(1)]).pipe(z.coerce.number());
const spokenInteger = spokenNumber.pipe(z.int());
const trade = z.string().transform(normalizeSpanish).pipe(z.enum(TRADES));
const zone = z.string().trim().min(2).max(80);

const spokenList = z
  .union([z.array(z.string().trim().max(80)), z.string().trim().max(400)])
  .transform((value) =>
    (typeof value === "string" ? value.split(/,| y /u) : value).map((item) => item.trim()).filter(Boolean),
  );

const profileSchema = z
  .object({
    nombre: z.string().trim().min(2).max(80),
    fecha_nacimiento: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    mayor_de_edad: spokenBoolean.optional(),
    oficios: z.array(trade).max(TRADES.length).default([]),
    oficio: trade.optional(),
    anos_experiencia: spokenNumber.pipe(z.number().min(0).max(60)),
    tecnicas: z.array(z.string().max(80)).max(20).default([]),
    alcance: z.string().transform(normalizeSpanish).pipe(z.enum(WORK_SCOPES)).optional(),
    estados: spokenList.default([]),
    municipios: spokenList.default([]),
    zona: zone.optional(),
    disponibilidad: z.string().trim().min(1).max(120),
    trabaja_de_noche: spokenBoolean.default(false),
    conversation_id: conversationIdSchema,
  })
  .refine((body) => body.oficios.length > 0 || body.oficio !== undefined, {
    error: "Falta el oficio",
    path: ["oficios"],
  })
  .refine((body) => body.alcance !== undefined || body.zona !== undefined, {
    error: "Falta dónde quiere trabajar",
    path: ["alcance"],
  });

type SpokenProfile = z.infer<typeof profileSchema>;

/** Mayor de edad según la fecha que dijo o, si no la dijo, según su confirmación. */
function isAdultSaid(body: SpokenProfile, today: string): boolean {
  if (body.fecha_nacimiento) return (ageOn(body.fecha_nacimiento, today) ?? 0) >= MIN_WORK_AGE;
  return body.mayor_de_edad === true;
}

function workAreaSaid(body: SpokenProfile) {
  if (!body.alcance) return undefined;
  return spokenWorkArea({ scope: body.alcance, states: body.estados, municipalities: body.municipios });
}

const reportSchema = z.object({
  tipo: z.enum(REPORT_KINDS),
  descripcion: z.string().trim().min(1).max(2000),
  empresa: z.string().trim().max(80).optional(),
  conversation_id: conversationIdSchema.optional(),
});

const offersSchema = z.object({ conversation_id: conversationIdSchema.optional() });

const answerSchema = z.object({
  invitacion_id: idSchema,
  acepta: spokenBoolean,
  conversation_id: conversationIdSchema.optional(),
});

const DURATION_KEYS = HIRE_DURATIONS.map((duration) => duration.key) as [
  (typeof HIRE_DURATIONS)[number]["key"],
  ...(typeof HIRE_DURATIONS)[number]["key"][],
];
const spokenClock = z
  .string()
  .trim()
  .regex(/^([01]?\d|2[0-3]):[0-5]\d$/)
  .transform((value) => value.padStart(5, "0"));

const requestSchema = z
  .object({
    oficio: trade,
    cantidad: spokenInteger.pipe(z.number().min(1).max(50)),
    nivel_minimo: spokenInteger.pipe(z.literal([1, 2, 3, 4, 5])),
    zona: zone,
    fecha_inicio: z.string().trim().min(1).max(40),
    dias: spokenInteger.pipe(z.number().min(1).max(90)).optional(),
    duracion: z.enum(DURATION_KEYS).optional(),
    hora_entrada: spokenClock.optional(),
    hora_salida: spokenClock.optional(),
    pago_diario_usd: spokenNumber.pipe(z.number().positive().max(1000)),
    tipo_contrato: z.enum(CONTRACT_TYPES).default("obra_determinada"),
  })
  .refine((body) => body.dias !== undefined || body.duracion !== undefined, {
    error: "Falta cuánto tiempo va a durar",
    path: ["duracion"],
  });

const inviteSchema = z.object({
  solicitud_id: idSchema,
  cantidad: spokenInteger.pipe(z.number().min(1).max(10)),
});

const costSchema = z.object({
  pago_diario_usd: spokenNumber,
  dias: spokenInteger,
  cantidad: spokenInteger,
});

const NO_PROFILE = "Para eso primero necesito tu perfil. ¿Lo armamos? Dime cómo te llamas.";
const NO_CONSENT =
  "Para guardar tu perfil necesito tu permiso en pantalla. Toca Empezar, acepta el permiso y lo hacemos de nuevo.";

export const workerTools = (runtime: RuntimeProvider) => ({
  guardarPerfil: tool(
    { name: "guardar_perfil", body: profileSchema },
    async ({ body, context, toolContext }) => {
      if (!isAdultSaid(body, localDate(context.now()))) return { say: SAY_UNDERAGE, creado: false };
      if (toolContext?.kind !== "registration") throw new ForbiddenError(NO_CONSENT);
      const trades = [...new Set([...(body.oficio ? [body.oficio] : []), ...body.oficios])];
      const workArea = workAreaSaid(body);
      const created = await registerWorkerByVoice(context, {
        name: body.nombre,
        isAdult: true,
        trade: trades[0] ?? "otro",
        trades,
        yearsExp: body.anos_experiencia,
        skills: body.tecnicas,
        zone: body.zona ?? ([...body.municipios, ...body.estados].join(", ") || "Carabobo"),
        ...(workArea ? { workArea } : {}),
        availability: matchAvailability(body.disponibilidad),
        nightShift: body.trabaja_de_noche,
        conversationId: body.conversation_id,
        real: toolContext.real,
        consentAt: toolContext.consentAt,
      });
      return {
        creado: true,
        worker_id: created.workerId,
        nivel: created.level,
        ruta: {
          curso_gratis: created.route.freeCourse,
          curso_recomendado: created.route.recommendedCourse,
          prueba_practica: "Prueba práctica en un taller aliado",
        },
        banda_referencia: created.referenceBand,
        say: sayProfileCreated({ firstName: created.firstName, ...created.route }),
      };
    },
    runtime,
  ),

  crearReporte: tool(
    { name: "crear_reporte", body: reportSchema },
    async ({ body, context, worker }) => {
      const reporter = await worker(body.conversation_id);
      const companyId = body.empresa ? await findCompanyByName(context, body.empresa) : undefined;
      const report = await openReport(context, reporter?.workerId ?? null, {
        kind: body.tipo,
        transcript: body.descripcion,
        companyId,
      });
      const guidance = body.tipo === "inseguridad" ? ` ${INPSASEL_GUIDANCE}` : "";
      return { caso_id: report.reportId, say: `${REPORT_RECEIVED_MESSAGE}${guidance}` };
    },
    runtime,
  ),
});

export const offerTools = (runtime: RuntimeProvider) => ({
  consultarOfertas: tool(
    { name: "consultar_ofertas", body: offersSchema },
    async ({ body, context, worker }) => {
      const actor = await worker(body.conversation_id);
      if (!actor) return { ofertas: [], say: NO_PROFILE };
      const open = (await listMyOffers(context, actor)).filter((offer) => offer.status === "enviada");
      const spoken = open.map((offer) => ({ ...offer, companyName: offer.company.name }));
      return {
        ofertas: open.map((offer) => ({
          invitacion_id: offer.invitationId,
          empresa: offer.company.name,
          oficio: offer.trade,
          zona: offer.zone,
          fecha_inicio: offer.startDate,
          dias: offer.days,
          pago_diario_usd: offer.dailyPayUsd,
        })),
        say: sayOffers(spoken),
      };
    },
    runtime,
  ),

  responderOferta: tool(
    { name: "responder_oferta", body: answerSchema },
    async ({ body, context, worker }) => {
      const actor = await worker(body.conversation_id);
      if (!actor) return { estado: "sin_perfil", say: NO_PROFILE };
      const { offer } = await respondToInvitation(context, actor, {
        invitationId: body.invitacion_id,
        accept: body.acepta,
      });
      // El código de firma no se dice en voz alta: se muestra solo en la pantalla del trabajador.
      return { estado: offer.status, say: sayOfferAnswered(body.acepta, offer.company.name) };
    },
    runtime,
  ),
});

export const companyTools = (runtime: RuntimeProvider) => ({
  crearSolicitud: tool(
    { name: "crear_solicitud", body: requestSchema },
    async ({ body, context, company }) => {
      const created = await createJobRequest(context, company(), {
        trade: body.oficio,
        quantity: body.cantidad,
        minLevel: body.nivel_minimo,
        zone: body.zona,
        startDate: body.fecha_inicio,
        days: body.dias ?? 1,
        duration: body.duracion,
        hours:
          body.hora_entrada && body.hora_salida
            ? { from: body.hora_entrada, to: body.hora_salida }
            : undefined,
        dailyPayUsd: body.pago_diario_usd,
        contractType: body.tipo_contrato,
        createdVia: "voz",
      });
      const { request, legalCost, feeRange } = created;
      return {
        solicitud_id: request.id,
        cumplen: created.matching,
        top: created.candidates.slice(0, TOP_CANDIDATES).map((candidate) => ({
          nombre_corto: candidate.shortName,
          nivel: candidate.level,
          trabajos_confirmados: candidate.confirmedJobs,
          prueba_practica: candidate.practicalPassed,
          distancia_km: candidate.distanceKm,
        })),
        costo_legal: { por_trabajador: legalCost.perWorker.total, total: legalCost.totalForQuantity },
        tarifa: feeRange && { minima: feeRange.min, maxima: feeRange.max },
        say: sayRequestCreated({
          trade: request.trade,
          quantity: request.quantity,
          minLevel: request.minLevel as Level,
          zone: request.zone,
          days: request.days,
          matching: created.matching,
          legalCost,
          feeRange,
        }),
      };
    },
    runtime,
  ),
});

export const crewTools = (runtime: RuntimeProvider) => ({
  invitarCandidatos: tool(
    { name: "invitar_candidatos", body: inviteSchema },
    async ({ body, context, company }) => {
      const sent = await inviteCandidates(context, company(), {
        requestId: body.solicitud_id,
        quantity: body.cantidad,
      });
      return {
        invitados: sent.map(({ candidate }) => ({
          nombre_corto: candidate.shortName,
          nivel: candidate.level,
        })),
        say: sayInvited(sent.map(({ candidate }) => candidate.shortName)),
      };
    },
    runtime,
  ),

  /** Solo calcula: no necesita saber quién pregunta. */
  calcularCostoLegal: tool(
    { name: "calcular_costo_legal", body: costSchema },
    async ({ body }) => {
      const estimate = estimateLegalCost({
        dailyPayUsd: body.pago_diario_usd,
        days: body.dias,
        quantity: body.cantidad,
      });
      return {
        desglose: estimate.perWorker,
        total: estimate.totalForQuantity,
        say: sayLegalCost(estimate, body.dias),
      };
    },
    runtime,
  ),
});
