import { plural } from "@/lib/format";

import type { NiviMode } from "./nivi-session";
import type { MyProfile } from "./worker-api";

/**
 * Textos del registro por voz: lo que se le dice a la persona antes de pedirle
 * su voz y sus datos, y el resumen de lo que Nivi entendió. Sin React ni red.
 */

/** Sección 7.8 de la especificación: aviso para una persona real que prueba la demo en el evento. */
export const REAL_PERSON_NOTICE =
  "Esto es una prueba de un proyecto de hackathon. Guardamos tu nombre, oficio y zona para mostrar que la " +
  "app funciona. Puedes borrarlo cuando quieras en Mis datos.";

/** Lo que la persona acepta al registrarse hablando: cada punto es una promesa que la app cumple. */
export const VOICE_CONSENT_POINTS: readonly string[] = Object.freeze([
  "Nivi te pregunta tu nombre, tu oficio, tu experiencia, tu zona y cuándo puedes trabajar.",
  "Tu voz la procesa ElevenLabs, nuestro proveedor de voz, para entenderte y responderte. NIVEL no guarda el audio.",
  "Tu perfil no se muestra a ninguna empresa hasta que tú lo actives en Mis datos.",
  "Puedes ver, corregir o borrar tus datos cuando quieras.",
  "Solo para personas mayores de 18 años.",
]);

export const PRIVACY_AUDIO_URL = "/audio/privacidad.mp3";

/** Solo `?real=1` marca a una persona real del evento; cualquier otro valor se ignora. */
export const isRealVisitor = (value: unknown): boolean => value === "1";

export interface ConsentChoice {
  readonly label: string;
  readonly mode: NiviMode;
}

/** Las dos formas de aceptar: hablando (nota de voz) o escribiendo. Las dos dicen que se acepta. */
export const CONSENT_CHOICES: readonly ConsentChoice[] = Object.freeze([
  { label: "Acepto y quiero hablar con Nivi", mode: "nota" },
  { label: "Acepto, pero prefiero escribir", mode: "texto" },
]);

export interface HeardFact {
  readonly label: string;
  readonly value: string;
}

type HeardProfile = Pick<MyProfile, "name" | "tradeLabel" | "yearsExp" | "skills" | "zone" | "availability">;

/** "Esto entendimos": lo que quedó guardado, para que la persona lo compruebe antes de seguir. */
export function heardFacts(profile: HeardProfile): HeardFact[] {
  return [
    { label: "Nombre", value: profile.name },
    { label: "Oficio", value: profile.tradeLabel },
    { label: "Experiencia", value: plural(profile.yearsExp, "año", "años") },
    { label: "Técnicas", value: profile.skills.length > 0 ? profile.skills.join(", ") : "Sin anotar" },
    { label: "Zona", value: profile.zone },
    { label: "Disponibilidad", value: profile.availability },
  ];
}
