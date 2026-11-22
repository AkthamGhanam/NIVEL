import { describe, expect, it, vi } from "vitest";

import { errorMessage } from "./api";
import { currentPosition, LOCATION_TIMEOUT_MS, LocationError } from "./geolocation";

type Locator = NonNullable<Parameters<typeof currentPosition>[0]>;

const failing = (code: number): Locator => ({
  getCurrentPosition: (_ok, fail) => fail?.({ code } as GeolocationPositionError),
});

describe("ubicación para marcar entrada y salida", () => {
  it("pide una posición fresca y precisa, una sola vez, y devuelve solo latitud y longitud", async () => {
    const getCurrentPosition = vi.fn<Locator["getCurrentPosition"]>((ok) =>
      ok({ coords: { latitude: 10.19, longitude: -67.93, accuracy: 12 } } as GeolocationPosition),
    );

    await expect(currentPosition({ getCurrentPosition })).resolves.toEqual({ lat: 10.19, lng: -67.93 });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(getCurrentPosition.mock.calls[0]?.[2]).toEqual({
      enableHighAccuracy: true,
      timeout: LOCATION_TIMEOUT_MS,
      maximumAge: 0,
    });
  });

  it("explica con palabras cada motivo por el que no se pudo ubicar a la persona", async () => {
    await expect(currentPosition(failing(1))).rejects.toThrow("No tenemos permiso para ver tu ubicación");
    await expect(currentPosition(failing(3))).rejects.toThrow("No logramos ubicarte a tiempo");
    await expect(currentPosition(failing(2))).rejects.toThrow("No pudimos obtener tu ubicación");
    await expect(currentPosition(failing(1))).rejects.toBeInstanceOf(LocationError);
  });

  it("fuera del navegador, o en un teléfono sin ubicación, lo dice en vez de fallar en silencio", async () => {
    await expect(currentPosition()).rejects.toThrow("no permite usar la ubicación");
  });

  it("el mensaje de ubicación se le muestra a la persona tal cual; otros errores no filtran detalles", () => {
    expect(errorMessage(new LocationError("Sal a un lugar abierto."))).toBe("Sal a un lugar abierto.");
    expect(errorMessage(new Error("ECONNRESET 10.0.0.3"))).toBe(
      "Algo falló de nuestro lado. Intenta de nuevo.",
    );
  });
});
