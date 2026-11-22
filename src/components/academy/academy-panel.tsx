"use client";

import { useState } from "react";

import type { AcademyPanel } from "@/client/academy-api";
import {
  type Course,
  coursePrice,
  enrollmentsThisMonth,
  passingHint,
  type PendingConstancia,
  type PendingTest,
  rankingView,
  scoreOptions,
} from "@/client/academy-view";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { SelectField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { PriceBreakdown } from "@/components/ui/price";
import { Tag } from "@/components/ui/tag";
import { formatDay, formatUsd } from "@/lib/format";
import { TRADE_LABELS } from "@/lib/trades";

import { useAction } from "../hooks/use-action";

export type EvaluateTest = (test: PendingTest, score: number) => Promise<void>;
export type IssueConstancia = (pending: PendingConstancia) => Promise<void>;

/** Lo del mes: inscripciones, ventas de la academia y la comisión de NIVEL con el IVA aparte. */
export function MonthSummary({ panel }: { readonly panel: AcademyPanel }) {
  return (
    <section aria-labelledby="mes-titulo" className="flex flex-col gap-3">
      <h2 id="mes-titulo" className="bar-title text-xl font-extrabold">
        Este mes
      </h2>
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <Eyebrow>Inscripciones</Eyebrow>
          <p className="display mt-1 text-4xl">{enrollmentsThisMonth(panel.courses)}</p>
        </Card>
        <Card>
          <Eyebrow>Ventas de la academia</Eyebrow>
          <p className="display mt-1 text-4xl">{formatUsd(panel.salesThisMonthUsd)}</p>
          <p className="mt-1 text-sm text-muted">Precio de los cursos, sin IVA.</p>
        </Card>
        <Card>
          <PriceBreakdown label="Comisión de NIVEL · 15 % por alumno" price={panel.commission} />
        </Card>
      </div>
    </section>
  );
}

function TestRow({ test, onEvaluate }: { readonly test: PendingTest; readonly onEvaluate: EvaluateTest }) {
  const [score, setScore] = useState(test.maxScore);
  const evaluate = useAction(onEvaluate);
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-lg font-bold">{test.worker}</p>
        <Tag tone={test.isToday ? "ok" : "neutral"}>{test.isToday ? "Hoy" : formatDay(test.date)}</Tag>
      </div>
      <p className="text-sm text-muted">
        Prueba de {TRADE_LABELS[test.trade].singular} · {test.workshop}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          id={`prueba-${test.id}-nota`}
          label={`Nota de ${test.worker}`}
          hint={passingHint(test.maxScore)}
          value={score}
          onChange={(event) => setScore(Number(event.target.value))}
          wrapperClassName="w-56"
        >
          {scoreOptions(test.maxScore).map((option) => (
            <option key={option} value={option}>
              {option} de {test.maxScore}
            </option>
          ))}
        </SelectField>
        <Button disabled={evaluate.pending} onClick={() => void evaluate.invoke(test, score)}>
          Registrar nota<span className="sr-only"> de {test.worker}</span>
        </Button>
      </div>
      {evaluate.error ? (
        <Notice tone="alert" urgent>
          {evaluate.error}
        </Notice>
      ) : null}
    </li>
  );
}

interface PendingTestsProps {
  readonly tests: readonly PendingTest[];
  readonly onEvaluate: EvaluateTest;
}

