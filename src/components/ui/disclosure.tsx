// Sección plegada: lo secundario queda a un toque, sin competir con el paso principal de la pantalla.
import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

import { ChevronIcon } from "./icons";

interface DisclosureProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
  /** Sin borde ni fondo, para usarla dentro de una tarjeta. */
  readonly plain?: boolean;
}

export function Disclosure({ title, children, className, plain = false }: DisclosureProps) {
  return (
    <details
      className={cx(
        "group",
        plain ? "" : "rounded-card border border-line bg-surface shadow-soft",
        className,
      )}
    >
      <summary
        className={cx(
          "flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 font-bold text-ink-2 [&::-webkit-details-marker]:hidden",
          plain ? "" : "px-5",
        )}
      >
        {title}
        <span
          aria-hidden="true"
          className="text-muted transition-transform duration-200 group-open:rotate-180"
        >
          <ChevronIcon />
        </span>
      </summary>
      <div className={cx("flex flex-col gap-4", plain ? "pb-1" : "px-5 pb-5")}>{children}</div>
    </details>
  );
}
