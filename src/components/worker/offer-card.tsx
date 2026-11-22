import { sameSiteAudio } from "@/client/audio-url";
import type { WorkerOffer } from "@/client/worker-api";
import { offerFacts, offerSpeech, offerTitle, paysOnTimeLabel } from "@/client/worker-view";
import { NotePlayer, SpokenNote } from "@/components/ui/spoken-note";
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

/** Pide el audio de una frase en la voz de Nivi y devuelve su dirección dentro de la app. */
export type Speak = (text: string) => Promise<string>;

interface OfferVoiceNoteProps {
  readonly offer: WorkerOffer;
  /** Sin esta función (por ejemplo, sin servicio de voz) la oferta se queda solo en texto. */
  readonly speak?: Speak | undefined;
}

/**
 * Nota de voz de la invitación. Siempre va con el texto de la oferta al lado:
 * nadie depende del audio para entenderla. Si la invitación ya trae su audio
 * se muestra de una vez; si no, Nivi la lee cuando la persona lo pide.
 */
export function OfferVoiceNote({ offer, speak }: OfferVoiceNoteProps) {
  const recorded = sameSiteAudio(offer.audioUrl);
  if (recorded) return <NotePlayer label="Nota de voz de Nivi" audioUrl={recorded} />;
  if (!speak) return null;
  return <SpokenNote text={offerSpeech(offer)} action="Escuchar la oferta" speak={speak} />;
}
