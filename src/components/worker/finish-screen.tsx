"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import type { ContractDetail } from "@/client/worker-api";
import { jobStep, stepAction } from "@/client/worker-view";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { formatUsd } from "@/lib/format";
import { BLIND_RATING_NOTICE } from "@/lib/legal-copy";

import { useAction } from "../hooks/use-action";
import { RatingForm, type RatingValues } from "../rating/rating-form";
import { ContractGate } from "./contract-gate";
import { NextStep } from "./home-screen";
import { useWorker } from "./worker-gate";

interface PaymentQuestionProps {
  readonly payment: NonNullable<ContractDetail["payment"]>;
  readonly onConfirm: () => void;
  readonly pending: boolean;
  readonly error: string | null;
}

/** "¿Recibiste tu pago?": solo la persona puede confirmar que el dinero le llegó. */
export function PaymentQuestion({ payment, onConfirm, pending, error }: PaymentQuestionProps) {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="display text-2xl">¿Recibiste tu pago de {formatUsd(payment.amountUsd)}?</h2>
      <p className="text-ink-2">
        La empresa registró que te pagó. El dinero va directo de la empresa a ti: confirma solo si ya lo
        tienes.
      </p>
      <Link
        href={`/recibo/${encodeURIComponent(payment.id)}?vista=trabajador`}
        className="inline-flex min-h-12 items-center font-semibold text-brand underline decoration-2"
      >
        Ver recibo {payment.receiptNumber}
      </Link>
      {error ? (
        <Notice tone="alert" urgent>
          {error}
        </Notice>
      ) : null}
      <Button block disabled={pending} onClick={onConfirm}>
        Sí, lo recibí
      </Button>
      <ButtonLink href="/trabajador/ayuda?tipo=no_pago" variant="danger" block>
        No lo he recibido
      </ButtonLink>
    </Card>
  );
}

interface FinishViewProps {
  readonly contract: ContractDetail;
  readonly onConfirm: () => void;
  readonly confirming: boolean;
  readonly error: string | null;
  readonly onRate: (input: RatingValues) => Promise<void>;
}

/** Fin de obra: confirmar el pago y calificar a la empresa en privado. */
export function FinishView({ contract, onConfirm, confirming, error, onRate }: FinishViewProps) {
  const step = jobStep(contract);
  return (
    <>
      <div>
        <Eyebrow>{contract.companyName}</Eyebrow>
        <h1 className="display mt-1 text-3xl">Fin de obra</h1>
      </div>
      {step === "confirmar_pago" && contract.payment ? (
        <PaymentQuestion
          payment={contract.payment}
          onConfirm={onConfirm}
          pending={confirming}
          error={error}
        />
      ) : null}
      {step === "calificar" ? (
        <Card className="flex flex-col gap-3">
          <h2 className="display text-2xl">Califica a la empresa</h2>
          <RatingForm
            role="trabajador"
            contractId={contract.id}
            subject="La empresa"
            notice={BLIND_RATING_NOTICE}
            onSubmit={onRate}
          />
        </Card>
      ) : null}
      {step === "terminado" ? (
        <>
          <Notice title="Calificación enviada">{BLIND_RATING_NOTICE}</Notice>
          <ButtonLink href="/trabajador/nivel" block>
            Ver mi nivel
          </ButtonLink>
        </>
      ) : null}
      {step !== "confirmar_pago" && step !== "calificar" && step !== "terminado" ? (
        <NextStep action={stepAction(step, contract.id)} />
      ) : null}
    </>
  );
}

interface FinishControlsProps {
  readonly contract: ContractDetail;
  readonly refresh: () => Promise<void>;
}

function FinishControls({ contract, refresh }: FinishControlsProps) {
  const { api, offers, profile } = useWorker();
  const router = useRouter();
  const confirm = useAction(async () => {
    if (contract.payment) await api.confirmPayment(contract.payment.id);
    await Promise.all([refresh(), offers.refresh()]);
  });
  const rate = async (input: RatingValues) => {
    await api.rate(input);
    // Con el trabajo confirmado por ambas partes, la fórmula pública vuelve a calcular el nivel.
    const level = await api.recalculateLevel();
    await Promise.all([refresh(), profile.refresh()]);
    if (level.leveledUp) router.push("/trabajador/nivel?subiste=1");
  };
  return (
    <FinishView
      contract={contract}
      onConfirm={() => void confirm.invoke()}
      confirming={confirm.pending}
      error={confirm.error}
      onRate={rate}
    />
  );
}

export function FinishScreen({ contractId }: { readonly contractId: string }) {
  return (
    <ContractGate contractId={contractId}>
      {(contract, refresh) => <FinishControls contract={contract} refresh={refresh} />}
    </ContractGate>
  );
}
