"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ApiError, errorMessage } from "@/client/api";
import type { WorkerApi } from "@/client/worker-api";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { type OrbState, VoiceOrb } from "@/components/ui/voice-orb";

/** Cada cuánto se pregunta si Nivi ya guardó el perfil de esta conversación. */
export const CLAIM_POLL_MS = 3000;

export const MIC_DENIED =
  "Necesitamos tu micrófono para hablar con Nivi. Revisa el permiso del navegador o usa el formulario.";

interface Bubble {
  readonly id: number;
  readonly from: "nivi" | "tu";
  readonly text: string;
}

interface NiviRegistrationProps {
  readonly api: WorkerApi;
  /** El perfil quedó creado y la sesión abierta. */
  readonly onRegistered: () => void;
}

/** Registro hablando con Nivi: la conversación corre en ElevenLabs y el perfil lo guarda el servidor. */
export function NiviRegistration(props: NiviRegistrationProps) {
  return (
    <ConversationProvider>
      <Conversation {...props} />
    </ConversationProvider>
  );
}

/** ¿Ya existe el perfil? 404 significa que Nivi todavía no lo guardó. */
export async function tryClaim(api: WorkerApi, conversationId: string): Promise<boolean> {
  try {
    await api.claimProfile(conversationId);
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return false;
    throw error;
  }
}

/**
 * Mientras se habla (y una vez más al colgar) pregunta si Nivi ya guardó el
 * perfil. Cuando existe, avisa una sola vez.
 */
interface ClaimWatch {
  readonly api: WorkerApi;
  /** Conversación en curso; nula si no hay ninguna o el perfil ya se reclamó. */
  readonly conversationId: string | null;
  readonly ended: boolean;
  readonly onClaimed: () => void;
  readonly onProblem: (message: string) => void;
}

function useProfileClaim({ api, conversationId, ended, onClaimed, onProblem }: ClaimWatch) {
  const callbacks = useRef({ onClaimed, onProblem });
  useEffect(() => {
    callbacks.current = { onClaimed, onProblem };
  });
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    const check = async () => {
      try {
        if (!cancelled && (await tryClaim(api, conversationId))) {
          cancelled = true;
          callbacks.current.onClaimed();
        }
      } catch (error) {
        if (!cancelled) callbacks.current.onProblem(errorMessage(error));
      }
    };
    if (ended) void check();
    const timer = ended ? undefined : setInterval(() => void check(), CLAIM_POLL_MS);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [api, conversationId, ended]);
}

export function orbState(status: string, isSpeaking: boolean, starting: boolean): OrbState {
  if (status === "connecting" || starting) return "thinking";
  if (status !== "connected") return "idle";
  return isSpeaking ? "speaking" : "listening";
}

/** Pide el micrófono, luego el token (así no se gasta uno si no hay permiso) y abre la conversación. */
async function openRegistration(
  api: WorkerApi,
  startSession: ReturnType<typeof useConversation>["startSession"],
): Promise<void> {
  await navigator.mediaDevices.getUserMedia({ audio: true });
  const session = await api.registrationVoice();
  startSession({
    conversationToken: session.token,
    connectionType: "webrtc",
    dynamicVariables: { ...session.dynamicVariables },
  });
}

function useNiviConversation({ api, onRegistered }: NiviRegistrationProps) {
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const conversation = useConversation({
    onConnect: ({ conversationId: id }) => {
      setConversationId(id);
      setEnded(false);
    },
    onMessage: ({ message, role, event_id }) => {
      if (!message.trim()) return;
      setBubbles((current) => [
        ...current,
        { id: event_id, from: role === "agent" ? "nivi" : "tu", text: message },
      ]);
    },
    onDisconnect: () => setEnded(true),
    onError: (message) => setProblem(message || "Se cortó la conversación."),
  });

  useProfileClaim({
    api,
    conversationId: claimed ? null : conversationId,
    ended,
    onClaimed: () => {
      setClaimed(true);
      conversation.endSession();
      onRegistered();
    },
    onProblem: setProblem,
  });

  const start = async () => {
    setProblem(null);
    setStarting(true);
    setBubbles([]);
    try {
      await openRegistration(api, conversation.startSession);
    } catch (error) {
      setProblem(error instanceof DOMException ? MIC_DENIED : errorMessage(error));
    } finally {
      setStarting(false);
    }
  };

  const { status, isSpeaking } = conversation;
  const live = status === "connected" || status === "connecting";
  const unfinished = ended && !claimed && conversationId !== null;
  return {
    start,
    stop: conversation.endSession,
    live,
    orb: orbState(status, isSpeaking, starting),
    starting,
    problem,
    bubbles,
    unfinished,
  };
}

function Transcript({ bubbles }: { readonly bubbles: readonly Bubble[] }) {
  if (bubbles.length === 0) return null;
  return (
    <ol aria-label="Conversación con Nivi" className="flex max-h-72 flex-col gap-2 overflow-y-auto">
      {bubbles.map((bubble) => (
        <li
          key={`${bubble.from}-${bubble.id}`}
          className={
            bubble.from === "nivi"
              ? "self-start rounded-card rounded-tl-sm bg-brand-tint px-3 py-2 text-ink"
              : "self-end rounded-card rounded-tr-sm bg-ink px-3 py-2 text-white"
          }
        >
          <span className="sr-only">{bubble.from === "nivi" ? "Nivi: " : "Tú: "}</span>
          {bubble.text}
        </li>
      ))}
    </ol>
  );
}

function StartControls({ starting, onStart }: { readonly starting: boolean; readonly onStart: () => void }) {
  const [consent, setConsent] = useState(false);
  return (
    <>
      <label className="flex min-h-12 items-start gap-3 text-ink-2">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1 size-5 shrink-0 accent-brand"
        />
        <span>
          Tengo 18 años o más y acepto que NIVEL use mi voz y lo que diga para armar mi perfil (
          <Link href="/legal/privacidad" className="font-semibold text-brand underline decoration-2">
            privacidad
          </Link>
          ).
        </span>
      </label>
      <Button block disabled={!consent || starting} onClick={onStart}>
        {starting ? "Conectando con Nivi…" : "Hablar con Nivi"}
      </Button>
    </>
  );
}

function Conversation(props: NiviRegistrationProps) {
  const nivi = useNiviConversation(props);
  return (
    <div className="flex flex-col gap-4">
      <VoiceOrb state={nivi.orb} size="md" />
      <Transcript bubbles={nivi.bubbles} />
      {nivi.problem ? (
        <Notice tone="alert" urgent>
          {nivi.problem}
        </Notice>
      ) : null}
      {nivi.unfinished ? (
        <Notice tone="pending">
          No llegamos a guardar tu perfil. Puedes hablar de nuevo con Nivi o escribirlo en el formulario.
        </Notice>
      ) : null}
      {nivi.live ? (
        <Button variant="outline" block onClick={nivi.stop}>
          Terminar la conversación
        </Button>
      ) : (
        <StartControls starting={nivi.starting} onStart={() => void nivi.start()} />
      )}
    </div>
  );
}
