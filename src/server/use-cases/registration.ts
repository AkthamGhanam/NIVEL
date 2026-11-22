import { and, count, eq, gte, inArray } from "drizzle-orm";

import { ensure } from "@/lib/errors";
import { type Level, MARKET_REFERENCE_BANDS } from "@/lib/level";
import { type Trade, TRADE_LABELS } from "@/lib/trades";
import { locateZone } from "@/lib/zones";

import type { Actor } from "../actor";
import type { AppContext } from "../context";
import { companies, courses, workers } from "../db/schema";
import { ConflictError, NotFoundError } from "../errors";
import { logEvent } from "./events";

/**
 * Registro del trabajador hablando con Nivi. El perfil nace en Nivel 1 y no
 * aparece en búsquedas de empresas hasta que la persona acepte compartirlo.
 */

export interface VoiceProfile {
  readonly name: string;
  readonly isAdult: boolean;
  readonly trade: Trade;
  readonly yearsExp: number;
  readonly skills: readonly string[];
  /** Municipio o sector, nunca la dirección exacta. */
  readonly zone: string;
  readonly availability: string;
  /** Conversación de voz que creó el perfil: enlaza la herramienta con la pantalla que la inició. */
  readonly conversationId: string;
  /** Persona real registrada en el evento: el reset no la borra. */
  readonly real: boolean;
  /** Cuándo aceptó en pantalla el uso de su voz y sus datos. */
  readonly consentAt: string;
}

export interface ProfileCreated {
  readonly workerId: string;
  readonly firstName: string;
  readonly level: Level;
  readonly route: { readonly freeCourse: string | null; readonly recommendedCourse: string | null };
  /** Referencia de mercado en USD al mes. No es una promesa de salario. */
  readonly referenceBand: { readonly min: number; readonly max: number };
}

export const UNDERAGE_MESSAGE = "Por ahora NIVEL es solo para personas mayores de 18 años.";

