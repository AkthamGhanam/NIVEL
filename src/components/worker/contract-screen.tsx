"use client";

import { type FormEvent, useState } from "react";

import type { ContractDetail } from "@/client/worker-api";
import { jobStep, stepAction } from "@/client/worker-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { NotEmployerNotice, Notice } from "@/components/ui/notice";
import { Tag } from "@/components/ui/tag";
import { formatDateTime, formatDay, formatUsd, plural } from "@/lib/format";
import { CONTRACT_TYPE_LABELS } from "@/lib/trades";

import { useAction } from "../hooks/use-action";
import { ContractGate } from "./contract-gate";
import { NextStep } from "./home-screen";
import { useWorker } from "./worker-gate";

const OTP_PATTERN = /^\d{6}$/;

/** Resumen del contrato directo entre la empresa y el trabajador. */
export function ContractSummary({ contract }: { readonly contract: ContractDetail }) {
  const rows = [
    ["Empresa (patrono)", contract.companyName],
    ["Tipo de contrato", CONTRACT_TYPE_LABELS[contract.contractType]],
    ["Empieza", formatDay(contract.startDate)],
    ["Duración", plural(contract.days, "día", "días")],
    ["Pago diario", formatUsd(contract.dailyPayUsd)],
  ] as const;
  return (
    <Card>
      <dl className="flex flex-col divide-y divide-line-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-ink-2">{label}</dt>
            <dd className="text-right font-semibold">{value}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 py-2">
          <dt className="font-bold">Total</dt>
          <dd className="text-2xl font-extrabold tabular-nums">{formatUsd(contract.totalUsd)}</dd>
        </div>
      </dl>
      <NotEmployerNotice className="mt-2" />
    </Card>
  );
}

interface SignatureProps {
  /** Pide un código nuevo. En la demo el servidor lo devuelve para mostrarlo en pantalla. */
  readonly onRequestCode: () => Promise<string>;
  readonly onSign: (code: string) => Promise<void>;
}

/** Firma con código de un solo uso. El SMS es simulado: el código se muestra aquí mismo. */
export function SignatureForm({ onRequestCode, onSign }: SignatureProps) {
  const [sent, setSent] = useState<string>();
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string>();
  const request = useAction(async () => setSent(await onRequestCode()));
  const sign = useAction(onSign);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!OTP_PATTERN.test(code.trim())) {
      setProblem("El código tiene 6 dígitos.");
      return;
    }
    setProblem(undefined);
    void sign.invoke(code.trim());
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      {sent ? (
        <Notice title="Código enviado por SMS (simulado)">
          <p className="text-2xl font-extrabold tracking-[0.2em] tabular-nums">{sent}</p>
          <button
            type="button"
            onClick={() => setCode(sent)}
            className="min-h-12 font-semibold text-brand underline decoration-2"
          >
            Usar este código
          </button>
        </Notice>
      ) : null}
      <Button variant="outline" block disabled={request.pending} onClick={() => void request.invoke()}>
        {sent ? "Enviarme otro código" : "Enviarme el código"}
      </Button>
      <TextField
        id="contrato-codigo"
        label="Código de 6 dígitos"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        error={problem}
        onChange={(event) => setCode(event.target.value)}
      />
      {request.error || sign.error ? (
        <Notice tone="alert" urgent>
          {request.error ?? sign.error}
        </Notice>
      ) : null}
      <Button type="submit" block disabled={sign.pending}>
        {sign.pending ? "Firmando…" : "Firmar contrato"}
      </Button>
    </form>
  );
}

export function ContractView({
  contract,
  onRequestCode,
  onSign,
}: SignatureProps & { readonly contract: ContractDetail }) {
  const signed = contract.status !== "pendiente_firma";
  return (
    <>
      <h1 className="display text-3xl">Tu contrato</h1>
      <ContractSummary contract={contract} />
      {signed ? (
        <>
          <Tag tone="ok" className="self-start">
            {contract.signedWorkerAt
              ? `Firmado el ${formatDateTime(contract.signedWorkerAt)}`
              : "Contrato firmado"}
          </Tag>
          <NextStep action={stepAction(jobStep(contract), contract.id)} />
        </>
      ) : (
        <SignatureForm onRequestCode={onRequestCode} onSign={onSign} />
      )}
    </>
  );
}

export function ContractScreen({ contractId }: { readonly contractId: string }) {
  const { api, offers } = useWorker();
  return (
    <ContractGate contractId={contractId}>
      {(contract, refresh) => (
        <ContractView
          contract={contract}
          onRequestCode={async () => (await api.requestOtp(contractId)).otp}
          onSign={async (code) => {
            await api.sign(contractId, code);
            await Promise.all([refresh(), offers.refresh()]);
          }}
        />
      )}
    </ContractGate>
  );
}
