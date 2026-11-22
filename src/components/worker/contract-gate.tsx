"use client";

import { type ReactNode, useState } from "react";

import { errorMessage } from "@/client/api";
import { createLiveStore } from "@/client/live-store";
import type { ContractDetail } from "@/client/worker-api";
import { LoadingText, Notice } from "@/components/ui/notice";

import { useLive } from "../hooks/use-live";
import { useWorker } from "./worker-gate";

/** El contrato cambia cuando la otra parte actúa (registra el pago): se consulta cada pocos segundos. */
const CONTRACT_POLL_MS = 3000;

interface ContractGateProps {
  readonly contractId: string;
  /** Recibe el contrato al día y una forma de pedirlo ya, tras una acción de la persona. */
  readonly children: (contract: ContractDetail, refresh: () => Promise<void>) => ReactNode;
}

/** Carga un contrato de la persona y resuelve lo común: cargando, error y sin conexión. */
export function ContractGate({ contractId, children }: ContractGateProps) {
  const { api } = useWorker();
  const [store] = useState(() =>
    createLiveStore((signal) => api.contract(contractId, signal), { intervalMs: CONTRACT_POLL_MS }),
  );
  const live = useLive(store);
  if (live.loading) return <LoadingText>Buscando tu contrato…</LoadingText>;
  return (
    <>
      {live.error === undefined ? null : (
        <Notice tone={live.data ? "pending" : "alert"} urgent={!live.data}>
          {errorMessage(live.error)}
        </Notice>
      )}
      {live.data ? children(live.data, store.refresh) : null}
    </>
  );
}
