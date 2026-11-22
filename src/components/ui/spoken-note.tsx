"use client";

import { useState } from "react";

import { sameSiteAudio } from "@/client/audio-url";
import { Button } from "@/components/ui/button";
import { LoadingText } from "@/components/ui/notice";

interface NotePlayerProps {
  readonly label: string;
  readonly audioUrl: string;
  /** Empieza a sonar apenas aparece (la persona acaba de pedirlo con un toque). */
  readonly autoPlay?: boolean;
}

/** Reproductor de una nota de voz, con controles a la vista por si el navegador no la arranca solo. */
export function NotePlayer({ label, audioUrl, autoPlay = false }: NotePlayerProps) {
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-sm font-semibold text-ink-2">{label}</figcaption>
      <audio controls autoPlay={autoPlay} preload="none" src={audioUrl} className="w-full" />
    </figure>
  );
}

export type SpokenNoteState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly audioUrl: string }
  | { readonly kind: "failed" };

interface SpokenNoteViewProps {
  readonly state: SpokenNoteState;
  /** Texto del botón: "Escuchar la oferta". */
  readonly action: string;
  readonly onListen: () => void;
}

/** Botón para oír un texto que ya está escrito en pantalla, y el reproductor cuando el audio llega. */
export function SpokenNoteView({ state, action, onListen }: SpokenNoteViewProps) {
  if (state.kind === "ready")
    return <NotePlayer label="Nota de voz de Nivi" audioUrl={state.audioUrl} autoPlay />;
  if (state.kind === "loading") return <LoadingText>Nivi está preparando el audio…</LoadingText>;
  return (
    <div className="flex flex-col gap-1.5">
      <Button variant="outline" block onClick={onListen}>
        {action}
      </Button>
      {state.kind === "failed" ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          No pudimos preparar el audio. Todo lo que dice está escrito aquí mismo.
        </p>
      ) : null}
    </div>
  );
}

interface SpokenNoteProps {
  readonly text: string;
  readonly action: string;
  /** Pide el audio del texto y devuelve su dirección dentro de la app. */
  readonly speak: (text: string) => Promise<string>;
}

/**
 * Lee en voz alta un texto que ya está en pantalla. El audio se pide solo
 * cuando la persona lo toca: nadie depende de él para entender la pantalla.
 */
export function SpokenNote({ text, action, speak }: SpokenNoteProps) {
  const [state, setState] = useState<SpokenNoteState>({ kind: "idle" });

  const listen = async () => {
    setState({ kind: "loading" });
    try {
      const audioUrl = sameSiteAudio(await speak(text));
      setState(audioUrl ? { kind: "ready", audioUrl } : { kind: "failed" });
    } catch {
      setState({ kind: "failed" });
    }
  };

  return <SpokenNoteView state={state} action={action} onListen={() => void listen()} />;
}
