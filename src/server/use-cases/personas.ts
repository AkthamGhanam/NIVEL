// Cuentas disponibles para entrar (demo y registradas) y sesión activa por vista.
import { and, asc, eq, isNull } from "drizzle-orm";

import type { Actor, Sessions } from "../actor";
import type { AppContext } from "../context";
import { IDS } from "../db/seed/cast";
import { academies, companies, workers } from "../db/schema";
import { NotFoundError } from "../errors";
import { isDemoFlagOn } from "./demo-state";

export type PersonaRole = "worker" | "company" | "academy";

export interface PersonaChoice {
  readonly role: PersonaRole;
  readonly id: string;
}

export interface DemoState {
  readonly personas: {
    readonly workers: ReadonlyArray<{
      id: string;
      name: string;
      trade: string;
      level: number;
      zone: string;
      registered: boolean;
    }>;
    readonly companies: ReadonlyArray<{
      id: string;
      name: string;
      zone: string;

      rif: string;
      verified: boolean;
      registered: boolean;
    }>;
    readonly academies: ReadonlyArray<{ id: string; name: string }>;
  };

  readonly active: {
    readonly workerId: string | null;
    readonly companyId: string | null;
    readonly academyId: string | null;
    readonly admin: boolean;
  };

  readonly activeCompany: DemoState["personas"]["companies"][number] | null;
  readonly flags: { readonly bot: boolean; readonly simulation: boolean };
}

async function companyCard(context: AppContext, companyId: string) {
  const [company] = await context.db
    .select({
      id: companies.id,
      name: companies.name,
      zone: companies.zone,
      rif: companies.rif,
      verified: companies.verified,
      registered: companies.isReal,
    })
    .from(companies)
    .where(eq(companies.id, companyId));
  return company ?? null;
}

const STARS: readonly string[] = [IDS.carlos, IDS.rafael, IDS.jose, IDS.luis, IDS.andres];

function starsFirst<Row extends { readonly id: string }>(rows: readonly Row[]): Row[] {
  const rank = (row: Row) => {
    const position = STARS.indexOf(row.id);
    return position === -1 ? STARS.length : position;
  };
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => rank(a.row) - rank(b.row) || a.index - b.index)
    .map(({ row }) => row);
}

interface WorkerRow {
  readonly id: string;
  readonly name: string;
  readonly trade: string;
  readonly level: number;
  readonly zone: string;
  readonly createdVia: string;
}

function publicWorker({ createdVia, ...worker }: WorkerRow): DemoState["personas"]["workers"][number] {
  const registered = createdVia !== "seed";
  const [first = "", last] = worker.name.split(" ");
  return { ...worker, name: registered && last ? `${first} ${last.charAt(0)}.` : worker.name, registered };
}

const DEMO_COMPANY_ID = IDS.activeCompany;

export async function getDemoState(context: AppContext, sessions: Sessions): Promise<DemoState> {
  const [workerRows, companyRows, academyRows, bot, simulation] = await Promise.all([
    context.db
      .select({
        id: workers.id,
        name: workers.name,
        trade: workers.trade,
        level: workers.level,
        zone: workers.zone,
        createdVia: workers.createdVia,
      })
      .from(workers)
      .where(isNull(workers.deletedAt))
      .orderBy(asc(workers.name)),
    context.db
      .select({
        id: companies.id,
        name: companies.name,
        zone: companies.zone,
        rif: companies.rif,
        verified: companies.verified,
        registered: companies.isReal,
      })
      .from(companies)
      .orderBy(asc(companies.isReal), asc(companies.id)),
    context.db.select({ id: academies.id, name: academies.name }).from(academies).orderBy(asc(academies.id)),
    isDemoFlagOn(context, "bot"),
    isDemoFlagOn(context, "simulation"),
  ]);
  const { worker, company, academy, admin } = sessions;
  const companyId = company?.role === "company" ? company.companyId : null;
  const activeCompany =
    companyId === null
      ? null
      : (companyRows.find((row) => row.id === companyId) ?? (await companyCard(context, companyId)));
  return {
    personas: {
      workers: starsFirst(workerRows).map(publicWorker),
      // Una sola empresa de ejemplo, recién creada; las demás existen solo como historial de los trabajadores.
      companies: companyRows.filter((row) => row.registered || row.id === DEMO_COMPANY_ID),
      academies: academyRows,
    },
    active: {
      workerId: worker?.role === "worker" ? worker.workerId : null,
      companyId,
      academyId: academy?.role === "academy" ? academy.academyId : null,
      admin: admin !== undefined,
    },
    activeCompany,
    flags: { bot, simulation },
  };
}

async function listedWorker(context: AppContext, id: string): Promise<Actor> {
  const [worker] = await context.db
    .select({ id: workers.id })
    .from(workers)
    .where(and(eq(workers.id, id), isNull(workers.deletedAt)));
  if (!worker) throw new NotFoundError("esa persona");
  return { role: "worker", workerId: worker.id };
}

export async function resolvePersona(context: AppContext, choice: PersonaChoice): Promise<Actor> {
  if (choice.role === "worker") return listedWorker(context, choice.id);
  if (choice.role === "company") {
    const [company] = await context.db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, choice.id));
    if (!company) throw new NotFoundError("esa empresa");
    return { role: "company", companyId: company.id };
  }
  const [academy] = await context.db
    .select({ id: academies.id })
    .from(academies)
    .where(eq(academies.id, choice.id));
  if (!academy) throw new NotFoundError("esa academia");
  return { role: "academy", academyId: academy.id };
}
