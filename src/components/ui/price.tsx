import { formatBs, formatUsd } from "@/lib/format";
import { EXAMPLE_RATE_LABEL, FEE_PAYMENT_NOTICE } from "@/lib/legal-copy";
import type { PriceWithIva } from "@/lib/pricing";

interface PriceBreakdownProps {
  readonly label: string;
  readonly price: PriceWithIva;
  /** Equivalente en bolívares, calculado con la tasa de ejemplo de la demo. */
  readonly totalBs?: number;
}

/**
 * Precio de una tarifa de NIVEL: base, IVA 16 % siempre aparte y total
 * (regla legal 8.8). Es una lista de definiciones para que un lector de
 * pantalla lea cada cifra con su nombre.
 */
export function PriceBreakdown({ label, price, totalBs }: PriceBreakdownProps) {
  return (
    <div>
      <p className="eyebrow text-muted">{label}</p>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[0.9375rem]">
        <dt className="text-ink-2">Tarifa</dt>
        <dd className="text-right font-semibold tabular-nums">{formatUsd(price.base)}</dd>
        <dt className="text-ink-2">IVA 16 %</dt>
        <dd className="text-right font-semibold tabular-nums">{formatUsd(price.iva)}</dd>
        <dt className="border-t border-line pt-1.5 font-bold">Total</dt>
        <dd className="border-t border-line pt-1.5 text-right text-lg font-extrabold tabular-nums">
          {formatUsd(price.total)}
        </dd>
      </dl>
      {totalBs === undefined ? null : (
        <p className="mt-1 text-right text-sm text-muted">
          {formatBs(totalBs)} ({EXAMPLE_RATE_LABEL})
        </p>
      )}
      <p className="mt-2 text-sm text-muted">{FEE_PAYMENT_NOTICE}</p>
    </div>
  );
}
