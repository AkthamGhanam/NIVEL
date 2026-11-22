import { normalizeSpanish } from "./dates";
import type { GeoPoint } from "./geo";
import { ZONES } from "./zones";

/**
 * Estados y municipios de Venezuela para elegir zona de trabajo. Los puntos son
 * el centro aproximado de la capital de cada estado o municipio: nunca una dirección.
 * En la demo hay municipios cargados para los estados del centro del país; en los
 * demás se puede elegir el estado completo.
 */

interface StateInfo {
  readonly name: string;
  readonly capital: GeoPoint;
  readonly municipalities?: readonly string[];
}

const CARABOBO_POINTS: Readonly<Record<string, GeoPoint>> = {
  Valencia: ZONES.valencia.point,
  "Los Guayos": ZONES.losGuayos.point,
  "San Diego": ZONES.sanDiego.point,
  Naguanagua: ZONES.naguanagua.point,
  Guacara: ZONES.guacara.point,
  Libertador: ZONES.tocuyito.point,
  "Puerto Cabello": ZONES.puertoCabello.point,
};

export const STATES: readonly StateInfo[] = [
  { name: "Amazonas", capital: { lat: 5.66, lng: -67.62 } },
  { name: "Anzoátegui", capital: { lat: 10.13, lng: -64.69 } },
  { name: "Apure", capital: { lat: 7.89, lng: -67.47 } },
  {
    name: "Aragua",
    capital: { lat: 10.25, lng: -67.6 },
    municipalities: [
      "Bolívar",
      "Camatagua",
      "Francisco Linares Alcántara",
      "Girardot",
      "José Ángel Lamas",
      "José Félix Ribas",
      "José Rafael Revenga",
      "Libertador",
      "Mario Briceño Iragorry",
      "Ocumare de la Costa de Oro",
      "San Casimiro",
      "San Sebastián",
      "Santiago Mariño",
      "Santos Michelena",
      "Sucre",
      "Tovar",
      "Urdaneta",
      "Zamora",
    ],
  },
  { name: "Barinas", capital: { lat: 8.62, lng: -70.21 } },
  { name: "Bolívar", capital: { lat: 8.12, lng: -63.55 } },
  {
    name: "Carabobo",
    capital: ZONES.valencia.point,
    municipalities: [
      "Bejuma",
      "Carlos Arvelo",
      "Diego Ibarra",
      "Guacara",
      "Juan José Mora",
      "Libertador",
      "Los Guayos",
      "Miranda",
      "Montalbán",
      "Naguanagua",
      "Puerto Cabello",
      "San Diego",
      "San Joaquín",
      "Valencia",
    ],
  },
  { name: "Cojedes", capital: { lat: 9.66, lng: -68.58 } },
  { name: "Delta Amacuro", capital: { lat: 9.06, lng: -62.05 } },
  { name: "Distrito Capital", capital: { lat: 10.49, lng: -66.88 }, municipalities: ["Libertador"] },
  { name: "Falcón", capital: { lat: 11.4, lng: -69.67 } },
  { name: "Guárico", capital: { lat: 9.91, lng: -67.35 } },
  { name: "La Guaira", capital: { lat: 10.6, lng: -66.93 }, municipalities: ["Vargas"] },
  { name: "Lara", capital: { lat: 10.07, lng: -69.32 } },
  { name: "Mérida", capital: { lat: 8.59, lng: -71.15 } },
  {
    name: "Miranda",
    capital: { lat: 10.34, lng: -67.04 },
    municipalities: [
      "Acevedo",
      "Andrés Bello",
      "Baruta",
      "Brión",
      "Buroz",
      "Carrizal",
      "Chacao",
      "Cristóbal Rojas",
      "El Hatillo",
      "Guaicaipuro",
      "Independencia",
      "Lander",
      "Los Salias",
      "Páez",
      "Paz Castillo",
      "Pedro Gual",
      "Plaza",
      "Simón Bolívar",
      "Sucre",
      "Urdaneta",
      "Zamora",
    ],
  },
  { name: "Monagas", capital: { lat: 9.75, lng: -63.18 } },
  { name: "Nueva Esparta", capital: { lat: 11.03, lng: -63.86 } },
  { name: "Portuguesa", capital: { lat: 9.04, lng: -69.74 } },
  { name: "Sucre", capital: { lat: 10.45, lng: -64.17 } },
  { name: "Táchira", capital: { lat: 7.77, lng: -72.22 } },
  { name: "Trujillo", capital: { lat: 9.37, lng: -70.43 } },
  { name: "Yaracuy", capital: { lat: 10.34, lng: -68.74 } },
  { name: "Zulia", capital: { lat: 10.65, lng: -71.64 } },
];

