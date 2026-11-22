import { describe, expect, it } from "vitest";

import { approximateDistance, checkArrival, type GeoPoint } from "./geo";

const SITE: GeoPoint = { lat: 10.186, lng: -67.938 };
const FENCE = { center: SITE, radiusMeters: 120 };
/** Un grado de latitud son unos 111,2 km. */
const north = (meters: number): GeoPoint => ({ lat: SITE.lat + meters / 111_195, lng: SITE.lng });

describe("verificar la llegada a la obra", () => {
  it("dentro del radio cuenta como llegada, con o sin margen de error", () => {
    expect(checkArrival(north(100), FENCE)).toEqual({ verdict: "dentro", distanceM: 100 });
    expect(checkArrival({ ...north(100), accuracyM: 15 }, FENCE).verdict).toBe("dentro");
  });

  it("el margen de error del GPS cuenta a favor de la persona, pero con tope", () => {
    expect(checkArrival({ ...north(160), accuracyM: 50 }, FENCE).verdict).toBe("dentro");
    expect(checkArrival({ ...north(160), accuracyM: 20 }, FENCE).verdict).toBe("fuera");
    // Un margen enorme no convierte cualquier lugar en la obra: el tope es de 80 m.
    expect(checkArrival({ ...north(230), accuracyM: 200 }, FENCE).verdict).toBe("fuera");
  });

  it("con una lectura inservible no acusa a nadie de estar fuera: pide otra", () => {
    expect(checkArrival({ ...north(300), accuracyM: 400 }, FENCE).verdict).toBe("senal_debil");
    // Lejos de verdad sigue siendo fuera, por mala que sea la señal.
    expect(checkArrival({ ...north(2000), accuracyM: 400 }, FENCE).verdict).toBe("fuera");
  });

  it("ignora márgenes que no son un número válido", () => {
    expect(checkArrival({ ...north(160), accuracyM: Number.NaN }, FENCE).verdict).toBe("fuera");
    expect(checkArrival({ ...north(160), accuracyM: -5 }, FENCE).verdict).toBe("fuera");
  });

  it("dice la distancia como la diría una persona", () => {
    expect(approximateDistance(4)).toBe("unos 10 m");
    expect(approximateDistance(347)).toBe("unos 350 m");
    expect(approximateDistance(2400)).toBe("unos 2,4 km");
  });
});
