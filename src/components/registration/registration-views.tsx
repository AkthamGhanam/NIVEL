import Link from "next/link";

import {
  CONSENT_CHOICES,
  heardFacts,
  PRIVACY_AUDIO_URL,
  REAL_PERSON_NOTICE,
  VOICE_CONSENT_POINTS,
} from "@/client/registration-view";
import type { NiviMode } from "@/client/nivi-session";
import type { MyProfile } from "@/client/worker-api";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { NotePlayer } from "@/components/ui/spoken-note";
import { LevelBadge } from "@/components/ui/tag";
import { formatUsd } from "@/lib/format";
import { REFERENCE_BAND_NOTICE } from "@/lib/legal-copy";

interface ConsentSheetProps {
  /** Persona real del evento (`?real=1`): ve el aviso de que esto es una prueba. */
  readonly real: boolean;
  readonly onAccept: (mode: NiviMode) => void;
}

/**
 * Hoja de permiso de voz. Nada se graba ni se guarda antes de este toque, y
 * las dos formas de seguir (hablar o escribir) dicen con palabras que se acepta.
 */
export function ConsentSheet({ real, onAccept }: ConsentSheetProps) {
  return (
    <>
      <div>
        <Eyebrow className="text-brand">Registro</Eyebrow>
        <h1 className="display mt-1 text-3xl">Crea tu perfil hablando con Nivi</h1>
        <p className="mt-1 text-ink-2">
          Toma unos dos minutos. Antes, esto es lo que hacemos con tu voz y tus datos:
        </p>
      </div>
      {real ? <Notice tone="pending">{REAL_PERSON_NOTICE}</Notice> : null}
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[0.9375rem] text-ink-2">
        {VOICE_CONSENT_POINTS.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <NotePlayer label="Escuchar antes de aceptar" audioUrl={PRIVACY_AUDIO_URL} />
      <p className="text-sm text-muted">
        El detalle completo está en{" "}
        <Link href="/legal/privacidad" className="font-semibold text-brand underline">
          Privacidad
        </Link>
        .
      </p>
      <div className="mt-auto flex flex-col gap-2">
        {CONSENT_CHOICES.map((choice, index) => (
          <Button
            key={choice.mode}
            block
            variant={index === 0 ? "primary" : "outline"}
            onClick={() => onAccept(choice.mode)}
          >
            {choice.label}
          </Button>
        ))}
        <ButtonLink href="/t" variant="outline" block>
          Ya tengo perfil
        </ButtonLink>
      </div>
    </>
  );
}

interface HeardProfileProps {
  readonly profile: MyProfile;
}

/** "Esto entendimos": lo que quedó guardado, con la salida para corregirlo antes de seguir. */
export function HeardProfile({ profile }: HeardProfileProps) {
  return (
    <>
      <div>
        <Eyebrow className="text-brand">Perfil creado</Eyebrow>
        <h1 className="display mt-1 text-3xl">Esto entendimos, {profile.firstName}</h1>
      </div>
      <Card>
        <dl className="flex flex-col gap-2">
          {heardFacts(profile).map((fact) => (
            <div key={fact.label}>
              <dt className="text-sm font-bold text-ink-2">{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card className="flex flex-col gap-1.5">
        <LevelBadge level={profile.level.level} />
        <p className="text-[0.9375rem] text-ink-2">{profile.level.explanation}</p>
        <p className="text-sm text-muted">
          De {formatUsd(profile.level.referenceBand.min)} a {formatUsd(profile.level.referenceBand.max)} al
          mes. {REFERENCE_BAND_NOTICE}
        </p>
      </Card>
      <div className="mt-auto flex flex-col gap-2">
        <ButtonLink href="/t" block>
          Confirmar y entrar
        </ButtonLink>
        <ButtonLink href="/t/mis-datos" variant="outline" block>
          Corregir
        </ButtonLink>
      </div>
    </>
  );
}
