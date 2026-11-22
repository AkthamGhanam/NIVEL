"use client";

import { useState } from "react";

import { apiRequest, errorMessage, type ViewRole } from "@/client/api";
import type { Receipt } from "@/client/company-api";
import { createLiveStore } from "@/client/live-store";
import { Button } from "@/components/ui/button";
import { LoadingText, Notice } from "@/components/ui/notice";

import { useLive } from "../hooks/use-live";
import { ReceiptFrame, ReceiptView } from "./receipt-view";

interface ReceiptScreenProps {
  readonly paymentId: string;
  /** Con qué sesión se pide el recibo. Sin valor, el servidor usa la que haya abierta. */
  readonly view: Extract<ViewRole, "worker" | "company"> | undefined;
}

/** Recibo imprimible. El servidor solo lo entrega a las dos partes del contrato. */
export function ReceiptScreen({ paymentId, view }: ReceiptScreenProps) {
  const [store] = useState(() =>
    createLiveStore((signal) =>
      apiRequest<Receipt>(`/api/payments/${encodeURIComponent(paymentId)}/receipt`, {
        signal,
        ...(view ? { as: view } : {}),
      }),
    ),
  );
  const live = useLive(store);
  return (
    <ReceiptFrame>
      {live.loading ? <LoadingText>Buscando el recibo…</LoadingText> : null}
      {!live.loading && !live.data ? (
        <Notice tone="alert" urgent>
          {errorMessage(live.error)}
        </Notice>
      ) : null}
      {live.data ? (
        <>
          <ReceiptView receipt={live.data} />
          <Button variant="outline" className="self-start print:hidden" onClick={() => window.print()}>
            Imprimir o guardar como PDF
          </Button>
        </>
      ) : null}
    </ReceiptFrame>
  );
}
