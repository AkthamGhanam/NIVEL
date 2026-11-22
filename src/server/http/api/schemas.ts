import { z } from "zod";

/** Identificadores propios: letras, números, guion y guion bajo. */
export const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "identificador inválido");

/** Parámetro de ruta validado (`/api/contracts/:id`). */
export const pathId = (params: Readonly<Record<string, string>>, name = "id"): string =>
  idSchema.parse(params[name]);

export const emptyBody = z.strictObject({});
