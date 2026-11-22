import { ensure } from "./errors";

export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const METERS_PER_KM = 1000;
const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

export function assertValidPoint(point: GeoPoint): void {
  ensure(Number.isFinite(point.lat) && Math.abs(point.lat) <= MAX_LATITUDE, "Latitud fuera de rango");
  ensure(Number.isFinite(point.lng) && Math.abs(point.lng) <= MAX_LONGITUDE, "Longitud fuera de rango");
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Distancia en línea recta (gran círculo) en kilómetros. */
export function haversineKm(from: GeoPoint, to: GeoPoint): number {
  assertValidPoint(from);
  assertValidPoint(to);
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface Geofence {
  readonly center: GeoPoint;
  readonly radiusMeters: number;
}

/** ¿El punto está dentro de la geocerca de la obra? El borde cuenta como dentro. */
export function isInsideGeofence(point: GeoPoint, fence: Geofence): boolean {
  ensure(fence.radiusMeters > 0, "El radio de la geocerca debe ser mayor que cero");
  return haversineKm(point, fence.center) * METERS_PER_KM <= fence.radiusMeters;
}

/** Un punto con el margen de error que reporta el GPS del teléfono, en metros. */
export interface GeoFix extends GeoPoint {
  readonly accuracyM?: number | undefined;
}

/** Margen de error del GPS que se tolera como máximo al comparar con la geocerca. */
export const MAX_TOLERATED_ACCURACY_M = 80;
/** Con un margen mayor a este la lectura no sirve para decidir: se pide otra. */
export const UNUSABLE_ACCURACY_M = 250;
/** La obra solo se fija con una lectura buena: de ella depende verificar cada llegada. */
export const SITE_PIN_MAX_ACCURACY_M = 100;

export type ArrivalVerdict = "dentro" | "fuera" | "senal_debil";

export interface ArrivalCheck {
  readonly verdict: ArrivalVerdict;
  /** Distancia al centro de la obra, redondeada a metros. */
  readonly distanceM: number;
}

const usableAccuracy = (accuracyM: number | undefined) =>
  accuracyM !== undefined && Number.isFinite(accuracyM) && accuracyM > 0 ? accuracyM : 0;

/**
 * ¿La persona llegó a la obra? El GPS de un teléfono nunca es exacto, así que
 * su margen de error cuenta a favor de la persona, con un tope. Si la lectura
 * es demasiado imprecisa para decidir, no se le dice "estás fuera": se le pide
 * otra lectura.
 */
export function checkArrival(fix: GeoFix, fence: Geofence): ArrivalCheck {
  ensure(fence.radiusMeters > 0, "El radio de la geocerca debe ser mayor que cero");
  const distanceM = Math.round(haversineKm(fix, fence.center) * METERS_PER_KM);
  const accuracyM = usableAccuracy(fix.accuracyM);
  if (distanceM <= fence.radiusMeters + Math.min(accuracyM, MAX_TOLERATED_ACCURACY_M)) {
    return { verdict: "dentro", distanceM };
  }
  const couldBeInside = distanceM - accuracyM <= fence.radiusMeters;
  return { verdict: accuracyM > UNUSABLE_ACCURACY_M && couldBeInside ? "senal_debil" : "fuera", distanceM };
}

const ROUND_TO_M = 10;
const KM_THRESHOLD_M = 1000;

/** "unos 350 m" o "unos 2,4 km": distancia dicha como la diría una persona. */
export function approximateDistance(distanceM: number): string {
  if (distanceM >= KM_THRESHOLD_M) {
    return `unos ${(distanceM / METERS_PER_KM).toFixed(1).replace(".", ",")} km`;
  }
  return `unos ${Math.max(ROUND_TO_M, Math.round(distanceM / ROUND_TO_M) * ROUND_TO_M)} m`;
}
