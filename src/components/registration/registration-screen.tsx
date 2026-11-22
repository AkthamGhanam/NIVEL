"use client";

import { useEffect, useState } from "react";

import { apiRequest, errorMessage } from "@/client/api";
import type { NiviMode } from "@/client/nivi-session";
import { createVoiceApi, waitForProfile } from "@/client/voice-api";
import { createWorkerApi, type MyProfile } from "@/client/worker-api";
import { NivelMark } from "@/components/brand/brand";
import { Notice } from "@/components/ui/notice";
import { NiviVoice } from "@/components/voice/nivi-voice";
import { PhoneStage } from "@/components/worker/worker-shell";
import { DEMO_FOOTER } from "@/lib/legal-copy";

import { ConsentSheet, HeardProfile } from "./registration-views";

/**
 * Espera el perfil que Nivi guarda durante la conversación. Al recogerlo el
 * servidor abre la sesión de esa persona, y con ella se lee el perfil completo.
 */
function useCreatedProfile(conversationId: string | null) {
  const [profile, setProfile] = useState<MyProfile>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!conversationId) return undefined;
    const waiting = new AbortController();
    const voice = createVoiceApi(apiRequest);
    const worker = createWorkerApi(apiRequest);
    const { signal } = waiting;
    waitForProfile(() => voice.claimProfile(conversationId, signal), { signal })
      .then(async (created) => {
        if (created && !signal.aborted) setProfile(await worker.profile(signal));
      })
      .catch((problem: unknown) => {
        if (!signal.aborted) setError(errorMessage(problem));
      });
    return () => waiting.abort();
  }, [conversationId]);

  return { profile, error };
}

function Talking({ mode, real }: { readonly mode: NiviMode; readonly real: boolean }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const { profile, error } = useCreatedProfile(conversationId);
  if (profile) return <HeardProfile profile={profile} />;
  return (
    <>
      <h1 className="display text-3xl">Cuéntale a Nivi quién eres</h1>
      <p className="text-ink-2">
        Nivi te hace unas preguntas cortas. Cuando guarde tu perfil, esta pantalla cambia sola.
      </p>
      {error ? (
        <Notice tone="alert" urgent>
          {error}
        </Notice>
      ) : null}
      <NiviVoice
        agent="worker"
        defaultMode={mode}
        remember={false}
        token={{ registration: true, consent: true, real }}
        onConversation={setConversationId}
      />
    </>
  );
}

/** Registro del trabajador: permiso de voz, conversación con Nivi y "Esto entendimos". */
export function RegistrationScreen({ real }: { readonly real: boolean }) {
  const [mode, setMode] = useState<NiviMode>();
  return (
    <PhoneStage>
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-5">
        <NivelMark />
        {mode ? <Talking mode={mode} real={real} /> : <ConsentSheet real={real} onAccept={setMode} />}
        <p className="text-center text-xs text-muted">{DEMO_FOOTER}</p>
      </main>
    </PhoneStage>
  );
}
