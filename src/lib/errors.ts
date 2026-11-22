/** Error de entrada inválida en una regla de negocio. El mensaje es apto para mostrarse. */
export class DomainValidationError extends Error {
  override readonly name = "DomainValidationError";
}

/** Falla si la condición no se cumple. Mantiene las validaciones en una línea. */
export function ensure(condition: boolean, message: string): asserts condition {
  if (!condition) throw new DomainValidationError(message);
}
