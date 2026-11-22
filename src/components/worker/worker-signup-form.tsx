// Crear el perfil del trabajador escribiendo: cuatro pasos cortos, casi todo para tocar.
"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import type { AccessKey } from "@/client/demo-access";
import type { WorkerSignupInput } from "@/client/worker-api";
import { CedulaCheck, PasswordField } from "@/components/access/account-key";
import { Button } from "@/components/ui/button";
import { ChoiceChips, chipClass, single, toggled } from "@/components/ui/choice-chips";
import { TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Progress } from "@/components/ui/progress";
import { WorkAreaPicker } from "@/components/ui/work-area-picker";
import { localDate } from "@/lib/dates";
import {
  AVAILABILITY_OPTIONS,
  EXPERIENCE_RANGES,
  type ExperienceKey,
  MIN_WORK_AGE,
  skillsFor,
} from "@/lib/profile-options";
import { TRADE_LABELS, TRADES, type Trade } from "@/lib/trades";

import {
  type DraftProblems,
  EMPTY_SIGNUP,
  SIGNUP_STEPS,
  type SignupDraft,
  stepProblems,
  toSignup,
  withTrades,
} from "./signup-draft";

interface WorkerSignupFormProps {
  readonly onSubmit: (input: WorkerSignupInput, access: AccessKey) => void;
  readonly pending: boolean;
  readonly error: string | null;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const TRADE_CHOICES = TRADES.map((trade) => ({
  value: trade,
  label: trade === "otro" ? "Otro oficio" : capitalize(TRADE_LABELS[trade].singular),
}));
const EXPERIENCE_CHOICES = EXPERIENCE_RANGES.map((range) => ({ value: range.key, label: range.label }));
const AVAILABILITY_CHOICES = AVAILABILITY_OPTIONS.map((option) => ({ value: option, label: option }));
const LINK = "font-semibold text-brand underline decoration-2";

/** El calendario solo deja elegir fechas de personas entre 18 y 100 años. */
function birthDateBounds(today: string) {
  const [year = 2000, rest] = [Number(today.slice(0, 4)), today.slice(4)];
  return { max: `${year - MIN_WORK_AGE}${rest}`, min: `${year - 100}${rest}` };
}

interface StepProps {
  readonly draft: SignupDraft;
  readonly problems: DraftProblems;
  readonly update: (changes: Partial<SignupDraft>) => void;
}

function AboutYouStep({ draft, problems, update }: StepProps) {
  const bounds = birthDateBounds(localDate(new Date()));
  return (
    <>
      <TextField
        id="registro-nombre"
        label="Nombre y apellido"
        placeholder="Ej: María Pérez"
        autoComplete="name"
        maxLength={80}
        value={draft.name}
        error={problems.name}
        onChange={(event) => update({ name: event.target.value })}
      />
      <TextField
        id="registro-nacimiento"
        label="Fecha de nacimiento"
        type="date"
        min={bounds.min}
        max={bounds.max}
        value={draft.birthDate}
        hint="Toca y elige el día en el calendario. Solo la usamos para confirmar que tienes 18 años o más."
        error={problems.birthDate}
        onChange={(event) => update({ birthDate: event.target.value, cedulaVerified: false })}
      />
      <CedulaCheck
        value={draft.cedula}
        onChange={(cedula) => update({ cedula })}
        birthDate={draft.birthDate}
        verified={draft.cedulaVerified}
        onVerified={(cedulaVerified) => update({ cedulaVerified })}
      />
      {problems.cedula && !draft.cedulaVerified ? (
        <p className="text-sm font-semibold text-danger">{problems.cedula}</p>
      ) : null}
    </>
  );
}

function TradeStep({ draft, problems, update }: StepProps) {
  const skills = skillsFor(draft.trades);
  return (
    <>
      <ChoiceChips<Trade>
        id="registro-oficios"
        legend="¿Qué oficios tienes?"
        hint="Puedes elegir varios."
        options={TRADE_CHOICES}
        selected={draft.trades}
        error={problems.trades}
        onToggle={(trade) => update(withTrades(draft, toggled(draft.trades, trade)))}
      />
      <ChoiceChips<ExperienceKey>
        id="registro-experiencia"
        legend="¿Cuánta experiencia tienes?"
        options={EXPERIENCE_CHOICES}
        selected={single(draft.experience)}
        error={problems.experience}
        onToggle={(experience) => update({ experience })}
      />
      {skills.length > 0 ? (
        <ChoiceChips
          id="registro-habilidades"
          legend="¿Qué sabes hacer?"
          hint="Toca todo lo que haces bien. Lo puedes cambiar después."
          options={skills.map((skill) => ({ value: skill, label: skill }))}
          selected={draft.skills}
          onToggle={(skill) => update({ skills: toggled(draft.skills, skill) })}
        />
      ) : (
        <p className="text-sm text-muted">Elige tu oficio y aquí te salen las cosas que puedes marcar.</p>
      )}
    </>
  );
}

function WhereWhenStep({ draft, problems, update }: StepProps) {
  return (
    <>
      <WorkAreaPicker
        id="registro-zona"
        legend="Zona de trabajo"
        hint="Dónde aceptas trabajar. Nunca te pedimos tu dirección."
        value={draft.workArea}
        error={problems.workArea}
        onChange={(workArea) => update({ workArea })}
      />
      <ChoiceChips
        id="registro-disponibilidad"
        legend="¿Cuándo puedes trabajar?"
        options={AVAILABILITY_CHOICES}
        selected={single(draft.availability)}
        error={problems.availability}
        onToggle={(availability) => update({ availability })}
      >
        <button
          type="button"
          aria-pressed={draft.nightShift}
          onClick={() => update({ nightShift: !draft.nightShift })}
          className={chipClass(draft.nightShift) + " self-start"}
        >
          {draft.nightShift ? "✓ " : ""}También trabajo de noche
        </button>
      </ChoiceChips>
    </>
  );
}

function AccountStep({ draft, problems, update }: StepProps) {
  return (
    <>
      <PasswordField
        id="registro-clave"
        label="Crea una contraseña"
        hint="Con tu cédula y esta contraseña vuelves a entrar si cambias o pierdes el teléfono."
        value={draft.password}
        error={problems.password}
        onChange={(password) => update({ password })}
      />
      <label className="flex min-h-12 items-start gap-3 text-ink-2">
        <input
          type="checkbox"
          checked={draft.consent}
          onChange={(event) => update({ consent: event.target.checked })}
          className="mt-1 size-5 shrink-0 accent-brand"
        />
        <span>
          Acepto que NIVEL guarde estos datos para armar mi perfil. Lee los{" "}
          <Link href="/legal/terminos" className={LINK}>
            términos
          </Link>{" "}
          y la{" "}
          <Link href="/legal/privacidad" className={LINK}>
            privacidad
          </Link>
          .
        </span>
      </label>
      {problems.consent ? <p className="text-sm font-semibold text-danger">{problems.consent}</p> : null}
    </>
  );
}

const STEP_VIEWS = [AboutYouStep, TradeStep, WhereWhenStep, AccountStep] as const;

function useSignupSteps(onSubmit: WorkerSignupFormProps["onSubmit"]) {
  const [draft, setDraft] = useState<SignupDraft>(EMPTY_SIGNUP);
  const [step, setStep] = useState(0);
  const [problems, setProblems] = useState<DraftProblems>({});
  const update = (changes: Partial<SignupDraft>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setProblems((current) => {
      const next = { ...current };
      for (const key of Object.keys(changes)) delete next[key as keyof SignupDraft];
      return next;
    });
  };
  const next = (event: FormEvent) => {
    event.preventDefault();
    const found = stepProblems(draft, step, localDate(new Date()));
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    if (step < SIGNUP_STEPS.length - 1) return setStep(step + 1);
    const signup = toSignup(draft);
    if (signup) onSubmit(signup.input, signup.access);
  };
  return { draft, step, problems, update, next, back: () => setStep(Math.max(0, step - 1)) };
}

export function WorkerSignupForm({ onSubmit, pending, error }: WorkerSignupFormProps) {
  const { draft, step, problems, update, next, back } = useSignupSteps(onSubmit);
  const View = STEP_VIEWS[step] ?? AboutYouStep;
  const last = step === SIGNUP_STEPS.length - 1;
  return (
    <form onSubmit={next} noValidate className="flex flex-col gap-4" aria-label="Crear mi perfil escribiendo">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-muted">
          Paso {step + 1} de {SIGNUP_STEPS.length}: {SIGNUP_STEPS[step]?.title}
        </p>
        <Progress value={(step + 1) / SIGNUP_STEPS.length} label="Avance del registro" />
      </div>
      <View draft={draft} problems={problems} update={update} />
      {error && last ? (
        <Notice tone="alert" urgent>
          {error}
        </Notice>
      ) : null}
      <div className="flex gap-3">
        {step > 0 ? (
          <Button variant="outline" onClick={back}>
            Atrás
          </Button>
        ) : null}
        <Button type="submit" block disabled={pending}>
          {last ? (pending ? "Creando tu perfil…" : "Crear mi perfil") : "Seguir"}
        </Button>
      </div>
    </form>
  );
}
