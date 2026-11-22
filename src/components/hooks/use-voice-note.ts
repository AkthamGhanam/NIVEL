"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import { errorMessage } from "@/client/api";
import {
  MAX_NOTE_SECONDS,
  noteSeconds,
  recordVoiceNote,
  type VoiceNoteRecording,
} from "@/client/voice-recorder";

/** En qué va la nota: sin empezar, pidiendo el micrófono, grabando o enviándose. */
export type NotePhase = "idle" | "starting" | "recording" | "sending";

export interface VoiceNoteControls {
  readonly phase: NotePhase;
  /** Segundos grabados hasta ahora. */
  readonly seconds: number;
  readonly error: string | null;
  readonly start: () => void;
  readonly finish: () => void;
  readonly cancel: () => void;
}

const TICK_MS = 250;

/** Mientras se graba, avisa los segundos transcurridos varias veces por segundo. */
function useNoteTimer(active: boolean, onTick: (seconds: number) => void): void {
  const tick = useEffectEvent(onTick);
  useEffect(() => {
    if (!active) return undefined;
    const startedAt = Date.now();
    const timer = setInterval(() => tick(noteSeconds(startedAt, Date.now())), TICK_MS);
    return () => clearInterval(timer);
  }, [active]);
}

/**
 * Graba una nota de voz y la entrega a `send`. Corta sola al llegar al máximo
 * y suelta el micrófono al terminar, al descartar o si la persona sale de la pantalla.
 */
export function useVoiceNote(send: (audio: Blob) => Promise<void>): VoiceNoteControls {
  const [phase, setPhase] = useState<NotePhase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recording = useRef<VoiceNoteRecording | null>(null);
  const mounted = useRef(true);

  const fail = (problem: unknown) => {
    setError(errorMessage(problem));
    setPhase("idle");
  };

  const finish = async () => {
    const current = recording.current;
    if (!current) return;
    recording.current = null;
    setPhase("sending");
    try {
      await send(await current.finish());
      setPhase("idle");
    } catch (problem) {
      fail(problem);
    }
  };

  const start = async () => {
    if (phase !== "idle") return;
    setError(null);
    setSeconds(0);
    setPhase("starting");
    try {
      const started = await recordVoiceNote();
      // Si la persona salió mientras el navegador pedía permiso, no se deja el micrófono abierto.
      if (!mounted.current) return started.cancel();
      recording.current = started;
      setPhase("recording");
    } catch (problem) {
      fail(problem);
    }
  };

  const cancel = () => {
    recording.current?.cancel();
    recording.current = null;
    setPhase("idle");
  };

  useNoteTimer(phase === "recording", (elapsed) => {
    setSeconds(elapsed);
    if (elapsed >= MAX_NOTE_SECONDS) void finish();
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      recording.current?.cancel();
      recording.current = null;
    };
  }, []);

  return { phase, seconds, error, start: () => void start(), finish: () => void finish(), cancel };
}
