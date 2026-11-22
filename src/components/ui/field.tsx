import type { ComponentProps, ReactNode } from "react";

import { cx } from "@/lib/cx";

/**
 * Casillas de formulario: etiqueta siempre visible, 48 px de alto y el error
 * escrito junto al campo y enlazado con `aria-describedby`.
 */

const CONTROL =
  "min-h-12 w-full rounded-control border-[1.5px] bg-surface px-3 text-base text-ink " +
  "placeholder:text-muted disabled:cursor-not-allowed disabled:bg-line-2";

const controlClass = (invalid: boolean, extra?: string) =>
  cx(CONTROL, invalid ? "border-danger" : "border-line", extra);

interface FieldShellProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

function FieldShell({ id, label, hint, error, className, children }: FieldShellProps) {
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-sm font-bold text-ink-2">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-ayuda`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface Described {
  readonly id: string;
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly wrapperClassName?: string | undefined;
}

const describedBy = ({ id, hint, error }: Described) =>
  error ? `${id}-error` : hint ? `${id}-ayuda` : undefined;

type TextFieldProps = Omit<ComponentProps<"input">, "id"> & Described;

export function TextField({ label, hint, error, wrapperClassName, className, ...input }: TextFieldProps) {
  const described = { id: input.id, label, hint, error };
  return (
    <FieldShell {...described} className={wrapperClassName}>
      <input
        {...input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(described)}
        className={controlClass(Boolean(error), className)}
      />
    </FieldShell>
  );
}

type SelectFieldProps = Omit<ComponentProps<"select">, "id"> & Described;

export function SelectField({
  label,
  hint,
  error,
  wrapperClassName,
  className,
  ...select
}: SelectFieldProps) {
  const described = { id: select.id, label, hint, error };
  return (
    <FieldShell {...described} className={wrapperClassName}>
      <select
        {...select}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(described)}
        className={controlClass(Boolean(error), className)}
      />
    </FieldShell>
  );
}

type TextAreaFieldProps = Omit<ComponentProps<"textarea">, "id"> & Described;

export function TextAreaField({
  label,
  hint,
  error,
  wrapperClassName,
  className,
  ...textarea
}: TextAreaFieldProps) {
  const described = { id: textarea.id, label, hint, error };
  return (
    <FieldShell {...described} className={wrapperClassName}>
      <textarea
        {...textarea}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(described)}
        className={controlClass(Boolean(error), cx("py-2.5", className))}
      />
    </FieldShell>
  );
}
