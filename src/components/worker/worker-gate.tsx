"use client";

import { useSearchParams } from "next/navigation";
import { createContext, type ReactNode, use, useState } from "react";

import { apiRequest, errorMessage } from "@/client/api";
import { createLiveStore, type LiveStore } from "@/client/live-store";
import { createWorkerApi, type MyProfile, type WorkerApi, type WorkerOffer } from "@/client/worker-api";
import { Button } from "@/components/ui/button";
import { LoadingText, Notice } from "@/components/ui/notice";

import { useAction } from "../hooks/use-action";
import { useLive } from "../hooks/use-live";
import { WorkerPicker } from "./worker-picker";
import { PhoneStage, WorkerShell } from "./worker-shell";

/** Cada cuánto se revisa si llegó una invitación nueva. */
export const OFFERS_POLL_MS = 3000;

export interface WorkerSession {
  readonly workerId: string;
  readonly api: WorkerApi;
  /** Invitaciones y trabajos de la persona, al día mientras la app está abierta. */
  readonly offers: LiveStore<WorkerOffer[]>;
  readonly profile: LiveStore<MyProfile>;
  /** Se puede mostrar "Simular que estoy en la obra": solo en el Modo Jurado y si el servidor lo permite. */
  readonly canSimulateSite: boolean;
  /** Vuelve a preguntar al servidor quién tiene la sesión (por ejemplo, tras borrar la cuenta). */
  readonly refreshSession: () => Promise<void>;
}

const WorkerContext = createContext<WorkerSession | null>(null);

/** Persona con sesión abierta. Solo se usa dentro de `WorkerGate`. */
export function useWorker(): WorkerSession {
  const session = use(WorkerContext);
  if (!session) throw new Error("useWorker se usa dentro de WorkerGate");
  return session;
}

function createSessionStores() {
  const api = createWorkerApi(apiRequest);
  return {
    api,
    state: createLiveStore((signal) => api.state(signal)),
    offers: createLiveStore((signal) => api.offers(signal), { intervalMs: OFFERS_POLL_MS }),
    profile: createLiveStore((signal) => api.profile(signal)),
  };
}

function GateMessage({ children }: { readonly children: ReactNode }) {
  return (
    <PhoneStage>
      <div className="flex flex-1 flex-col gap-4 px-4 py-10">{children}</div>
    </PhoneStage>
  );
}

/**
 * Puerta de la app del trabajador. Pregunta al servidor con qué persona está
 * abierta la sesión; si no hay ninguna, muestra el selector de la demo. La
 * autorización real la hace el servidor en cada petición.
 */
export function WorkerGate({ children }: { readonly children: ReactNode }) {
  const [stores] = useState(createSessionStores);
  const [choosing, setChoosing] = useState(false);
  const demoMode = useSearchParams().get("demo") === "1";
  const [startedInDemo] = useState(demoMode);
  const state = useLive(stores.state);
  const enter = useAction(async (workerId: string) => {
    await stores.api.enter(workerId);
    // Todo se pide ya con la persona nueva: nunca se muestra lo de la anterior.
    await Promise.all([stores.state.refresh(), stores.offers.refresh(), stores.profile.refresh()]);
    setChoosing(false);
  });

  if (state.loading) {
    return (
      <GateMessage>
        <LoadingText>Abriendo tu app…</LoadingText>
      </GateMessage>
    );
  }
  if (!state.data) {
    return (
      <GateMessage>
        <Notice tone="alert" urgent>
          {errorMessage(state.error)}
        </Notice>
        <Button onClick={() => void stores.state.refresh()}>Intentar de nuevo</Button>
      </GateMessage>
    );
  }
  const { personas, active, flags } = state.data;
  // Vale cualquier sesión abierta, también la de una persona real que se registró hablando
  // y que por privacidad no aparece en el selector.
  if (active.workerId === null || choosing) {
    return (
      <PhoneStage>
        <WorkerPicker
          workers={personas.workers}
          onPick={(workerId) => void enter.invoke(workerId)}
          pending={enter.pending}
          error={enter.error}
        />
      </PhoneStage>
    );
  }
  const session: WorkerSession = {
    workerId: active.workerId,
    api: stores.api,
    offers: stores.offers,
    profile: stores.profile,
    canSimulateSite: (demoMode || startedInDemo) && flags.simulation,
    refreshSession: () => stores.state.refresh(),
  };
  return (
    <WorkerContext value={session}>
      <SessionShell profile={stores.profile} onSwitch={() => setChoosing(true)}>
        {children}
      </SessionShell>
    </WorkerContext>
  );
}

interface SessionShellProps {
  readonly profile: LiveStore<MyProfile>;
  readonly onSwitch: () => void;
  readonly children: ReactNode;
}

function SessionShell({ profile, onSwitch, children }: SessionShellProps) {
  const live = useLive(profile);
  return (
    <WorkerShell firstName={live.data?.firstName ?? "Tú"} onSwitch={onSwitch}>
      {children}
    </WorkerShell>
  );
}
