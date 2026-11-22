/**
 * Etiquetas positivas de una calificación privada. Lista cerrada: no hay texto
 * libre visible para la otra parte. La clave dice quién califica.
 */
export const RATING_TAGS = Object.freeze({
  empresa: ["Trabajo prolijo", "Puntual", "Cumple normas de seguridad", "Buen compañero", "Resuelve solo"],
  trabajador: ["Pagó a tiempo", "Buen trato", "Equipo de protección completo", "Obra ordenada"],
} as const);

export type RatingRole = keyof typeof RATING_TAGS;

export type RatingCategory = "quality" | "punctuality" | "safety" | "attitude";

export interface RatingCategoryLabel {
  readonly key: RatingCategory;
  readonly label: string;
}

/**
 * Las cuatro categorías que se califican del 1 al 5, con el nombre que ve
 * quien califica: la empresa evalúa el trabajo; el trabajador, a la empresa.
 */
export const RATING_CATEGORIES: Readonly<Record<RatingRole, readonly RatingCategoryLabel[]>> = Object.freeze({
  empresa: [
    { key: "quality", label: "Calidad del trabajo" },
    { key: "punctuality", label: "Puntualidad" },
    { key: "safety", label: "Seguridad" },
    { key: "attitude", label: "Actitud" },
  ],
  trabajador: [
    { key: "quality", label: "Condiciones de la obra" },
    { key: "punctuality", label: "Pago a tiempo" },
    { key: "safety", label: "Seguridad" },
    { key: "attitude", label: "Trato" },
  ],
});
