import { and, count, desc, eq, isNull, ne } from "drizzle-orm";

import { ensure } from "@/lib/errors";
import { TRADE_LABELS } from "@/lib/trades";
import { locateZone, ZONES } from "@/lib/zones";

import { type Actor, requireRole } from "../actor";
import type { AppContext } from "../context";
import {
  attendance,
  certificates,
  companies,
  contracts,
  courses,
  enrollments,
  incidents,
  invitations,
  payments,
  practicalTests,
  ratings,
  reports,
  telegramCodes,
  telegramLinks,
  workers,
} from "../db/schema";
import { NotFoundError } from "../errors";
import { logEvent } from "./events";
import { getLevelStatus, type LevelStatus } from "./levels";
import { isRevealed } from "./ratings";

/**
 * "Mis datos" (regla legal 8.12): la persona ve, descarga, corrige y borra lo
 * suyo, y concede o retira cada permiso por separado (regla 8.5).
 * Todo sale de la sesión: nunca se acepta el id de otra persona.
 */

export const CONSENT_KINDS = Object.freeze([
  "voice",
  "selfie",
  "gps",
  "notifications",
  "share_profile",
] as const);
export type ConsentKind = (typeof CONSENT_KINDS)[number];

const CONSENT_COLUMNS = Object.freeze({
  voice: "consentVoiceAt",
  selfie: "consentSelfieAt",
  gps: "consentGpsAt",
  notifications: "consentNotificationsAt",
  share_profile: "consentShareProfileAt",
} as const satisfies Record<ConsentKind, keyof typeof workers.$inferSelect>);

const CONSENT_LABELS: Readonly<Record<ConsentKind, string>> = Object.freeze({
  voice: "usar la voz",
  selfie: "selfie de verificación",
  gps: "ubicación al marcar entrada y salida",
  notifications: "avisos",
  share_profile: "compartir el perfil con empresas",
});

type WorkerRow = typeof workers.$inferSelect;

export interface MyProfile {
  readonly workerId: string;
  readonly name: string;
  readonly firstName: string;
  readonly trade: WorkerRow["trade"];
  readonly tradeLabel: string;
  readonly yearsExp: number;
  readonly skills: readonly string[];
  readonly zone: string;
  readonly availability: string;
  readonly openToWork: boolean;
  /** Fecha en que se concedió cada permiso, o nulo si no está concedido. */
  readonly consents: Readonly<Record<ConsentKind, string | null>>;
  readonly level: LevelStatus;
}

async function loadSelf(context: AppContext, actor: Actor): Promise<WorkerRow> {
  const { workerId } = requireRole(actor, "worker");
  const [worker] = await context.db
    .select()
    .from(workers)
    .where(and(eq(workers.id, workerId), isNull(workers.deletedAt)));
  if (!worker) throw new NotFoundError("tu perfil");
  return worker;
}

const consentsOf = (worker: WorkerRow): MyProfile["consents"] => ({
  voice: worker.consentVoiceAt,
  selfie: worker.consentSelfieAt,
  gps: worker.consentGpsAt,
  notifications: worker.consentNotificationsAt,
  share_profile: worker.consentShareProfileAt,
});

export async function getMyProfile(context: AppContext, actor: Actor): Promise<MyProfile> {
  const worker = await loadSelf(context, actor);
  return {
    workerId: worker.id,
    name: worker.name,
    firstName: worker.name.split(" ")[0] ?? worker.name,
    trade: worker.trade,
    tradeLabel: TRADE_LABELS[worker.trade].singular,
    yearsExp: worker.yearsExp,
    skills: worker.skills,
    zone: worker.zone,
    availability: worker.availability,
    openToWork: worker.openToWork,
    consents: consentsOf(worker),
    level: await getLevelStatus(context, actor, worker.id),
  };
}

export interface ProfileCorrection {
  readonly name?: string | undefined;
  readonly zone?: string | undefined;
  readonly availability?: string | undefined;
  readonly skills?: readonly string[] | undefined;
  readonly yearsExp?: number | undefined;
  readonly openToWork?: boolean | undefined;
}

