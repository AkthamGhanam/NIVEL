import type { Metadata } from "next";
import type { ReactNode } from "react";

import { BytesLogo, DemoFooter, NivelMark } from "@/components/brand/brand";
import { Avatar } from "@/components/ui/avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { LoadingText, NotEmployerNotice, Notice } from "@/components/ui/notice";
import { PhoneFrame } from "@/components/ui/phone-frame";
import { PriceBreakdown } from "@/components/ui/price";
import { Progress } from "@/components/ui/progress";
import { Chip, LevelBadge, Tag } from "@/components/ui/tag";
import { VoiceOrb } from "@/components/ui/voice-orb";
import { formatKm } from "@/lib/format";
import { SEARCH_GUARANTEE_NOTICE } from "@/lib/legal-copy";
import { hiringFee } from "@/lib/pricing";

export const metadata: Metadata = { title: "Sistema visual" };

function Block({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="bar-title text-xl font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function CandidateExample() {
  return (
    <Card selected className="flex items-center gap-3 self-start">
      <Avatar name="Rafael Torres" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-bold">
          Rafael T. <LevelBadge level={3} short />
        </p>
        <p className="text-sm text-muted">
          5 trabajos confirmados · prueba práctica aprobada · a {formatKm(4)}
        </p>
      </div>
      <Tag tone="ok">Aceptó</Tag>
    </Card>
  );
}

function PhoneExample() {
  return (
    <PhoneFrame label="Ejemplo de pantalla del trabajador">
      <div className="flex flex-1 flex-col gap-4 p-5">
        <Eyebrow className="text-brand">Tu nivel</Eyebrow>
        <h3 className="display text-3xl">Nivel 2 · Verificado</h3>
        <Progress value={2 / 3} label="Avance hacia el Nivel 3" />
        <p className="text-ink-2">Te falta 1 trabajo confirmado para Nivel 3: Probado.</p>
        <Card className="flex flex-col gap-2">
          <p className="font-bold">Constructora Los Guayos</p>
          <p className="text-sm text-muted">Soldador · 5 días · $25 al día</p>
          <NotEmployerNotice />
          <Button block>Aceptar</Button>
          <Button block variant="outline">
            Rechazar
          </Button>
        </Card>
        <div className="mt-auto flex justify-center pb-4">
          <VoiceOrb state="listening" size="md" />
        </div>
      </div>
    </PhoneFrame>
  );
}

function Buttons() {
  return (
    <Block title="Botones">
      <div className="flex flex-wrap gap-3">
        <Button>Invitar a los 3 mejores</Button>
        <Button variant="outline">Prefiero escribir</Button>
        <Button variant="ink">Ver contrato</Button>
        <Button variant="danger">Borrar mi cuenta</Button>
        <Button disabled>Enviando…</Button>
        <ButtonLink href="/legal/niveles" variant="outline">
          Cómo se calcula el nivel
        </ButtonLink>
      </div>
    </Block>
  );
}

function States() {
  return (
    <Block title="Estados y niveles">
      <div className="flex flex-wrap items-center gap-2">
        <Tag>Enviada</Tag>
        <Tag tone="ok">Aceptó</Tag>
        <Tag tone="pending">Pendiente de firma</Tag>
        <Tag tone="alert">Rechazó</Tag>
        <LevelBadge level={1} />
        <LevelBadge level={3} />
        <LevelBadge level={5} />
      </div>
    </Block>
  );
}

function Cards() {
  return (
    <Block title="Tarjetas">
      <div className="grid gap-4 md:grid-cols-2">
        <CandidateExample />
        <Card>
          <PriceBreakdown label="Tarifa de NIVEL · Nivel 3" price={hiringFee(3)} totalBs={1740} />
        </Card>
      </div>
    </Block>
  );
}

function Notices() {
  return (
    <Block title="Avisos">
      <div className="grid gap-3 md:grid-cols-2">
        <Notice title="Garantía de búsqueda">{SEARCH_GUARANTEE_NOTICE}</Notice>
        <Notice tone="pending" title="Falta tu firma">
          Te enviamos un código por SMS (simulado).
        </Notice>
        <Notice tone="alert" title="No pudimos guardar">
          Revisa tu conexión e intenta de nuevo.
        </Notice>
        <div className="flex flex-col justify-center gap-2">
          <LoadingText>Nivi está buscando soldadores…</LoadingText>
          <NotEmployerNotice />
        </div>
      </div>
    </Block>
  );
}

function Orbs() {
  return (
    <Block title="Orbe de voz">
      <div className="grid gap-6 sm:grid-cols-4">
        <VoiceOrb state="idle" size="md" />
        <VoiceOrb state="listening" size="md" />
        <VoiceOrb state="thinking" size="md" />
        <VoiceOrb state="speaking" size="md" />
      </div>
    </Block>
  );
}

/** Galería del sistema visual: sirve para revisar de un vistazo colores, tipografía y componentes. */
export default function StyleGuidePage() {
  return (
    <>
      <header className="on-dark bg-ink">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
          <NivelMark tone="white" />
          <BytesLogo tone="white" height={24} />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-10">
        <div className="flex flex-col gap-3">
          <Chip className="self-start">Sistema visual</Chip>
          <h1 className="display text-5xl">Identidad de Bytes en NIVEL</h1>
          <p className="max-w-2xl text-lg text-ink-2">
            Titulares en Inter 900 itálica, texto en Inter, tarjetas blancas con borde gris y acentos en
            verde.
          </p>
        </div>

        <Buttons />
        <States />
        <Cards />
        <Notices />
        <Orbs />

        <Block title="Marco de teléfono">
          <div className="flex justify-center">
            <PhoneExample />
          </div>
        </Block>
      </main>
      <DemoFooter className="border-t border-line" />
    </>
  );
}
