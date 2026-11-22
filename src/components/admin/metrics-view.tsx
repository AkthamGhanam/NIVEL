import Link from "next/link";
import type { ReactNode } from "react";

import { formatCrewTime, incomeRows, levelRows } from "@/client/admin-view";
import type { Metrics } from "@/client/team-api";
import { Card, Eyebrow } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cx } from "@/lib/cx";
import { formatRate, formatUsd, plural } from "@/lib/format";
import { FEE_PAYMENT_NOTICE } from "@/lib/legal-copy";

interface TileProps {
  readonly label: string;
  readonly value: string | number;
  readonly children?: ReactNode;
}

function Tile({ label, value, children }: TileProps) {
  return (
    <Card className="flex flex-col gap-1">
      <Eyebrow>{label}</Eyebrow>
      <p className="display text-4xl">{value}</p>
      {children ? <div className="text-sm text-muted">{children}</div> : null}
    </Card>
  );
}

/** Las cifras de la operación: gente, solicitudes, contrataciones, rapidez y casos por revisar. */
export function MetricTiles({ metrics }: { readonly metrics: Metrics }) {
  const { workers, requests } = metrics;
  return (
    <section aria-labelledby="operacion-titulo" className="flex flex-col gap-3">
      <h2 id="operacion-titulo" className="bar-title text-xl font-extrabold">
        Operación
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile label="Trabajadores" value={workers.total}>
          {plural(workers.real, "persona real registrada", "personas reales registradas")} en el evento.
        </Tile>
        <Tile label="Solicitudes" value={requests.total}>
          {plural(requests.open, "abierta", "abiertas")} · {requests.complete} con cuadrilla completa.
        </Tile>
        <Tile label="Contrataciones" value={metrics.hires} />
        <Tile label="Tiempo a cuadrilla completa" value={formatCrewTime(metrics.averageMinutesToFullCrew)}>
          Promedio desde que se publica la solicitud hasta que acepta la última persona.
        </Tile>
        <Tile label="Reportes en revisión" value={metrics.reportsInReview}>
          <Link
            href="/admin/revision"
            className="inline-flex min-h-12 items-center font-semibold text-brand underline decoration-2"
          >
            Ir a la revisión humana
          </Link>
        </Tile>
      </div>
    </section>
  );
}

const CELL = "px-4 py-3 text-right tabular-nums";

/** Ingresos de NIVEL por origen. El IVA siempre va en su propia columna. */
export function IncomeTable({ income }: { readonly income: Metrics["income"] }) {
  return (
    <section aria-labelledby="ingresos-titulo" className="flex flex-col gap-3">
      <h2 id="ingresos-titulo" className="bar-title text-xl font-extrabold">
        Ingresos de NIVEL
      </h2>
      {/* En un teléfono la tabla se desplaza de lado: el contenedor recibe el foco del teclado. */}
      <Card role="group" aria-label="Tabla de ingresos" tabIndex={0} className="overflow-x-auto p-0">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line text-sm text-muted">
              <th scope="col" className="px-4 py-2.5 font-bold">
                Origen
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-bold">
                Tarifa
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-bold">
                IVA 16 %
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-bold">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-2">
            {incomeRows(income).map((row) => (
              <tr key={row.label} className={cx(row.total && "font-extrabold")}>
                <th scope="row" className={cx("px-4 py-3", row.total ? "font-extrabold" : "font-semibold")}>
                  {row.label}
                </th>
                <td className={CELL}>{formatUsd(row.price.base)}</td>
                <td className={CELL}>{formatUsd(row.price.iva)}</td>
                <td className={CELL}>{formatUsd(row.price.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-ink-2">
        Por cobrar: <span className="font-bold tabular-nums">{formatUsd(income.pendingTotalUsd)}</span> con
        IVA.
      </p>
      <p className="text-sm text-muted">{FEE_PAYMENT_NOTICE}</p>
    </section>
  );
}

/** Cuánta gente hay en cada nivel. Los niveles se calculan con hechos verificables, nunca a mano. */
export function LevelDistribution({ workers }: { readonly workers: Metrics["workers"] }) {
  return (
    <section aria-labelledby="niveles-titulo" className="flex flex-col gap-3">
      <h2 id="niveles-titulo" className="bar-title text-xl font-extrabold">
        Trabajadores por nivel
      </h2>
      <Card>
        <ul className="flex flex-col gap-3">
          {levelRows(workers).map((row) => (
            <li key={row.level} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-bold">
                  Nivel {row.level} · {row.name}
                </p>
                <p className="font-semibold tabular-nums">
                  {row.count} <span className="text-sm text-muted">({formatRate(row.share)})</span>
                </p>
              </div>
              <Progress value={row.share} label={`Proporción en el nivel ${row.level}`} />
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

/** Métricas del equipo. Todo se calcula en vivo con los datos de la demo. */
export function MetricsView({ metrics }: { readonly metrics: Metrics }) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Eyebrow className="text-brand">Administración</Eyebrow>
        <h1 className="display mt-1 text-4xl">Métricas</h1>
        <p className="mt-1 text-ink-2">Cifras calculadas en vivo con los datos de la demo.</p>
      </div>
      <MetricTiles metrics={metrics} />
      <IncomeTable income={metrics.income} />
      <LevelDistribution workers={metrics.workers} />
    </div>
  );
}
