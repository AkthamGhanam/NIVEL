import type { GeoPoint } from "@/lib/geo";
import type { Level } from "@/lib/level";
import type { Trade } from "@/lib/trades";
import { type ZoneKey, ZONES } from "@/lib/zones";

/**
 * Elenco y lugares del seed canónico (docs/spec.md, sección 5.2).
 * Todo es de ejemplo: nombres, empresas y cifras inventados para la demo.
 */

export { ZONES, type ZoneKey };

export const SITE = {
  name: "Obra Los Guayos",
  address: "Av. Principal de Los Guayos",
  point: ZONES.losGuayos.point,
  geofenceMeters: 120,
} as const;

const KM_PER_DEGREE_LATITUDE = 111.195;

/** Punto a `km` kilómetros al norte de la obra: fija la distancia exacta del guion. */
export const northOfSite = (km: number): GeoPoint => ({
  lat: Number((SITE.point.lat + km / KM_PER_DEGREE_LATITUDE).toFixed(6)),
  lng: SITE.point.lng,
});

export const IDS = {
  activeCompany: "co-guayos",
  academy: "ac-carabobo",
  workshop: "ac-taller-guayos",
  paidCourse: "cu-smaw",
  freeCourse: "cu-seguridad",
  carlos: "w-carlos",
  rafael: "w-rafael",
  jose: "w-jose",
  luis: "w-luis",
  andres: "w-andres",
} as const;

export const COMPANIES = [
  { id: IDS.activeCompany, name: "Constructora Los Guayos", rif: "J-50123456-7", zone: "losGuayos" },
  { id: "co-moron", name: "Talleres Morón", rif: "J-50234567-8", zone: "moron" },
  { id: "co-prado", name: "Herrería El Prado", rif: "J-50345678-9", zone: "valencia" },
  { id: "co-tocuyito", name: "Metálicas Tocuyito", rif: "J-50456789-0", zone: "tocuyito" },
] as const satisfies ReadonlyArray<{ id: string; name: string; rif: string; zone: ZoneKey }>;

export interface CastMember {
  readonly id: string;
  readonly name: string;
  readonly trade: Trade;
  readonly level: Level;
  readonly yearsExp: number;
  readonly skills: readonly string[];
  readonly zone: ZoneKey;
  /** Si se indica, vive a esta distancia exacta al norte de la obra. */
  readonly kmFromSite?: number;
  readonly confirmedJobs: number;
  readonly practicalPassed: boolean;
  readonly certificateCodes: readonly string[];
  /** Ocupado en otra obra durante la semana de la demo. */
  readonly busyThisWeek?: boolean;
}

type CastInput = Omit<CastMember, "skills" | "practicalPassed" | "certificateCodes"> &
  Partial<Pick<CastMember, "skills" | "practicalPassed" | "certificateCodes">>;

const member = (input: CastInput): CastMember => ({
  skills: [],
  practicalPassed: input.level >= 2,
  certificateCodes: [],
  ...input,
});

/** Protagonistas del camino dorado: datos exactos del guion. */
const STARS: readonly CastMember[] = [
  member({
    id: IDS.rafael,
    name: "Rafael Torres",
    trade: "soldador",
    level: 3,
    yearsExp: 6,
    skills: ["SMAW", "MIG"],
    zone: "losGuayos",
    kmFromSite: 4,
    confirmedJobs: 5,
  }),
  member({
    id: IDS.jose,
    name: "José Pérez",
    trade: "soldador",
    level: 3,
    yearsExp: 5,
    skills: ["SMAW"],
    zone: "losGuayos",
    kmFromSite: 6,
    confirmedJobs: 4,
  }),
  member({
    id: IDS.luis,
    name: "Luis Mendoza",
    trade: "soldador",
    level: 3,
    yearsExp: 4,
    skills: ["SMAW", "oxicorte"],
    zone: "guacara",
    kmFromSite: 9,
    confirmedJobs: 3,
  }),
  member({
    id: IDS.carlos,
    name: "Carlos Rodríguez",
    trade: "soldador",
    level: 2,
    yearsExp: 2,
    skills: ["SMAW"],
    zone: "losGuayos",
    kmFromSite: 1.2,
    confirmedJobs: 2,
    certificateCodes: ["C-2041"],
  }),
  member({
    id: "w-pedro",
    name: "Pedro Gil",
    trade: "soldador",
    level: 2,
    yearsExp: 3,
    skills: ["SMAW"],
    zone: "sanDiego",
    kmFromSite: 12,
    confirmedJobs: 1,
  }),
  member({
    id: "w-ramon",
    name: "Ramón Díaz",
    trade: "soldador",
    level: 2,
    yearsExp: 1,
    skills: ["SMAW"],
    zone: "sanDiego",
    kmFromSite: 20,
    confirmedJobs: 0,
    practicalPassed: false,
    certificateCodes: ["C-2050"],
  }),
  member({
    id: IDS.andres,
    name: "Andrés Silva",
    trade: "soldador",
    level: 5,
    yearsExp: 15,
    skills: ["SMAW", "TIG", "MIG", "lectura de planos"],
    zone: "valencia",
    confirmedJobs: 25,
    certificateCodes: ["C-1002", "C-1003"],
    busyThisWeek: true,
  }),
];

