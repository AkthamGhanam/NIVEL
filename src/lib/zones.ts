import { normalizeSpanish } from "./dates";
import type { GeoPoint } from "./geo";

/**
 * Municipios y sectores de Carabobo que la demo sabe ubicar. Los puntos son
 * el centro aproximado de cada zona: nunca se pide ni se guarda una dirección exacta.
 */
export const ZONES = {
  valencia: { name: "Valencia", point: { lat: 10.162, lng: -68.007 } },
  losGuayos: { name: "Los Guayos", point: { lat: 10.186, lng: -67.938 } },
  sanDiego: { name: "San Diego", point: { lat: 10.258, lng: -67.954 } },
  naguanagua: { name: "Naguanagua", point: { lat: 10.257, lng: -68.012 } },
  guacara: { name: "Guacara", point: { lat: 10.232, lng: -67.877 } },
  tocuyito: { name: "Tocuyito", point: { lat: 10.104, lng: -68.073 } },
  puertoCabello: { name: "Puerto Cabello", point: { lat: 10.473, lng: -68.012 } },
  moron: { name: "Morón", point: { lat: 10.488, lng: -68.2 } },
} as const satisfies Record<string, { name: string; point: GeoPoint }>;

export type ZoneKey = keyof typeof ZONES;

export interface LocatedZone {
  readonly name: string;
  readonly point: GeoPoint;
  /** Falso si no reconocimos la zona y usamos el centro de Valencia como aproximación. */
  readonly known: boolean;
}

const MAX_ZONE_LENGTH = 80;

/** Ubica una zona dicha de palabra ("vivo por los guayos") en un punto aproximado. */
export function locateZone(spoken: string): LocatedZone {
  const text = normalizeSpanish(spoken);
  const match = Object.values(ZONES).find((zone) => text.includes(normalizeSpanish(zone.name)));
  if (match) return { name: match.name, point: match.point, known: true };
  const name = spoken.trim().replace(/\s+/g, " ").slice(0, MAX_ZONE_LENGTH);
  return { name, point: ZONES.valencia.point, known: false };
}
