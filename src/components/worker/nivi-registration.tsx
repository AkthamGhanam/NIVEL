// Registro del trabajador conversando con Nivi: al guardarse el perfil, la pantalla lo reclama y abre la sesión.
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ApiError, errorMessage } from "@/client/api";
import type { WorkerApi } from "@/client/worker-api";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { NiviPanel, NiviProvider } from "@/components/voice/nivi-panel";
import { useNivi } from "@/components/voice/use-nivi";

export const CLAIM_POLL_MS = 2500;

interface NiviRegistrationProps {
  readonly api: WorkerApi;
  readonly onRegistered: () => void;
}

export function NiviRegistration(props: NiviRegistrationProps) {
  return (
    <NiviProvider>
      <Registration {...props} />
    </NiviProvider>
  );
}

export async function tryClaim(api: WorkerApi, conversationId: string): Promise<string | null> {
  try {
    return (await api.claimProfile(conversationId)).profile.firstName;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

interface ClaimWatch {
  readonly api: WorkerApi;
  readonly conversationId: string | null;
  readonly ended: boolean;
  readonly onClaimed: (firstName: string) => void;
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
        const firstName = cancelled ? null : await tryClaim(api, conversationId);
        if (firstName !== null && !cancelled) {
          cancelled = true;
          callbacks.current.onClaimed(firstName);
        }
      } catch (error) {
        if (!cancelled) callbacks.current.onProblem(errorMessage(error));
      }
    };
    void check();
    const timer = ended ? undefined : setInterval(() => void check(), CLAIM_POLL_MS);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [api, conversationId, ended]);
}

function Consent({
  checked,
  onChange,
}: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 text-ink-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-6 shrink-0 accent-brand"
      />
      <span>
        Tengo 18 años o más y acepto que NIVEL use lo que diga para armar mi perfil (
        <Link href="/legal/privacidad" className="font-semibold text-brand underline decoration-2">
          privacidad
        </Link>
        ).
      </span>
    </label>
  );
}

function Saved({ firstName, onEnter }: { readonly firstName: string; readonly onEnter: () => void }) {
  return (
    <div
      role="status"
      className="flex animate-enter flex-col gap-3 rounded-card border-[1.5px] border-brand bg-brand-tint p-4"
    >
      <p className="display text-2xl text-brand">¡Listo, {firstName}!</p>
      <p className="text-ink-2">Tu perfil quedó guardado. Ya puedes entrar a tu app.</p>
      <Button block onClick={onEnter}>
        Entrar a mi app
      </Button>
    </div>
  );
}

function Registration({ api, onRegistered }: NiviRegistrationProps) {
  const [consent, setConsent] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [claimProblem, setClaimProblem] = useState<string | null>(null);
  const nivi = useNivi(() => api.registrationVoice());
  useProfileClaim({
    api,
    conversationId: savedName === null ? nivi.conversationId : null,
    ended: nivi.ended,
    onClaimed: setSavedName,
    onProblem: setClaimProblem,
  });
  const enter = () => {
    nivi.stop();
    onRegistered();
  };
  const unfinished = nivi.ended && savedName === null && nivi.conversationId !== null;
  return (
    <NiviPanel nivi={nivi} locked={!consent} before={<Consent checked={consent} onChange={setConsent} />}>
      {savedName !== null ? <Saved firstName={savedName} onEnter={enter} /> : null}
      {claimProblem ? <Notice tone="alert">{claimProblem}</Notice> : null}
      {unfinished ? (
        <Notice tone="pending">
          Aún no guardamos tu perfil. Habla o escríbele de nuevo a Nivi, o usa «Prefiero escribir».
        </Notice>
      ) : null}
    </NiviPanel>
  );
}
