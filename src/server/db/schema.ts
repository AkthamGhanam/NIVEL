import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { CONTRACT_TYPES, TRADES } from "@/lib/trades";

/**
 * Esquema de NIVEL (docs/spec.md, sección 5.1). SQLite/libSQL.
 * Ids de texto, fechas ISO 8601 en UTC. Los enums cerrados impiden estados
 * inválidos desde el tipo; el DDL de `migrations.ts` los refuerza con CHECK.
 */

const id = () => text("id").primaryKey();
const bool = (name: string) => integer(name, { mode: "boolean" }).notNull().default(false);
const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();

export const companies = sqliteTable("companies", {
  id: id(),
  name: text("name").notNull(),
  rif: text("rif").notNull(),
  verified: bool("verified"),
  kind: text("kind", { enum: ["contratista", "empresa"] }).notNull(),
  zone: text("zone").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
});

export const academies = sqliteTable("academies", {
  id: id(),
  name: text("name").notNull(),
  rif: text("rif").notNull(),
  city: text("city").notNull(),
});

export const workers = sqliteTable("workers", {
  id: id(),
  name: text("name").notNull(),
  phone: text("phone"),
  isAdult: bool("is_adult"),
  trade: text("trade", { enum: TRADES }).notNull(),
  yearsExp: integer("years_exp").notNull().default(0),
  skills: json<string[]>("skills").notNull(),
  zone: text("zone").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  availability: text("availability").notNull(),
  level: integer("level").notNull().default(1),
  photoUrl: text("photo_url"),
  createdVia: text("created_via", { enum: ["voz", "texto", "seed"] }).notNull(),
  /** Persona real registrada durante el evento: el reset no la borra. */
  isReal: bool("is_real"),
  /** "Abierto a trabajar": si lo apaga, no aparece en búsquedas de empresas. */
  openToWork: integer("open_to_work", { mode: "boolean" }).notNull().default(true),
  /** Cuenta borrada a petición de la persona: sus datos personales ya no están. */
  deletedAt: text("deleted_at"),
  conversationId: text("conversation_id"),
  consentVoiceAt: text("consent_voice_at"),
  consentSelfieAt: text("consent_selfie_at"),
  consentGpsAt: text("consent_gps_at"),
  consentNotificationsAt: text("consent_notifications_at"),
  consentShareProfileAt: text("consent_share_profile_at"),
  createdAt: text("created_at").notNull(),
});

export const courses = sqliteTable("courses", {
  id: id(),
  academyId: text("academy_id")
    .notNull()
    .references(() => academies.id),
  title: text("title").notNull(),
  trade: text("trade", { enum: TRADES }).notNull(),
  priceUsd: real("price_usd").notNull(),
  weeks: integer("weeks").notNull(),
  mode: text("mode").notNull(),
  free: bool("free"),
  /** Cuotas ofrecidas por la academia, no por NIVEL. */
  installments: json<{ count: number; amountUsd: number }>("installments"),
});

export const lessons = sqliteTable("lessons", {
  id: id(),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id),
  order: integer("order").notNull(),
  title: text("title").notNull(),
  script: text("script").notNull(),
  audioUrl: text("audio_url"),
  durationS: integer("duration_s").notNull(),
});

export const enrollments = sqliteTable("enrollments", {
  id: id(),
  workerId: text("worker_id")
    .notNull()
    .references(() => workers.id),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id),
  status: text("status", { enum: ["en_curso", "completado"] }).notNull(),
  progress: real("progress").notNull().default(0),
  enrolledAt: text("enrolled_at").notNull(),
});

export const practicalTests = sqliteTable("practical_tests", {
  id: id(),
  workerId: text("worker_id")
    .notNull()
    .references(() => workers.id),
  trade: text("trade", { enum: TRADES }).notNull(),
  workshop: text("workshop").notNull(),
  evaluator: text("evaluator").notNull(),
  score: integer("score"),
  maxScore: integer("max_score").notNull(),
  passed: integer("passed", { mode: "boolean" }),
  insured: bool("insured"),
  date: text("date").notNull(),
});

export const certificates = sqliteTable("certificates", {
  id: id(),
  workerId: text("worker_id")
    .notNull()
    .references(() => workers.id),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id),
  /** Se muestra como "constancia" (regla legal 8.10). */
  code: text("code").notNull().unique(),
  issuedByAcademyId: text("issued_by_academy_id")
    .notNull()
    .references(() => academies.id),
  date: text("date").notNull(),
});

