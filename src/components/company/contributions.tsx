// Aportes al Estado: cuánto le toca a cada institución este mes y el comprobante de cada pago.
"use client";

import { type FormEvent, useState } from "react";

import type { ContributionPeriod } from "@/client/company-api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Tag } from "@/components/ui/tag";
import { formatUsd } from "@/lib/format";
import { type Institution, INSTITUTION_INFO } from "@/lib/legal-cost";

import { useAction } from "../hooks/use-action";

type Declare = (input: { period: string; institution: Institution; reference: string }) => Promise<void>;

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export function monthName(period: string): string {
  const [year, month] = period.split("-");
  return `${MONTHS[Number(month) - 1] ?? ""} ${year ?? ""}`.trim();
}

const REFERENCE = /^[A-Za-z0-9-]{4,30}$/;

function DeclareForm({
  period,
  institution,
  onDeclare,
}: {
  readonly period: string;
  readonly institution: Institution;
  readonly onDeclare: Declare;
}) {
  const [reference, setReference] = useState("");
  const [problem, setProblem] = useState<string>();
  const action = useAction(onDeclare);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!REFERENCE.test(reference.trim())) {
      setProblem("De 4 a 30 letras o números.");
      return;
    }
    setProblem(undefined);
    void action.invoke({ period, institution, reference: reference.trim() });
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1">
        <TextField
          id={`aporte-${period}-${institution}`}
          label="N.º de comprobante"
          autoComplete="off"
          maxLength={30}
          value={reference}
          error={problem ?? action.error ?? undefined}
          onChange={(event) => setReference(event.target.value)}
        />
      </div>
      <Button type="submit" variant="outline" disabled={action.pending}>
        Ya lo pagué
        <span className="sr-only"> en {INSTITUTION_INFO[institution].name}</span>
      </Button>
    </form>
  );
}

function PeriodCard({
  period,
  onDeclare,
}: {
  readonly period: ContributionPeriod;
  readonly onDeclare: Declare;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-extrabold capitalize">{monthName(period.period)}</h3>
        <Tag tone={period.complete ? "ok" : "pending"}>
          {period.complete ? "Todo declarado" : "Por declarar"}
        </Tag>
      </div>
      <p className="text-sm text-muted">Sobre {formatUsd(period.salariesUsd)} de salarios pagados ese mes.</p>
      <ul className="flex flex-col divide-y divide-line-2">
        {period.lines.map((line) => {
          const info = INSTITUTION_INFO[line.institution];
          return (
            <li key={line.institution} className="flex flex-col gap-2 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="font-bold">{info.name}</p>
                  <p className="text-sm text-muted">
                    {info.what} · se paga en el {info.portal}
                  </p>
                </div>
                <p className="text-lg font-extrabold tabular-nums">{formatUsd(line.amountUsd)}</p>
              </div>
              {line.reference ? (
                <Tag tone="ok">Pagado · comprobante {line.reference}</Tag>
              ) : (
                <DeclareForm period={period.period} institution={line.institution} onDeclare={onDeclare} />
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex items-baseline justify-between border-t border-line pt-2">
        <p className="font-bold">Total del mes</p>
        <p className="text-lg font-extrabold tabular-nums">{formatUsd(period.totalUsd)}</p>
      </div>
    </Card>
  );
}

/** La planilla del mes: la empresa paga en cada portal y aquí deja el comprobante. */
export function ContributionsView({
  periods,
  onDeclare,
}: {
  readonly periods: readonly ContributionPeriod[];
  readonly onDeclare: Declare;
}) {
  return (
    <section aria-labelledby="aportes-titulo" className="flex flex-col gap-3">
      <h2 id="aportes-titulo" className="bar-title text-xl font-extrabold">
        Aportes al Estado
      </h2>
      <p className="text-sm text-muted">
        Se calculan solos con los salarios que pagaste. Págalos en cada portal y anota el comprobante: con
        todo al día, los trabajadores ven tu empresa como «Paga en regla».
      </p>
      {periods.length === 0 ? (
        <Notice>Aparecen aquí cuando registres la primera liquidación.</Notice>
      ) : (
        periods.map((period) => <PeriodCard key={period.period} period={period} onDeclare={onDeclare} />)
      )}
      <p className="text-sm text-muted">Montos estimados. Valídalos con tu contador.</p>
    </section>
  );
}
