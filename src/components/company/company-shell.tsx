"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import type { CompanyPersona } from "@/client/company-api";
import { DemoFooter, NivelMark } from "@/components/brand/brand";
import { Avatar } from "@/components/ui/avatar";
import { cx } from "@/lib/cx";

export const COMPANY_NAV = [
  { href: "/c", label: "Pedir cuadrilla" },
  { href: "/c/obra", label: "Obra" },
  { href: "/c/pagos", label: "Pagos" },
  { href: "/c/calificar", label: "Calificar" },
] as const;

interface CompanyShellProps {
  readonly company: CompanyPersona;
  readonly onSwitch: () => void;
  readonly children: ReactNode;
}

function CompanyNav({ current }: { readonly current: string }) {
  return (
    <nav aria-label="Secciones de la empresa">
      <ul className="flex flex-wrap gap-1 lg:flex-col">
        {COMPANY_NAV.map((item) => {
          const active = item.href === current;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-12 items-center rounded-control px-3.5 text-[1.0625rem] font-semibold",
                  active ? "bg-brand text-white" : "text-muted-on-ink hover:bg-ink-2 hover:text-white",
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

/** Empresa activa: nombre, si está verificada y su RIF (datos mercantiles públicos). */
export function CompanyIdentity({ company, onSwitch }: Omit<CompanyShellProps, "children">) {
  return (
    <div className="flex flex-col gap-1">
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

/**
 * Marco de la vista del contratista: menú oscuro a la izquierda en escritorio
 * (arriba en pantallas angostas) y el contenido sobre el fondo gris claro.
 */
export function CompanyShell({ company, onSwitch, children }: CompanyShellProps) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <header className="on-dark flex flex-col gap-4 bg-ink px-4 py-4 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:gap-8 lg:overflow-y-auto lg:px-5 lg:py-7">
        <Link href="/c" aria-label="NIVEL, pedir cuadrilla" className="inline-flex min-h-12 items-center">
          <NivelMark tone="white" />
        </Link>
        <CompanyNav current={pathname} />
        <div className="lg:mt-auto">
          <CompanyIdentity company={company} onSwitch={onSwitch} />
        </div>
      </header>
      <div className="flex min-w-0 flex-1 flex-col bg-canvas">
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
        <DemoFooter className="border-t border-line" />
      </div>
    </div>
  );
}
