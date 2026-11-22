"use client";

import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

/**
 * Opciones para tocar en vez de escribir. Cada opción es un botón con
 * `aria-pressed`; el grupo tiene su leyenda y, si hay, su error enlazado.
 */

export interface Choice<Value extends string> {
  readonly value: Value;
  readonly label: string;
}

interface ChoiceChipsProps<Value extends string> {
  readonly id: string;
  readonly legend: string;
  readonly options: readonly Choice<Value>[];
  readonly selected: readonly Value[];
  readonly onToggle: (value: Value) => void;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  /** Contenido extra al final del grupo (un panel que se abre, una casilla…). */
  readonly children?: ReactNode;
}

const CHIP =
  "min-h-11 rounded-full border-[1.5px] px-4 text-left text-[0.95rem] font-semibold " +
  "transition-colors duration-150 motion-reduce:transition-none";

export function chipClass(on: boolean): string {
  return cx(
    CHIP,
    on ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink-2 hover:border-ink-2",
  );
}

export function ChoiceChips<Value extends string>({
  id,
  legend,
  options,
  selected,
  onToggle,
  hint,
  error,
  children,
}: ChoiceChipsProps<Value>) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-ayuda` : undefined;
  return (
    <fieldset id={id} className="flex flex-col gap-2" aria-describedby={describedBy}>
      <legend className="mb-1 text-sm font-bold text-ink-2">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const on = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(option.value)}
              className={chipClass(on)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
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
    </fieldset>
  );
}

/** Para un grupo de una sola opción: tocar otra cambia la elegida. */
export const single = <Value extends string>(current: Value | null) => (current === null ? [] : [current]);

/** Para un grupo de varias: tocar agrega o quita. */
export const toggled = <Value extends string>(list: readonly Value[], value: Value): Value[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
