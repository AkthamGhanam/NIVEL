"use client";

import { createContext, type ReactNode, use, useState } from "react";

import { type AcademyApi, type AcademyPanel, createAcademyApi } from "@/client/academy-api";
import { apiRequest, errorMessage } from "@/client/api";
import { createLiveStore, type LiveStore } from "@/client/live-store";
import { Button } from "@/components/ui/button";
import { LoadingText, Notice } from "@/components/ui/notice";

import { useAction } from "../hooks/use-action";
import { useLive } from "../hooks/use-live";
import { AcademyPicker } from "./academy-picker";
import { AcademyShell } from "./academy-shell";

/** Cada cuánto se vuelve a pedir el panel: una prueba recién agendada aparece sin recargar. */
export const PANEL_POLL_MS = 5000;

export interface AcademySession {
  readonly api: AcademyApi;
  readonly panel: LiveStore<AcademyPanel>;
}

const AcademyContext = createContext<AcademySession | null>(null);

/** Academia con sesión abierta. Solo se usa dentro de `AcademyGate`. */
export function useAcademy(): AcademySession {
  const session = use(AcademyContext);
  if (!session) throw new Error("useAcademy se usa dentro de AcademyGate");
  return session;
}

function createSessionStores() {
  const api = createAcademyApi(apiRequest);
  return {
    api,
    state: createLiveStore((signal) => api.state(signal)),
    panel: createLiveStore((signal) => api.panel(signal), { intervalMs: PANEL_POLL_MS }),
  };
}

function GateMessage({ children }: { readonly children: ReactNode }) {
  return <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-16">{children}</main>;
}

/**
 * Puerta del panel de la academia. Pregunta al servidor con qué academia está
 * abierta la sesión; si no hay ninguna, muestra el selector de la demo. La
 * autorización real la hace el servidor en cada petición.
 */
export function AcademyGate({ children }: { readonly children: ReactNode }) {
  const [stores] = useState(createSessionStores);
  const [choosing, setChoosing] = useState(false);
  const state = useLive(stores.state);
  const enter = useAction(async (academyId: string) => {
    await stores.api.enter(academyId);
    // El panel se pide ya con la academia nueva: nunca se muestra el de la anterior.
    await Promise.all([stores.state.refresh(), stores.panel.refresh()]);
    setChoosing(false);
  });

  if (state.loading) {
    return (
      <GateMessage>
        <LoadingText>Abriendo tu academia…</LoadingText>
      </GateMessage>
    );
  }
  if (!state.data) {
    return (
      <GateMessage>
        <Notice tone="alert" urgent>
          {errorMessage(state.error)}
        </Notice>
        <Button className="self-start" onClick={() => void stores.state.refresh()}>
          Intentar de nuevo
        </Button>
      </GateMessage>
    );
  }
  const { personas, active } = state.data;
  const academy = personas.academies.find((candidate) => candidate.id === active.academyId);
  if (!academy || choosing) {
    return (
      <AcademyPicker
        academies={personas.academies}
        onPick={(academyId) => void enter.invoke(academyId)}
        pending={enter.pending}
        error={enter.error}
      />
    );
  }
  return (
    <AcademyContext value={{ api: stores.api, panel: stores.panel }}>
      <AcademyShell academy={academy} onSwitch={() => setChoosing(true)}>
        {children}
      </AcademyShell>
    </AcademyContext>
  );
}
