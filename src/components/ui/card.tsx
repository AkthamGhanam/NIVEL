// Tarjeta blanca y etiqueta de sección.
import type { ComponentProps } from "react";

import { cx } from "@/lib/cx";

type CardProps = ComponentProps<"div"> & {
  readonly selected?: boolean;
};

export function Card({ selected = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        "rounded-card border bg-surface p-5 shadow-soft",
        selected ? "border-brand shadow-[inset_0_0_0_1.5px_var(--color-brand)]" : "border-line",
        className,
      )}
      {...rest}
    />
  );
}

export function Eyebrow({ className, ...rest }: ComponentProps<"p">) {
  return <p className={cx("eyebrow text-muted", className)} {...rest} />;
}
