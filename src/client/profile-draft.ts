import type { MyProfile, ProfileCorrection } from "./worker-api";

/**
 * Formulario "Corregir mis datos": lo que la persona escribe, como texto, y
 * su paso a una corrección que solo lleva lo que de verdad cambió. Las reglas
 * repiten las del servidor para avisar antes; quien decide es el servidor.
 */

export interface ProfileDraft {
  readonly name: string;
  readonly zone: string;
  readonly availability: string;
  readonly yearsExp: string;
  /** Habilidades separadas por comas. */
  readonly skills: string;
}

/** Lo que la persona puede corregir de su perfil. */
export type EditableProfile = Pick<MyProfile, "name" | "zone" | "availability" | "yearsExp" | "skills">;

export type ProfileField = keyof ProfileDraft;
export type ProfileProblems = Partial<Record<ProfileField, string>>;

export const PROFILE_LIMITS = Object.freeze({ text: 80, years: 60, skills: 12, skill: 40 });

const NAME_PATTERN = /^\p{L}[\p{L} .'-]{1,79}$/u;
const tidy = (text: string) => text.trim().replace(/\s+/g, " ");

export const profileDraft = (profile: EditableProfile): ProfileDraft => ({
  name: profile.name,
  zone: profile.zone,
  availability: profile.availability,
  yearsExp: String(profile.yearsExp),
  skills: profile.skills.join(", "),
});

const splitSkills = (text: string): string[] => text.split(",").map(tidy).filter(Boolean);

function problemsOf(draft: ProfileDraft): ProfileProblems {
  const problems: ProfileProblems = {};
  const shortText = (text: string) => {
    const clean = tidy(text);
    return clean.length >= 2 && clean.length <= PROFILE_LIMITS.text;
  };
  if (!NAME_PATTERN.test(tidy(draft.name))) problems.name = "Escribe tu nombre solo con letras.";
  if (!shortText(draft.zone)) problems.zone = "Escribe tu municipio o sector.";
  if (!shortText(draft.availability)) problems.availability = "Di cuándo puedes trabajar.";
  const years = Number(draft.yearsExp.trim());
  if (draft.yearsExp.trim() === "" || !Number.isInteger(years) || years < 0 || years > PROFILE_LIMITS.years)
    problems.yearsExp = `Escribe tus años de experiencia, de 0 a ${PROFILE_LIMITS.years}.`;
  const skills = splitSkills(draft.skills);
  if (skills.length > PROFILE_LIMITS.skills)
    problems.skills = `Escribe hasta ${PROFILE_LIMITS.skills} habilidades.`;
  else if (skills.some((skill) => skill.length > PROFILE_LIMITS.skill))
    problems.skills = `Cada habilidad puede tener hasta ${PROFILE_LIMITS.skill} letras.`;
  return problems;
}

export type ParsedProfile =
  | { readonly ok: true; readonly changes: ProfileCorrection }
  | { readonly ok: false; readonly problems: ProfileProblems };

/** Valida el formulario y devuelve solo los campos que cambiaron respecto al perfil actual. */
export function parseProfileDraft(draft: ProfileDraft, profile: EditableProfile): ParsedProfile {
  const problems = problemsOf(draft);
  if (Object.keys(problems).length > 0) return { ok: false, problems };
  const skills = splitSkills(draft.skills);
  const years = Number(draft.yearsExp.trim());
  const changes: ProfileCorrection = {
    ...(tidy(draft.name) !== profile.name && { name: tidy(draft.name) }),
    ...(tidy(draft.zone) !== profile.zone && { zone: tidy(draft.zone) }),
    ...(tidy(draft.availability) !== profile.availability && { availability: tidy(draft.availability) }),
    ...(years !== profile.yearsExp && { yearsExp: years }),
    ...(skills.join("|") !== profile.skills.join("|") && { skills }),
  };
  return { ok: true, changes };
}
