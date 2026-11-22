"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";

import {
  MAX_MESSAGE_LENGTH,
  NIVI_MODE_LABELS,
  NIVI_MODES,
  type NiviMode,
  type NiviSession,
  type NiviState,
  type TranscriptLine,
} from "@/client/nivi-session";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { LoadingText, Notice } from "@/components/ui/notice";
import { VoiceOrb } from "@/components/ui/voice-orb";
import { cx } from "@/lib/cx";

/** Lo que se promete antes de pedir el micrófono (sección 7.1 de la especificación). */
export const MICROPHONE_PROMISE = "Para hablar con Nivi usamos tu micrófono. No guardamos el audio.";

export type NiviActions = Pick<NiviSession, "start" | "stop" | "setMode" | "hold" | "release" | "sendText">;

const MODE_ICONS: Readonly<Record<NiviMode, string>> = {
  // Micrófono, teléfono y teclado, dibujados con trazos simples.
  nota: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-6 9a6 6 0 0 0 12 0M12 18v3",
  llamada: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z",
  texto: "M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10",
};

function ModeSwitch({
  mode,
  onChange,
}: {
  readonly mode: NiviMode;
  readonly onChange: (mode: NiviMode) => void;
}) {
  return (
    <div role="group" aria-label="Cómo quieres hablar con Nivi" className="flex gap-1.5">
      {NIVI_MODES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === mode}
          onClick={() => onChange(option)}
          className={cx(
            "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-control",
            "border-[1.5px] px-1 text-[0.8125rem] leading-tight font-bold whitespace-nowrap",
            option === mode ? "border-brand bg-brand-tint text-ink" : "border-line bg-surface text-ink-2",
          )}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5 shrink-0 fill-none stroke-current stroke-2"
          >
            <path d={MODE_ICONS[option]} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {NIVI_MODE_LABELS[option]}
        </button>
      ))}
    </div>
  );
}

/** La conversación escrita: todo lo que suena también se puede leer. */
export function Transcript({ lines }: { readonly lines: readonly TranscriptLine[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [lines.length]);
  if (lines.length === 0) return null;
  return (
    <div
      role="log"
      aria-label="Conversación con Nivi"
      tabIndex={0}
      className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-card border-[1.5px] border-line bg-canvas p-3"
    >
      {lines.map((line) => (
        <p
          key={line.id}
          className={cx(
            "max-w-[85%] rounded-card px-3 py-2 text-[0.9375rem] leading-snug",
            line.from === "nivi" ? "self-start bg-brand-tint text-ink" : "self-end bg-ink text-white",
          )}
        >
          <span className="sr-only">{line.from === "nivi" ? "Nivi: " : "Tú: "}</span>
          {line.text}
        </p>
      ))}
      <div ref={end} />
    </div>
  );
}

const HOLD_KEYS: readonly string[] = [" ", "Enter"];

/** Mantener presionado abre el micrófono; soltar lo cierra. Funciona con el dedo, el ratón y el teclado. */
function HoldToTalk({ state, actions }: { readonly state: NiviState; readonly actions: NiviActions }) {
  const onKey = (act: () => void) => (event: KeyboardEvent) => {
    if (!HOLD_KEYS.includes(event.key) || event.repeat) return;
    event.preventDefault();
    act();
  };
  return (
    <button
      type="button"
      aria-pressed={state.talking}
      onPointerDown={actions.hold}
      onPointerUp={actions.release}
      onPointerLeave={actions.release}
      onPointerCancel={actions.release}
      onKeyDown={onKey(actions.hold)}
      onKeyUp={onKey(actions.release)}
      onContextMenu={(event) => event.preventDefault()}
      className={cx(
        "min-h-16 w-full touch-none rounded-control px-5 text-lg font-extrabold text-white select-none",
        state.talking ? "bg-brand-2" : "bg-brand",
      )}
    >
      {state.talking ? "Te escucho… suelta para enviar" : "Mantén presionado para hablar"}
    </button>
  );
}

function TextComposer({ onSend }: { readonly onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (text.trim() === "") return;
    onSend(text);
    setText("");
  };
  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <TextField
        id="nivi-mensaje"
        label="Escríbele a Nivi"
        value={text}
        maxLength={MAX_MESSAGE_LENGTH}
        autoComplete="off"
        onChange={(event) => setText(event.target.value)}
        wrapperClassName="flex-1"
      />
      <Button type="submit">Enviar</Button>
    </form>
  );
}

function LiveControls({ state, actions }: { readonly state: NiviState; readonly actions: NiviActions }) {
  return (
    <>
      {state.mode === "nota" ? <HoldToTalk state={state} actions={actions} /> : null}
      {state.mode === "llamada" ? (
        <p className="text-center text-sm font-semibold text-ink-2">
          Micrófono abierto: habla con normalidad.
        </p>
      ) : null}
      {state.mode === "texto" ? <TextComposer onSend={actions.sendText} /> : null}
      <Button variant="outline" block onClick={() => void actions.stop()}>
        {state.mode === "llamada" ? "Colgar" : "Terminar"}
      </Button>
    </>
  );
}

function StartControls({ state, actions }: { readonly state: NiviState; readonly actions: NiviActions }) {
  if (state.status === "connecting") {
    return (
      <>
        <LoadingText>Conectando con Nivi…</LoadingText>
        <Button variant="outline" block onClick={() => void actions.stop()}>
          Cancelar
        </Button>
      </>
    );
  }
  return (
    <>
      {state.mode === "texto" ? null : <p className="text-center text-sm text-muted">{MICROPHONE_PROMISE}</p>}
      <Button block onClick={() => void actions.start()}>
        {state.mode === "texto" ? "Escribirle a Nivi" : "Hablar con Nivi"}
      </Button>
    </>
  );
}

interface NiviVoiceViewProps {
  readonly state: NiviState;
  readonly actions: NiviActions;
}

/**
 * Nivi en pantalla: selector de modo, orbe con su estado en palabras, la
 * conversación escrita y los controles del modo elegido.
 */
export function NiviVoiceView({ state, actions }: NiviVoiceViewProps) {
  return (
    <div className="flex flex-col gap-3">
      <ModeSwitch mode={state.mode} onChange={actions.setMode} />
      <VoiceOrb state={state.activity} size="md" />
      <Transcript lines={state.lines} />
      {state.error ? (
        <Notice tone="alert" urgent>
          {state.error}
        </Notice>
      ) : null}
      {state.status === "live" ? (
        <LiveControls state={state} actions={actions} />
      ) : (
        <StartControls state={state} actions={actions} />
      )}
    </div>
  );
}
