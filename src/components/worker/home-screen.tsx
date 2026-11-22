// Inicio de la app del trabajador: nivel, disponibilidad, trabajo en curso, ofertas y Nivi.
"use client";

import Link from "next/link";
import { type ReactNode, useCallback } from "react";

import { errorMessage } from "@/client/api";
import type { MyProfile, WorkerOffer } from "@/client/worker-api";
import { currentJob, jobStep, pendingOffers, stepAction } from "@/client/worker-view";
import { ButtonLink } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { LoadingText, Notice } from "@/components/ui/notice";
import { Switch } from "@/components/ui/switch";
import { LevelRings } from "@/components/ui/rings";
import { LevelBadge } from "@/components/ui/tag";
import { cx } from "@/lib/cx";

import { TelegramCard } from "@/components/telegram/telegram-card";
import { NiviCard } from "@/components/voice/nivi-card";

import { useAction } from "../hooks/use-action";
import { useLive } from "../hooks/use-live";
import { ContractGate } from "./contract-gate";
import { OfferCompany, OfferSummary, OfferVoiceNote, type Speak } from "./offer-card";
import { useWorker } from "./worker-gate";

/** La consola del trabajador: sus anillos de nivel, qué le falta y la referencia de mercado. */
export function LevelCard({ level }: { readonly level: MyProfile["level"] }) {
  return (
    <section aria-label="Tu nivel" className="console flex flex-col gap-5 rounded-panel p-5 sm:p-6">
      <div className="flex items-center gap-4 sm:gap-5">
        <LevelRings level={level.level} className="w-28 shrink-0 sm:w-40">
          <span aria-hidden="true" className="display figures text-5xl">
            {level.level}
          </span>
        </LevelRings>
        <div className="flex min-w-0 flex-col items-start gap-2.5">
          <LevelBadge level={level.level} tone="signal" />
          <p className="text-lg leading-snug font-semibold text-white">{level.explanation}</p>
        </div>
      </div>
      <ButtonLink href="/t/nivel" variant="outline" block className="border-transparent">
        Ver mi nivel
      </ButtonLink>
    </section>
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
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cx(
            "mt-2 size-3 shrink-0 rounded-full",
            open ? "bg-brand-2 shadow-[0_0_0_5px_var(--color-brand-tint)]" : "bg-line",
          )}
        />
        <div>
          <p id="abierto-titulo" className="text-lg font-extrabold">
            Abierto a trabajar
          </p>
          <p className={cx("text-sm font-semibold", open ? "text-brand" : "text-muted")}>
            {open ? "Las empresas pueden invitarte" : "No recibes invitaciones nuevas"}
          </p>
        </div>
      </div>
      <Switch checked={open} onChange={onChange} labelledBy="abierto-titulo" disabled={pending} />
    </Card>
  );
}

interface OfferListProps {
  readonly offers: readonly WorkerOffer[];
  readonly speak?: Speak;
}

export function OfferList({ offers, speak }: OfferListProps) {
  const pending = pendingOffers(offers);
  return (
    <section aria-labelledby="ofertas-titulo" className="flex flex-col gap-3">
      <h2 id="ofertas-titulo" className="bar-title text-xl font-extrabold">
        Ofertas para ti
      </h2>
      {pending.length === 0 ? (
        <p className="text-muted">Aún no tienes ofertas nuevas. Te avisamos aquí.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((offer) => (
            <li key={offer.invitationId}>
              <Card selected className="flex animate-enter flex-col gap-3">
                <OfferCompany company={offer.company} />
                <OfferSummary offer={offer} titleAs="h3" />
                <OfferVoiceNote offer={offer} speak={speak} />
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
  // Con ofertas por responder, van primero; sin ellas, primero el nivel.
  const hasOffers = pendingOffers(offers.data ?? []).length > 0;
  const failure = toggle.error ?? (profile.error === undefined ? null : errorMessage(profile.error));

  return (
    <>
      <h1 className="display text-4xl">Hola{profile.data ? `, ${profile.data.firstName}` : ""}</h1>
      {failure ? <Notice tone="alert">{failure}</Notice> : null}
      {/* Primero lo que hay que hacer ahora: el trabajo en curso o las ofertas. */}
      {job ? <CurrentJob offer={job} /> : null}
      {offers.loading ? <LoadingText>Nivi está revisando tus ofertas…</LoadingText> : null}
      {hasOffers && !job ? <OfferList offers={offers.data ?? []} speak={api.speak} /> : null}
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
      {offers.data && !hasOffers && !job ? <OfferList offers={offers.data} speak={api.speak} /> : null}
      <NiviCard
        title="Habla con Nivi"
        hint="Pregunta por tus ofertas o acéptalas hablando"
        openSession={api.voice}
        onActivity={refreshOffers}
      />
      <Disclosure title="Más opciones">
        {offers.data && job ? <OfferList offers={offers.data} speak={api.speak} /> : null}
        <TelegramCard role="worker" />
        <HelpLink href="/t/ayuda">¿Algo salió mal? Pide ayuda</HelpLink>
      </Disclosure>
    </>
  );
}
