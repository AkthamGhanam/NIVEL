import type { ComponentProps } from "react";

import { cx } from "@/lib/cx";

type CardProps = ComponentProps<"div"> & {
  /** Resalta la tarjeta elegida con el borde verde. */
  readonly selected?: boolean;
};

/** Tarjeta blanca con borde gris y radio de 14 px. */
export function Card({ selected = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        "rounded-card border-[1.5px] bg-surface p-4",
        selected ? "border-brand shadow-[inset_0_0_0_1px_var(--color-brand)]" : "border-line",
        className,
      )}
      {...rest}
    />
  );
}

/** Etiqueta en mayúsculas que encabeza un bloque. */
export function Eyebrow({ className, ...rest }: ComponentProps<"p">) {
  return <p className={cx("eyebrow text-muted", className)} {...rest} />;
}
