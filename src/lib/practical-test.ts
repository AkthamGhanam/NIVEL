/**
 * Regla de la prueba práctica: se aprueba con 3 de cada 4 criterios. La usan
 * el servidor, que decide, y el panel de la academia, que la explica.
 */

export const PASSING_RATIO = 0.75;

/** Nota mínima para aprobar: con 4 criterios son 3; con 10, son 8. */
export const passingScore = (maxScore: number): number => Math.ceil(maxScore * PASSING_RATIO);

export const passes = (score: number, maxScore: number): boolean => score >= passingScore(maxScore);
