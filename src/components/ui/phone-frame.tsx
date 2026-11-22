import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

/**
 * Marco de teléfono de 390 × 844 para ver la app del trabajador en una
 * pantalla grande (Modo Jurado). En un teléfono real no dibuja nada: el
 * contenido ocupa la pantalla completa.
 */
interface PhoneFrameProps {
  readonly children: ReactNode;
  /** Nombre del marco cuando va dentro de una página. Si el marco es toda la página, se omite. */
  readonly label?: string;
  /** Barra fija al pie (la navegación de la app): queda fuera de la zona que se desplaza. */
  readonly footer?: ReactNode;
  /** Ocupa el alto que le deje su contenedor, hasta el tamaño real. Sin esto mide siempre 868 px. */
  readonly fit?: boolean;
}

export function PhoneFrame({ children, label, footer, fit = false }: PhoneFrameProps) {
  return (
    <div
      role={label ? "group" : undefined}
      aria-label={label}
      className={cx(
        "relative flex h-dvh w-full flex-col bg-surface md:min-h-0 md:w-[414px] md:rounded-[56px] md:bg-[#0b1117] md:p-3 md:shadow-phone md:ring-2 md:ring-ink-2 md:ring-inset",
        fit ? "md:h-auto md:max-h-[868px] md:flex-1" : "md:h-[868px]",
      )}
    >
      <span
        aria-hidden="true"
        className="absolute top-[22px] left-1/2 z-10 hidden h-8 w-28 -translate-x-1/2 rounded-full bg-[#0b1117] md:block"
      />
      <div className="relative flex flex-1 flex-col overflow-hidden bg-surface md:rounded-[44px]">
        <div aria-hidden="true" className="hidden h-12 shrink-0 md:block" />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        {footer}
      </div>
    </div>
  );
}
