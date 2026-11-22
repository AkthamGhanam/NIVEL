// Cuánto cuesta contratar en regla y a dónde va cada dólar: al trabajador, al Estado y a NIVEL.
import Link from "next/link";
import type { ReactNode } from "react";

import type { RequestBoard } from "@/client/company-api";
import { Card, Eyebrow } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { cx } from "@/lib/cx";
import { formatUsd, plural } from "@/lib/format";
import { FEE_PAYMENT_NOTICE, SEARCH_GUARANTEE_NOTICE } from "@/lib/legal-copy";
import { LEGAL_COST_DISCLAIMER, moneyFlow } from "@/lib/legal-cost";

type LegalCost = RequestBoard["legalCost"];
type FeeRange = NonNullable<RequestBoard["feeRange"]>;

const ROW = "flex items-baseline justify-between gap-4";
const AMOUNT = "font-semibold tabular-nums";

interface GroupProps {
  readonly title: string;
  readonly hint: string;
  readonly subtotal: number;
  readonly rows: ReadonlyArray<readonly [label: string, amount: number]>;
  readonly tone: "worker" | "state";
}

/** Un destino del dinero, con su subtotal a la vista y el detalle debajo. */
function Destination({ title, hint, subtotal, rows, tone }: GroupProps) {
  return (
    <div
      className={cx(
        "rounded-control border-l-4 bg-canvas px-3 py-2.5",
        tone === "worker" ? "border-brand" : "border-ink-2",
      )}
    >
      <div className={ROW}>
        <dt className="font-bold">{title}</dt>
        <dd className="text-lg font-extrabold tabular-nums">{formatUsd(subtotal)}</dd>
      </div>
      <dd className="text-sm text-muted">{hint}</dd>
      <dd>
        <dl className="mt-1.5 flex flex-col gap-0.5 text-[0.9375rem]">
          {rows.map(([label, amount]) => (
            <div key={label} className={ROW}>
              <dt className="text-ink-2">{label}</dt>
              <dd className={AMOUNT}>{formatUsd(amount)}</dd>
            </div>
          ))}
        </dl>
      </dd>
    </div>
  );
}

/**
 * Costo legal estimado de contratar en regla, por persona. No es una factura
 * ni un cobro de NIVEL: es lo que la ley le exige al patrono, separado por a
 * quién le llega. Siempre es un estimado.
 */
export function LegalCostCard({ legalCost, days }: { readonly legalCost: LegalCost; readonly days: number }) {
  const { perWorker } = legalCost;
  const flow = moneyFlow(legalCost);
  return (
    <Card>
      <Eyebrow>Costo legal estimado</Eyebrow>
      <p className="mt-1 text-sm text-ink-2">No es una factura. Lo pagas tú, directo. Nada es de NIVEL.</p>
      <dl className="mt-3 flex flex-col gap-2">
        <Destination
          tone="worker"
          title="Va al trabajador"
          hint="Salario y beneficios de ley."
          subtotal={flow.toWorker}
          rows={[
            [`Salario (${plural(days, "día", "días")})`, perWorker.salary],
            ["Utilidades", perWorker.utilidades],
            ["Vacaciones y bono vacacional", perWorker.vacacionesBono],
            ["Prestaciones sociales", perWorker.prestaciones],
          ]}
        />
        <Destination
          tone="state"
          title="Va al Estado"
          hint="Seguridad social."
          subtotal={flow.toState}
          rows={[
            ["Contribución de pensiones", perWorker.pensiones],
            ["Aportes (IVSS, FAOV, INCES)", perWorker.aportes],
          ]}
        />
        <div className={`${ROW} border-t border-line pt-2`}>
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

/** Lo único que cobra NIVEL: la tarifa por contratación, con el IVA 16 % aparte (regla legal 8.8). */
export function FeeRangeCard({ feeRange }: { readonly feeRange: FeeRange }) {
  const { min, max } = feeRange;
  return (
    <Card selected>
      <Eyebrow className="text-brand">Lo único que cobra NIVEL</Eyebrow>
      <p className="mt-1 text-sm text-ink-2">Solo si alguien acepta.</p>
      <dl className="mt-2 flex flex-col gap-1 text-[0.9375rem]">
        <div className={ROW}>
          <dt className="text-ink-2">Tarifa de NIVEL por contratación</dt>
          <dd className={AMOUNT}>{range(min.base, max.base)}</dd>
        </div>
        <div className={ROW}>
          <dt className="text-ink-2">IVA 16 % (va al SENIAT)</dt>
          <dd className={AMOUNT}>{range(min.iva, max.iva)}</dd>
        </div>
        <div className={`${ROW} border-t border-line pt-1.5`}>
          <dt className="font-bold">Total por persona</dt>
          <dd className="text-lg font-extrabold tabular-nums">{range(min.total, max.total)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-sm text-muted">{FEE_PAYMENT_NOTICE}</p>
    </Card>
  );
}

function Voucher({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <li>
      <p className="font-bold">{title}</p>
      <p className="text-sm text-ink-2">{children}</p>
    </li>
  );
}

/** Los comprobantes de una contratación: quién emite cada uno y dónde se ve. */
export function VouchersCard() {
  return (
    <Card>
      <Eyebrow>Tus comprobantes</Eyebrow>
      <ul className="mt-2 flex flex-col gap-2">
        <Voucher title="Recibo de pago del trabajador">Lo emites tú al registrar su pago.</Voucher>
        <Voucher title="Factura de NIVEL">Una por contratación: tarifa más IVA.</Voucher>
      </ul>
      <Link
        href="/c/pagos"
        className="mt-2 inline-flex min-h-12 items-center font-semibold text-brand underline decoration-2"
      >
        Ver recibos y facturas en Pagos
      </Link>
    </Card>
  );
}

/** Columna derecha de `/c`: cuánto cuesta contratar en regla y qué cobra NIVEL. */
export function CostPanel({ board }: { readonly board: RequestBoard | null }) {
  return (
    <aside aria-label="Costos" className="flex flex-col gap-4">
      {board ? <LegalCostCard legalCost={board.legalCost} days={board.request.days} /> : null}
      {board?.feeRange ? <FeeRangeCard feeRange={board.feeRange} /> : null}
      {board ? <VouchersCard /> : null}
      <Notice title="Garantía de búsqueda">{SEARCH_GUARANTEE_NOTICE}</Notice>
    </aside>
  );
}
