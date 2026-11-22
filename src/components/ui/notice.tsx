import type { ReactNode } from "react";

import { cx } from "@/lib/cx";
import { NOT_EMPLOYER_NOTICE } from "@/lib/legal-copy";

type NoticeTone = "info" | "pending" | "alert";

const TONES: Readonly<Record<NoticeTone, string>> = {
  info: "border-brand-tint-2 bg-brand-tint text-ink",
  pending: "border-amber-bg bg-amber-bg text-ink",
  alert: "border-danger-line bg-danger-bg text-ink",
};

interface NoticeProps {
  readonly tone?: NoticeTone;
  readonly title?: string;
  readonly children: ReactNode;
  /** Un aviso urgente se anuncia a los lectores de pantalla apenas aparece. */
  readonly urgent?: boolean;
  readonly className?: string;
}

/** Aviso dentro de la pantalla: información, algo pendiente o una alerta. */
export function Notice({ tone = "info", title, children, urgent = false, className }: NoticeProps) {
  return (
    <div
      role={urgent ? "alert" : "note"}
      className={cx(
        "rounded-control border-[1.5px] px-4 py-3 text-[0.9375rem] leading-snug",
        TONES[tone],
        className,
      )}
    >
      {title ? <p className="mb-0.5 font-bold">{title}</p> : null}
      {children}
    </div>
  );
}

/** Texto fijo de la regla legal 8.1: va en ofertas, contrato y aceptación. */
export function NotEmployerNotice({ className }: { readonly className?: string }) {
  return (
    <p role="note" className={cx("text-sm font-semibold text-muted", className)}>
      {NOT_EMPLOYER_NOTICE}
    </p>
  );
}

/**
 * Estado de carga con palabras, nunca un spinner eterno: "Nivi está buscando soldadores…".
 * Se anuncia con cortesía a los lectores de pantalla.
 */
export function LoadingText({ children }: { readonly children: ReactNode }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 text-[0.9375rem] font-semibold text-muted"
    >
      {/* Solo late el punto: el texto conserva siempre su contraste. */}
      <span aria-hidden="true" className="size-2 shrink-0 animate-pulse rounded-full bg-brand" />
      {children}
    </p>
  );
}
