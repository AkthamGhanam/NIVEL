"use client";

import { useState } from "react";

import { OUTCOME_DONE, reportView } from "@/client/admin-view";
import { errorMessage } from "@/client/api";
import { createLiveStore } from "@/client/live-store";
import { Button } from "@/components/ui/button";
import { LoadingText, Notice } from "@/components/ui/notice";

import { useLive } from "../hooks/use-live";
import { type TeamSession, useTeam } from "../team/team-gate";
import { type ResolveReport, ReviewQueue } from "./review-queue";

/** Cada cuánto se vuelve a pedir la cola: un reporte nuevo aparece sin recargar. */
export const REPORTS_POLL_MS = 5000;

/** La cola ya lista para mostrar. El plazo de cada caso se recalcula en cada consulta. */
function createQueueStore({ api, state }: TeamSession) {
  return createLiveStore(
    async (signal) => {
      const reports = await api.reports(signal);
      const companies = state.getSnapshot().data?.personas.companies ?? [];
      return reports.map((report) => reportView(report, companies, new Date()));
    },
    { intervalMs: REPORTS_POLL_MS },
  );
}

export function ReviewScreen() {
  const team = useTeam();
  const [store] = useState(() => createQueueStore(team));
  const live = useLive(store);
  const [notice, setNotice] = useState<string | null>(null);

  const resolve: ResolveReport = async (reportId, outcome, note) => {
    setNotice(null);
    await team.api.resolveReport(reportId, { outcome, note });
    await store.refresh();
    setNotice(OUTCOME_DONE[outcome]);
  };

  if (live.data) return <ReviewQueue reports={live.data} onResolve={resolve} notice={notice} />;
  if (live.loading) return <LoadingText>Cargando la cola de revisión…</LoadingText>;
  return (
    <div className="flex flex-col items-start gap-4">
      <Notice tone="alert" urgent>
        {errorMessage(live.error)}
      </Notice>
      <Button onClick={() => void store.refresh()}>Intentar de nuevo</Button>
    </div>
  );
}
