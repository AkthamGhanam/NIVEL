"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { NivelMark } from "@/components/brand/brand";
import { PhoneFrame } from "@/components/ui/phone-frame";
import { cx } from "@/lib/cx";
import { DEMO_FOOTER } from "@/lib/legal-copy";

export const WORKER_NAV = [
  { href: "/t", label: "Inicio" },
  { href: "/t/aprender", label: "Mi ruta" },
  { href: "/t/obra", label: "Trabajos" },
  { href: "/t/mis-datos", label: "Perfil" },
] as const;

function BottomNav({ current }: { readonly current: string | null }) {
  return (
    <nav aria-label="Secciones de la app" className="shrink-0 border-t border-line bg-surface">
      <ul className="grid grid-cols-4">
        {WORKER_NAV.map((item) => {
          const active = item.href === current;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-14 items-center justify-center border-t-[3px] px-1 text-[0.9375rem] font-bold",
                  active ? "border-brand text-brand" : "border-transparent text-muted",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * El teléfono: marco en pantallas grandes, pantalla completa en un teléfono real.
 * El marco es solo dibujo: las regiones de la página (encabezado, contenido, navegación) van dentro.
 */
export function PhoneStage({
  children,
  footer,
}: {
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}) {
  return (
    <div className="flex flex-1 justify-center md:items-center md:bg-canvas md:py-6">
      <PhoneFrame footer={footer}>{children}</PhoneFrame>
    </div>
  );
}

interface WorkerShellProps {
  readonly firstName: string;
  readonly onSwitch: () => void;
  readonly children: ReactNode;
}

/** Marco de la app del trabajador: encabezado, contenido y barra inferior de cuatro secciones. */
export function WorkerShell({ firstName, onSwitch, children }: WorkerShellProps) {
  const pathname = usePathname();
  return (
    <PhoneStage footer={<BottomNav current={pathname} />}>
      <header className="on-dark flex items-center justify-between gap-3 bg-ink px-4 py-2">
        <Link href="/t" aria-label="NIVEL, ir al inicio" className="inline-flex min-h-12 items-center">
          <NivelMark tone="white" size={28} />
        </Link>
        <button
          type="button"
          onClick={onSwitch}
          className="min-h-12 rounded-control px-1 text-sm font-semibold text-muted-on-ink underline decoration-2"
        >
          {firstName} · cambiar
        </button>
      </header>
      <main className="flex flex-1 flex-col gap-4 px-4 py-5">{children}</main>
      <footer className="px-4 pb-4 text-center text-xs text-muted">{DEMO_FOOTER}</footer>
    </PhoneStage>
  );
}
