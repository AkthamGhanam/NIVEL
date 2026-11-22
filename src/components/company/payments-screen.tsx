"use client";

import { useState } from "react";

import { errorMessage } from "@/client/api";
import type { PaymentInput } from "@/client/company-api";
import { createLiveStore } from "@/client/live-store";
import { LoadingText, Notice } from "@/components/ui/notice";
import type { FeePaymentMethod } from "@/lib/pricing";

import { useLive } from "../hooks/use-live";
import { BoardGate } from "./board-gate";
import { useCompany } from "./company-gate";
import { FeeStatementView } from "./fee-statement";
import { WagePayments } from "./wage-payments";

/** Las tarifas cambian solo cuando alguien acepta: se consultan con menos frecuencia que el tablero. */
const FEES_POLL_MS = 5000;

function FeeSection() {
  const { api } = useCompany();
  const [store] = useState(() => createLiveStore((signal) => api.fees(signal), { intervalMs: FEES_POLL_MS }));
  const live = useLive(store);
  const pay = async (feeId: string, method: FeePaymentMethod) => {
    await api.payFee(feeId, method);
    await store.refresh();
  };
  if (live.loading) return <LoadingText>Nivi está sumando tus tarifas…</LoadingText>;
  return (
    <>
      {live.error === undefined ? null : <Notice tone="pending">{errorMessage(live.error)}</Notice>}
      {live.data ? <FeeStatementView statement={live.data} onPay={pay} /> : null}
    </>
  );
}

/** Pagos: el salario que la empresa paga directo a su cuadrilla y las tarifas de NIVEL. */
export function PaymentsScreen() {
  const { api, board: store } = useCompany();
  const register = async (input: PaymentInput) => {
    await api.registerPayment(input);
    await store.refresh();
  };
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <h1 className="display text-3xl sm:text-4xl">Pagos</h1>
      <BoardGate emptyTitleAs="h2">
        {(board) => <WagePayments board={board} onRegister={register} />}
      </BoardGate>
      <FeeSection />
    </div>
  );
}
