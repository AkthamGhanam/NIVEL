import { describe, expect, it } from "vitest";

import { parseIsoDate } from "./dates";
import { DomainValidationError } from "./errors";
import { type CandidateWorker, type JobSearch, rankCandidates, shortName } from "./matching";

const OBRA_LOS_GUAYOS = { lat: 10.186, lng: -67.938 };
const KM_PER_DEGREE_LAT = 111.2;

/** Un punto a `km` kilómetros al norte de la obra. */
const northOfSite = (km: number) => ({
  lat: OBRA_LOS_GUAYOS.lat + km / KM_PER_DEGREE_LAT,
  lng: OBRA_LOS_GUAYOS.lng,
});

const welder = (
  overrides: Partial<CandidateWorker> & Pick<CandidateWorker, "id" | "fullName">,
): CandidateWorker => ({
  trade: "soldador",
  level: 2,
  confirmedJobs: 0,
  practicalPassed: false,
  certificates: 0,
  location: northOfSite(5),
  busy: [],
  ...overrides,
});

const TUESDAY = parseIsoDate("2026-11-24");

const SEARCH: JobSearch = {
  trade: "soldador",
  minLevel: 2,
  site: OBRA_LOS_GUAYOS,
  startDate: TUESDAY,
  days: 5,
};

/** Elenco del camino dorado (docs/spec.md, sección 5.2). */
const CAST: CandidateWorker[] = [
  welder({
    id: "w-rafael",
    fullName: "Rafael Torres",
    level: 3,
    confirmedJobs: 4,
    practicalPassed: true,
    location: northOfSite(4),
  }),
  welder({
    id: "w-jose",
    fullName: "José Pérez",
    level: 3,
    confirmedJobs: 3,
    practicalPassed: true,
    location: northOfSite(6),
  }),
  welder({
    id: "w-luis",
    fullName: "Luis Mendoza",
    level: 3,
    confirmedJobs: 3,
    practicalPassed: true,
    location: northOfSite(9),
  }),
  welder({
    id: "w-carlos",
    fullName: "Carlos Rodríguez",
    level: 2,
    confirmedJobs: 2,
    practicalPassed: true,
    certificates: 1,
    location: northOfSite(1.2),
  }),
  welder({ id: "w-n2-12km", fullName: "Pedro Gil", level: 2, confirmedJobs: 1, location: northOfSite(12) }),
  welder({ id: "w-n2-20km", fullName: "Ramón Díaz", level: 2, confirmedJobs: 1, location: northOfSite(20) }),
  welder({
    id: "w-andres",
    fullName: "Andrés Silva",
    level: 5,
    confirmedJobs: 30,
    practicalPassed: true,
    busy: [{ from: parseIsoDate("2026-11-23"), to: parseIsoDate("2026-11-28") }],
  }),
  welder({ id: "w-n1", fullName: "Juan Nivel Uno", level: 1 }),
  welder({ id: "w-far", fullName: "Lejos Morón", level: 3, location: northOfSite(30) }),
  welder({ id: "w-electric", fullName: "Elena Electricista", trade: "electricista", level: 4 }),
];

describe("rankCandidates: camino dorado", () => {
  const ranked = rankCandidates(CAST, SEARCH);

  it("encuentra exactamente 6 soldadores de nivel 2 o más, a 25 km o menos y disponibles el martes", () => {
    expect(ranked).toHaveLength(6);
  });

  it("ordena Rafael, José, Luis y Carlos en ese orden", () => {
    expect(ranked.slice(0, 4).map((r) => r.candidate.shortName)).toEqual([
      "Rafael T.",
      "José P.",
      "Luis M.",
      "Carlos R.",
    ]);
  });

  it("deja fuera a Andrés (ocupado), al nivel 1, al de 30 km y a otro oficio", () => {
    const ids = ranked.map((r) => r.candidate.workerId);

    expect(ids).not.toContain("w-andres");
    expect(ids).not.toContain("w-n1");
    expect(ids).not.toContain("w-far");
    expect(ids).not.toContain("w-electric");
  });

  it("muestra a Carlos a 1,2 km con prueba práctica aprobada", () => {
    const carlos = ranked.find((r) => r.candidate.workerId === "w-carlos")?.candidate;

    expect(carlos).toEqual({
      workerId: "w-carlos",
      shortName: "Carlos R.",
      level: 2,
      confirmedJobs: 2,
      practicalPassed: true,
      certificates: 1,
      distanceKm: 1.2,
    });
  });

  it("nunca expone nombre completo, ubicación ni datos sensibles", () => {
    const exposedKeys = new Set(ranked.flatMap((r) => Object.keys(r.candidate)));

    for (const forbidden of ["fullName", "location", "photo", "age", "sex", "rating", "busy"]) {
      expect(exposedKeys.has(forbidden)).toBe(false);
    }
  });
});

describe("rankCandidates: casos borde", () => {
  it("acepta a un trabajador justo a 25 km", () => {
    const edge = welder({ id: "w-edge", fullName: "Borde Exacto", location: northOfSite(24.99) });

    expect(rankCandidates([edge], SEARCH)).toHaveLength(1);
  });

  it("considera ocupado a quien tiene un compromiso el último día de la obra", () => {
    const busyFriday = welder({
      id: "w-busy",
      fullName: "Ocupado Viernes",
      busy: [{ from: parseIsoDate("2026-11-28"), to: parseIsoDate("2026-11-28") }],
    });

    expect(rankCandidates([busyFriday], SEARCH)).toHaveLength(0);
    expect(rankCandidates([busyFriday], { ...SEARCH, days: 4 })).toHaveLength(1);
  });

  it("devuelve una lista vacía si nadie cumple", () => {
    expect(rankCandidates([], SEARCH)).toEqual([]);
  });

  it("desempata por id para que el orden sea estable", () => {
    const twins = [welder({ id: "b", fullName: "Gemelo B" }), welder({ id: "a", fullName: "Gemelo A" })];

    expect(rankCandidates(twins, SEARCH).map((r) => r.candidate.workerId)).toEqual(["a", "b"]);
  });

  it("rechaza días inválidos", () => {
    expect(() => rankCandidates(CAST, { ...SEARCH, days: 0 })).toThrow(DomainValidationError);
  });
});

describe("shortName", () => {
  it.each([
    ["Carlos Rodríguez", "Carlos R."],
    ["  María José   Ávila  ", "María Á."],
    ["Madonna", "Madonna"],
    ["josé ñáñez", "josé Ñ."],
  ])("%j → %j", (full, expected) => {
    expect(shortName(full)).toBe(expected);
  });
});
