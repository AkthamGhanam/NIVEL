import { describe, expect, it } from "vitest";

import { DomainValidationError } from "./errors";
import { haversineKm, isInsideGeofence } from "./geo";

const LOS_GUAYOS = { lat: 10.186, lng: -67.938 };
const VALENCIA = { lat: 10.162, lng: -68.007 };
const OBRA = { center: LOS_GUAYOS, radiusMeters: 120 };

describe("haversineKm", () => {
  it("es cero para el mismo punto", () => {
    expect(haversineKm(LOS_GUAYOS, LOS_GUAYOS)).toBe(0);
  });

  it("mide Valencia–Los Guayos en unos 8 km y es simétrica", () => {
    const distance = haversineKm(VALENCIA, LOS_GUAYOS);

    expect(distance).toBeCloseTo(8.0, 0);
    expect(haversineKm(LOS_GUAYOS, VALENCIA)).toBeCloseTo(distance, 10);
  });

  it("funciona en puntos antípodas sin devolver NaN", () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(20015, 0);
  });

  it.each([
    [{ lat: 91, lng: 0 }],
    [{ lat: 0, lng: -181 }],
    [{ lat: Number.NaN, lng: 0 }],
    [{ lat: 0, lng: Number.POSITIVE_INFINITY }],
  ])("rechaza coordenadas inválidas %j", (point) => {
    expect(() => haversineKm(point, LOS_GUAYOS)).toThrow(DomainValidationError);
  });
});

describe("isInsideGeofence", () => {
  it("acepta un punto a 50 m de la obra", () => {
    const fiftyMetersNorth = { lat: LOS_GUAYOS.lat + 0.00045, lng: LOS_GUAYOS.lng };

    expect(isInsideGeofence(fiftyMetersNorth, OBRA)).toBe(true);
  });

  it("rechaza un punto a unos 200 m de la obra", () => {
    const twoHundredMetersNorth = { lat: LOS_GUAYOS.lat + 0.0018, lng: LOS_GUAYOS.lng };

    expect(isInsideGeofence(twoHundredMetersNorth, OBRA)).toBe(false);
  });

  it("rechaza un radio cero o negativo", () => {
    expect(() => isInsideGeofence(LOS_GUAYOS, { center: LOS_GUAYOS, radiusMeters: 0 })).toThrow(
      DomainValidationError,
    );
  });
});
