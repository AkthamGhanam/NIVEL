"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { DemoFooter, NivelMark } from "@/components/brand/brand";
import { Avatar } from "@/components/ui/avatar";
import { cx } from "@/lib/cx";

export const WORKER_NAV = [
  { href: "/trabajador", label: "Inicio" },
  { href: "/trabajador/aprender", label: "Mi ruta" },
  { href: "/trabajador/obra", label: "Trabajos" },
  { href: "/trabajador/mis-datos", label: "Perfil" },
] as const;

/** Sección activa: la más específica que contenga la dirección actual. */
function activeHref(current: string | null): string | null {
  if (!current) return null;
  const matches = WORKER_NAV.filter((item) => current === item.href || current.startsWith(`${item.href}/`));
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

/** Navegación inferior en el teléfono: cuatro secciones al alcance del pulgar. */
function BottomNav({ current }: { readonly current: string | null }) {
  const active = activeHref(current);
  return (
    <nav
      aria-label="Secciones de la app"
      className="sticky bottom-0 z-10 shrink-0 border-t border-line bg-surface lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {WORKER_NAV.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.href === active ? "page" : undefined}
              className={cx(
                "flex min-h-14 items-center justify-center border-t-[3px] px-1 text-[0.9375rem] font-bold",
                item.href === active ? "border-brand text-brand" : "border-transparent text-muted",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Menú lateral en escritorio, con el mismo estilo que la web del contratista. */
function SideNav({ current }: { readonly current: string | null }) {
  const active = activeHref(current);
  return (
    <nav aria-label="Secciones">
      <ul className="flex flex-col gap-1">
        {WORKER_NAV.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.href === active ? "page" : undefined}
              className={cx(
                "flex min-h-12 items-center rounded-control px-3.5 text-[1.0625rem] font-semibold",
                item.href === active
                  ? "bg-brand text-white"
                  : "text-muted-on-ink hover:bg-ink-2 hover:text-white",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Fondo de las pantallas sin sesión (acceso, carga, errores): una columna
 * centrada sobre el gris claro, a pantalla completa en el teléfono.
 */
export function WorkerStage({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-canvas">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8 sm:py-12">{children}</div>
      <DemoFooter className="border-t border-line" />
    </div>
  );
}

interface WorkerShellProps {
  readonly firstName: string;
  readonly onSwitch: () => void;
  readonly children: ReactNode;
}

/**
 * App web del trabajador. En el teléfono: encabezado, contenido y barra
 * inferior. En escritorio: menú oscuro a la izquierda y el contenido centrado.
 */
export function WorkerShell({ firstName, onSwitch, children }: WorkerShellProps) {
  const pathname = usePathname();
  const switchButton = (
    <button
      type="button"
      onClick={onSwitch}
      className="min-h-12 self-start rounded-control text-sm font-semibold text-muted-on-ink underline decoration-2 hover:text-white"
    >
      Cambiar de cuenta
    </button>
  );
  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      <header className="on-dark flex items-center justify-between gap-3 bg-ink px-4 py-2 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:items-stretch lg:justify-start lg:gap-8 lg:overflow-y-auto lg:px-5 lg:py-7">
        <Link
          href="/trabajador"
          aria-label="NIVEL, ir al inicio"
          className="inline-flex min-h-12 items-center"
        >
          <NivelMark tone="white" size={28} />
        </Link>
        <div className="hidden lg:block">
          <SideNav current={pathname} />
        </div>
        <div className="flex items-center gap-3 lg:mt-auto lg:flex-col lg:items-start lg:gap-1">
          <div className="hidden items-center gap-3 lg:flex">
            <Avatar name={firstName} tone="gray" />
            <p className="font-bold text-white">{firstName}</p>
          </div>
          <span className="text-sm font-semibold text-white lg:hidden">{firstName}</span>
          {switchButton}
        </div>
      </header>
      <div className="flex min-w-0 flex-1 flex-col bg-canvas">
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-5 lg:py-10">
          {children}
        </main>
        <DemoFooter className="hidden border-t border-line lg:block" />
        <BottomNav current={pathname} />
      </div>
    </div>
  );
}
