"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { DemoFooter, NivelMark } from "@/components/brand/brand";
import { cx } from "@/lib/cx";

export const ADMIN_NAV = [
  { href: "/admin", label: "Métricas" },
  { href: "/admin/revision", label: "Revisión de reportes" },
  { href: "/demo", label: "Modo Jurado" },
] as const;

function AdminNav({ current }: { readonly current: string }) {
  return (
    <nav aria-label="Secciones del equipo">
      <ul className="flex flex-wrap gap-1">
        {ADMIN_NAV.map((item) => {
          const active = item.href === current;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-12 items-center rounded-control px-3.5 font-semibold",
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

/** Marco de la administración: barra oscura con las secciones del equipo y el contenido sobre el fondo claro. */
export function AdminShell({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas">
      <header className="on-dark flex flex-wrap items-center gap-x-6 gap-y-2 bg-ink px-4 py-3 lg:px-8">
        <div className="flex items-center gap-3">
          <NivelMark tone="white" size={28} />
          <p className="font-bold text-white">Equipo NIVEL</p>
        </div>
        <AdminNav current={pathname} />
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      <DemoFooter className="border-t border-line" />
    </div>
  );
}
