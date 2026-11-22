import type { ReactNode } from "react";

/**
 * Marco de teléfono de 390 × 844 para ver la app del trabajador en una
 * pantalla grande (Modo Jurado). En un teléfono real no dibuja nada: el
 * contenido ocupa la pantalla completa.
 */
export function PhoneFrame({ children, label }: { readonly children: ReactNode; readonly label: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="relative flex min-h-dvh w-full flex-col bg-surface md:h-[868px] md:min-h-0 md:w-[414px] md:rounded-[56px] md:bg-[#0b1117] md:p-3 md:shadow-phone md:ring-2 md:ring-ink-2 md:ring-inset"
    >
      <span
        aria-hidden="true"
        className="absolute top-[22px] left-1/2 z-10 hidden h-8 w-28 -translate-x-1/2 rounded-full bg-[#0b1117] md:block"
      />
      <div className="relative flex flex-1 flex-col overflow-hidden bg-surface md:rounded-[44px]">
        <div aria-hidden="true" className="hidden h-12 shrink-0 md:block" />
        <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