export const jobRequests = sqliteTable("job_requests", {
  id: id(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  trade: text("trade", { enum: TRADES }).notNull(),
  quantity: integer("quantity").notNull(),
  minLevel: integer("min_level").notNull(),
  zone: text("zone").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  startDate: text("start_date").notNull(),
  days: integer("days").notNull(),
  dailyPayUsd: real("daily_pay_usd").notNull(),
  contractType: text("contract_type", { enum: CONTRACT_TYPES }).notNull(),
  status: text("status", { enum: ["abierta", "completa", "cerrada"] }).notNull(),
  createdVia: text("created_via", { enum: ["voz", "web", "seed"] }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const invitations = sqliteTable("invitations", {
  id: id(),
  requestId: text("request_id")
    .notNull()
    .references(() => jobRequests.id),
  workerId: text("worker_id")
    .notNull()
    .references(() => workers.id),
  status: text("status", { enum: ["enviada", "aceptada", "rechazada"] }).notNull(),
  channel: text("channel", { enum: ["app"] }).notNull(),
  audioUrl: text("audio_url"),
  createdAt: text("created_at").notNull(),
  respondedAt: text("responded_at"),
});

export const contracts = sqliteTable("contracts", {
  id: id(),
  requestId: text("request_id")
    .notNull()
    .references(() => jobRequests.id),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  workerId: text("worker_id")
    .notNull()
    .references(() => workers.id),
  contractType: text("contract_type", { enum: CONTRACT_TYPES }).notNull(),
  dailyPayUsd: real("daily_pay_usd").notNull(),
  startDate: text("start_date").notNull(),
  days: integer("days").notNull(),
  /** Hash del código de firma (OTP simulado); nunca el código en claro. */
  otpHash: text("otp_hash"),
  otpAttempts: integer("otp_attempts").notNull().default(0),
  signedWorkerAt: text("signed_worker_at"),
  signedCompanyAt: text("signed_company_at"),
  status: text("status", { enum: ["pendiente_firma", "activo", "completado", "terminado"] }).notNull(),
});

export const attendance = sqliteTable("attendance", {
  id: id(),
  contractId: text("contract_id")
    .notNull()
    .references(() => contracts.id),
  date: text("date").notNull(),
  checkInAt: text("check_in_at"),
  checkOutAt: text("check_out_at"),
  insideGeofence: bool("inside_geofence"),
  note: text("note"),
});

export const payments = sqliteTable("payments", {
  id: id(),
  contractId: text("contract_id")
    .notNull()
    .references(() => contracts.id),
  amountUsd: real("amount_usd").notNull(),
  amountBs: real("amount_bs").notNull(),
  method: text("method", { enum: ["pago_movil", "transferencia"] }).notNull(),
  reference: text("reference").notNull(),
  receiptNumber: text("receipt_number").notNull().unique(),
  registeredAt: text("registered_at").notNull(),
  confirmedByWorkerAt: text("confirmed_by_worker_at"),
});

export const ratings = sqliteTable("ratings", {
  id: id(),
  contractId: text("contract_id")
    .notNull()
    .references(() => contracts.id),
  fromRole: text("from_role", { enum: ["empresa", "trabajador"] }).notNull(),
  toId: text("to_id").notNull(),
  quality: integer("quality").notNull(),
  punctuality: integer("punctuality").notNull(),
  safety: integer("safety").notNull(),
  attitude: integer("attitude").notNull(),
  tags: json<string[]>("tags").notNull(),
  comment: text("comment"),
  submittedAt: text("submitted_at").notNull(),
  /** Doble ciega: nulo hasta que ambas partes califican o pasan 7 días. */
  revealedAt: text("revealed_at"),
});

export const incidents = sqliteTable("incidents", {
  id: id(),
  workerId: text("worker_id")
    .notNull()
    .references(() => workers.id),
  kind: text("kind", { enum: ["identidad_falsa", "ausencia_confirmada", "violencia"] }).notNull(),
  verifiedBy: text("verified_by"),
  verifiedAt: text("verified_at"),
});

export const reports = sqliteTable("reports", {
  id: id(),
  reporterWorkerId: text("reporter_worker_id").references(() => workers.id),
  companyId: text("company_id").references(() => companies.id),
  kind: text("kind", { enum: ["no_pago", "inseguridad", "oferta_falsa", "acoso", "otro"] }).notNull(),
  text: text("text"),
  audioUrl: text("audio_url"),
  transcript: text("transcript"),
  status: text("status", { enum: ["en_revision", "resuelto", "descartado"] }).notNull(),
  reviewerNote: text("reviewer_note"),
  createdAt: text("created_at").notNull(),
  reviewedAt: text("reviewed_at"),
});

export const fees = sqliteTable("fees", {
  id: id(),
  companyId: text("company_id").references(() => companies.id),
  academyId: text("academy_id").references(() => academies.id),
  contractId: text("contract_id").references(() => contracts.id),
  concept: text("concept").notNull(),
  baseUsd: real("base_usd").notNull(),
  ivaUsd: real("iva_usd").notNull(),
  totalUsd: real("total_usd").notNull(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  status: text("status", { enum: ["por_pagar", "pagado"] }).notNull(),
  method: text("method", { enum: ["pago_movil", "transferencia"] }),
  createdAt: text("created_at").notNull(),
});

export const events = sqliteTable("events", {
  id: id(),
  ts: text("ts").notNull(),
  actor: text("actor").notNull(),
  type: text("type").notNull(),
  label: text("label").notNull(),
  detail: json<Record<string, unknown>>("detail"),
  latencyMs: integer("latency_ms"),
  product: text("product", { enum: ["agents", "tts", "stt", "sfx", "app"] }).notNull(),
});

export const demoState = sqliteTable("demo_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const schema = {
  companies,
  academies,
  workers,
  courses,
  lessons,
  enrollments,
  practicalTests,
  certificates,
  jobRequests,
  invitations,
  contracts,
  attendance,
  payments,
  ratings,
  incidents,
  reports,
  fees,
  events,
  demoState,
};
