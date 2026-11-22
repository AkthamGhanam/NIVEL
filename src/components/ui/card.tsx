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
        "rounded-card border-[1.5px] bg-surface p-4 shadow-soft",
        selected ? "border-brand shadow-[inset_0_0_0_1px_var(--color-brand)]" : "border-line",
        className,
      )}
      {...rest}
    />
  );
}

export function Eyebrow({ className, ...rest }: ComponentProps<"p">) {
  return <p className={cx("eyebrow text-muted", className)} {...rest} />;
}
