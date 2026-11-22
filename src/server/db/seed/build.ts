import { addDays, type IsoDate, localDate } from "@/lib/dates";
import { academyCommission, hiringFee, toBolivares } from "@/lib/pricing";

import type { schema } from "../schema";
import { CAST, type CastMember, COMPANIES, IDS, northOfSite, SITE, ZONES } from "./cast";
import { LESSONS } from "./lessons";

/**
 * Construye el seed canónico. Función pura: mismas filas para el mismo día,
 * así dos resets seguidos dejan la base idéntica. Los niveles no se escriben
 * a mano sin respaldo: cada trabajador recibe los hechos (pruebas, constancias,
 * trabajos confirmados) que justifican su nivel con la fórmula pública.
 */

type Insert<K extends keyof typeof schema> = (typeof schema)[K]["$inferInsert"];

export type SeedRows = { [K in keyof typeof schema]: Array<Insert<K>> };

export const EXAMPLE_RATE_BS_PER_USD = 36.5;

const HISTORY = Object.freeze({
  firstJobDaysAgo: 21,
  daysBetweenJobs: 7,
  jobDays: 3,
  baseDailyPayUsd: 18,
  dailyPayPerLevelUsd: 3,
});

const MONTHLY_ENROLLMENTS = 12;
const PAID_COURSE_PRICE_USD = 120;
const TESTS_TODAY = 3;
const BUSY_CONTRACT_DAYS = 10;

/** 7:00 a. m. en Caracas (UTC−4) de una fecha local. */
const morning = (date: IsoDate) => `${date}T11:00:00.000Z`;
/** 4:00 p. m. en Caracas. */
const afternoon = (date: IsoDate) => `${date}T20:00:00.000Z`;

const pad = (value: number, width: number) => String(value).padStart(width, "0");

function workerRow(person: CastMember, today: IsoDate): Insert<"workers"> {
  const point = person.kmFromSite === undefined ? ZONES[person.zone].point : northOfSite(person.kmFromSite);
  const registeredAt = morning(addDays(today, -200));
  return {
    id: person.id,
    name: person.name,
    isAdult: true,
    trade: person.trade,
    yearsExp: person.yearsExp,
    skills: [...person.skills],
    zone: ZONES[person.zone].name,
    lat: point.lat,
    lng: point.lng,
    availability: person.busyThisWeek ? "Ocupado en otra obra esta semana" : "Disponible de lunes a sábado",
    level: person.level,
    createdVia: "seed",
    consentVoiceAt: registeredAt,
    consentGpsAt: registeredAt,
    consentShareProfileAt: registeredAt,
    createdAt: registeredAt,
  };
}

function practicalTestRow(person: CastMember, today: IsoDate): Insert<"practicalTests"> {
  return {
    id: `pt-${person.id}`,
    workerId: person.id,
    trade: person.trade,
    workshop: "Taller Escuela Los Guayos",
    evaluator: "Ing. M. Pérez",
    score: 4,
    maxScore: 4,
    passed: true,
    insured: true,
    date: addDays(today, -180),
  };
}

function certificateRows(person: CastMember, today: IsoDate): Array<Insert<"certificates">> {
  const courseIds = [IDS.paidCourse, IDS.freeCourse];
  return person.certificateCodes.map((code, index) => ({
    id: `ce-${code}`,
    workerId: person.id,
    courseId: courseIds[index % courseIds.length] ?? IDS.paidCourse,
    code,
    issuedByAcademyId: IDS.academy,
    date: addDays(today, -190),
  }));
}

interface HistoricalJob {
  readonly person: CastMember;
  readonly jobIndex: number;
  readonly sequence: number;
  readonly today: IsoDate;
}

type JobRows = Pick<SeedRows, "jobRequests" | "contracts" | "attendance" | "payments" | "fees">;

interface JobContext {
  readonly key: string;
  readonly person: CastMember;
  readonly sequence: number;
  readonly company: (typeof COMPANIES)[number];
  readonly startDate: IsoDate;
  readonly dailyPayUsd: number;
}

