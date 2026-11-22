import { describe, expect, it } from "vitest";

import { doesTrade, reachesSite } from "./matching";
import {
  cleanPlace,
  cleanWorkArea,
  coversPlace,
  describeWorkArea,
  findPlace,
  matchMunicipality,
  spokenWorkArea,
} from "./venezuela";

const worker = {
  id: "w1",
  fullName: "Ana Torres",
  trade: "pintor" as const,
  trades: ["pintor", "albanil"] as const,
  level: 2 as const,
  confirmedJobs: 0,
  practicalPassed: false,
  certificates: 0,
  location: { lat: 10.18, lng: -68.0 },
  busy: [],
};
const search = {
  trade: "albanil" as const,
  minLevel: 1 as const,
  site: { lat: 10.24, lng: -67.6 },
  startDate: "2026-11-24" as never,
  days: 5,
};

describe("zonas de trabajo en Venezuela", () => {
  it("solo acepta estados y municipios de la lista, sin repetir", () => {
    expect(cleanWorkArea({ scope: "estadal", states: ["Carabobo", "Narnia", "Carabobo"] })).toEqual({
      scope: "estadal",
      states: ["Carabobo"],
    });
    expect(
      cleanWorkArea({ scope: "municipal", places: [{ state: "Carabobo", municipality: "Gotham" }] }),
    ).toBe(undefined);
    expect(cleanPlace({ state: "Zulia", municipality: "Maracaibo" })).toEqual({
      state: "Zulia",
      municipality: "Maracaibo",
    });
    expect(cleanPlace({ state: "Carabobo", municipality: "Maracaibo" })).toBeUndefined();
  });

  it("dice si una obra queda dentro de la zona", () => {
    const area = { scope: "municipal" as const, places: [{ state: "Carabobo", municipality: "San Diego" }] };
    expect(coversPlace(area, { state: "Carabobo", municipality: "San Diego" })).toBe(true);
    expect(coversPlace(area, { state: "Carabobo", municipality: "Guacara" })).toBe(false);
    expect(coversPlace({ scope: "nacional" }, { state: "Zulia" })).toBe(true);
    expect(describeWorkArea(area)).toBe("San Diego (Carabobo)");
  });

  it("reconoce el lugar dicho y, con varios estados, toma el primero", () => {
    expect(findPlace("Carabobo y Aragua")).toEqual({ state: "Carabobo" });
    expect(findPlace("Los Guayos")).toEqual({ state: "Carabobo", municipality: "Los Guayos" });
    expect(matchMunicipality("naguanagua", [])).toEqual({ state: "Carabobo", municipality: "Naguanagua" });
    expect(spokenWorkArea({ scope: "estadal", states: ["carabobo", "miranda"], municipalities: [] })).toEqual(
      {
        scope: "estadal",
        states: ["Carabobo", "Miranda"],
      },
    );
  });

  it("un trabajador con varios oficios aparece por cualquiera, y lejos solo si la obra está en su zona", () => {
    expect(doesTrade(worker, "albanil")).toBe(true);
    expect(doesTrade(worker, "soldador")).toBe(false);
    expect(reachesSite(worker, search, 40)).toBe(false);
    expect(
      reachesSite(
        { ...worker, workArea: { scope: "estadal", states: ["Carabobo"] } },
        {
          ...search,
          place: { state: "Carabobo", municipality: "Puerto Cabello" },
        },
        40,
      ),
    ).toBe(true);
  });
});
