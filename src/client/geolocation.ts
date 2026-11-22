import type { GeoFix, GeoPoint } from "@/lib/geo";

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

/**
 * Lectura precisa: el primer dato del GPS suele venir de antenas o wifi y puede
 * errar cientos de metros. Se escucha unos segundos, se queda con la mejor
 * lectura y se corta en cuanto llega una buena. Sirve para fijar la obra y
 * para verificar una llegada con señal regular.
 */
export const GOOD_ACCURACY_M = 25;
export const PRECISE_WINDOW_MS = 12_000;

type Watcher = Pick<Geolocation, "watchPosition" | "clearWatch">;

interface PreciseOptions {
  readonly locator?: Watcher | undefined;
  readonly windowMs?: number;
  readonly goodAccuracyM?: number;
}

const browserWatcher = (): Watcher | undefined =>
  typeof navigator === "undefined" ? undefined : navigator.geolocation;

export function precisePosition(options: PreciseOptions = {}): Promise<GeoFix> {
  const locator = "locator" in options ? options.locator : browserWatcher();
  const windowMs = options.windowMs ?? PRECISE_WINDOW_MS;
  const goodAccuracyM = options.goodAccuracyM ?? GOOD_ACCURACY_M;
  return new Promise((resolve, reject) => {
    if (!locator) {
      reject(new LocationError(MESSAGES.unsupported));
      return;
    }
    let best: GeoFix | undefined;
    let done = false;
    const watch: { id?: number } = {};
    const finish = (failure?: LocationError) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (watch.id !== undefined) locator.clearWatch(watch.id);
      if (best) resolve(best);
      else reject(failure ?? new LocationError(MESSAGES.timeout));
    };
    const timer = setTimeout(() => finish(), windowMs);
    watch.id = locator.watchPosition(
      ({ coords }) => {
        const fix = { lat: coords.latitude, lng: coords.longitude, accuracyM: coords.accuracy };
        if (!best || (fix.accuracyM ?? Infinity) < (best.accuracyM ?? Infinity)) best = fix;
        if (coords.accuracy <= goodAccuracyM) finish();
      },
      (error) => {
        // Sin permiso no hay nada que esperar; otros fallos pueden ser pasajeros dentro de la ventana.
        if (error.code === PERMISSION_DENIED) finish(new LocationError(MESSAGES.denied));
      },
      { enableHighAccuracy: true, timeout: windowMs, maximumAge: 0 },
    );
    // Si el navegador respondió antes de devolver el id, la escucha se cierra aquí.
    if (done) locator.clearWatch(watch.id);
  });
}

/** "±12 m": el margen de la lectura, para que la persona sepa qué tan buena fue. */
export function accuracyLabel(fix: GeoFix): string {
  return fix.accuracyM === undefined ? "" : `±${Math.max(1, Math.round(fix.accuracyM))} m`;
}