const NAME_PATTERN = /^\p{L}[\p{L} .'-]{1,79}$/u;
const LIMITS = Object.freeze({ yearsExp: 60, skills: 10, skillLength: 40, text: 80 });
/** Tope de perfiles creados por voz: evita que un abuso llene la base durante el evento. */
const MAX_VOICE_PROFILES = 300;
/** Ventana para que la pantalla que inició la conversación reclame el perfil recién creado. */
const CLAIM_WINDOW_MS = 30 * 60 * 1000;

const tidy = (text: string) => text.trim().replace(/\s+/g, " ");
const firstNameOf = (name: string) => name.split(" ")[0] ?? name;

function cleanProfile(input: VoiceProfile) {
  const name = tidy(input.name);
  ensure(input.isAdult, UNDERAGE_MESSAGE);
  ensure(NAME_PATTERN.test(name), "No entendí bien el nombre. ¿Me lo repites?");
  ensure(
    Number.isFinite(input.yearsExp) && input.yearsExp >= 0 && input.yearsExp <= LIMITS.yearsExp,
    "Los años de experiencia deben estar entre 0 y 60",
  );
  const availability = tidy(input.availability).slice(0, LIMITS.text);
  ensure(availability.length > 0, "Falta la disponibilidad");
  const skills = input.skills
    .map((skill) => tidy(skill).slice(0, LIMITS.skillLength))
    .filter(Boolean)
    .slice(0, LIMITS.skills);
  return { name, availability, skills, yearsExp: Math.round(input.yearsExp), zone: locateZone(input.zone) };
}

async function routeFor(context: AppContext, trade: Trade): Promise<ProfileCreated["route"]> {
  const offered = await context.db
    .select({ title: courses.title, free: courses.free })
    .from(courses)
    .where(eq(courses.trade, trade));
  return {
    freeCourse: offered.find((course) => course.free)?.title ?? null,
    recommendedCourse: offered.find((course) => !course.free)?.title ?? null,
  };
}

async function describe(
  context: AppContext,
  worker: { id: string; name: string; trade: Trade; level: number },
): Promise<ProfileCreated> {
  const level = worker.level as Level;
  return {
    workerId: worker.id,
    firstName: firstNameOf(worker.name),
    level,
    route: await routeFor(context, worker.trade),
    referenceBand: MARKET_REFERENCE_BANDS[level],
  };
}

const byConversation = (context: AppContext, conversationId: string) =>
  context.db
    .select({ id: workers.id, name: workers.name, trade: workers.trade, level: workers.level })
    .from(workers)
    .where(eq(workers.conversationId, conversationId));

/** Tope de perfiles creados desde la app (voz o formulario): evita que un abuso llene la base. */
async function ensureRoomForProfiles(context: AppContext): Promise<void> {
  const [{ total } = { total: 0 }] = await context.db
    .select({ total: count() })
    .from(workers)
    .where(inArray(workers.createdVia, ["voz", "texto"]));
  if (total >= MAX_VOICE_PROFILES)
    throw new ConflictError("Llegamos al máximo de registros de la demo por hoy.");
}

interface NewWorker {
  readonly profile: ReturnType<typeof cleanProfile>;
  readonly trade: Trade;
  readonly via: "voz" | "texto";
  readonly real: boolean;
  readonly conversationId: string | null;
  readonly consentAt: string;
}

async function insertWorker(context: AppContext, input: NewWorker): Promise<string> {
  const { profile } = input;
  const id = context.newId("w");
  await context.db.insert(workers).values({
    id,
    name: profile.name,
    isAdult: true,
    trade: input.trade,
    yearsExp: profile.yearsExp,
    skills: profile.skills,
    zone: profile.zone.name,
    lat: profile.zone.point.lat,
    lng: profile.zone.point.lng,
    availability: profile.availability,
    level: 1,
    createdVia: input.via,
    isReal: input.real,
    conversationId: input.conversationId,
    consentVoiceAt: input.via === "voz" ? input.consentAt : null,
    createdAt: context.now().toISOString(),
  });
  // La bitácora no guarda el nombre: solo oficio y zona reconocida.
  const place = profile.zone.known ? profile.zone.name : "zona por ubicar";
  await logEvent(context, {
    actor: input.via === "voz" ? "Nivi" : "Trabajador",
    type: "perfil_creado",
    label: `Perfil nuevo ${input.via === "voz" ? "por voz" : "en la web"} · ${TRADE_LABELS[input.trade].singular} · ${place}${input.real ? " · persona real" : ""}`,
    detail: { workerId: id, real: input.real },
    product: input.via === "voz" ? "agents" : "app",
  });
  return id;
}

/** Crea el perfil. Si el agente repite la llamada en la misma conversación, devuelve el mismo perfil. */
export async function registerWorkerByVoice(
  context: AppContext,
  input: VoiceProfile,
): Promise<ProfileCreated> {
  const profile = cleanProfile(input);
  const [existing] = await byConversation(context, input.conversationId);
  if (existing) return describe(context, existing);
  await ensureRoomForProfiles(context);
  const id = await insertWorker(context, {
    profile,
    trade: input.trade,
    via: "voz",
    real: input.real,
    conversationId: input.conversationId,
    consentAt: input.consentAt,
  });
  return describe(context, { id, name: profile.name, trade: input.trade, level: 1 });
}

/** Lo que pide el formulario "Prefiero escribir": lo mismo que Nivi, sin la conversación. */
export type FormProfile = Omit<VoiceProfile, "conversationId" | "real">;

/**
 * Registro escribiendo en la web. Siempre es una persona real: nace privada,
 * sobrevive al reset y no aparece entre las cuentas de prueba.
 */
export async function registerWorkerByForm(
  context: AppContext,
  input: FormProfile,
): Promise<{ readonly actor: Extract<Actor, { role: "worker" }>; readonly profile: ProfileCreated }> {
  const profile = cleanProfile({ ...input, conversationId: "", real: true });
  await ensureRoomForProfiles(context);
  const id = await insertWorker(context, {
    profile,
    trade: input.trade,
    via: "texto",
    real: true,
    conversationId: null,
    consentAt: input.consentAt,
  });
  return {
    actor: { role: "worker", workerId: id },
    profile: await describe(context, { id, name: profile.name, trade: input.trade, level: 1 }),
  };
}

/** Trabajador creado en esta conversación de voz, si lo hay y la conversación sigue reciente. */
export async function workerOfConversation(
  context: AppContext,
  conversationId: string,
): Promise<Extract<Actor, { role: "worker" }> | undefined> {
  const since = new Date(context.now().getTime() - CLAIM_WINDOW_MS).toISOString();
  const [worker] = await context.db
    .select({ id: workers.id })
    .from(workers)
    .where(and(eq(workers.conversationId, conversationId), gte(workers.createdAt, since)));
  return worker && { role: "worker", workerId: worker.id };
}

/**
 * La pantalla que inició la conversación reclama su perfil recién creado.
 * El id de conversación solo lo conocen esa pantalla y el agente, y deja de valer a los 30 minutos.
 */
export async function claimProfile(
  context: AppContext,
  conversationId: string,
): Promise<{ readonly actor: Actor; readonly profile: ProfileCreated }> {
  const actor = await workerOfConversation(context, conversationId);
  if (!actor) throw new NotFoundError("un perfil para esta conversación");
  const [worker] = await byConversation(context, conversationId);
  if (!worker) throw new NotFoundError("un perfil para esta conversación");
  return { actor, profile: await describe(context, worker) };
}

/* Registro de empresas */

export const COMPANY_KINDS = Object.freeze(["contratista", "empresa"] as const);
export type CompanyKind = (typeof COMPANY_KINDS)[number];

export interface CompanySignup {
  readonly name: string;
  /** RIF venezolano: letra, 8 dígitos y dígito verificador (J-12345678-9). */
  readonly rif: string;
  readonly zone: string;
  readonly kind: CompanyKind;
}

export interface CompanyCreated {
  readonly id: string;
  readonly name: string;
  readonly rif: string;
  readonly zone: string;
  readonly verified: boolean;
}

const COMPANY_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} .,&'()-]{1,79}$/u;
const RIF_PATTERN = /^([JGVEPC])-?(\d{8})-?(\d)$/;
/** Tope de empresas registradas en la web durante la demo. */
const MAX_REAL_COMPANIES = 200;

