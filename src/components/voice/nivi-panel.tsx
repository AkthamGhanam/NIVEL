// Panel de Nivi: orbe, conversación en burbujas, hablar o escribir, y terminar.
"use client";

import { ConversationProvider } from "@elevenlabs/react";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { MicIcon, MicOffIcon } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { VoiceOrb } from "@/components/ui/voice-orb";
import { cx } from "@/lib/cx";

import type { Nivi, NiviBubble } from "./use-nivi";

export const NiviProvider = ConversationProvider;

function Transcript({ bubbles }: { readonly bubbles: readonly NiviBubble[] }) {
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [bubbles.length]);
  if (bubbles.length === 0) return null;
  return (
    <ol
      aria-label="Conversación con Nivi"
      aria-live="polite"
      className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1"
    >
      {bubbles.map((bubble) => (
        <li
          key={bubble.id}
          className={cx(
            "max-w-[85%] animate-enter rounded-card px-4 py-2.5 text-[1.0625rem]",
            bubble.from === "nivi"
              ? "self-start rounded-tl-sm bg-brand-tint text-ink"
              : "self-end rounded-tr-sm bg-ink text-white",
          )}
        >
          <span className="sr-only">{bubble.from === "nivi" ? "Nivi: " : "Tú: "}</span>
          {bubble.text}
        </li>
      ))}
      <li ref={end} aria-hidden="true" />
    </ol>
  );
}

function MessageBox({ nivi }: { readonly nivi: Nivi }) {
  const [text, setText] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    nivi.send(text);
    setText("");
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <label htmlFor="nivi-mensaje" className="sr-only">
        Escríbele a Nivi
      </label>
      <input
        id="nivi-mensaje"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Escribe aquí tu respuesta…"
        autoComplete="off"
        maxLength={500}
        disabled={!nivi.connected}
        className="min-h-12 min-w-0 flex-1 rounded-control border-[1.5px] border-line bg-surface px-3 text-base text-ink placeholder:text-muted"
      />
      <Button type="submit" disabled={!nivi.connected || !text.trim()}>
        Enviar
      </Button>
    </form>
  );
}

/** Con mucho ruido alrededor, la persona pausa su micrófono y Nivi solo la oye cuando ella quiere. */
export function MuteControl({ nivi }: { readonly nivi: Pick<Nivi, "muted" | "toggleMute"> }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Button
        variant={nivi.muted ? "primary" : "outline"}
        block
        aria-pressed={nivi.muted}
        onClick={nivi.toggleMute}
      >
        {nivi.muted ? <MicIcon size={22} /> : <MicOffIcon size={22} />}
        {nivi.muted ? "Volver a hablar" : "Pausar mi micrófono"}
      </Button>
      <p role="status" className="text-sm text-muted">
        {nivi.muted ? "Nivi no te oye hasta que vuelvas a hablar." : "Habla cuando Nivi termine."}
      </p>
    </div>
  );
}

function StartButtons({ nivi, locked }: { readonly nivi: Nivi; readonly locked: boolean }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Button block disabled={locked || nivi.starting} onClick={() => void nivi.start("voz")}>
        {nivi.starting && nivi.mode === "voz" ? "Conectando…" : "Hablar con Nivi"}
      </Button>
      <Button
        variant="outline"
        block
        disabled={locked || nivi.starting}
        onClick={() => void nivi.start("texto")}
      >
        {nivi.starting && nivi.mode === "texto" ? "Conectando…" : "Escribirle a Nivi"}
      </Button>
    </div>
  );
}

interface NiviPanelProps {
  readonly nivi: Nivi;
  readonly locked?: boolean;
  readonly before?: ReactNode;
  readonly children?: ReactNode;
}

export function NiviPanel({ nivi, locked = false, before, children }: NiviPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <VoiceOrb state={nivi.orb} size="md" />
      <Transcript bubbles={nivi.bubbles} />
      {nivi.problem ? (
        <Notice tone="alert" urgent>
          {nivi.problem}
        </Notice>
      ) : null}
      {children}
      {nivi.live ? (
        <>
          {nivi.voice && nivi.connected ? <MuteControl nivi={nivi} /> : null}
          <MessageBox nivi={nivi} />
          <Button variant="outline" block onClick={nivi.stop}>
            Terminar la conversación
          </Button>
        </>
      ) : (
        <>
          {before}
          <StartButtons nivi={nivi} locked={locked} />
        </>
      )}
    </div>
  );
}
