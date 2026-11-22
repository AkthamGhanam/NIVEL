"use client";

import { useRouter } from "next/navigation";

import type { WorkerOffer } from "@/client/worker-api";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingText, NotEmployerNotice, Notice } from "@/components/ui/notice";
import { Tag } from "@/components/ui/tag";
import { CONTRACT_TYPE_LABELS } from "@/lib/trades";

import { useAction } from "../hooks/use-action";
import { useLive } from "../hooks/use-live";
import { OfferCompany, OfferSummary, OfferVoiceNote } from "./offer-card";
import { useWorker } from "./worker-gate";

interface OfferViewProps {
  readonly offer: WorkerOffer;
  readonly onRespond: (accept: boolean) => void;
  readonly pending: boolean;
  readonly error: string | null;
}

/** Detalle de una oferta: quién invita, qué trabajo es, y aceptar o rechazar. */
export function OfferView({ offer, onRespond, pending, error }: OfferViewProps) {
  return (
    <>
      <OfferCompany company={offer.company} />
      <OfferSummary offer={offer} titleAs="h1" />
      <OfferVoiceNote audioUrl={offer.audioUrl} />
      <Card className="flex flex-col gap-1">
        <p className="text-sm font-bold text-ink-2">Tipo de contrato</p>
        <p>{CONTRACT_TYPE_LABELS[offer.contractType]}</p>
        <NotEmployerNotice className="mt-1" />
      </Card>
      {error ? (
        <Notice tone="alert" urgent>
          {error}
        </Notice>
      ) : null}
      {offer.status === "enviada" ? (
        <div className="mt-auto flex flex-col gap-2">
          <Button block disabled={pending} onClick={() => onRespond(true)}>
            Aceptar
          </Button>
          <Button block variant="outline" disabled={pending} onClick={() => onRespond(false)}>
            Rechazar
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Tag tone={offer.status === "aceptada" ? "ok" : "neutral"} className="self-start">
            {offer.status === "aceptada" ? "Aceptaste esta oferta" : "Rechazaste esta oferta"}
          </Tag>
          {offer.contractId ? (
            <ButtonLink href={`/trabajador/contrato/${encodeURIComponent(offer.contractId)}`} block>
              Ver mi contrato
            </ButtonLink>
          ) : null}
        </div>
      )}
    </>
  );
}

export function OfferScreen({ invitationId }: { readonly invitationId: string }) {
  const { api, offers: store } = useWorker();
  const router = useRouter();
  const live = useLive(store);
  const respond = useAction(async (accept: boolean) => {
    const { offer } = await api.respond(invitationId, accept);
    await store.refresh();
    router.push(
      accept && offer.contractId
        ? `/trabajador/contrato/${encodeURIComponent(offer.contractId)}`
        : "/trabajador",
    );
  });
  const offer = live.data?.find((candidate) => candidate.invitationId === invitationId);

  if (live.loading) return <LoadingText>Nivi está buscando la oferta…</LoadingText>;
  if (!offer) {
    return (
      <>
        <Notice tone="pending">No encontramos esa oferta. Puede que ya no esté disponible.</Notice>
        <ButtonLink href="/trabajador" variant="outline" block>
          Volver al inicio
        </ButtonLink>
      </>
    );
  }
  return (
    <OfferView
      offer={offer}
      onRespond={(accept) => void respond.invoke(accept)}
      pending={respond.pending}
      error={respond.error}
    />
  );
}