/** Deja el RIF en la forma J-12345678-9, o falla si no tiene esa forma. */
export function normalizeRif(raw: string): string {
  const match = RIF_PATTERN.exec(raw.trim().toUpperCase().replace(/\s+/g, ""));
  ensure(match !== null, "El RIF debe tener la forma J-12345678-9");
  const [, letter, number, check] = match;
  return `${letter}-${number}-${check}`;
}

/**
 * Registra una empresa real. Nace sin verificar: la verificación del RIF la
 * hace una persona del equipo, nunca la propia empresa.
 */
export async function registerCompany(
  context: AppContext,
  input: CompanySignup,
): Promise<{ readonly actor: Extract<Actor, { role: "company" }>; readonly company: CompanyCreated }> {
  const name = tidy(input.name);
  ensure(COMPANY_NAME_PATTERN.test(name), "Escribe el nombre de la empresa (de 2 a 80 caracteres)");
  const rif = normalizeRif(input.rif);
  const zoneText = tidy(input.zone);
  ensure(zoneText.length > 0, "Falta la zona de la empresa");
  const zone = locateZone(zoneText);
  const [taken] = await context.db.select({ id: companies.id }).from(companies).where(eq(companies.rif, rif));
  if (taken) throw new ConflictError("Ya hay una empresa registrada con ese RIF.");
  const [{ total } = { total: 0 }] = await context.db
    .select({ total: count() })
    .from(companies)
    .where(eq(companies.isReal, true));
  if (total >= MAX_REAL_COMPANIES)
    throw new ConflictError("Llegamos al máximo de empresas registradas en la demo por hoy.");
  const id = context.newId("co");
  await context.db.insert(companies).values({
    id,
    name,
    rif,
    verified: false,
    kind: input.kind,
    zone: zone.name,
    lat: zone.point.lat,
    lng: zone.point.lng,
    isReal: true,
  });
  await logEvent(context, {
    actor: "Empresa",
    type: "empresa_registrada",
    label: `Empresa nueva en la web · ${zone.known ? zone.name : "zona por ubicar"}`,
    detail: { companyId: id },
    product: "app",
  });
  return {
    actor: { role: "company", companyId: id },
    company: { id, name, rif, zone: zone.name, verified: false },
  };
}
