"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import type { PaymentInput, RequestBoard } from "@/client/company-api";
import { type CrewMember, liquidationOwed, paymentStage } from "@/client/company-view";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LiquidationList } from "@/components/ui/liquidation-list";
import { SelectField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Tag } from "@/components/ui/tag";
import { formatUsd, plural } from "@/lib/format";
import { LIQUIDATION_LABELS } from "@/lib/legal-cost";
import { FEE_PAYMENT_METHODS, type FeePaymentMethod, PAYMENT_METHOD_LABELS } from "@/lib/pricing";

import { useAction } from "../hooks/use-action";

/** El mismo formato que valida la API: de 4 a 30 letras, números o guiones. */
const REFERENCE_PATTERN = /^[A-Za-z0-9-]{4,30}$/;

type RegisterPayment = (input: PaymentInput) => Promise<void>;

function PaymentForm({
  member,
  onRegister,
}: {
  readonly member: CrewMember;
  readonly onRegister: RegisterPayment;
}) {
  const [method, setMethod] = useState<FeePaymentMethod>("pago_movil");
  const [reference, setReference] = useState("");
  const [problem, setProblem] = useState<string>();
  const register = useAction(onRegister);
  const id = `pago-${member.contractId}`;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = reference.trim();
    if (!REFERENCE_PATTERN.test(clean)) {
      setProblem("Escribe la referencia: de 4 a 30 letras o números.");
      return;
    }
    setProblem(undefined);
    void register.invoke({ contractId: member.contractId, method, reference: clean });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          id={`${id}-medio`}
          label="Cómo le pagaste"
          value={method}
          onChange={(event) => setMethod(event.target.value as FeePaymentMethod)}
        >
          {FEE_PAYMENT_METHODS.map((option) => (
            <option key={option} value={option}>
              {PAYMENT_METHOD_LABELS[option]}
            </option>
          ))}
        </SelectField>
        <TextField
          id={`${id}-referencia`}
          label="Número de referencia"
          autoComplete="off"
          maxLength={30}
          value={reference}
          error={problem}
          onChange={(event) => setReference(event.target.value)}
        />
      </div>
      {register.error ? (
        <Notice tone="alert" urgent>
          {register.error}
        </Notice>
      ) : null}
      <Button type="submit" className="self-start" disabled={register.pending}>
        {register.pending ? "Registrando…" : "Registrar liquidación pagada"}
        <span className="sr-only"> a {member.shortName}</span>
      </Button>
    </form>
  );
}

function ReceiptLink({ member }: { readonly member: CrewMember }) {
  if (!member.payment) return null;
  return (
    <Link
      href={`/recibo/${encodeURIComponent(member.payment.id)}?vista=empresa`}
      className="inline-flex min-h-12 items-center font-semibold text-brand underline decoration-2"
    >
      Ver recibo {member.payment.receiptNumber}
    </Link>
  );
}

interface WageCardProps {
  readonly request: RequestBoard["request"];
  readonly member: CrewMember;
  readonly onRegister: RegisterPayment;
}

/** Salario de una persona de la cuadrilla y en qué va su pago. */
export function WageCard({ request, member, onRegister }: WageCardProps) {
  const stage = paymentStage(member);
  const owed = liquidationOwed(request, member);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={member.shortName} tone="ink" />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold">{member.shortName}</h3>
          <p className="text-sm text-muted">
            {plural(member.days, "día", "días")} a {formatUsd(request.dailyPayUsd)}
          </p>
        </div>
        <p className="text-2xl font-extrabold tabular-nums">{formatUsd(owed.total)}</p>
      </div>
      {stage === "por_pagar" ? (
        <LiquidationList
          items={LIQUIDATION_LABELS.map(([key, label]) => ({ label, amountUsd: owed[key] }))}
          total={owed.total}
        />
      ) : null}
      {stage === "sin_firma" ? (
        <Tag tone="pending" className="self-start">
          {member.status === "terminado" ? "Contrato terminado" : "Falta la firma del trabajador"}
        </Tag>
      ) : null}
      {stage === "por_pagar" ? <PaymentForm member={member} onRegister={onRegister} /> : null}
      {stage === "por_confirmar" ? (
        <Tag tone="pending" className="self-start">
          Liquidación registrada. Falta que {member.shortName} confirme
        </Tag>
      ) : null}
      {stage === "confirmado" ? (
        <Tag tone="ok" className="self-start">
          {member.shortName} confirmó que recibió su liquidación
        </Tag>
      ) : null}
      <ReceiptLink member={member} />
    </Card>
  );
}

interface WagePaymentsProps {
  readonly board: RequestBoard;
  readonly onRegister: RegisterPayment;
}

export function WagePayments({ board, onRegister }: WagePaymentsProps) {
  return (
    <section aria-labelledby="salarios-titulo" className="flex flex-col gap-3">
      <h2 id="salarios-titulo" className="bar-title text-xl font-extrabold">
        Liquidación de tu cuadrilla
      </h2>
      <p className="text-sm text-muted">
        Al terminar la obra le pagas a cada persona su liquidación completa, directo. NIVEL genera el recibo y
        la persona confirma que la recibió.
      </p>
      {board.crew.length === 0 ? (
        <p className="text-muted">Aún no hay nadie contratado en esta solicitud.</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {board.crew.map((member) => (
            <li key={member.contractId}>
              <WageCard request={board.request} member={member} onRegister={onRegister} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