const NAME_PATTERN = /^\p{L}[\p{L} .'-]{1,79}$/u;
const tidy = (text: string) => text.trim().replace(/\s+/g, " ");

function changesFrom(input: ProfileCorrection): Partial<WorkerRow> {
  const changes: Partial<WorkerRow> = {};
  if (input.name !== undefined) {
    const name = tidy(input.name);
    ensure(NAME_PATTERN.test(name), "Escribe tu nombre solo con letras");
    changes.name = name;
  }
  if (input.zone !== undefined) {
    const zone = locateZone(input.zone);
    ensure(zone.name.length >= 2, "Escribe tu municipio o sector");
    Object.assign(changes, { zone: zone.name, lat: zone.point.lat, lng: zone.point.lng });
  }
  if (input.availability !== undefined) changes.availability = tidy(input.availability);
  if (input.skills !== undefined) changes.skills = input.skills.map(tidy).filter(Boolean);
  if (input.yearsExp !== undefined) changes.yearsExp = input.yearsExp;
  if (input.openToWork !== undefined) changes.openToWork = input.openToWork;
  return changes;
}

/** La persona corrige sus propios datos. El nivel y los hechos verificables no se editan aquí. */
export async function correctMyProfile(
  context: AppContext,
  actor: Actor,
  input: ProfileCorrection,
): Promise<MyProfile> {
  const worker = await loadSelf(context, actor);
  const changes = changesFrom(input);
  if (Object.keys(changes).length > 0) {
    await context.db.update(workers).set(changes).where(eq(workers.id, worker.id));
  }
  return getMyProfile(context, actor);
}

/** Concede o retira un permiso. Retirar "compartir perfil" saca a la persona de las búsquedas de inmediato. */
export async function setMyConsent(
  context: AppContext,
  actor: Actor,
  input: { readonly kind: ConsentKind; readonly granted: boolean },
): Promise<MyProfile["consents"]> {
  const worker = await loadSelf(context, actor);
  const column = CONSENT_COLUMNS[input.kind];
  const value = input.granted ? (worker[column] ?? context.now().toISOString()) : null;
  await context.db
    .update(workers)
    .set({ [column]: value })
    .where(eq(workers.id, worker.id));
  await logEvent(context, {
    actor: "Trabajador",
    type: input.granted ? "permiso_concedido" : "permiso_retirado",
    label: `Permiso ${input.granted ? "concedido" : "retirado"}: ${CONSENT_LABELS[input.kind]}`,
  });
  return { ...consentsOf(worker), [input.kind]: value };
}

async function ratingsAbout(context: AppContext, workerId: string) {
  const rows = await context.db
    .select({ rating: ratings, companyName: companies.name })
    .from(ratings)
    .innerJoin(contracts, eq(ratings.contractId, contracts.id))
    .innerJoin(companies, eq(contracts.companyId, companies.id))
    .where(and(eq(ratings.toId, workerId), eq(ratings.fromRole, "empresa")))
    .orderBy(desc(ratings.submittedAt));
  const now = context.now();
  // Doble ciega: solo las ya reveladas (ambas partes calificaron o pasaron 7 días).
  return rows
    .filter(({ rating }) => isRevealed(rating, now))
    .map(({ rating, companyName }) => ({
      company: companyName,
      date: rating.submittedAt,
      quality: rating.quality,
      punctuality: rating.punctuality,
      safety: rating.safety,
      attitude: rating.attitude,
      tags: rating.tags,
      comment: rating.comment,
    }));
}

async function workHistory(context: AppContext, workerId: string) {
  const rows = await context.db
    .select({ contract: contracts, companyName: companies.name, payment: payments })
    .from(contracts)
    .innerJoin(companies, eq(contracts.companyId, companies.id))
    .leftJoin(payments, eq(payments.contractId, contracts.id))
    .where(eq(contracts.workerId, workerId))
    .orderBy(desc(contracts.startDate));
  return rows.map(({ contract, companyName, payment }) => ({
    contractId: contract.id,
    company: companyName,
    contractType: contract.contractType,
    startDate: contract.startDate,
    days: contract.days,
    dailyPayUsd: contract.dailyPayUsd,
    status: contract.status,
    signedAt: contract.signedWorkerAt,
    payment: payment && {
      amountUsd: payment.amountUsd,
      receiptNumber: payment.receiptNumber,
      registeredAt: payment.registeredAt,
      confirmedAt: payment.confirmedByWorkerAt,
    },
  }));
}

async function trainingHistory(context: AppContext, workerId: string) {
  const [enrolled, constancias, tests] = await Promise.all([
    context.db
      .select({ course: courses.title, status: enrollments.status, progress: enrollments.progress })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.workerId, workerId)),
    context.db
      .select({ code: certificates.code, course: courses.title, date: certificates.date })
      .from(certificates)
      .innerJoin(courses, eq(certificates.courseId, courses.id))
      .where(eq(certificates.workerId, workerId)),
    context.db
      .select({
        date: practicalTests.date,
        workshop: practicalTests.workshop,
        score: practicalTests.score,
        maxScore: practicalTests.maxScore,
        passed: practicalTests.passed,
      })
      .from(practicalTests)
      .where(eq(practicalTests.workerId, workerId)),
  ]);
  return { enrollments: enrolled, constancias, practicalTests: tests };
}

