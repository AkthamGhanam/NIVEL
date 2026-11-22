"use client";

import { useState } from "react";

import {
  INPSASEL_REMINDER,
  parseReviewNote,
  queueSummary,
  type ReportView,
  REVIEW_NOTE_MAX_LENGTH,
} from "@/client/admin-view";
import type { ReportOutcome } from "@/client/team-api";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { TextAreaField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Tag } from "@/components/ui/tag";

import { useAction } from "../hooks/use-action";

export type ResolveReport = (reportId: string, outcome: ReportOutcome, note: string) => Promise<void>;

/** Regla legal 8.4, a la vista de quien revisa. */
export const HUMAN_REVIEW_RULE =
  "Ninguna decisión es automática: una persona del equipo revisa cada reporte en menos de 24 horas. " +
  "Quien reporta queda anónimo frente a la empresa y su nivel no cambia.";

function ReportFacts({ report }: { readonly report: ReportView }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[0.9375rem]">
      <dt className="text-muted">Recibido</dt>
      <dd className="font-semibold">{report.received}</dd>
      <dt className="text-muted">Empresa señalada</dt>
      <dd className="font-semibold">{report.company ?? "No nombra una empresa"}</dd>
      <dt className="text-muted">Origen</dt>
      <dd className="font-semibold">{report.source}</dd>
    </dl>
  );
}

interface ReportCardProps {
  readonly report: ReportView;
  readonly onResolve: ResolveReport;
}

/** Un caso de la cola: lo que dijo la persona, y la decisión con su nota. */
export function ReportCard({ report, onResolve }: ReportCardProps) {
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState<string>();
  const resolve = useAction(onResolve);
  const decide = (outcome: ReportOutcome) => {
    const parsed = parseReviewNote(draft);
    setProblem(parsed.ok ? undefined : parsed.error);
    if (parsed.ok) void resolve.invoke(report.id, outcome, parsed.note);
  };
  const titleId = `reporte-${report.id}-titulo`;
  return (
    <Card className="flex flex-col gap-3">
      <article aria-labelledby={titleId} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={titleId} className="text-xl font-extrabold">
            {report.kind}
          </h2>
          <Tag tone={report.overdue ? "alert" : "pending"}>{report.deadline}</Tag>
        </div>
        <ReportFacts report={report} />
        {report.body ? (
          <blockquote className="rounded-control border-l-4 border-brand bg-canvas px-4 py-3 text-lg">
            {report.body}
          </blockquote>
        ) : null}
        {report.audioUrl ? (
          <audio controls preload="none" src={report.audioUrl} aria-label="Nota de voz del reporte" />
        ) : null}
        {report.safetyReminder ? <Notice tone="pending">{INPSASEL_REMINDER}</Notice> : null}
        <TextAreaField
          id={`reporte-${report.id}-nota`}
          label="Nota de la decisión"
          hint="Qué se revisó y qué se decidió. Queda guardada con el caso."
          rows={3}
          maxLength={REVIEW_NOTE_MAX_LENGTH}
          value={draft}
          error={problem}
          onChange={(event) => setDraft(event.target.value)}
        />
        {resolve.error ? (
          <Notice tone="alert" urgent>
            {resolve.error}
          </Notice>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button disabled={resolve.pending} onClick={() => decide("resuelto")}>
            Marcar como resuelto
          </Button>
          <Button variant="outline" disabled={resolve.pending} onClick={() => decide("descartado")}>
            Descartar
          </Button>
        </div>
      </article>
    </Card>
  );
}

interface ReviewQueueProps {
  readonly reports: readonly ReportView[];
  readonly onResolve: ResolveReport;
  /** Resultado de la última decisión, en palabras. */
  readonly notice: string | null;
}

/** Cola de revisión humana, de la más antigua a la más nueva. */
export function ReviewQueue({ reports, onResolve, notice }: ReviewQueueProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow className="text-brand">Administración</Eyebrow>
        <h1 className="display mt-1 text-4xl">Revisión de reportes</h1>
        <p className="mt-1 text-lg text-ink-2">{queueSummary(reports.length)}</p>
      </div>
      <Notice>{HUMAN_REVIEW_RULE}</Notice>
      <div role="status" aria-live="polite">
        {notice ? <Notice>{notice}</Notice> : null}
      </div>
      <ul className="flex flex-col gap-4">
        {reports.map((report) => (
          <li key={report.id}>
            <ReportCard report={report} onResolve={onResolve} />
          </li>
        ))}
      </ul>
    </div>
  );
}
