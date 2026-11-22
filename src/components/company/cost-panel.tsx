import type { RequestBoard } from "@/client/company-api";
import { Card, Eyebrow } from "@/components/ui/card";
import { NotEmployerNotice, Notice } from "@/components/ui/notice";
import { formatUsd, plural } from "@/lib/format";
import { FEE_PAYMENT_NOTICE, SEARCH_GUARANTEE_NOTICE } from "@/lib/legal-copy";
import { LEGAL_COST_DISCLAIMER } from "@/lib/legal-cost";

type LegalCost = RequestBoard["legalCost"];
type FeeRange = NonNullable<RequestBoard["feeRange"]>;

const ROW = "flex items-baseline justify-between gap-4";
const AMOUNT = "font-semibold tabular-nums";

/** Costo legal estimado de contratar en regla: salario más las cargas de ley. Siempre es un estimado. */
export function LegalCostCard({ legalCost, days }: { readonly legalCost: LegalCost; readonly days: number }) {
  const { perWorker } = legalCost;
  const rows = [
    [`Salario (${plural(days, "día", "días")})`, perWorker.salary],
    ["Utilidades", perWorker.utilidades],
    ["Vacaciones y bono vacacional", perWorker.vacacionesBono],
    ["Prestaciones sociales", perWorker.prestaciones],
    ["Contribución de pensiones", perWorker.pensiones],
    ["Aportes (IVSS, FAOV, INCES)", perWorker.aportes],
  ] as const;
  return (
    <Card>
      <Eyebrow>Costo legal estimado</Eyebrow>
      <dl className="mt-2 flex flex-col gap-1 text-[0.9375rem]">
        {rows.map(([label, amount]) => (
          <div key={label} className={ROW}>
            <dt className="text-ink-2">{label}</dt>
            <dd className={AMOUNT}>{formatUsd(amount)}</dd>
          </div>
        ))}
        <div className={`${ROW} border-t border-line pt-1.5`}>
          <dt className="font-bold">Por persona</dt>
          <dd className="text-lg font-extrabold tabular-nums">{formatUsd(perWorker.total)}</dd>
        </div>
        <div className={ROW}>
          <dt className="font-bold">Por {plural(legalCost.quantity, "persona", "personas")}</dt>
          <dd className="text-lg font-extrabold tabular-nums">{formatUsd(legalCost.totalForQuantity)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-sm text-muted">{LEGAL_COST_DISCLAIMER}</p>
    </Card>
  );
}

const range = (min: number, max: number) =>
  min === max ? formatUsd(min) : `${formatUsd(min)} a ${formatUsd(max)}`;

/** Tarifa de NIVEL por contratación: base, IVA 16 % aparte y total (regla legal 8.8). */
export function FeeRangeCard({ feeRange }: { readonly feeRange: FeeRange }) {
  const { min, max } = feeRange;
  return (
    <Card>
      <Eyebrow>Tarifa de NIVEL por contratación</Eyebrow>
      <dl className="mt-2 flex flex-col gap-1 text-[0.9375rem]">
        <div className={ROW}>
          <dt className="text-ink-2">Tarifa</dt>
          <dd className={AMOUNT}>{range(min.base, max.base)}</dd>
        </div>
        <div className={ROW}>
          <dt className="text-ink-2">IVA 16 %</dt>
          <dd className={AMOUNT}>{range(min.iva, max.iva)}</dd>
        </div>
        <div className={`${ROW} border-t border-line pt-1.5`}>
          <dt className="font-bold">Total</dt>
          <dd className="text-lg font-extrabold tabular-nums">{range(min.total, max.total)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-sm text-muted">
        Depende del nivel de cada persona y se cobra solo cuando acepta. {FEE_PAYMENT_NOTICE}
      </p>
    </Card>
  );
}

/** Columna derecha de `/c`: cuánto cuesta contratar en regla y qué cobra NIVEL. */
export function CostPanel({ board }: { readonly board: RequestBoard | null }) {
  return (
    <aside aria-label="Costos" className="flex flex-col gap-4">
      {board ? <LegalCostCard legalCost={board.legalCost} days={board.request.days} /> : null}
      {board?.feeRange ? <FeeRangeCard feeRange={board.feeRange} /> : null}
      <Notice title="Garantía de búsqueda">{SEARCH_GUARANTEE_NOTICE}</Notice>
      <NotEmployerNotice />
    </aside>
  );
}
