import type { AccessKey } from "@/client/demo-access";
import { MIN_PASSWORD } from "@/client/demo-access";
import type { WorkerSignupInput } from "@/client/worker-api";
import {
  type AvailabilityOption,
  birthDateProblem,
  type ExperienceKey,
  isCedula,
  skillsFor,
  yearsOf,
} from "@/lib/profile-options";
import type { Trade } from "@/lib/trades";
import type { WorkArea } from "@/lib/venezuela";

/** Lo que la persona va llenando en el registro escribiendo, paso por paso. */
export interface SignupDraft {
  readonly name: string;
  readonly birthDate: string;
  readonly cedula: string;
  readonly cedulaVerified: boolean;
  readonly trades: readonly Trade[];
  readonly experience: ExperienceKey | null;
  readonly skills: readonly string[];
  readonly workArea: WorkArea | null;
  readonly availability: AvailabilityOption | null;
  readonly nightShift: boolean;
  readonly password: string;
  readonly consent: boolean;
}

export type DraftKey = keyof SignupDraft;
export type DraftProblems = Partial<Record<DraftKey, string>>;

export const EMPTY_SIGNUP: SignupDraft = Object.freeze({
  name: "",
  birthDate: "",
  cedula: "",
  cedulaVerified: false,
  trades: [],
  experience: null,
  skills: [],
  workArea: null,
  availability: null,
  nightShift: false,
  password: "",
  consent: false,
});

export const SIGNUP_STEPS = Object.freeze([
  { title: "Tus datos", fields: ["name", "birthDate", "cedula"] },
  { title: "Tu oficio", fields: ["trades", "experience", "skills"] },
  { title: "Dónde y cuándo", fields: ["workArea", "availability"] },
  { title: "Tu cuenta", fields: ["password", "consent"] },
] as const satisfies ReadonlyArray<{ title: string; fields: readonly DraftKey[] }>);

const NAME = /^\p{L}[\p{L} .'-]{1,79}$/u;

function allProblems(draft: SignupDraft, today: string): DraftProblems {
  return {
    name: NAME.test(draft.name.trim()) ? undefined : "Escribe tu nombre y apellido.",
    birthDate: birthDateProblem(draft.birthDate, today),
    cedula: !isCedula(draft.cedula)
      ? "Escribe tu cédula, por ejemplo V-12345678."
      : draft.cedulaVerified
        ? undefined
        : "Toca Verificar para confirmar tu cédula.",
    trades: draft.trades.length > 0 ? undefined : "Elige al menos un oficio.",
    experience: draft.experience ? undefined : "Elige tu experiencia.",
    workArea: draft.workArea ? undefined : "Elige dónde quieres trabajar.",
    availability: draft.availability ? undefined : "Elige cuándo puedes trabajar.",
    password:
      draft.password.length >= MIN_PASSWORD ? undefined : `Usa al menos ${MIN_PASSWORD} letras o números.`,
    consent: draft.consent ? undefined : "Necesitamos tu permiso para guardar tus datos.",
  };
}

/** Problemas de un paso; vacío si se puede seguir. */
export function stepProblems(draft: SignupDraft, step: number, today: string): DraftProblems {
  const problems = allProblems(draft, today);
  const fields: readonly DraftKey[] = SIGNUP_STEPS[step]?.fields ?? [];
  return Object.fromEntries(fields.flatMap((field) => (problems[field] ? [[field, problems[field]]] : [])));
}

/** Al cambiar de oficios se quitan las habilidades que ya no corresponden. */
export function withTrades(draft: SignupDraft, trades: readonly Trade[]): SignupDraft {
  const allowed = new Set(skillsFor(trades));
  return { ...draft, trades, skills: draft.skills.filter((skill) => allowed.has(skill)) };
}

/** Lo que va al servidor y la llave que se queda en el teléfono. Solo con el borrador completo. */
export function toSignup(draft: SignupDraft): { input: WorkerSignupInput; access: AccessKey } | null {
  if (!draft.experience || !draft.workArea || !draft.availability || !draft.consent) return null;
  return {
    input: {
      name: draft.name.trim().replace(/\s+/g, " "),
      birthDate: draft.birthDate,
      trades: draft.trades,
      yearsExp: yearsOf(draft.experience),
      skills: draft.skills,
      workArea: draft.workArea,
      availability: draft.availability,
      nightShift: draft.nightShift,
      consent: true,
    },
    access: { document: draft.cedula, password: draft.password },
  };
}
