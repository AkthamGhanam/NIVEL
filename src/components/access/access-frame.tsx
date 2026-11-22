// Marco común de las pantallas de acceso: cabecera oscura, dos pestañas grandes (crear cuenta o entrar) y pie.
"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { DemoFooter, NivelMark } from "@/components/brand/brand";
import { cx } from "@/lib/cx";

export type AccessTab = "crear" | "entrar";

interface AccessFrameProps {
  readonly kicker: string;
  readonly title: string;
  readonly text: string;
  readonly tab: AccessTab;
  readonly onTab: (tab: AccessTab) => void;
  readonly createLabel: string;
  readonly children: ReactNode;
}

const TABS: ReadonlyArray<{ readonly value: AccessTab; readonly label: (create: string) => string }> = [
  { value: "crear", label: (create) => create },
  { value: "entrar", label: () => "Ya tengo cuenta" },
];

export function AccessFrame({ kicker, title, text, tab, onTab, createLabel, children }: AccessFrameProps) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-canvas">
      <header className="hero-ink on-dark px-5 pt-4 pb-24 text-white">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
          <Link
            href="/"
            aria-label="NIVEL, volver al inicio"
            className="inline-flex min-h-12 items-center self-start"
          >
            <NivelMark tone="white" />
          </Link>
          <div className="animate-rise">
            <p className="eyebrow text-brand-on-ink">{kicker}</p>
            <h1 className="display mt-2 text-4xl sm:text-5xl">{title}</h1>
            <p className="mt-3 text-lg text-white/85">{text}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto -mt-16 flex w-full max-w-xl flex-1 flex-col gap-4 px-4 pb-8">
        <div className="animate-rise rounded-[22px] bg-surface p-4 shadow-float [animation-delay:90ms] sm:p-6">
          <div
            role="tablist"
            aria-label="Cómo quieres entrar"
            className="grid grid-cols-2 gap-1 rounded-control bg-line-2 p-1"
          >
            {TABS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                id={`acceso-${item.value}`}
                aria-selected={tab === item.value}
                aria-controls="acceso-panel"
                onClick={() => onTab(item.value)}
                className={cx(
                  "min-h-13 rounded-[11px] px-2 text-base font-extrabold transition-all duration-200",
                  tab === item.value ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink",
                )}
              >
                {item.label(createLabel)}
              </button>
            ))}
          </div>
          <div
            key={tab}
            role="tabpanel"
            id="acceso-panel"
            aria-labelledby={`acceso-${tab}`}
            className="mt-5 animate-enter"
          >
            {children}
          </div>
        </div>
      </main>
      <DemoFooter />
    </div>
  );
}
