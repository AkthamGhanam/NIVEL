"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { errorMessage } from "@/client/api";
import { createCelebration, levelUpSpeech } from "@/client/level-up";
import { createLiveStore } from "@/client/live-store";
import type { LevelStatus } from "@/client/worker-api";
import { levelFacts } from "@/client/worker-view";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { LoadingText, Notice } from "@/components/ui/notice";
import { formatUsd } from "@/lib/format";
import { REFERENCE_BAND_NOTICE } from "@/lib/legal-copy";

import { useLive } from "../hooks/use-live";
import { useWorker } from "./worker-gate";

interface LevelViewProps {
  readonly level: LevelStatus;
  /** La persona acaba de subir: se celebra arriba de todo. */
  readonly celebrate: boolean;
  /** La felicitación que dice Nivi; va escrita junto al botón para oírla de nuevo. */
  readonly congratulation?: string | undefined;
  readonly onListen?: () => void;
}

/** El nivel de la persona, los hechos que lo sostienen y qué le falta para el siguiente. */
export function LevelView({ level, celebrate, congratulation, onListen }: LevelViewProps) {
  return (
    <>
      <div className="flex flex-col items-center gap-2 rounded-card bg-ink px-4 py-8 text-center text-white">
        {celebrate ? (
          <p role="status" className="display animate-enter text-3xl text-brand-on-ink">
            ¡Subiste de nivel!
          </p>
        ) : null}
        <p className="eyebrow text-muted-on-ink">Tu nivel</p>
        <h1 className="display text-5xl">
          Nivel {level.level}
          <span className="mt-1 block text-3xl text-brand-on-ink">{level.levelName}</span>
        </h1>
      </div>
      {celebrate && congratulation ? (
        <Card className="flex flex-col gap-3">
          <p className="text-lg font-semibold">{congratulation}</p>
          <Button variant="outline" block onClick={onListen}>
            Escuchar la felicitación
          </Button>
        </Card>
      ) : null}
      <Card>
        <Eyebrow>Lo que ya lograste</Eyebrow>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 marker:text-brand">
          {levelFacts(level.facts).map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </Card>
      <Card>
        <Eyebrow>Lo que sigue</Eyebrow>
        <p className="mt-2 text-ink-2">{level.explanation}</p>
      </Card>
      <p className="text-sm text-muted">
        Trabajos de este nivel pagan de {formatUsd(level.referenceBand.min)} a{" "}
        {formatUsd(level.referenceBand.max)} al mes. {REFERENCE_BAND_NOTICE}
      </p>
      <Link
        href="/legal/niveles"
        className="inline-flex min-h-12 items-center font-semibold text-brand underline decoration-2"
      >
        Cómo se calcula el nivel
      </Link>
      <ButtonLink href="/t/aprender" variant="outline" block>
        Ver mi ruta
      </ButtonLink>
    </>
  );
}

/** Al llegar tras subir de nivel suena la celebración; al salir de la pantalla se calla. */
function useCelebration(text: string | undefined) {
  const { api } = useWorker();
  const [celebration] = useState(() => createCelebration({ speak: api.speak }));
  useEffect(() => {
    if (text === undefined) return;
    void celebration.play(text);
    return celebration.stop;
  }, [celebration, text]);
  return () => {
    if (text !== undefined) void celebration.play(text);
  };
}

export function LevelScreen({ celebrate }: { readonly celebrate: boolean }) {
  const { api, profile } = useWorker();
  const [store] = useState(() => createLiveStore((signal) => api.level(signal)));
  const live = useLive(store);
  const firstName = useLive(profile).data?.firstName;
  const level = live.data;
  const congratulation = celebrate && level && firstName ? levelUpSpeech({ ...level, firstName }) : undefined;
  const listen = useCelebration(congratulation);
  if (live.loading) return <LoadingText>Nivi está calculando tu nivel…</LoadingText>;
  if (!level) return <Notice tone="alert">{errorMessage(live.error)}</Notice>;
  return <LevelView level={level} celebrate={celebrate} congratulation={congratulation} onListen={listen} />;
}
