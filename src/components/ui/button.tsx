import Link from "next/link";
import type { ComponentProps } from "react";

import { cx } from "@/lib/cx";

/**
 * Botón de NIVEL. Siempre mide al menos 48 px de alto (dedo en móvil) y
 * muestra el foco. `ButtonLink` es lo mismo para navegar.
 */

export type ButtonVariant = "primary" | "outline" | "ink" | "danger";

const BASE =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-5 text-base font-extrabold " +
  "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55";

const VARIANTS: Readonly<Record<ButtonVariant, string>> = {
  primary: "bg-brand text-white hover:bg-brand-2",
  outline: "border-2 border-line bg-surface text-ink hover:border-ink-2",
  ink: "bg-ink text-white hover:bg-ink-2",
  danger: "border-2 border-danger-line bg-surface text-danger hover:border-danger",
};

interface Appearance {
  readonly variant?: ButtonVariant;
  /** Ocupa todo el ancho disponible (lo habitual en el teléfono). */
  readonly block?: boolean;
}

export function buttonClass({ variant = "primary", block = false }: Appearance = {}, extra?: string): string {
  return cx(BASE, VARIANTS[variant], block && "w-full", extra);
}

type ButtonProps = ComponentProps<"button"> & Appearance;

export function Button({ variant, block, className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, block }, className)} {...rest} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & Appearance;

export function ButtonLink({ variant, block, className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClass({ variant, block }, className)} {...rest} />;
}