/** Pruebas prácticas sin evaluar. Registrar la nota actualiza el nivel de la persona. */
export function PendingTests({ tests, onEvaluate }: PendingTestsProps) {
  return (
    <section aria-labelledby="pruebas-titulo" className="flex flex-col gap-3">
      <h2 id="pruebas-titulo" className="bar-title text-xl font-extrabold">
        Pruebas prácticas por evaluar
      </h2>
      <p className="text-sm text-muted">
        Al registrar la nota, el nivel de la persona se recalcula solo. La nota no se puede cambiar después.
      </p>
      {tests.length === 0 ? (
        <p className="text-muted">No hay pruebas pendientes.</p>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line-2">
            {tests.map((test) => (
              <TestRow key={test.id} test={test} onEvaluate={onEvaluate} />
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

interface ConstanciaRowProps {
  readonly pending: PendingConstancia;
  readonly onIssue: IssueConstancia;
}

function ConstanciaRow({ pending, onIssue }: ConstanciaRowProps) {
  const issue = useAction(onIssue);
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold">{pending.worker}</p>
          <p className="text-sm text-muted">Terminó «{pending.course}»</p>
        </div>
        <Button variant="outline" disabled={issue.pending} onClick={() => void issue.invoke(pending)}>
          Emitir constancia<span className="sr-only"> a {pending.worker}</span>
        </Button>
      </div>
      {issue.error ? (
        <Notice tone="alert" urgent>
          {issue.error}
        </Notice>
      ) : null}
    </li>
  );
}

interface PendingConstanciasProps {
  readonly pending: readonly PendingConstancia[];
  readonly onIssue: IssueConstancia;
}

/** Alumnos que terminaron un curso y aún no tienen su constancia. */
export function PendingConstancias({ pending, onIssue }: PendingConstanciasProps) {
  return (
    <section aria-labelledby="constancias-titulo" className="flex flex-col gap-3">
      <h2 id="constancias-titulo" className="bar-title text-xl font-extrabold">
        Constancias por emitir
      </h2>
      <p className="text-sm text-muted">
        Es una constancia de la academia, no un título oficial. Muestra nombre, curso, fecha y academia.
      </p>
      {pending.length === 0 ? (
        <p className="text-muted">No hay constancias pendientes.</p>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line-2">
            {pending.map((row) => (
              <ConstanciaRow key={row.enrollmentId} pending={row} onIssue={onIssue} />
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

export function CourseTable({ courses }: { readonly courses: readonly Course[] }) {
  return (
    <section aria-labelledby="cursos-titulo" className="flex flex-col gap-3">
      <h2 id="cursos-titulo" className="bar-title text-xl font-extrabold">
        Cursos
      </h2>
      {courses.length === 0 ? (
        <p className="text-muted">Esta academia no publica cursos: evalúa pruebas prácticas.</p>
      ) : (
        <CourseRows courses={courses} />
      )}
    </section>
  );
}

function CourseRows({ courses }: { readonly courses: readonly Course[] }) {
  return (
    <Card role="group" aria-label="Tabla de cursos" tabIndex={0} className="overflow-x-auto p-0">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-line text-sm text-muted">
            <th scope="col" className="px-4 py-2.5 font-bold">
              Curso
            </th>
            <th scope="col" className="px-4 py-2.5 font-bold">
              Precio
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-bold">
              Inscripciones del mes
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-2">
          {courses.map((course) => (
            <tr key={course.id}>
              <th scope="row" className="px-4 py-3 font-bold">
                {course.title}
              </th>
              <td className="px-4 py-3">{coursePrice(course)}</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {course.enrollmentsThisMonth}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** El ranking nunca es una cifra suelta: va con su cuenta y con la fórmula a la vista. */
export function RankingCard({ ranking }: { readonly ranking: AcademyPanel["ranking"] }) {
  const view = rankingView(ranking);
  return (
    <section aria-labelledby="ranking-titulo" className="flex flex-col gap-3">
      <h2 id="ranking-titulo" className="bar-title text-xl font-extrabold">
        Alumnos con trabajo
      </h2>
      <Card className="flex flex-col gap-2">
        {view.percent ? <p className="display text-5xl text-brand">{view.percent}</p> : null}
        <p className="text-lg font-semibold">{view.detail}</p>
        <p className="text-sm text-muted">
          <span className="font-bold text-ink-2">Cómo se calcula: </span>
          {view.formula}
        </p>
      </Card>
    </section>
  );
}

interface AcademyPanelViewProps {
  readonly panel: AcademyPanel;
  readonly onEvaluate: EvaluateTest;
  readonly onIssue: IssueConstancia;
  /** Resultado de la última acción, en palabras. */
  readonly notice: string | null;
}

/** Panel de la academia: lo del mes, lo que le toca hacer hoy, sus cursos y su ranking. */
export function AcademyPanelView({ panel, onEvaluate, onIssue, notice }: AcademyPanelViewProps) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Eyebrow className="text-brand">Academia · RIF {panel.academy.rif}</Eyebrow>
        <h1 className="display mt-1 text-4xl">{panel.academy.name}</h1>
      </div>
      <div role="status" aria-live="polite">
        {notice ? <Notice>{notice}</Notice> : null}
      </div>
      <PendingTests tests={panel.pendingTests} onEvaluate={onEvaluate} />
      <PendingConstancias pending={panel.pendingConstancias} onIssue={onIssue} />
      <MonthSummary panel={panel} />
      <CourseTable courses={panel.courses} />
      <RankingCard ranking={panel.ranking} />
    </div>
  );
}
