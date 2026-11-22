"use client";

import { type FormEvent, useState } from "react";

import { type AccessKey, MIN_PASSWORD } from "@/client/demo-access";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { localDate } from "@/lib/dates";
import { ageOn, isCedula, normalizeCedula } from "@/lib/profile-options";

/**
 * Cédula o RIF y contraseña: para volver a entrar si se cambia o se pierde el
 * teléfono. En la demo no viajan al servidor (ver client/demo-access.ts).
 */

interface PasswordFieldProps {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label?: string;
  readonly hint?: string;
  readonly error?: string | undefined;
  readonly autoComplete?: "new-password" | "current-password";
}

export function PasswordField({
  id,
  value,
  onChange,
  label = "Contraseña",
  hint,
  error,
  autoComplete = "new-password",
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <TextField
        id={id}
        label={label}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={MIN_PASSWORD}
        maxLength={64}
        value={value}
        hint={hint}
        error={error}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="self-start text-sm font-semibold text-brand underline"
        aria-controls={id}
        onClick={() => setVisible((shown) => !shown)}
      >
        {visible ? "Ocultar contraseña" : "Ver contraseña"}
      </button>
    </div>
  );
}

const LONG_MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export function longDate(isoDate: string): string {
  const [year, month = 1, day] = isoDate.split("-").map(Number);
  return `${day} de ${LONG_MONTHS[month - 1]} de ${year}`;
}

interface CedulaCheckProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly birthDate: string;
  readonly verified: boolean;
  readonly onVerified: (verified: boolean) => void;
}

/** Cédula con su verificación: confirma la fecha de nacimiento y la edad. En la demo es simulada. */
export function CedulaCheck({ value, onChange, birthDate, verified, onVerified }: CedulaCheckProps) {
  const [problem, setProblem] = useState<string | undefined>();
  const age = ageOn(birthDate, localDate(new Date()));
  const verify = () => {
    if (!isCedula(value)) return setProblem("Escribe la cédula con la letra, por ejemplo V-12345678.");
    if (age === undefined) return setProblem("Primero elige tu fecha de nacimiento.");
    setProblem(undefined);
    onVerified(true);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <TextField
          id="registro-cedula"
          label="Cédula"
          placeholder="Ej: V-12345678"
          autoCapitalize="characters"
          inputMode="text"
          maxLength={14}
          value={value}
          error={problem}
          wrapperClassName="flex-1"
          onChange={(event) => {
            onChange(event.target.value);
            onVerified(false);
          }}
        />
        <Button type="button" variant="outline" onClick={verify} disabled={verified}>
          {verified ? "Verificada" : "Verificar"}
        </Button>
      </div>
      {verified && age !== undefined ? (
        <Notice tone="info">
          Cédula {normalizeCedula(value)} verificada: naciste el {longDate(birthDate)} y tienes {age} años.
          <span className="block text-sm text-muted">
            En la demo esta verificación es simulada. NIVEL no guarda tu cédula ni la muestra a las empresas.
          </span>
        </Notice>
      ) : null}
    </div>
  );
}

interface AccessLoginProps {
  readonly documentLabel: string;
  readonly placeholder: string;
  /** Busca la cuenta. Devuelve un mensaje si no la encontró. */
  readonly onLogin: (key: AccessKey) => Promise<string | null>;
  readonly pending: boolean;
}

/** "Ya tengo cuenta": entrar con el documento y la contraseña. */
export function AccessLogin({ documentLabel, placeholder, onLogin, pending }: AccessLoginProps) {
  const [document, setDocument] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (document.trim().length < 6 || password.length < MIN_PASSWORD) {
      setProblem(`Escribe tu ${documentLabel.toLowerCase()} y tu contraseña.`);
      return;
    }
    setProblem(await onLogin({ document, password }));
  };
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-3"
      aria-label="Entrar a mi cuenta"
    >
      <TextField
        id="entrar-documento"
        label={documentLabel}
        placeholder={placeholder}
        autoCapitalize="characters"
        autoComplete="username"
        maxLength={16}
        value={document}
        onChange={(event) => setDocument(event.target.value)}
      />
      <PasswordField
        id="entrar-clave"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />
      {problem ? (
        <Notice tone="alert" urgent>
          {problem}
        </Notice>
      ) : null}
      <Button type="submit" block disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

export const NOT_ON_THIS_PHONE =
  "No encontramos esa cuenta en este teléfono. En la demo la contraseña se guarda solo en el teléfono donde " +
  "te registraste; también puedes tocar tu cuenta en la lista de abajo.";
