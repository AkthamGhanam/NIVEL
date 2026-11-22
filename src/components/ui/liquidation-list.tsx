// Los conceptos de una liquidación, uno por línea, con el total al final.
import { formatUsd } from "@/lib/format";
import { cx } from "@/lib/cx";

interface LiquidationListProps {
  readonly items: ReadonlyArray<{ readonly label: string; readonly amountUsd: number }>;
  readonly total: number;
  readonly className?: string;
}

export function LiquidationList({ items, total, className }: LiquidationListProps) {
  return (
    <dl className={cx("flex flex-col gap-1 text-[0.9375rem]", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-2">{item.label}</dt>
          <dd className="font-semibold tabular-nums">{formatUsd(item.amountUsd)}</dd>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-4 border-t border-line pt-1.5">
        <dt className="font-bold">Total</dt>
        <dd className="text-lg font-extrabold tabular-nums">{formatUsd(total)}</dd>
      </div>
    </dl>
  );
}
