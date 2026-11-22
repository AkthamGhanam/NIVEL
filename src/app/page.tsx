import Link from "next/link";

import { BytesLogo, DemoFooter, NivelMark } from "@/components/brand/brand";
import { ButtonLink } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { Chip } from "@/components/ui/tag";

const AUDIENCES = [
  {
    chip: "Trabajador",
    title: "Regístrate hablando",
    text: "Sin formularios. Nivi te escucha, arma tu perfil y te avisa de ofertas de trabajo en regla.",
    href: "/t",
    cta: "Crear mi perfil",
  },
  {
    chip: "Contratista",
    title: "Pide tu cuadrilla hablando",
    text: "Dices qué necesitas y ves quién cumple, cuánto cuesta en regla y quién aceptó.",
    href: "/c",
    cta: "Registrar mi empresa",
  },
  {
    chip: "Academia",
    title: "Tus alumnos consiguen trabajo",
    text: "Cursos, pruebas prácticas y constancias que suben el nivel de cada persona.",
    href: "/a",
    cta: "Entrar como academia",
  },
] as const;

const LEGAL_LINKS = [
  { href: "/legal/niveles", label: "Cómo se calcula el nivel" },
  { href: "/legal/terminos", label: "Términos de uso" },
  { href: "/legal/privacidad", label: "Privacidad" },
] as const;

function Audiences() {
  return (
    <section aria-labelledby="audiences-title">
      <h2 id="audiences-title" className="bar-title text-2xl font-extrabold">
        Para quién es
      </h2>
      <ul className="mt-5 grid gap-4 md:grid-cols-3">
        {AUDIENCES.map((audience) => (
          <li key={audience.chip}>
            <Card className="flex h-full flex-col gap-3 p-5">
              <Chip className="self-start">{audience.chip}</Chip>
              <h3 className="display text-2xl">{audience.title}</h3>
              <p className="flex-1 text-ink-2">{audience.text}</p>
              <ButtonLink href={audience.href} variant={audience.href === "/a" ? "outline" : "primary"} block>
                {audience.cta}
              </ButtonLink>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <NivelMark />
        <BytesLogo height={24} />
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-10">
        <section aria-labelledby="hero-title" className="flex flex-col gap-4">
          <Eyebrow className="text-brand">NIVEL · por Bytes Technology</Eyebrow>
          <h1 id="hero-title" className="display text-5xl sm:text-6xl">
            Capacítate. Trabaja. <span className="text-brand">Sube de nivel.</span>
          </h1>
          <p className="max-w-2xl text-xl text-ink-2">
            El talento de los oficios de Carabobo, con un nivel que se puede comprobar. Contrata rápido y en
            regla.
          </p>
        </section>

        <Audiences />

        <nav aria-label="Reglas claras">
          <h2 className="bar-title text-2xl font-extrabold">Reglas claras</h2>
          <ul className="mt-4 flex flex-col gap-1 sm:flex-row sm:gap-6">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-12 items-center font-semibold text-brand underline decoration-2"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
      <DemoFooter className="border-t border-line" />
    </>
  );
}
