import { describe, expect, it } from "vitest";

import { addDays, type IsoDate, localDate, resolveStartDate } from "@/lib/dates";
import { estimateLegalCost } from "@/lib/legal-cost";
import { computeLevel, type Level } from "@/lib/level";
import { type CandidateWorker, rankCandidates } from "@/lib/matching";

import { buildSeed, type SeedRows } from "./build";
import { IDS, SITE } from "./cast";

/** Domingo 22 de noviembre de 2026, 2:30 a. m. en Caracas. */
const NOW = new Date("2026-11-22T06:30:00Z");
const seed = buildSeed(NOW);

const confirmedJobs = (rows: SeedRows, workerId: string) =>
  rows.contracts.filter(
    (contract) =>
      contract.workerId === workerId &&
      contract.status === "completado" &&
      rows.payments.some((payment) => payment.contractId === contract.id && payment.confirmedByWorkerAt),
  ).length;

function toCandidate(rows: SeedRows, worker: SeedRows["workers"][number]): CandidateWorker {
  return {
    id: worker.id,
    fullName: worker.name,
    trade: worker.trade,
    level: worker.level as Level,
    confirmedJobs: confirmedJobs(rows, worker.id),
    practicalPassed: rows.practicalTests.some((test) => test.workerId === worker.id && test.passed === true),
    certificates: rows.certificates.filter((certificate) => certificate.workerId === worker.id).length,
    location: { lat: worker.lat, lng: worker.lng },
    busy: rows.contracts
      .filter((contract) => contract.workerId === worker.id && contract.status === "activo")
      .map((contract) => ({
        from: contract.startDate as IsoDate,
        to: addDays(contract.startDate as IsoDate, contract.days - 1),
      })),
  };
}

describe("seed canónico", () => {
  it("tiene 40 trabajadores repartidos en los 6 oficios y 4 empresas", () => {
    expect(seed.workers).toHaveLength(40);
    expect(new Set(seed.workers.map((worker) => worker.trade)).size).toBe(6);
    expect(seed.companies).toHaveLength(4);
  });

  it("no repite ids en ninguna tabla", () => {
    for (const [table, rows] of Object.entries(seed)) {
      const ids = rows.map((row) => ("id" in row ? row.id : row.key));
      expect(new Set(ids).size, table).toBe(ids.length);
    }
  });

  it("es determinista: el mismo día produce exactamente las mismas filas", () => {
    const later = new Date("2026-11-22T20:00:00Z");

    expect(buildSeed(later)).toEqual(seed);
  });

  it("respalda el nivel de cada trabajador con hechos y la fórmula pública", () => {
    for (const worker of seed.workers) {
      const candidate = toCandidate(seed, worker);
      const level = computeLevel(
        {
          confirmedJobs: candidate.confirmedJobs,
          practicalPassed: candidate.practicalPassed,
          certificates: candidate.certificates,
          attendanceRate: 1,
          verifiedIncidents: 0,
          ratings: [],
        },
        { now: NOW, currentLevel: 1 },
      );

      expect(level, worker.name).toBe(worker.level);
    }
  });

  it("solo registra adultos, creados por seed y sin teléfono ni foto", () => {
    for (const worker of seed.workers) {
      expect(worker.isAdult).toBe(true);
      expect(worker.createdVia).toBe("seed");
      expect(worker.phone).toBeUndefined();
      expect(worker.photoUrl).toBeUndefined();
    }
  });

  it("solo cobra por Pago Móvil o transferencia y con IVA de 16 % aparte", () => {
    for (const fee of seed.fees) {
      expect(fee.ivaUsd).toBeCloseTo(fee.baseUsd * 0.16, 2);
      expect(fee.totalUsd).toBeCloseTo(fee.baseUsd + fee.ivaUsd, 2);
    }
    expect(new Set(seed.payments.map((payment) => payment.method))).toEqual(
      new Set(["pago_movil", "transferencia"]),
    );
  });

  it("incluye 12 inscripciones del mes y 3 pruebas prácticas pendientes hoy", () => {
    expect(seed.enrollments).toHaveLength(12);
    expect(
      seed.practicalTests.filter((test) => test.date === localDate(NOW) && test.passed === undefined),
    ).toHaveLength(3);
  });

  it("trae las 5 lecciones con guion para el audio", () => {
    expect(seed.lessons).toHaveLength(5);
    for (const lesson of seed.lessons) expect(lesson.script.length).toBeGreaterThan(300);
  });
});

describe("seed canónico: camino dorado", () => {
  const tuesday = resolveStartDate("el martes", NOW);
  const candidates = seed.workers.map((worker) => toCandidate(seed, worker));
  const ranked = rankCandidates(candidates, {
    trade: "soldador",
    minLevel: 2,
    site: SITE.point,
    startDate: tuesday,
    days: 5,
  });

  it("exactamente 6 soldadores cumplen nivel 2 o más, 25 km y disponibilidad el martes", () => {
    expect(ranked).toHaveLength(6);
  });

  it("el orden es Rafael, José, Luis, Carlos", () => {
    expect(ranked.slice(0, 4).map((entry) => entry.candidate.workerId)).toEqual([
      IDS.rafael,
      IDS.jose,
      IDS.luis,
      IDS.carlos,
    ]);
  });

  it("Rafael está a 4,0 km y Carlos a 1,2 km de la obra", () => {
    const distance = (id: string) =>
      ranked.find((entry) => entry.candidate.workerId === id)?.candidate.distanceKm;

    expect(distance(IDS.rafael)).toBe(4);
    expect(distance(IDS.carlos)).toBe(1.2);
  });

  it("Andrés (nivel 5) queda fuera porque está ocupado en otra obra", () => {
    const andres = candidates.find((candidate) => candidate.id === IDS.andres);

    expect(andres?.level).toBe(5);
    expect(andres?.busy).toHaveLength(1);
    expect(ranked.map((entry) => entry.candidate.workerId)).not.toContain(IDS.andres);
  });

  it("a Carlos le falta 1 trabajo confirmado para nivel 3 y tiene la constancia C-2041", () => {
    expect(confirmedJobs(seed, IDS.carlos)).toBe(2);
    expect(seed.certificates.find((certificate) => certificate.workerId === IDS.carlos)?.code).toBe("C-2041");
  });

  it("el costo legal del pedido del guion es de unos 301 dólares por persona", () => {
    expect(estimateLegalCost({ dailyPayUsd: 25, days: 5, quantity: 3 }).perWorker.total).toBe(300.83);
  });
});