export const STATE_NAMES = STATES.map((state) => state.name);

export const municipalitiesOf = (state: string): readonly string[] =>
  STATES.find((candidate) => candidate.name === state)?.municipalities ?? [];

export interface Place {
  readonly state: string;
  readonly municipality?: string | undefined;
}

/** Dónde trabaja una persona o una empresa: todo el país, unos estados o unos municipios. */
export type WorkArea =
  | { readonly scope: "nacional" }
  | { readonly scope: "estadal"; readonly states: readonly string[] }
  | { readonly scope: "municipal"; readonly places: readonly Required<Place>[] };

export const WORK_SCOPES = Object.freeze(["nacional", "estadal", "municipal"] as const);
export const WORK_SCOPE_LABELS: Readonly<Record<WorkArea["scope"], string>> = Object.freeze({
  nacional: "Todo el país",
  estadal: "Por estados",
  municipal: "Por municipios",
});

const isState = (name: string) => STATE_NAMES.includes(name);
const WRITTEN_NAME = /^\p{L}[\p{L} .'-]{1,59}$/u;

/** Estados con lista: el municipio sale de ella. Los demás aceptan un nombre escrito. */
export const hasMunicipalityList = (state: string): boolean => municipalitiesOf(state).length > 0;

const isMunicipality = (place: Place) => {
  if (place.municipality === undefined || !isState(place.state)) return false;
  return hasMunicipalityList(place.state)
    ? municipalitiesOf(place.state).includes(place.municipality)
    : WRITTEN_NAME.test(place.municipality);
};

/** Un lugar que llega del cliente, solo si existe: estado de la lista y municipio válido o ninguno. */
export function cleanPlace(place: Place): Place | undefined {
  const state = place.state.trim();
  const municipality = place.municipality?.trim().replace(/\s+/g, " ");
  if (!isState(state)) return undefined;
  if (!municipality) return { state };
  return isMunicipality({ state, municipality }) ? { state, municipality } : undefined;
}

/** Limpia una zona que llega del cliente: solo nombres de la lista, sin repetidos. */
export function cleanWorkArea(area: WorkArea): WorkArea | undefined {
  if (area.scope === "nacional") return area;
  if (area.scope === "estadal") {
    const states = [...new Set(area.states.filter(isState))];
    return states.length > 0 ? { scope: "estadal", states } : undefined;
  }
  const seen = new Set<string>();
  const places = area.places.filter((place) => {
    const key = `${place.state}/${place.municipality}`;
    if (!isMunicipality(place) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return places.length > 0 ? { scope: "municipal", places } : undefined;
}

/** Centro aproximado de un lugar: el municipio si lo conocemos, si no la capital del estado. */
export function pointOf(place: Place): GeoPoint {
  const state = STATES.find((candidate) => candidate.name === place.state);
  if (place.state === "Carabobo" && place.municipality && CARABOBO_POINTS[place.municipality]) {
    return CARABOBO_POINTS[place.municipality] as GeoPoint;
  }
  return state?.capital ?? ZONES.valencia.point;
}

/** El punto que representa una zona de trabajo: el primer lugar elegido. Todo el país: Valencia. */
export function anchorOf(area: WorkArea): GeoPoint {
  if (area.scope === "estadal") return pointOf({ state: area.states[0] ?? "Carabobo" });
  if (area.scope === "municipal") return pointOf(area.places[0] ?? { state: "Carabobo" });
  return ZONES.valencia.point;
}

const MAX_LISTED = 3;

const list = (names: readonly string[]) => {
  const shown = names.slice(0, MAX_LISTED);
  const rest = names.length - shown.length;
  const joined = shown.length > 1 ? `${shown.slice(0, -1).join(", ")} y ${shown.at(-1)}` : (shown[0] ?? "");
  return rest > 0 ? `${shown.join(", ")} y ${rest} más` : joined;
};

/** "Todo el país", "Carabobo y Aragua", "Valencia y San Diego (Carabobo)". */
export function describeWorkArea(area: WorkArea): string {
  if (area.scope === "nacional") return "Todo el país";
  if (area.scope === "estadal") return list(area.states);
  const states = [...new Set(area.places.map((place) => place.state))];
  const names = list(area.places.map((place) => place.municipality));
  return states.length === 1 ? `${names} (${states[0]})` : names;
}

export const describePlace = (place: Place): string =>
  place.municipality ? `${place.municipality}, ${place.state}` : place.state;

/** ¿Quien trabaja en esta zona puede ir a ese lugar? */
export function coversPlace(area: WorkArea, place: Place): boolean {
  if (area.scope === "nacional") return true;
  if (area.scope === "estadal") return area.states.includes(place.state);
  return area.places.some(
    (candidate) =>
      candidate.state === place.state &&
      (!place.municipality || candidate.municipality === place.municipality),
  );
}

/** Ubica un lugar dicho de palabra ("Valencia", "en Aragua") en la lista. */
export function findPlace(spoken: string): Place | undefined {
  const text = normalizeSpanish(spoken);
  for (const state of STATES) {
    const municipality = state.municipalities?.find((name) => text.includes(normalizeSpanish(name)));
    if (municipality && (text.includes(normalizeSpanish(state.name)) || state.name === "Carabobo")) {
      return { state: state.name, municipality };
    }
  }
  // Si nombra varios estados, el primero que dijo.
  const [first] = STATES.map((candidate) => ({
    name: candidate.name,
    at: text.indexOf(normalizeSpanish(candidate.name)),
  }))
    .filter((candidate) => candidate.at >= 0)
    .sort((a, b) => a.at - b.at);
  return first ? { state: first.name } : undefined;
}

const MAX_AREA_NAME = 80;

/** El nombre y el punto que se guardan para una zona de trabajo. */
export function locateArea(area: WorkArea): { name: string; point: GeoPoint; known: true } {
  return { name: describeWorkArea(area).slice(0, MAX_AREA_NAME), point: anchorOf(area), known: true };
}

const sameName = (a: string, b: string) => normalizeSpanish(a) === normalizeSpanish(b);

/** "carabobo" → "Carabobo". */
export const matchState = (spoken: string): string | undefined =>
  STATE_NAMES.find(
    (name) => sameName(name, spoken) || normalizeSpanish(spoken).includes(normalizeSpanish(name)),
  );

/** Un municipio dicho de palabra ("San Diego" o "San Diego, Carabobo"), buscado primero en los estados nombrados. */
export function matchMunicipality(spoken: string, states: readonly string[]): Required<Place> | undefined {
  const [namePart = spoken, statePart] = spoken.split(",");
  const preferred = statePart ? matchState(statePart) : undefined;
  const order = [...new Set([...(preferred ? [preferred] : []), ...states, ...STATE_NAMES])];
  for (const state of order) {
    const municipality = municipalitiesOf(state).find((name) => sameName(name, namePart));
    if (municipality) return { state, municipality };
  }
  return undefined;
}

/** La zona de trabajo armada con lo que dijo la persona a Nivi. */
export function spokenWorkArea(input: {
  readonly scope: WorkArea["scope"];
  readonly states: readonly string[];
  readonly municipalities: readonly string[];
}): WorkArea | undefined {
  if (input.scope === "nacional") return { scope: "nacional" };
  const states = input.states.map(matchState).filter((state): state is string => state !== undefined);
  if (input.scope === "estadal") return cleanWorkArea({ scope: "estadal", states });
  const places = input.municipalities
    .map((name) => matchMunicipality(name, states))
    .filter((place): place is Required<Place> => place !== undefined);
  return cleanWorkArea({ scope: "municipal", places });
}
