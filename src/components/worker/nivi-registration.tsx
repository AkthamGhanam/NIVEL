// Registro del trabajador conversando con Nivi: al guardarse el perfil, la pantalla lo reclama y abre la sesión.
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ApiError, errorMessage } from "@/client/api";
import { MIN_PASSWORD, rememberAccess } from "@/client/demo-access";
import type { WorkerApi } from "@/client/worker-api";
import { PasswordField } from "@/components/access/account-key";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { isCedula } from "@/lib/profile-options";
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

export interface Claimed {
  readonly firstName: string;
  readonly workerId: string;
}

export async function tryClaim(api: WorkerApi, conversationId: string): Promise<Claimed | null> {
  try {
    const { profile } = await api.claimProfile(conversationId);
    return { firstName: profile.firstName, workerId: profile.workerId };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

interface ClaimWatch {
  readonly api: WorkerApi;
  readonly conversationId: string | null;
  readonly ended: boolean;
  readonly onClaimed: (claimed: Claimed) => void;
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
        const claimed = cancelled ? null : await tryClaim(api, conversationId);
        if (claimed !== null && !cancelled) {
          cancelled = true;
          callbacks.current.onClaimed(claimed);
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
        Acepto que NIVEL use lo que diga para armar mi perfil (
        <Link href="/legal/privacidad" className="font-semibold text-brand underline decoration-2">
          privacidad
        </Link>
        ).
      </span>
    </label>
  );
}

/** Después de hablar con Nivi: cédula y contraseña se ponen en pantalla, nunca en voz alta. */
function Saved({ claimed, onEnter }: { readonly claimed: Claimed; readonly onEnter: () => void }) {
  const [cedula, setCedula] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const secure = async () => {
    if (!isCedula(cedula)) return setProblem("Escribe tu cédula con la letra, por ejemplo V-12345678.");
    if (password.length < MIN_PASSWORD)
      return setProblem(`La contraseña lleva al menos ${MIN_PASSWORD} letras o números.`);
    await rememberAccess("worker", { document: cedula, password }, claimed.workerId);
    onEnter();
  };
  return (
    <div
      role="status"
      className="flex animate-enter flex-col gap-3 rounded-card border-[1.5px] border-brand bg-brand-tint p-4"
    >
      <p className="display text-2xl text-brand">¡Listo, {claimed.firstName}!</p>
      <p className="text-ink-2">
        Tu perfil quedó guardado. Pon tu cédula y una contraseña para volver a entrar si cambias de teléfono.
      </p>
      <TextField
        id="nivi-cedula"
        label="Cédula"
        placeholder="Ej: V-12345678"
        autoCapitalize="characters"
        value={cedula}
        onChange={(event) => setCedula(event.target.value)}
      />
      <PasswordField id="nivi-clave" label="Crea una contraseña" value={password} onChange={setPassword} />
      {problem ? <Notice tone="alert">{problem}</Notice> : null}
      <Button block onClick={() => void secure()}>
        Guardar y entrar
      </Button>
      <Button block variant="outline" onClick={onEnter}>
        Ahora no, entrar
      </Button>
    </div>
  );
}

function Registration({ api, onRegistered }: NiviRegistrationProps) {
  const [consent, setConsent] = useState(false);
  const [saved, setSaved] = useState<Claimed | null>(null);
  const [claimProblem, setClaimProblem] = useState<string | null>(null);
  const nivi = useNivi(() => api.registrationVoice());
  useProfileClaim({
    api,
    conversationId: saved === null ? nivi.conversationId : null,
    ended: nivi.ended,
    onClaimed: setSaved,
    onProblem: setClaimProblem,
  });
  const enter = () => {
    nivi.stop();
    onRegistered();
  };
  const unfinished = nivi.ended && saved === null && nivi.conversationId !== null;
  return (
    <NiviPanel nivi={nivi} locked={!consent} before={<Consent checked={consent} onChange={setConsent} />}>
      {saved !== null ? <Saved claimed={saved} onEnter={enter} /> : null}
      {claimProblem ? <Notice tone="alert">{claimProblem}</Notice> : null}
      {unfinished ? (
        <Notice tone="pending">
          Aún no guardamos tu perfil. Habla o escríbele de nuevo a Nivi, o usa «Prefiero escribir».
        </Notice>
      ) : null}
    </NiviPanel>
  );
}
