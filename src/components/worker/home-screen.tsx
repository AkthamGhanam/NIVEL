// Inicio de la app del trabajador: nivel, disponibilidad, trabajo en curso, ofertas y Nivi.
"use client";

import Link from "next/link";
import { type ReactNode, useCallback } from "react";

import { errorMessage } from "@/client/api";
import type { MyProfile, WorkerOffer } from "@/client/worker-api";
import { currentJob, jobStep, pendingOffers, stepAction } from "@/client/worker-view";
import { ButtonLink } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { LoadingText, Notice } from "@/components/ui/notice";
import { Switch } from "@/components/ui/switch";
import { LevelBadge } from "@/components/ui/tag";
import { cx } from "@/lib/cx";
import { formatUsd } from "@/lib/format";
import { REFERENCE_BAND_NOTICE } from "@/lib/legal-copy";

import { NiviCard } from "@/components/voice/nivi-card";

import { useAction } from "../hooks/use-action";
import { useLive } from "../hooks/use-live";
import { ContractGate } from "./contract-gate";
import { OfferCompany, OfferSummary, OfferVoiceNote } from "./offer-card";
import { useWorker } from "./worker-gate";

export function LevelCard({ level }: { readonly level: MyProfile["level"] }) {
  return (
    <Card className="flex flex-col gap-2">
      <LevelBadge level={level.level} />
      <p className="text-ink-2">{level.explanation}</p>
      <p className="text-sm text-muted">
        De {formatUsd(level.referenceBand.min)} a {formatUsd(level.referenceBand.max)} al mes.{" "}
        {REFERENCE_BAND_NOTICE}
      </p>
      <ButtonLink href="/t/nivel" variant="outline" block>
        Ver mi nivel
      </ButtonLink>
    </Card>
  );
}

interface OpenToWorkProps {
  readonly open: boolean;
  readonly onChange: (open: boolean) => void;
  readonly pending: boolean;
}

export function OpenToWorkSwitch({ open, onChange, pending }: OpenToWorkProps) {
  return (
    <Card className="flex items-center justify-between gap-3">
      <div>
        <p id="abierto-titulo" className="text-lg font-extrabold">
          Abierto a trabajar
        </p>
        <p className={cx("text-sm font-semibold", open ? "text-brand" : "text-muted")}>
          {open ? "Las empresas pueden invitarte" : "No recibes invitaciones nuevas"}
        </p>
      </div>
      <Switch checked={open} onChange={onChange} labelledBy="abierto-titulo" disabled={pending} />
    </Card>
  );
}

export function OfferList({ offers }: { readonly offers: readonly WorkerOffer[] }) {
  const pending = pendingOffers(offers);
  return (
    <section aria-labelledby="ofertas-titulo" className="flex flex-col gap-3">
      <h2 id="ofertas-titulo" className="bar-title text-xl font-extrabold">
        Ofertas para ti
      </h2>
      {pending.length === 0 ? (
        <p className="text-muted">Aún no tienes ofertas nuevas. Te avisaremos aquí cuando llegue una.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((offer) => (
            <li key={offer.invitationId}>
              <Card selected className="flex animate-enter flex-col gap-3">
                <OfferCompany company={offer.company} />
                <OfferSummary offer={offer} titleAs="h3" />
                <OfferVoiceNote audioUrl={offer.audioUrl} />
                <ButtonLink href={`/t/oferta/${encodeURIComponent(offer.invitationId)}`} block>
                  Ver oferta
                </ButtonLink>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CurrentJob({ offer }: { readonly offer: WorkerOffer & { contractId: string } }) {
  return (
    <section aria-labelledby="trabajo-titulo" className="flex flex-col gap-3">
      <h2 id="trabajo-titulo" className="bar-title text-xl font-extrabold">
        Tu trabajo
      </h2>
      <Card className="flex flex-col gap-3">
        <Eyebrow>{offer.company.name}</Eyebrow>
        <OfferSummary offer={offer} titleAs="h3" />
        <ContractGate key={offer.contractId} contractId={offer.contractId}>
          {(contract) => <NextStep action={stepAction(jobStep(contract), contract.id)} />}
        </ContractGate>
      </Card>
    </section>
  );
}

export function NextStep({ action }: { readonly action: ReturnType<typeof stepAction> }) {
  if (action.href === null) return <p className="font-semibold text-ink-2">{action.label}</p>;
  return (
    <ButtonLink href={action.href} block>
      {action.label}
    </ButtonLink>
  );
}

export function HelpLink({ href, children }: { readonly href: string; readonly children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center self-start font-semibold text-brand underline decoration-2"
    >
      {children}
    </Link>
  );
}

export function HomeScreen() {
  const { api, offers: offersStore, profile: profileStore } = useWorker();
  const profile = useLive(profileStore);
  const offers = useLive(offersStore);
  const toggle = useAction(async (open: boolean) => {
    await api.correctProfile({ openToWork: open });
    await profileStore.refresh();
  });
  const refreshOffers = useCallback(() => void offersStore.refresh(), [offersStore]);
  const job = currentJob(offers.data ?? []);
  const failure = toggle.error ?? (profile.error === undefined ? null : errorMessage(profile.error));

  return (
    <>
      <h1 className="display text-3xl">Hola{profile.data ? `, ${profile.data.firstName}` : ""}</h1>
      {failure ? <Notice tone="alert">{failure}</Notice> : null}
      {profile.loading ? <LoadingText>Nivi está buscando tu perfil…</LoadingText> : null}
      {profile.data ? (
        <>
          <LevelCard level={profile.data.level} />
          <OpenToWorkSwitch
            open={profile.data.openToWork}
            onChange={(open) => void toggle.invoke(open)}
            pending={toggle.pending}
          />
        </>
      ) : null}
      {job ? <CurrentJob offer={job} /> : null}
      {offers.loading ? <LoadingText>Nivi está revisando tus ofertas…</LoadingText> : null}
      {offers.data ? <OfferList offers={offers.data} /> : null}
      <NiviCard
        title="Habla con Nivi"
        hint="Pregúntale por tus ofertas o acéptalas hablando"
        openSession={api.voice}
        onActivity={refreshOffers}
      />
      <HelpLink href="/t/ayuda">¿Algo salió mal? Pide ayuda</HelpLink>
    </>
  );
}
