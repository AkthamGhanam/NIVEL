import type { ReactNode } from "react";

import type { AcademyPersona } from "@/client/academy-api";
import { DemoFooter, NivelMark } from "@/components/brand/brand";

interface AcademyShellProps {
  readonly academy: AcademyPersona;
  readonly onSwitch: () => void;
  readonly children: ReactNode;
}

/** Marco del panel de la academia: barra oscura con la academia activa y el contenido sobre el fondo claro. */
export function AcademyShell({ academy, onSwitch, children }: AcademyShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas">
      <header className="on-dark flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-ink px-4 py-3 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <NivelMark tone="white" size={28} />
          <p className="font-bold text-white">{academy.name}</p>
        </div>
        <button
          type="button"
          onClick={onSwitch}
          className="min-h-12 rounded-control text-sm font-semibold text-muted-on-ink underline decoration-2 hover:text-white"
        >
          Cambiar de academia
        </button>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      <DemoFooter className="border-t border-line" />
    </div>
  );
}
