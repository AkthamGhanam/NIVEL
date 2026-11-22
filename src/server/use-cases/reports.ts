import { and, asc, eq } from "drizzle-orm";

import { normalizeSpanish } from "@/lib/dates";
import { ensure } from "@/lib/errors";

import { type Actor, requireRole } from "../actor";
import type { AppContext } from "../context";
import { companies, reports } from "../db/schema";
import { ConflictError, NotFoundError } from "../errors";
import { logEvent } from "./events";

export const REPORT_KINDS = Object.freeze([
  "no_pago",
  "inseguridad",
  "oferta_falsa",
  "acoso",
  "otro",
] as const);
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_RECEIVED_MESSAGE =
  "Recibimos tu reporte. Es confidencial. Una persona del equipo lo revisa en menos de 24 horas.";

/** Cómo acudir al organismo competente en reportes de inseguridad (regla legal 8.4). */
export const INPSASEL_GUIDANCE =
  "Si hay un riesgo grave, también puedes acudir al INPSASEL, el instituto que vigila la seguridad en el trabajo.";

export type ReportRow = typeof reports.$inferSelect;

export interface NewReport {
  readonly kind: ReportKind;
  readonly text?: string | undefined;
  readonly transcript?: string | undefined;
  readonly audioUrl?: string | undefined;
  readonly companyId?: string | undefined;
}

const MAX_REPORT_TEXT_LENGTH = 2000;
const MAX_REVIEWER_NOTE_LENGTH = 1000;
const MIN_COMPANY_NAME_LENGTH = 4;

export interface ReportCreated {
  readonly reportId: string;
  readonly message: string;
  readonly guidance: string | null;
}

/**
 * Abre un reporte confidencial. Va siempre a revisión humana: no pausa a
 * nadie ni cambia ningún nivel de forma automática.
 */
export async function createReport(
  context: AppContext,
  actor: Actor,
  input: NewReport,
): Promise<ReportCreated> {
  const { workerId } = requireRole(actor, "worker");
  return openReport(context, workerId, input);
}

/**
 * Guarda el reporte. `reporterWorkerId` es nulo cuando alguien reporta por voz
 * antes de tener perfil: un reporte de abuso no exige registrarse primero.
 * Quien llama ya autenticó el origen (sesión del trabajador o secreto de herramientas).
 */
export async function openReport(
  context: AppContext,
  reporterWorkerId: string | null,
  input: NewReport,
): Promise<ReportCreated> {
  const body = input.text ?? input.transcript ?? "";
  ensure(body.length <= MAX_REPORT_TEXT_LENGTH, "El reporte es demasiado largo. Resúmelo en unas líneas.");
  const id = context.newId("re");
  await context.db.insert(reports).values({
    id,
    reporterWorkerId,
    companyId: input.companyId ?? null,
    kind: input.kind,
    text: input.text?.trim() || null,
    transcript: input.transcript?.trim() || null,
    audioUrl: input.audioUrl ?? null,
    status: "en_revision",
    createdAt: context.now().toISOString(),
  });
  // La bitácora no guarda el contenido ni quién reportó: solo que hay un caso nuevo.
  await logEvent(context, {
    actor: "NIVEL",
    type: "reporte_recibido",
    label: "Reporte confidencial recibido · en revisión humana",
    detail: { kind: input.kind },
  });
  return {
    reportId: id,
    message: REPORT_RECEIVED_MESSAGE,
    guidance: input.kind === "inseguridad" ? INPSASEL_GUIDANCE : null,
  };
}

/** Empresa a la que se refiere quien reporta de palabra ("la constructora de Los Guayos"), si la reconocemos. */
export async function findCompanyByName(context: AppContext, spoken: string): Promise<string | undefined> {
  const wanted = normalizeSpanish(spoken);
  if (wanted.length < MIN_COMPANY_NAME_LENGTH) return undefined;
  const all = await context.db.select({ id: companies.id, name: companies.name }).from(companies);
  return all.find((company) => {
    const name = normalizeSpanish(company.name);
    return name.includes(wanted) || wanted.includes(name);
  })?.id;
}

/** Cola de revisión humana, de la más antigua a la más nueva. Solo el equipo de NIVEL. */
export async function listReportsInReview(context: AppContext, actor: Actor): Promise<ReportRow[]> {
  requireRole(actor, "admin");
  return context.db
    .select()
    .from(reports)
    .where(eq(reports.status, "en_revision"))
    .orderBy(asc(reports.createdAt));
}

export interface ReportResolution {
  readonly reportId: string;
  readonly outcome: "resuelto" | "descartado";
  readonly note: string;
}

/** Una persona del equipo cierra el caso con una nota. */
export async function resolveReport(
  context: AppContext,
  actor: Actor,
  input: ReportResolution,
): Promise<ReportRow> {
  requireRole(actor, "admin");
  const note = input.note.trim();
  ensure(note.length > 0, "Escribe una nota que explique la decisión");
  ensure(note.length <= MAX_REVIEWER_NOTE_LENGTH, "La nota es demasiado larga");
  const [resolved] = await context.db
    .update(reports)
    .set({ status: input.outcome, reviewerNote: note, reviewedAt: context.now().toISOString() })
    .where(and(eq(reports.id, input.reportId), eq(reports.status, "en_revision")))
    .returning();
  if (resolved) {
    await logEvent(context, {
      actor: "Equipo NIVEL",
      type: "reporte_revisado",
      label: `Reporte ${input.outcome} por una persona del equipo`,
      detail: { reportId: resolved.id },
    });
    return resolved;
  }
  const [existing] = await context.db.select().from(reports).where(eq(reports.id, input.reportId));
  if (!existing) throw new NotFoundError("el reporte");
  throw new ConflictError("Este reporte ya fue revisado.");
}