function jobContext({ person, jobIndex, sequence, today }: HistoricalJob): JobContext {
  return {
    key: `${person.id}-${pad(jobIndex + 1, 2)}`,
    person,
    sequence,
    company: COMPANIES[sequence % COMPANIES.length] ?? COMPANIES[0],
    startDate: addDays(today, -(HISTORY.firstJobDaysAgo + HISTORY.daysBetweenJobs * jobIndex)),
    dailyPayUsd: HISTORY.baseDailyPayUsd + HISTORY.dailyPayPerLevelUsd * person.level,
  };
}

function pastRequestRow({ key, person, company, startDate, dailyPayUsd }: JobContext): Insert<"jobRequests"> {
  const site = ZONES[company.zone];
  return {
    id: `jr-${key}`,
    companyId: company.id,
    trade: person.trade,
    quantity: 1,
    minLevel: 1,
    zone: site.name,
    lat: site.point.lat,
    lng: site.point.lng,
    startDate,
    days: HISTORY.jobDays,
    dailyPayUsd,
    contractType: "obra_determinada",
    status: "cerrada",
    createdVia: "seed",
    createdAt: morning(addDays(startDate, -2)),
  };
}

function pastContractRow({ key, person, company, startDate, dailyPayUsd }: JobContext): Insert<"contracts"> {
  return {
    id: `ct-${key}`,
    requestId: `jr-${key}`,
    companyId: company.id,
    workerId: person.id,
    contractType: "obra_determinada",
    dailyPayUsd,
    startDate,
    days: HISTORY.jobDays,
    signedWorkerAt: morning(addDays(startDate, -1)),
    signedCompanyAt: morning(addDays(startDate, -2)),
    status: "completado",
  };
}

function pastAttendanceRows({ key, startDate }: JobContext): Array<Insert<"attendance">> {
  return Array.from({ length: HISTORY.jobDays }, (_, day) => {
    const date = addDays(startDate, day);
    return {
      id: `at-${key}-${day + 1}`,
      contractId: `ct-${key}`,
      date,
      checkInAt: morning(date),
      checkOutAt: afternoon(date),
      insideGeofence: true,
    };
  });
}

function pastPaymentRow({ key, sequence, startDate, dailyPayUsd }: JobContext): Insert<"payments"> {
  const endDate = addDays(startDate, HISTORY.jobDays - 1);
  const amountUsd = dailyPayUsd * HISTORY.jobDays;
  return {
    id: `pa-${key}`,
    contractId: `ct-${key}`,
    amountUsd,
    amountBs: toBolivares(amountUsd, EXAMPLE_RATE_BS_PER_USD),
    method: sequence % 2 === 0 ? "pago_movil" : "transferencia",
    reference: `REF${pad(100000 + sequence, 6)}`,
    receiptNumber: `R-${pad(sequence + 1, 5)}`,
    registeredAt: afternoon(endDate),
    confirmedByWorkerAt: afternoon(addDays(endDate, 1)),
  };
}

function pastFeeRow({ key, person, sequence, company, startDate }: JobContext): Insert<"fees"> {
  const fee = hiringFee(person.level);
  return {
    id: `fe-${key}`,
    companyId: company.id,
    contractId: `ct-${key}`,
    concept: `Contratación · Nivel ${person.level}`,
    baseUsd: fee.base,
    ivaUsd: fee.iva,
    totalUsd: fee.total,
    invoiceNumber: `F-${pad(sequence + 1, 5)}`,
    status: "pagado",
    method: "transferencia",
    createdAt: morning(startDate),
  };
}

/** Una contratación pasada completa: solicitud, contrato, asistencia, pago confirmado y tarifa pagada. */
function historicalJobRows(job: HistoricalJob): JobRows {
  const context = jobContext(job);
  return {
    jobRequests: [pastRequestRow(context)],
    contracts: [pastContractRow(context)],
    attendance: pastAttendanceRows(context),
    payments: [pastPaymentRow(context)],
    fees: [pastFeeRow(context)],
  };
}

