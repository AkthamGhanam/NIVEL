// Marco de la web del contratista: menú lateral, empresa activa y contenido.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import type { CompanyPersona } from "@/client/company-api";
import { DemoFooter, NivelMark } from "@/components/brand/brand";
import { Avatar } from "@/components/ui/avatar";
import { BuildingIcon, CrewIcon, StarIcon, WalletIcon } from "@/components/ui/icons";
import { RingMark } from "@/components/ui/ring-mark";
import { cx } from "@/lib/cx";

export const COMPANY_NAV = [
  { href: "/c", label: "Pedir cuadrilla", icon: <CrewIcon /> },
  { href: "/c/obra", label: "Obra", icon: <BuildingIcon size={24} /> },
  { href: "/c/pagos", label: "Pagos", icon: <WalletIcon /> },
  { href: "/c/calificar", label: "Calificar", icon: <StarIcon /> },
] as const;

interface CompanyShellProps {
  readonly company: CompanyPersona;
  readonly onSwitch: () => void;
  readonly children: ReactNode;
}

function CompanyNav({ current }: { readonly current: string }) {
  return (
    <nav aria-label="Secciones de la empresa">
      <ul className="flex flex-col gap-1">
        {COMPANY_NAV.map((item) => {
          const active = item.href === current;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-13 items-center gap-3 rounded-control px-3.5 text-[1.0625rem] font-semibold transition-colors duration-150",
                  active
                    ? "bg-ink-3 text-white shadow-[inset_0_0_0_1px_var(--color-ink-line)]"
                    : "text-muted-on-ink hover:bg-ink-3 hover:text-white",
                )}
              >
                <span aria-hidden="true" className={active ? "text-signal" : undefined}>
                  {item.icon}
                </span>
                {item.label}
                {active ? (
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

/** En el teléfono, las cuatro secciones quedan siempre a la vista en la barra de abajo. */
function CompanyBottomNav({ current }: { readonly current: string }) {
  return (
    <nav
      aria-label="Secciones de la empresa en el teléfono"
      className="sticky bottom-0 z-10 shrink-0 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-4 px-1">
        {COMPANY_NAV.map((item) => {
          const on = item.href === current;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "group flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-center text-[0.8125rem] leading-tight font-bold",
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

export function CompanyIdentity({ company, onSwitch }: Omit<CompanyShellProps, "children">) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-ink-line bg-ink-3/80 p-3">
      <div className="flex items-center gap-3">
        <Avatar name={company.name} tone="gray" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white">{company.name}</p>
          <p
            className={cx(
              "text-sm",
              company.verified ? "font-semibold text-brand-on-ink" : "text-muted-on-ink",
            )}
          >
            {company.verified ? "Empresa verificada" : "Verificación pendiente"}
          </p>
          <p className="text-sm text-muted-on-ink">RIF {company.rif}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onSwitch}
        className="min-h-12 self-start rounded-control text-sm font-semibold text-muted-on-ink underline decoration-2 hover:text-white"
      >
        Cambiar de cuenta
      </button>
    </div>
  );
}

export function CompanyShell({ company, onSwitch, children }: CompanyShellProps) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row lg:bg-ink">
      <header className="on-dark relative flex items-center justify-between gap-4 overflow-hidden bg-ink px-4 py-2 lg:flex-col lg:items-stretch lg:justify-start lg:sticky lg:top-0 lg:h-dvh lg:w-68 lg:shrink-0 lg:gap-9 lg:overflow-y-auto lg:px-5 lg:py-7">
        <Link href="/c" aria-label="NIVEL, pedir cuadrilla" className="inline-flex min-h-12 items-center">
          <NivelMark tone="white" />
        </Link>
        <span className="min-w-0 truncate text-sm font-semibold text-white lg:hidden">{company.name}</span>
        <div className="hidden lg:block">
          <CompanyNav current={pathname} />
        </div>
        <RingMark className="pointer-events-none absolute -bottom-24 -left-24 hidden size-80 lg:block" />
        <div className="relative hidden lg:mt-auto lg:block">
          <CompanyIdentity company={company} onSwitch={onSwitch} />
        </div>
      </header>
      <div className="flex min-w-0 flex-1 flex-col bg-canvas lg:rounded-l-[32px]">
        <main className="flex-1 animate-enter px-4 py-6 lg:px-8 lg:py-8">{children}</main>
        <div className="border-t border-line bg-ink px-4 py-4 lg:hidden">
          <CompanyIdentity company={company} onSwitch={onSwitch} />
        </div>
        <DemoFooter className="border-t border-line" />
        <CompanyBottomNav current={pathname} />
      </div>
    </div>
  );
}
