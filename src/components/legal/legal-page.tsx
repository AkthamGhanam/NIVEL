import Link from "next/link";
import type { ReactNode } from "react";

import { DemoFooter, NivelMark } from "@/components/brand/brand";

const LEGAL_LINKS = [
  { href: "/legal/terminos", label: "Términos" },
  { href: "/legal/privacidad", label: "Privacidad" },
  { href: "/legal/niveles", label: "Niveles" },
] as const;

interface LegalPageProps {
  readonly title: string;
  readonly lead: string;
  readonly children: ReactNode;
}

/** Marco común de las páginas legales: cortas y en lenguaje simple. */
export function LegalPage({ title, lead, children }: LegalPageProps) {
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" aria-label="NIVEL, ir al inicio" className="inline-flex min-h-12 items-center">
            <NivelMark />
          </Link>
          <nav aria-label="Páginas legales">
            <ul className="flex gap-1">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-12 items-center rounded-control px-3 font-semibold text-ink-2 underline decoration-line decoration-2 hover:decoration-brand"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="display text-4xl">{title}</h1>
        <p className="mt-3 text-lg text-ink-2">{lead}</p>
        <div className="mt-8 flex flex-col gap-8">{children}</div>
      </main>
      <DemoFooter className="border-t border-line" />
    </>
  );
}

export function LegalSection({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section>
      <h2 className="bar-title text-xl font-extrabold">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { readonly items: readonly ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-brand">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