function mergeJobRows(target: JobRows, source: JobRows): void {
  target.jobRequests.push(...source.jobRequests);
  target.contracts.push(...source.contracts);
  target.attendance.push(...source.attendance);
  target.payments.push(...source.payments);
  target.fees.push(...source.fees);
}

function historyRows(today: IsoDate): JobRows {
  const rows: JobRows = { jobRequests: [], contracts: [], attendance: [], payments: [], fees: [] };
  let sequence = 0;
  for (const person of CAST) {
    for (let jobIndex = 0; jobIndex < person.confirmedJobs; jobIndex += 1) {
      mergeJobRows(rows, historicalJobRows({ person, jobIndex, sequence, today }));
      sequence += 1;
    }
  }
  return rows;
}

/** Contrato activo en otra obra: es lo que deja a Andrés no disponible esta semana. */
function busyContractRows(person: CastMember, today: IsoDate): Pick<SeedRows, "jobRequests" | "contracts"> {
  const company = COMPANIES[1];
  const site = ZONES[company.zone];
  const startDate = addDays(today, -1);
  const dailyPayUsd = 40;
  return {
    jobRequests: [
      {
        id: `jr-${person.id}-activo`,
        companyId: company.id,
        trade: person.trade,
        quantity: 1,
        minLevel: 4,
        zone: site.name,
        lat: site.point.lat,
        lng: site.point.lng,
        startDate,
        days: BUSY_CONTRACT_DAYS,
        dailyPayUsd,
        contractType: "obra_determinada",
        status: "completa",
        createdVia: "seed",
        createdAt: morning(addDays(today, -4)),
      },
    ],
    contracts: [
      {
        id: `ct-${person.id}-activo`,
        requestId: `jr-${person.id}-activo`,
        companyId: company.id,
        workerId: person.id,
        contractType: "obra_determinada",
        dailyPayUsd,
        startDate,
        days: BUSY_CONTRACT_DAYS,
        signedWorkerAt: morning(addDays(today, -3)),
        signedCompanyAt: morning(addDays(today, -4)),
        status: "activo",
      },
    ],
  };
}

/** Calificaciones privadas ya reveladas de los trabajos de Carlos, para "Mis datos". */
function carlosRatings(contracts: ReadonlyArray<Insert<"contracts">>): Array<Insert<"ratings">> {
  return contracts
    .filter((contract) => contract.workerId === IDS.carlos && contract.status === "completado")
    .flatMap((contract) => {
      const submittedAt = afternoon(addDays(contract.startDate as IsoDate, HISTORY.jobDays));
      const scores = { quality: 5, punctuality: 4, safety: 5, attitude: 5 };
      return [
        {
          id: `ra-${contract.id}-empresa`,
          contractId: contract.id,
          fromRole: "empresa" as const,
          toId: IDS.carlos,
          ...scores,
          tags: ["Trabajo prolijo", "Cumple normas de seguridad"],
          submittedAt,
          revealedAt: submittedAt,
        },
        {
          id: `ra-${contract.id}-trabajador`,
          contractId: contract.id,
          fromRole: "trabajador" as const,
          toId: contract.companyId,
          ...scores,
          tags: ["Pagó a tiempo", "Buen trato"],
          submittedAt,
          revealedAt: submittedAt,
        },
      ];
    });
}

function enrollmentRows(today: IsoDate): Pick<SeedRows, "enrollments" | "fees"> {
  const students = CAST.filter((person) => person.level <= 2).slice(0, MONTHLY_ENROLLMENTS);
  const commission = academyCommission(PAID_COURSE_PRICE_USD);
  const enrollments = students.map((person, index) => {
    const paid = index % 2 === 0;
    // Quien ya tiene la constancia del curso pago lo terminó.
    const finished = paid && person.certificateCodes.length > 0;
    return {
      id: `en-${person.id}`,
      workerId: person.id,
      courseId: paid ? IDS.paidCourse : IDS.freeCourse,
      status: finished ? ("completado" as const) : ("en_curso" as const),
      progress: finished ? 1 : (index % 4) * 0.25,
      enrolledAt: morning(addDays(today, -(index + 1))),
    };
  });
  const fees = enrollments
    .filter((enrollment) => enrollment.courseId === IDS.paidCourse)
    .map((enrollment, index) => ({
      id: `fe-${enrollment.id}`,
      academyId: IDS.academy,
      concept: "Comisión academia 15 % · Soldadura SMAW en estructuras",
      baseUsd: commission.base,
      ivaUsd: commission.iva,
      totalUsd: commission.total,
      invoiceNumber: `FA-${pad(index + 1, 5)}`,
      status: "pagado" as const,
      method: "transferencia" as const,
      createdAt: enrollment.enrolledAt,
    }));
  return { enrollments, fees };
}

