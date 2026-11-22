/**
 * Etiquetas positivas de una calificación privada. Lista cerrada: no hay texto
 * libre visible para la otra parte. La clave dice quién califica.
 */
export const RATING_TAGS = Object.freeze({
  empresa: ["Trabajo prolijo", "Puntual", "Cumple normas de seguridad", "Buen compañero", "Resuelve solo"],
  trabajador: ["Pagó a tiempo", "Buen trato", "Equipo de protección completo", "Obra ordenada"],
} as const);

export type RatingRole = keyof typeof RATING_TAGS;

/** Categorías que se califican del 1 al 5, con el nombre que ve quien califica. */
export const RATING_CATEGORIES = Object.freeze([
  { key: "quality", label: "Calidad del trabajo" },
  { key: "punctuality", label: "Puntualidad" },
  { key: "safety", label: "Seguridad" },
  { key: "attitude", label: "Actitud" },
] as const);

export type RatingCategory = (typeof RATING_CATEGORIES)[number]["key"];