/** Todo lo que NIVEL guarda de la persona, listo para descargar como JSON. */
export async function exportMyData(context: AppContext, actor: Actor) {
  const profile = await getMyProfile(context, actor);
  const { workerId } = profile;
  const [work, training, received, attended, sent] = await Promise.all([
    workHistory(context, workerId),
    trainingHistory(context, workerId),
    ratingsAbout(context, workerId),
    context.db
      .select({ date: attendance.date, checkInAt: attendance.checkInAt, checkOutAt: attendance.checkOutAt })
      .from(attendance)
      .innerJoin(contracts, eq(attendance.contractId, contracts.id))
      .where(eq(contracts.workerId, workerId)),
    context.db
      .select({ kind: reports.kind, status: reports.status, createdAt: reports.createdAt })
      .from(reports)
      .where(eq(reports.reporterWorkerId, workerId)),
  ]);
  return {
    exportedAt: context.now().toISOString(),
    profile,
    work,
    attendance: attended,
    training,
    /** Calificaciones privadas que te dieron. Solo tú las ves; las empresas no ven las de otras. */
    ratingsReceived: received,
    reports: sent,
  };
}

export interface AccountDeletion {
  readonly outcome: "borrada" | "anonimizada";
  readonly message: string;
}

const DELETED_MESSAGE = "Borramos tu cuenta y todos tus datos.";
const ANONYMIZED_MESSAGE =
  "Borramos tu perfil y tus datos. Tu nombre queda solo en los recibos de pago ya emitidos, que la empresa debe conservar por ley.";

/**
 * Borra la cuenta. Si la persona ya trabajó con contratos, los recibos de
 * pago se conservan (la empresa está obligada a guardarlos, LOTTT art. 106):
 * se borra todo lo demás y el perfil queda vacío y fuera de toda búsqueda.
 */
export async function deleteMyAccount(context: AppContext, actor: Actor): Promise<AccountDeletion> {
  const worker = await loadSelf(context, actor);
  const id = worker.id;
  const [{ total } = { total: 0 }] = await context.db
    .select({ total: count() })
    .from(contracts)
    .where(eq(contracts.workerId, id));
  const hasContracts = total > 0;
  const { db } = context;
  await db.batch([
    db.delete(certificates).where(eq(certificates.workerId, id)),
    db.delete(enrollments).where(eq(enrollments.workerId, id)),
    db.delete(practicalTests).where(eq(practicalTests.workerId, id)),
    db.delete(incidents).where(eq(incidents.workerId, id)),
    db.delete(telegramLinks).where(and(eq(telegramLinks.role, "worker"), eq(telegramLinks.subjectId, id))),
    db.delete(telegramCodes).where(and(eq(telegramCodes.role, "worker"), eq(telegramCodes.subjectId, id))),
    db.delete(ratings).where(and(eq(ratings.toId, id), eq(ratings.fromRole, "empresa"))),
    // Los reportes siguen en revisión, pero ya no dicen quién los hizo.
    db.update(reports).set({ reporterWorkerId: null }).where(eq(reports.reporterWorkerId, id)),
    hasContracts
      ? db.delete(invitations).where(and(eq(invitations.workerId, id), ne(invitations.status, "aceptada")))
      : db.delete(invitations).where(eq(invitations.workerId, id)),
    hasContracts
      ? db
          .update(workers)
          .set({
            phone: null,
            skills: [],
            yearsExp: 0,
            zone: "",
            lat: ZONES.valencia.point.lat,
            lng: ZONES.valencia.point.lng,
            availability: "",
            photoUrl: null,
            conversationId: null,
            openToWork: false,
            consentVoiceAt: null,
            consentSelfieAt: null,
            consentGpsAt: null,
            consentNotificationsAt: null,
            consentShareProfileAt: null,
            deletedAt: context.now().toISOString(),
          })
          .where(eq(workers.id, id))
      : db.delete(workers).where(eq(workers.id, id)),
  ]);
  await logEvent(context, {
    actor: "Trabajador",
    type: "cuenta_borrada",
    label: "Una persona borró su cuenta desde Mis datos",
  });
  return hasContracts
    ? { outcome: "anonimizada", message: ANONYMIZED_MESSAGE }
    : { outcome: "borrada", message: DELETED_MESSAGE };
}