/** Pruebas prácticas de hoy, aún sin evaluar, para el panel de la academia. */
function testsToday(today: IsoDate): Array<Insert<"practicalTests">> {
  return CAST.filter((person) => person.level === 1)
    .slice(0, TESTS_TODAY)
    .map((person) => ({
      id: `pt-hoy-${person.id}`,
      workerId: person.id,
      trade: person.trade,
      workshop: "Taller Escuela Los Guayos",
      evaluator: "Ing. M. Pérez",
      maxScore: 4,
      insured: true,
      date: today,
    }));
}

function catalogRows(): Pick<SeedRows, "companies" | "academies" | "courses" | "lessons" | "demoState"> {
  return {
    companies: COMPANIES.map((company) => ({
      id: company.id,
      name: company.name,
      rif: company.rif,
      verified: true,
      kind: "contratista" as const,
      zone: ZONES[company.zone].name,
      lat: ZONES[company.zone].point.lat,
      lng: ZONES[company.zone].point.lng,
    })),
    academies: [
      { id: IDS.academy, name: "Academia Técnica Carabobo", rif: "J-40111222-3", city: "Valencia" },
      { id: IDS.workshop, name: "Taller Escuela Los Guayos", rif: "J-40222333-4", city: "Los Guayos" },
    ],
    courses: [
      {
        id: IDS.paidCourse,
        academyId: IDS.academy,
        title: "Soldadura SMAW en estructuras",
        trade: "soldador",
        priceUsd: PAID_COURSE_PRICE_USD,
        weeks: 6,
        mode: "Presencial + audio",
        free: false,
        installments: { count: 4, amountUsd: 30 },
      },
      {
        id: IDS.freeCourse,
        academyId: IDS.academy,
        title: "Seguridad en trabajos en caliente",
        trade: "soldador",
        priceUsd: 0,
        weeks: 1,
        mode: "Audio",
        free: true,
      },
    ],
    lessons: LESSONS.map((lesson) => ({ ...lesson })),
    demoState: [
      { key: "active_company_id", value: IDS.activeCompany },
      { key: "active_worker_id", value: IDS.carlos },
      { key: "bot", value: "on" },
      { key: "simulation", value: "on" },
      { key: "example_rate_bs_per_usd", value: String(EXAMPLE_RATE_BS_PER_USD) },
      { key: "site", value: JSON.stringify(SITE) },
    ],
  };
}

export function buildSeed(now: Date): SeedRows {
  const today = localDate(now);
  const history = historyRows(today);
  const busy = CAST.filter((person) => person.busyThisWeek).map((person) => busyContractRows(person, today));
  const academy = enrollmentRows(today);
  const contracts = [...history.contracts, ...busy.flatMap((rows) => rows.contracts)];
  const verified = CAST.filter((person) => person.practicalPassed);
  return {
    ...catalogRows(),
    workers: CAST.map((person) => workerRow(person, today)),
    enrollments: academy.enrollments,
    practicalTests: [...verified.map((person) => practicalTestRow(person, today)), ...testsToday(today)],
    certificates: CAST.flatMap((person) => certificateRows(person, today)),
    jobRequests: [...history.jobRequests, ...busy.flatMap((rows) => rows.jobRequests)],
    invitations: [],
    contracts,
    attendance: history.attendance,
    payments: history.payments,
    ratings: carlosRatings(contracts),
    incidents: [],
    reports: [],
    fees: [...history.fees, ...academy.fees],
    events: [],
  };
}
