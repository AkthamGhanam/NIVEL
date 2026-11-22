import type { GeoPoint } from "@/lib/geo";

/**
 * Ubicación del teléfono en este momento, solo para marcar entrada y salida
 * (regla legal 8.7). No se sigue a la persona ni se guarda en el navegador.
 */

export const LOCATION_TIMEOUT_MS = 10_000;

export class LocationError extends Error {
  override readonly name = "LocationError";
}

/** Códigos de `GeolocationPositionError`. */
const PERMISSION_DENIED = 1;
const TIMEOUT = 3;

const MESSAGES = {
  unsupported: "Este teléfono no permite usar la ubicación desde el navegador.",
  denied: "No tenemos permiso para ver tu ubicación. Actívalo para marcar tu entrada.",
  timeout: "No logramos ubicarte a tiempo. Sal a un lugar abierto e intenta de nuevo.",
  unavailable: "No pudimos obtener tu ubicación. Intenta de nuevo.",
} as const;

function messageFor(code: number): string {
  if (code === PERMISSION_DENIED) return MESSAGES.denied;
  return code === TIMEOUT ? MESSAGES.timeout : MESSAGES.unavailable;
}

type Locator = Pick<Geolocation, "getCurrentPosition">;

const browserLocator = (): Locator | undefined =>
  typeof navigator === "undefined" ? undefined : navigator.geolocation;

export function currentPosition(locator: Locator | undefined = browserLocator()): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!locator) {
      reject(new LocationError(MESSAGES.unsupported));
      return;
    }
    locator.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
      (error) => reject(new LocationError(messageFor(error.code))),
      { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT_MS, maximumAge: 0 },
    );
  });
}
