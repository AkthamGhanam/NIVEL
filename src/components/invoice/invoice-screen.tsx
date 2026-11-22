// Factura digital (simulada) de una tarifa de NIVEL: emisor, cliente, base, IVA aparte y total en bolívares.
"use client";

import { useState } from "react";

import { apiRequest, errorMessage } from "@/client/api";
import type { Invoice } from "@/client/company-api";
import { createLiveStore } from "@/client/live-store";
import { NivelMark } from "@/components/brand/brand";
import { ReceiptFrame } from "@/components/receipt/receipt-view";
import { Button } from "@/components/ui/button";
import { LoadingText, Notice } from "@/components/ui/notice";
import { Tag } from "@/components/ui/tag";
import { formatBs, formatDateTime, formatUsd } from "@/lib/format";
import { EXAMPLE_RATE_LABEL } from "@/lib/legal-copy";
import { PAYMENT_METHOD_LABELS } from "@/lib/pricing";

import { useLive } from "../hooks/use-live";

function Row({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 py-2">
      <dt className="text-ink-2">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}

export function InvoiceView({ invoice }: { readonly invoice: Invoice }) {
  return (
    <article className="rounded-card border-[1.5px] border-line bg-surface p-6 print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="display text-3xl">Factura digital</h1>
          <p className="mt-1 font-semibold text-ink-2">N.º {invoice.invoiceNumber}</p>
          <p className="text-sm text-muted">N.º de control {invoice.controlNumber}</p>
          <Tag tone="pending" className="mt-2">
            Simulada · sin validez fiscal
          </Tag>
        </div>
        <NivelMark />
      </header>
      <dl className="divide-y divide-line-2">
        <Row label="Emisor">
          {invoice.issuer.name}
          <span className="block text-sm font-normal text-muted">RIF {invoice.issuer.rif}</span>
        </Row>
        <Row label="Cliente">
          {invoice.customer.name}
          <span className="block text-sm font-normal text-muted">RIF {invoice.customer.rif}</span>
        </Row>
        <Row label="Concepto">{invoice.concept}</Row>
        <Row label="Base imponible">{formatUsd(invoice.base)}</Row>
        <Row label="IVA 16 %">{formatUsd(invoice.iva)}</Row>
        <Row label="Total">
          <span className="text-2xl font-extrabold tabular-nums">{formatUsd(invoice.total)}</span>
          <span className="block text-sm font-normal text-muted">
            {formatBs(invoice.totalBs)} a {String(invoice.rateBsPerUsd).replace(".", ",")} Bs por dólar (
            {EXAMPLE_RATE_LABEL})
          </span>
        </Row>
        <Row label="Pago">
          {invoice.method ? PAYMENT_METHOD_LABELS[invoice.method] : "Pendiente"}
          {invoice.reference ? ` · referencia ${invoice.reference}` : ""}
          {invoice.paidAt ? (
            <span className="block text-sm font-normal text-muted">{formatDateTime(invoice.paidAt)}</span>
          ) : null}
        </Row>
      </dl>
      <footer className="mt-4 flex flex-col gap-1 border-t border-line pt-4 text-sm text-muted">
        <p>
          NIVEL se queda con la base. El IVA lo entrega al SENIAT. En producción, esta factura la emite una
          imprenta digital autorizada.
        </p>
      </footer>
    </article>
  );
}

export function InvoiceScreen({ feeId }: { readonly feeId: string }) {
  const [store] = useState(() =>
    createLiveStore((signal) =>
      apiRequest<Invoice>(`/api/fees/${encodeURIComponent(feeId)}/invoice`, { signal, as: "company" }),
    ),
  );
  const live = useLive(store);
  return (
    <ReceiptFrame>
      {live.loading ? <LoadingText>Buscando la factura…</LoadingText> : null}
      {!live.loading && !live.data ? (
        <Notice tone="alert" urgent>
          {errorMessage(live.error)}
        </Notice>
      ) : null}
      {live.data ? (
        <>
          <InvoiceView invoice={live.data} />
          <Button variant="outline" className="self-start print:hidden" onClick={() => window.print()}>
            Imprimir o guardar en PDF
          </Button>
        </>
      ) : null}
    </ReceiptFrame>
  );
}
