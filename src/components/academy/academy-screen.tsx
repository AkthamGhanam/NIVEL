"use client";

import { useState } from "react";

import { constanciaOutcome, testOutcome } from "@/client/academy-view";
import { errorMessage } from "@/client/api";
import { Button } from "@/components/ui/button";
import { LoadingText, Notice } from "@/components/ui/notice";

import { useLive } from "../hooks/use-live";
import { useAcademy } from "./academy-gate";
import { AcademyPanelView, type EvaluateTest, type IssueConstancia } from "./academy-panel";

/** Conecta el panel de la academia con el servidor: evaluar y emitir actualizan el panel al momento. */
export function AcademyScreen() {
  const { api, panel } = useAcademy();
  const live = useLive(panel);
  const [notice, setNotice] = useState<string | null>(null);

  const evaluate: EvaluateTest = async (test, score) => {
    setNotice(null);
    const result = await api.evaluate(test.id, score);
    await panel.refresh();
    setNotice(testOutcome(test.worker, result));
  };
  const issue: IssueConstancia = async (pending) => {
    setNotice(null);
    const result = await api.issueConstancia(pending.enrollmentId);
    await panel.refresh();
    setNotice(constanciaOutcome(pending, result));
  };

  if (live.data) {
    return <AcademyPanelView panel={live.data} onEvaluate={evaluate} onIssue={issue} notice={notice} />;
  }
  if (live.loading) return <LoadingText>Cargando el panel de la academia…</LoadingText>;
  return (
    <div className="flex flex-col items-start gap-4">
      <Notice tone="alert" urgent>
        {errorMessage(live.error)}
      </Notice>
      <Button onClick={() => void panel.refresh()}>Intentar de nuevo</Button>
    </div>
  );
}
