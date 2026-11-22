import type { Receipt } from "@/client/company-api";
import { DemoFooter, NivelMark } from "@/components/brand/brand";
import { Tag } from "@/components/ui/tag";
import { formatBs, formatDateTime, formatUsd, plural } from "@/lib/format";
import { EXAMPLE_RATE_LABEL, NOT_EMPLOYER_NOTICE } from "@/lib/legal-copy";
import { PAYMENT_METHOD_LABELS } from "@/lib/pricing";

function Row({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 py-2">
      <dt className="text-ink-2">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}

/**
 * Recibo de pago del salario (LOTTT, artículo 106). NIVEL no mueve el dinero:
 * deja constancia de lo que registró la empresa y de si la persona confirmó.
 */
export function ReceiptView({ receipt }: { readonly receipt: Receipt }) {
  return (
    <article className="rounded-card border-[1.5px] border-line bg-surface p-6 print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="display text-3xl">Recibo de pago</h1>
          <p className="mt-1 font-semibold text-ink-2">N.º {receipt.receiptNumber}</p>
          <p className="text-sm text-muted">Artículo 106 de la LOTTT</p>
        </div>
        <NivelMark />
      </header>
      <dl className="divide-y divide-line-2">
        <Row label="Patrono">
          {receipt.employer.name}
          <span className="block text-sm font-normal text-muted">RIF {receipt.employer.rif}</span>
        </Row>
        <Row label="Trabajador">{receipt.workerName}</Row>
        <Row label="Concepto">{receipt.concept}</Row>
        <Row label="Detalle">
          {plural(receipt.days, "día", "días")} a {formatUsd(receipt.dailyPayUsd)}
        </Row>
        <Row label="Monto pagado">
          <span className="text-2xl font-extrabold tabular-nums">{formatUsd(receipt.amountUsd)}</span>
          <span className="block text-sm font-normal text-muted">
            {formatBs(receipt.amountBs)} ({EXAMPLE_RATE_LABEL})
          </span>
        </Row>
        <Row label="Medio de pago">
          {PAYMENT_METHOD_LABELS[receipt.method]} · referencia {receipt.reference}
        </Row>
        <Row label="Registrado por la empresa">{formatDateTime(receipt.registeredAt)}</Row>
        <Row label="Confirmación del trabajador">
          {receipt.confirmedByWorkerAt ? (
            <Tag tone="ok">Recibido · {formatDateTime(receipt.confirmedByWorkerAt)}</Tag>
          ) : (
            <Tag tone="pending">Pendiente de confirmación</Tag>
          )}
        </Row>
      </dl>
      <footer className="mt-4 flex flex-col gap-1 border-t border-line pt-4 text-sm text-muted">
        <p>El pago se hizo directo entre la empresa y el trabajador. El dinero no pasó por NIVEL.</p>
        <p className="font-semibold">{NOT_EMPLOYER_NOTICE}</p>
      </footer>
    </article>
  );
}

export function ReceiptFrame({ children }: { readonly children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8">{children}</main>
      <DemoFooter className="border-t border-line" />
    </>
  );
}
