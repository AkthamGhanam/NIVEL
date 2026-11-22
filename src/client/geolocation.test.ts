import { describe, expect, it, vi } from "vitest";

import { errorMessage } from "./api";
import {
  accuracyLabel,
  currentPosition,
  LOCATION_TIMEOUT_MS,
  LocationError,
  precisePosition,
} from "./geolocation";

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

describe("lectura precisa para fijar la obra y verificar llegadas", () => {
  type Watcher = NonNullable<NonNullable<Parameters<typeof precisePosition>[0]>["locator"]>;
  const fix = (accuracy: number, latitude = 10.19) =>
    ({ coords: { latitude, longitude: -67.93, accuracy } }) as GeolocationPosition;

  function watcher(readings: readonly GeolocationPosition[], denied = false) {
    const clearWatch = vi.fn();
    const locator: Watcher = {
      watchPosition: (ok, fail) => {
        if (denied) fail?.({ code: 1 } as GeolocationPositionError);
        for (const reading of readings) ok(reading);
        return 7;
      },
      clearWatch,
    };
    return { locator, clearWatch };
  }

  it("corta en cuanto llega una lectura buena y deja de escuchar", async () => {
    const { locator, clearWatch } = watcher([fix(300), fix(18, 10.2), fix(5, 10.3)]);

    await expect(precisePosition({ locator })).resolves.toEqual({ lat: 10.2, lng: -67.93, accuracyM: 18 });
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it("si ninguna es buena, al agotar el tiempo entrega la mejor que tuvo", async () => {
    const { locator } = watcher([fix(300), fix(60, 10.2), fix(90)]);

    await expect(precisePosition({ locator, windowMs: 5 })).resolves.toMatchObject({
      lat: 10.2,
      accuracyM: 60,
    });
  });

  it("sin permiso o sin ninguna lectura lo explica con palabras", async () => {
    await expect(precisePosition({ locator: watcher([], true).locator })).rejects.toThrow(
      "No tenemos permiso",
    );
    await expect(precisePosition({ locator: watcher([]).locator, windowMs: 5 })).rejects.toThrow(
      "No logramos ubicarte a tiempo",
    );
    await expect(precisePosition({ locator: undefined })).rejects.toThrow("no permite usar la ubicación");
  });

  it("muestra el margen de la lectura", () => {
    expect(accuracyLabel({ lat: 1, lng: 1, accuracyM: 11.6 })).toBe("±12 m");
    expect(accuracyLabel({ lat: 1, lng: 1 })).toBe("");
  });
});
