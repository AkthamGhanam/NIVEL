// Conversación con Nivi (voz o texto) sobre el SDK de ElevenLabs: estado, burbujas y envío de mensajes.
"use client";

import { useConversation } from "@elevenlabs/react";
import { useState } from "react";

import { errorMessage } from "@/client/api";
import { WORKLET_PATHS } from "@/client/voice-worklets";
import type { OrbState } from "@/components/ui/voice-orb";

export interface NiviSession {
  readonly token: string;
  readonly dynamicVariables: Readonly<Record<string, string>>;
}

export interface NiviBubble {
  readonly id: string;
  readonly from: "nivi" | "tu";
  readonly text: string;
}

export type NiviMode = "voz" | "texto";

export const MIC_DENIED =
  "No pudimos usar tu micrófono. Revisa el permiso del navegador o toca «Escribirle a Nivi».";

export function orbState(status: string, isSpeaking: boolean, starting: boolean): OrbState {
  if (status === "connecting" || starting) return "thinking";
  if (status !== "connected") return "idle";
  return isSpeaking ? "speaking" : "listening";
}

export function addBubble(list: readonly NiviBubble[], from: NiviBubble["from"], text: string): NiviBubble[] {
  const clean = text.trim();
  const last = list.at(-1);
  if (!clean || (last?.from === from && last.text === clean)) return [...list];
  return [...list, { id: `${list.length}-${from}`, from, text: clean }];
}

function useNiviSession(openSession: () => Promise<NiviSession>) {
  const [starting, setStarting] = useState(false);
  const [mode, setMode] = useState<NiviMode>("voz");
  const [problem, setProblem] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState<NiviBubble[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);

  const conversation = useConversation({
    onConnect: ({ conversationId: id }) => {
      setConversationId(id);
      setEnded(false);
    },
    onMessage: ({ message, role }) =>
      setBubbles((current) => addBubble(current, role === "agent" ? "nivi" : "tu", message)),
    onDisconnect: () => setEnded(true),
    onError: (message) => setProblem(message || "Se cortó la conversación. Intenta de nuevo."),
  });

  const start = async (next: NiviMode) => {
    setProblem(null);
    setStarting(true);
    setMode(next);
    setBubbles([]);
    try {
      if (next === "voz") await navigator.mediaDevices.getUserMedia({ audio: true });
      const session = await openSession();
      conversation.startSession({
        conversationToken: session.token,
        connectionType: "webrtc",
        textOnly: next === "texto",
        dynamicVariables: { ...session.dynamicVariables },
        workletPaths: { ...WORKLET_PATHS },
      });
    } catch (error) {
      setProblem(error instanceof DOMException ? MIC_DENIED : errorMessage(error));
    } finally {
      setStarting(false);
    }
  };

  const send = (text: string) => {
    if (!text.trim()) return;
    setBubbles((current) => addBubble(current, "tu", text));
    conversation.sendUserMessage(text.trim());
  };
  return { ...conversation, start, send, starting, mode, problem, bubbles, conversationId, ended };
}

export function useNivi(openSession: () => Promise<NiviSession>) {
  const session = useNiviSession(openSession);
  const { start, send, starting, mode, problem, bubbles, conversationId, ended } = session;

  const { status, isSpeaking, isMuted, setMuted } = session;
  return {
    /** Micrófono en pausa: Nivi no oye nada hasta que la persona lo reactiva. Útil con mucho ruido alrededor. */
    muted: isMuted,
    toggleMute: () => setMuted(!isMuted),
    start,
    send,
    stop: session.endSession,
    mode,
    live: status === "connected" || status === "connecting",
    connected: status === "connected",
    orb: orbState(status, isSpeaking, starting),
    voice: mode === "voz",
    starting,
    problem,
    bubbles,
    conversationId,
    ended,
  };
}

export type Nivi = ReturnType<typeof useNivi>;