/** Soldadores que NO deben cumplir la búsqueda del guion (nivel 1 o a más de 25 km). */
const OTHER_WELDERS: readonly CastMember[] = [
  member({
    id: "w-011",
    name: "Yorman Blanco",
    trade: "soldador",
    level: 1,
    yearsExp: 1,
    skills: ["SMAW"],
    zone: "losGuayos",
    confirmedJobs: 0,
  }),
  member({
    id: "w-012",
    name: "Kelvin Rojas",
    trade: "soldador",
    level: 1,
    yearsExp: 0,
    zone: "valencia",
    confirmedJobs: 0,
  }),
  member({
    id: "w-013",
    name: "Héctor Salas",
    trade: "soldador",
    level: 3,
    yearsExp: 8,
    skills: ["SMAW", "TIG"],
    zone: "moron",
    confirmedJobs: 3,
  }),
  member({
    id: "w-014",
    name: "Freddy Colina",
    trade: "soldador",
    level: 2,
    yearsExp: 3,
    skills: ["MIG"],
    zone: "puertoCabello",
    confirmedJobs: 0,
  }),
];

type Extra = readonly [
  name: string,
  trade: Trade,
  level: Level,
  zone: ZoneKey,
  yearsExp: number,
  jobs: number,
];

const EXTRAS: readonly Extra[] = [
  ["Miguel Ángel Herrera", "electricista", 4, "valencia", 12, 10],
  ["Jesús Contreras", "electricista", 3, "naguanagua", 7, 3],
  ["Daniela Méndez", "electricista", 2, "sanDiego", 3, 1],
  ["Wilmer Ochoa", "electricista", 2, "guacara", 4, 0],
  ["Ángel Figueroa", "electricista", 1, "tocuyito", 1, 0],
  ["Rosa Elena Pinto", "electricista", 1, "valencia", 2, 0],
  ["Edgar Montilla", "electricista", 3, "puertoCabello", 9, 4],
  ["Juan Carlos Zambrano", "albanil", 3, "losGuayos", 10, 4],
  ["Néstor Guevara", "albanil", 2, "guacara", 6, 2],
  ["Óscar Bracho", "albanil", 2, "valencia", 5, 1],
  ["Alexis Padrón", "albanil", 1, "tocuyito", 2, 0],
  ["Ramiro Uzcátegui", "albanil", 1, "naguanagua", 3, 0],
  ["Douglas Arráiz", "albanil", 3, "sanDiego", 11, 3],
  ["Gregorio Linares", "albanil", 1, "moron", 1, 0],
  ["Yusmary Castillo", "albanil", 2, "losGuayos", 4, 1],
  ["Víctor Manuel Ruiz", "plomero", 3, "valencia", 9, 3],
  ["Eduardo Camacho", "plomero", 2, "naguanagua", 5, 1],
  ["Simón Rivas", "plomero", 1, "guacara", 1, 0],
  ["Leonardo Peña", "plomero", 2, "puertoCabello", 6, 0],
  ["Marcos Tovar", "plomero", 1, "tocuyito", 2, 0],
  ["Carmen Aponte", "pintor", 2, "valencia", 4, 1],
  ["Richard Sequera", "pintor", 3, "sanDiego", 8, 3],
  ["Julio César Mata", "pintor", 1, "losGuayos", 1, 0],
  ["Nelson Barrios", "pintor", 1, "guacara", 2, 0],
  ["Argenis Lugo", "pintor", 2, "naguanagua", 5, 2],
  ["Franklin Urbina", "otro", 2, "valencia", 6, 1],
  ["Maryuri Sánchez", "otro", 1, "tocuyito", 1, 0],
  ["Reinaldo Marín", "otro", 3, "moron", 12, 3],
  ["Omar Villegas", "otro", 1, "puertoCabello", 3, 0],
];

const FIRST_EXTRA_NUMBER = 15;

const EXTRA_MEMBERS: readonly CastMember[] = EXTRAS.map(
  ([name, trade, level, zone, yearsExp, confirmedJobs], index) =>
    member({
      id: `w-${String(FIRST_EXTRA_NUMBER + index).padStart(3, "0")}`,
      name,
      trade,
      level,
      zone,
      yearsExp,
      confirmedJobs,
    }),
);

export const CAST: readonly CastMember[] = [...STARS, ...OTHER_WELDERS, ...EXTRA_MEMBERS];
