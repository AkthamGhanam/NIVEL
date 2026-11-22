/**
 * Errores de aplicación con su código HTTP. Los mensajes son aptos para
 * mostrarse al usuario: nunca incluyen detalles internos.
 */

export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;
  override get name(): string {
    return this.constructor.name;
  }
}

export class UnauthorizedError extends AppError {
  readonly status = 401;
  readonly code = "no_autenticado";
  constructor(message = "Primero elige con qué persona entrar.") {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  readonly status = 403;
  readonly code = "sin_permiso";
  constructor(message = "No tienes permiso para hacer esto.") {
    super(message);
  }
}

export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code = "no_encontrado";
  constructor(what: string) {
    super(`No encontramos ${what}.`);
  }
}

export class ConflictError extends AppError {
  readonly status = 409;
  readonly code = "conflicto";
}

export class PayloadTooLargeError extends AppError {
  readonly status = 413;
  readonly code = "cuerpo_demasiado_grande";
  constructor() {
    super("El contenido enviado es demasiado grande.");
  }
}

export class UnsupportedMediaTypeError extends AppError {
  readonly status = 415;
  readonly code = "formato_no_admitido";
  constructor() {
    super("El contenido debe enviarse como JSON.");
  }
}

export class RateLimitedError extends AppError {
  readonly status = 429;
  readonly code = "demasiadas_solicitudes";
  constructor(readonly retryAfterSeconds: number) {
    super("Demasiadas solicitudes. Espera unos segundos e intenta de nuevo.");
  }
}
