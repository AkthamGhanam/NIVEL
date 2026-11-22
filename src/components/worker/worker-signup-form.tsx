// Formulario para crear el perfil del trabajador escribiendo.
"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState } from "react";

import type { WorkerSignupInput } from "@/client/worker-api";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { TRADE_LABELS, TRADES } from "@/lib/trades";
import { ZONES } from "@/lib/zones";

interface WorkerSignupFormProps {
  readonly onSubmit: (input: WorkerSignupInput) => void;
  readonly pending: boolean;
  readonly error: string | null;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function splitSkills(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((skill) => skill.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export const AVAILABILITY = ["Inmediata", "En una semana", "Fines de semana", "Medio tiempo"] as const;

export function readWorkerSignup(data: FormData): WorkerSignupInput {
  const text = (name: string) => String(data.get(name) ?? "").trim();
  return {
    name: text("nombre"),
    isAdult: true,
    trade: text("oficio"),
    yearsExp: Number(text("experiencia") || "0"),
    skills: splitSkills(text("tecnicas")),
    zone: text("zona"),
    availability: text("disponibilidad"),
    consent: true,
  };
}

const LINK = "font-semibold text-brand underline decoration-2";

function Checkbox({
  checked,
  onChange,
  children,
}: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly children: ReactNode;
}) {
  return (
    <label className="flex min-h-12 items-start gap-3 text-ink-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-5 shrink-0 accent-brand"
        required
      />
      <span>{children}</span>
    </label>
  );
}

function TradeFields() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField id="registro-oficio" name="oficio" label="Oficio" required defaultValue="">
        <option value="" disabled>
          Elige tu oficio
        </option>
        {TRADES.map((trade) => (
          <option key={trade} value={trade}>
            {trade === "otro" ? "Otro oficio" : capitalize(TRADE_LABELS[trade].singular)}
          </option>
        ))}
      </SelectField>
      <TextField
        id="registro-experiencia"
        name="experiencia"
        label="Años de experiencia"
        type="number"
        inputMode="numeric"
        min={0}
        max={60}
        defaultValue={0}
        required
      />
    </div>
  );
}

function PlaceFields() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        id="registro-zona"
        name="zona"
        label="Zona donde vives"
        hint="Municipio o sector, nunca tu dirección"
        list="zonas-carabobo"
        required
        maxLength={80}
      />
      <datalist id="zonas-carabobo">
        {Object.values(ZONES).map((zone) => (
          <option key={zone.name} value={zone.name} />
        ))}
      </datalist>
      <SelectField
        id="registro-disponibilidad"
        name="disponibilidad"
        label="Disponibilidad"
        required
        defaultValue={AVAILABILITY[0]}
      >
        {AVAILABILITY.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

export function WorkerSignupForm({ onSubmit, pending, error }: WorkerSignupFormProps) {
  const [adult, setAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (adult && consent) onSubmit(readWorkerSignup(new FormData(event.currentTarget)));
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-label="Crear mi perfil escribiendo">
      <TextField
        id="registro-nombre"
        name="nombre"
        label="Nombre y apellido"
        autoComplete="name"
        required
        minLength={2}
        maxLength={80}
      />
      <TradeFields />
      <TextField
        id="registro-tecnicas"
        name="tecnicas"
        label="Qué sabes hacer"
        hint="Sepáralo con comas. Ejemplo: soldadura MIG, lectura de planos"
        maxLength={300}
      />
      <PlaceFields />
      <Checkbox checked={adult} onChange={setAdult}>
        Tengo 18 años o más.
      </Checkbox>
      <Checkbox checked={consent} onChange={setConsent}>
        Acepto que NIVEL guarde estos datos para armar mi perfil. Lee los{" "}
        <Link href="/legal/terminos" className={LINK}>
          términos
        </Link>{" "}
        y la{" "}
        <Link href="/legal/privacidad" className={LINK}>
          privacidad
        </Link>
        .
      </Checkbox>
      {error ? (
        <Notice tone="alert" urgent>
          {error}
        </Notice>
      ) : null}
      <Button type="submit" block disabled={pending || !adult || !consent}>
        {pending ? "Creando tu perfil…" : "Crear mi perfil"}
      </Button>
    </form>
  );
}
