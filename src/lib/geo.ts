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
