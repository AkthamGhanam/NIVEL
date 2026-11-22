// Portada de NIVEL: explica el producto y lleva a la app del trabajador o a la del contratista.
import Link from "next/link";
import type { ReactNode } from "react";

import { BytesLogo, NivelMark } from "@/components/brand/brand";
import {
  ArrowIcon,
  BadgeIcon,
  BuildingIcon,
  HandshakeIcon,
  HelmetIcon,
  MicIcon,
} from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import { DEMO_FOOTER } from "@/lib/legal-copy";

const DELAYS = ["", "[animation-delay:90ms]", "[animation-delay:180ms]", "[animation-delay:270ms]"] as const;

interface Door {
  readonly href: string;
  readonly kicker: string;
  readonly title: string;
  readonly text: string;
  readonly cta: string;
  readonly icon: ReactNode;
}

const DOORS: readonly Door[] = [
  {
    href: "/t",
    kicker: "Busco trabajo",
    title: "Soy trabajador",
    text: "Crea tu perfil hablando, sube de nivel y recibe ofertas de trabajo en regla.",
    cta: "Entrar como trabajador",
    icon: <HelmetIcon size={34} />,
  },
  {
    href: "/c",
    kicker: "Busco personal",
    title: "Soy contratista",
    text: "Pide tu cuadrilla, elige a quién invitar y contrata con todo en regla.",
    cta: "Entrar como contratista",
    icon: <BuildingIcon size={34} />,
  },
];

const STEPS = [
  {
    icon: <MicIcon />,
    title: "Habla con Nivi",
    text: "Cuenta qué sabes hacer o qué personal necesitas. Sin formularios largos.",
  },
  {
    icon: <BadgeIcon />,
    title: "Nivel que se comprueba",
    text: "Cursos, pruebas prácticas y trabajos confirmados suben el nivel de cada persona.",
  },
  {
    icon: <HandshakeIcon />,
    title: "Contrato directo",
    text: "La empresa contrata directo, con el costo legal claro antes de invitar.",
  },
] as const;

const LEGAL_LINKS = [
  { href: "/legal/niveles", label: "Cómo se calcula el nivel" },
  { href: "/legal/terminos", label: "Términos de uso" },
  { href: "/legal/privacidad", label: "Privacidad" },
  { href: "/a", label: "Academias" },
] as const;

function DoorCard({ door, delay }: { readonly door: Door; readonly delay: string }) {
  return (
    <Link
      href={door.href}
      className={cx(
        "group lift flex animate-rise flex-col gap-4 rounded-[26px] bg-surface p-6 text-ink shadow-float sm:p-8",
        delay,
      )}
    >
      <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-tint text-brand transition-colors duration-200 group-hover:bg-brand group-hover:text-white">
        {door.icon}
      </span>
      <span>
        <span className="eyebrow block text-brand">{door.kicker}</span>
        <span className="display mt-1 block text-4xl">{door.title}</span>
      </span>
      <span className="flex-1 text-lg text-ink-2">{door.text}</span>
      <span className="flex min-h-14 items-center justify-between gap-3 rounded-control bg-brand px-5 text-lg font-extrabold text-white transition-colors duration-200 group-hover:bg-brand-2">
        {door.cta}
        <span className="transition-transform duration-200 group-hover:translate-x-1">
          <ArrowIcon />
        </span>
      </span>
    </Link>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="hero-ink on-dark relative overflow-hidden text-white">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -right-40 size-[34rem] animate-halo rounded-full border-[3px] border-brand-on-ink/20"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 size-[24rem] animate-halo rounded-full border-[3px] border-brand-on-ink/25 [animation-delay:1.2s]"
      />
      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 pt-5 pb-40 sm:pb-44">
        <header className="flex items-center justify-between">
          <NivelMark tone="white" />
          <BytesLogo tone="white" height={22} />
        </header>
        <div className="flex max-w-3xl animate-rise flex-col gap-5">
          <p className="eyebrow self-start rounded-full bg-white/10 px-3 py-1.5 text-brand-on-ink">
            Oficios de Carabobo
          </p>
          <h1 id="hero-title" className="display text-5xl sm:text-7xl">
            Capacítate. Trabaja. <span className="text-brand-on-ink">Sube de nivel.</span>
          </h1>
          <p className="text-xl text-white/85 sm:text-2xl">
            El talento de los oficios, con un nivel que se puede comprobar. Elige cómo quieres entrar.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <Hero />
      <main className="mx-auto -mt-28 flex w-full max-w-5xl flex-1 flex-col gap-14 px-5 pb-10 sm:-mt-32">
        <nav aria-label="Elige cómo entrar" className="relative grid gap-5 md:grid-cols-2">
          {DOORS.map((door, index) => (
            <DoorCard key={door.href} door={door} delay={DELAYS[index + 1] ?? ""} />
          ))}
        </nav>
        <section aria-labelledby="como-funciona">
          <h2 id="como-funciona" className="bar-title text-2xl font-extrabold">
            Cómo funciona
          </h2>
          <ol className="mt-5 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className={cx(
                  "flex animate-rise flex-col gap-2 rounded-card border-[1.5px] border-line bg-surface p-5 shadow-soft",
                  DELAYS[index + 1],
                )}
              >
                <span className="flex size-12 items-center justify-center rounded-xl bg-ink text-brand-on-ink">
                  {step.icon}
                </span>
                <h3 className="mt-1 text-xl font-extrabold">{step.title}</h3>
                <p className="text-ink-2">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <footer className="border-t border-line px-5 py-5">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <ul className="flex flex-wrap gap-x-5">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-muted underline decoration-1 hover:text-ink"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-muted">
            {DEMO_FOOTER}
          </span>
        </div>
      </footer>
    </div>
  );
}
