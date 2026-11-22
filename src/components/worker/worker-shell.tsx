// Marco de la app del trabajador: menú lateral en escritorio y barra inferior en el teléfono.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { DemoFooter, NivelMark } from "@/components/brand/brand";
import { Avatar } from "@/components/ui/avatar";
import { BriefcaseIcon, HomeIcon, RouteIcon, UserIcon } from "@/components/ui/icons";
import { RingMark } from "@/components/ui/ring-mark";
import { cx } from "@/lib/cx";

export const WORKER_NAV = [
  { href: "/t", label: "Inicio", icon: <HomeIcon /> },
  { href: "/t/aprender", label: "Mi ruta", icon: <RouteIcon /> },
  { href: "/t/obra", label: "Trabajos", icon: <BriefcaseIcon /> },
  { href: "/t/mis-datos", label: "Perfil", icon: <UserIcon /> },
] as const;

function activeHref(current: string | null): string | null {
  if (!current) return null;
  const matches = WORKER_NAV.filter((item) => current === item.href || current.startsWith(`${item.href}/`));
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

function BottomNav({ current }: { readonly current: string | null }) {
  const active = activeHref(current);
  return (
    <nav
      aria-label="Secciones de la app"
      className="sticky bottom-0 z-10 shrink-0 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-4 px-1">
        {WORKER_NAV.map((item) => {
          const on = item.href === active;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "group flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-[0.875rem] font-bold",
                  on ? "text-brand" : "text-muted",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200",
                    on ? "bg-brand-tint" : "group-hover:bg-line-2",
                  )}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SideNav({ current }: { readonly current: string | null }) {
  const active = activeHref(current);
  return (
    <nav aria-label="Secciones">
      <ul className="flex flex-col gap-1">
        {WORKER_NAV.map((item) => {
          const on = item.href === active;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "relative flex min-h-13 items-center gap-3 rounded-control px-3.5 text-[1.0625rem] font-semibold transition-colors duration-150",
                  on
                    ? "bg-ink-3 text-white shadow-[inset_0_0_0_1px_var(--color-ink-line)]"
                    : "text-muted-on-ink hover:bg-ink-3 hover:text-white",
                )}
              >
                <span aria-hidden="true" className={on ? "text-signal" : undefined}>
                  {item.icon}
                </span>
                {item.label}
                {on ? (
                  <span aria-hidden="true" className="ml-auto size-2 animate-signal rounded-full bg-signal" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

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
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row lg:bg-ink">
      <header className="on-dark relative flex items-center justify-between gap-3 overflow-hidden bg-ink px-4 py-2 lg:sticky lg:top-0 lg:h-dvh lg:w-68 lg:shrink-0 lg:flex-col lg:items-stretch lg:justify-start lg:gap-9 lg:overflow-y-auto lg:px-5 lg:py-7">
        <Link href="/t" aria-label="NIVEL, ir al inicio" className="inline-flex min-h-12 items-center">
          <NivelMark tone="white" size={28} />
        </Link>
        <div className="hidden lg:block">
          <SideNav current={pathname} />
        </div>
        <RingMark className="pointer-events-none absolute -bottom-24 -left-24 hidden size-80 lg:block" />
        <div className="relative flex items-center gap-3 lg:mt-auto lg:flex-col lg:items-start lg:gap-1 lg:rounded-card lg:border lg:border-ink-line lg:bg-ink-3/80 lg:p-3">
          <div className="hidden items-center gap-3 lg:flex">
            <Avatar name={firstName} tone="gray" />
            <p className="font-bold text-white">{firstName}</p>
          </div>
          <span className="text-sm font-semibold text-white lg:hidden">{firstName}</span>
          {switchButton}
        </div>
      </header>
      <div className="flex min-w-0 flex-1 flex-col bg-canvas lg:rounded-l-[32px]">
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-5 lg:py-10">
          {children}
        </main>
        <DemoFooter className="hidden border-t border-line lg:block" />
        <BottomNav current={pathname} />
      </div>
    </div>
  );
}
