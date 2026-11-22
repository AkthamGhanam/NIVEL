// Puerta de la app del trabajador: sesión, acceso y datos en vivo.
"use client";

import { useSearchParams } from "next/navigation";
import { createContext, type ReactNode, use, useState } from "react";

import { apiRequest, errorMessage } from "@/client/api";
import { createLiveStore, type LiveStore } from "@/client/live-store";
import {
  createWorkerApi,
  type MyProfile,
  type WorkerApi,
  type WorkerOffer,
  type WorkerSignupInput,
} from "@/client/worker-api";
import { Button } from "@/components/ui/button";
import { LoadingText, Notice } from "@/components/ui/notice";

import { useAction } from "../hooks/use-action";
import { useLive } from "../hooks/use-live";
import { WorkerAccess } from "./worker-access";
import { WorkerShell, WorkerStage } from "./worker-shell";

export const OFFERS_POLL_MS = 3000;

export interface WorkerSession {
  readonly workerId: string;
  readonly api: WorkerApi;

  readonly offers: LiveStore<WorkerOffer[]>;
  readonly profile: LiveStore<MyProfile>;

  readonly canSimulateSite: boolean;

  readonly refreshSession: () => Promise<void>;
}

const WorkerContext = createContext<WorkerSession | null>(null);

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

type SessionStores = ReturnType<typeof createSessionStores>;

function useAccessActions(stores: SessionStores, done: () => void) {
  const reloadSession = async () => {
    await Promise.all([stores.state.refresh(), stores.offers.refresh(), stores.profile.refresh()]);
    done();
  };
  const enter = useAction(async (workerId: string) => {
    await stores.api.enter(workerId);
    await reloadSession();
  });
  const register = useAction(async (input: WorkerSignupInput) => {
    await stores.api.register(input);
    await reloadSession();
  });
  return { enter, register, reloadSession };
}

function GateMessage({ children }: { readonly children: ReactNode }) {
  return (
    <WorkerStage>
      <div className="flex flex-1 flex-col gap-4 py-10">{children}</div>
    </WorkerStage>
  );
}

export function WorkerGate({ children }: { readonly children: ReactNode }) {
  const [stores] = useState(createSessionStores);
  const [choosing, setChoosing] = useState(false);
  const demoMode = useSearchParams().get("demo") === "1";
  const [startedInDemo] = useState(demoMode);
  const state = useLive(stores.state);
  const { enter, register, reloadSession } = useAccessActions(stores, () => setChoosing(false));

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

  if (active.workerId === null || choosing) {
    return (
      <>
        <WorkerAccess
          api={stores.api}
          accounts={personas.workers}
          initialTab={choosing ? "entrar" : "crear"}
          onPick={(workerId) => void enter.invoke(workerId)}
          onRegister={(input) => void register.invoke(input)}
          onRegistered={() => void reloadSession()}
          pending={enter.pending || register.pending}
          error={register.error ?? enter.error}
        />
      </>
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
