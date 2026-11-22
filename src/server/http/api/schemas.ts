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

const placeName = z.string().trim().min(2).max(60);

/** Un estado, con su municipio si se eligió. Los nombres se revisan contra la lista en el caso de uso. */
export const placeSchema = z.strictObject({ state: placeName, municipality: placeName.optional() });

/** Dónde trabaja alguien: todo el país, unos estados o unos municipios. */
export const workAreaSchema = z.discriminatedUnion("scope", [
  z.strictObject({ scope: z.literal("nacional") }),
  z.strictObject({ scope: z.literal("estadal"), states: z.array(placeName).min(1).max(24) }),
  z.strictObject({
    scope: z.literal("municipal"),
    places: z
      .array(z.strictObject({ state: placeName, municipality: placeName }))
      .min(1)
      .max(30),
  }),
]);

/** Hora del día, "07:00". */
export const clockSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Escribe la hora como 07:00");
