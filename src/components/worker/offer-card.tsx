import type { WorkerOffer } from "@/client/worker-api";
import { offerFacts, offerTitle, paysOnTimeLabel } from "@/client/worker-view";
import { Tag } from "@/components/ui/tag";

/** Quién invita: nombre, si está verificada y su puntualidad de pago, que es un hecho medido. */
export function OfferCompany({ company }: { readonly company: WorkerOffer["company"] }) {
  const paysOnTime = paysOnTimeLabel(company.paysOnTimePercent);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-bold">{company.name}</p>
      <div className="flex flex-wrap gap-1.5">
        <Tag tone={company.verified ? "ok" : "pending"}>
          {company.verified ? "Empresa verificada" : "Verificación pendiente"}
        </Tag>
        {company.paysInRegla ? <Tag tone="ok">Paga en regla</Tag> : null}
        {paysOnTime ? <Tag tone="ok">{paysOnTime}</Tag> : null}
      </div>
    </div>
  );
}

type OfferTerms = Pick<WorkerOffer, "trade" | "zone" | "days" | "startDate" | "dailyPayUsd" | "totalUsd">;

/** El trabajo en pocas palabras: oficio, zona, días, pago diario y total. */
export function OfferSummary({
  offer,
  titleAs: Title = "h2",
}: {
  readonly offer: OfferTerms;
  readonly titleAs?: "h1" | "h2" | "h3";
}) {
  return (
    <div>
      <Title className="display text-2xl">{offerTitle(offer)}</Title>
      <ul className="mt-1.5 flex flex-col gap-0.5 text-ink-2">
        {offerFacts(offer).map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Nota de voz de la invitación. Siempre va con el texto de la oferta al lado:
 * nadie depende del audio para entenderla.
 */
export function OfferVoiceNote({ audioUrl }: { readonly audioUrl: string | null }) {
  if (!audioUrl) return null;
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-sm font-semibold text-ink-2">Nota de voz de Nivi</figcaption>
      <audio controls preload="none" src={audioUrl} className="w-full" />
    </figure>
  );
}
