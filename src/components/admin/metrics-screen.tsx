"use client";

import { useState } from "react";

import { errorMessage } from "@/client/api";
import { createLiveStore } from "@/client/live-store";
import { Button } from "@/components/ui/button";
import { LoadingText, Notice } from "@/components/ui/notice";

import { useLive } from "../hooks/use-live";
import { useTeam } from "../team/team-gate";
import { MetricsView } from "./metrics-view";

/** Cada cuánto se recalculan las métricas mientras alguien las mira. */
export const METRICS_POLL_MS = 5000;

export function MetricsScreen() {
  const { api } = useTeam();
  const [store] = useState(() =>
    createLiveStore((signal) => api.metrics(signal), { intervalMs: METRICS_POLL_MS }),
  );
  const live = useLive(store);

  if (live.data) return <MetricsView metrics={live.data} />;
  if (live.loading) return <LoadingText>Calculando las métricas…</LoadingText>;
  return (
    <div className="flex flex-col items-start gap-4">
      <Notice tone="alert" urgent>
        {errorMessage(live.error)}
      </Notice>
      <Button onClick={() => void store.refresh()}>Intentar de nuevo</Button>
    </div>
  );
}
