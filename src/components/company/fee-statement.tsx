"use client";

import { useState } from "react";

import type { FeeStatement } from "@/client/company-api";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Tag } from "@/components/ui/tag";
import { formatUsd, plural } from "@/lib/format";
import { FEE_PAYMENT_NOTICE } from "@/lib/legal-copy";
import {
  FEE_PAYMENT_METHODS,
  type FeePaymentMethod,
  HIRING_FEE_USD,
  PAYMENT_METHOD_LABELS,
  PLANS,
  type PriceWithIva,
} from "@/lib/pricing";

import { useAction } from "../hooks/use-action";

type FeeLine = FeeStatement["fees"][number];
type PayFee = (feeId: string, method: FeePaymentMethod) => Promise<void>;

/** Base, IVA 16 % aparte y total, en una línea que un lector de pantalla lee con sus nombres. */
function Amounts({ price }: { readonly price: PriceWithIva }) {
  return (
    <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[0.9375rem]">
      <div className="flex gap-1.5">
        <dt className="text-muted">Tarifa</dt>
        <dd className="font-semibold tabular-nums">{formatUsd(price.base)}</dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="text-muted">IVA 16 %</dt>
        <dd className="font-semibold tabular-nums">{formatUsd(price.iva)}</dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="font-bold">Total</dt>
        <dd className="font-extrabold tabular-nums">{formatUsd(price.total)}</dd>
      </div>
    </dl>
  );
}

function FeeRow({ fee, onPay }: { readonly fee: FeeLine; readonly onPay: PayFee }) {
  const [method, setMethod] = useState<FeePaymentMethod>("pago_movil");
  const pay = useAction(onPay);
  const selectId = `tarifa-${fee.id}-medio`;
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">{fee.concept}</p>
        <Tag tone={fee.status === "pagado" ? "ok" : "pending"}>
          {fee.status === "pagado" && fee.method
            ? `Pagada por ${PAYMENT_METHOD_LABELS[fee.method]}`
            : "Por pagar"}
        </Tag>
      </div>
      <p className="text-sm text-muted">Factura simulada N.º {fee.invoiceNumber}</p>
      <Amounts price={fee} />
      {fee.status === "por_pagar" ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={selectId} className="text-sm font-bold text-ink-2">
              Medio de pago
            </label>
            <select
              id={selectId}
              value={method}
              onChange={(event) => setMethod(event.target.value as FeePaymentMethod)}
              className="min-h-12 rounded-control border-[1.5px] border-line bg-surface px-3"
            >
              {FEE_PAYMENT_METHODS.map((option) => (
                <option key={option} value={option}>
                  {PAYMENT_METHOD_LABELS[option]}
                </option>
              ))}
            </select>
          </div>
          <Button variant="outline" disabled={pay.pending} onClick={() => void pay.invoke(fee.id, method)}>
            Marcar como pagada<span className="sr-only">: factura {fee.invoiceNumber}</span>
          </Button>
        </div>
      ) : null}
      {pay.error ? (
        <Notice tone="alert" urgent>
          {pay.error}
        </Notice>
      ) : null}
    </li>
  );
}

/** Sugerencia del Plan Obra: solo aparece si este mes le sale más barato que pagar por contratación. */
export function PlanCard({ plan }: { readonly plan: NonNullable<FeeStatement["planSuggestion"]> }) {
  return (
    <Card selected className="flex flex-col gap-2">
      <Eyebrow className="text-brand">Plan Obra</Eyebrow>
      <p className="text-lg font-bold">Con el Plan Obra ahorrarías {formatUsd(plan.savesUsd)} este mes.</p>
      <p className="text-ink-2">
        Llevas {plural(plan.hiresThisMonth, "contratación", "contrataciones")} y pagas{" "}
        {formatUsd(plan.payPerHire.total)} con IVA. El plan cuesta {formatUsd(PLANS.obra.monthlyUsd)} al mes +
        IVA, incluye {PLANS.obra.includedHires} contrataciones y cada una adicional cuesta{" "}
        {formatUsd(PLANS.obra.extraHireUsd)} + IVA: serían {formatUsd(plan.planObra.total)} con IVA.
      </p>
    </Card>
  );
}

interface PlanOption {
  readonly name: string;
  readonly price: string;
  readonly detail: string;
  readonly fits: string;
}

const PLAN_OPTIONS: readonly PlanOption[] = [
  {
    name: "Pago por contratación",
    price: `${formatUsd(HIRING_FEE_USD[1])} a ${formatUsd(HIRING_FEE_USD[5])} + IVA por persona`,
    detail: "Según el nivel de quien contratas. Solo pagas cuando alguien acepta.",
    fits: "Si contratas de vez en cuando.",
  },
  {
    name: "Plan Obra",
    price: `${formatUsd(PLANS.obra.monthlyUsd)} al mes + IVA`,
    detail: `Incluye ${PLANS.obra.includedHires} contrataciones al mes. Cada una adicional, ${formatUsd(PLANS.obra.extraHireUsd)} + IVA.`,
    fits: "Si armas cuadrilla todos los meses.",
  },
  {
    name: "Plan Empresa",
    price: `${formatUsd(PLANS.empresa.monthlyUsd)} al mes + IVA`,
    detail: "Para industria y logística con contratación continua. Disponible en la siguiente fase.",
    fits: "Si contratas 10 o más personas al mes.",
  },
];

/** Los tres planes, con el que le conviene hoy a esta empresa marcado según sus contrataciones del mes. */
export function PlansCard({ recommended }: { readonly recommended: "Pago por contratación" | "Plan Obra" }) {
  return (
    <section aria-labelledby="planes-titulo" className="flex flex-col gap-3">
      <h2 id="planes-titulo" className="bar-title text-xl font-extrabold">
        Cómo cobra NIVEL
      </h2>
      <p className="text-sm text-muted">
        El trabajador nunca paga. El salario va directo de tu empresa a cada persona: no pasa por NIVEL.
      </p>
      <ul className="grid gap-3 md:grid-cols-3">
        {PLAN_OPTIONS.map((plan) => (
          <li key={plan.name}>
            <Card selected={plan.name === recommended} className="flex h-full flex-col gap-1.5">
              {plan.name === recommended ? <Tag tone="ok">Te conviene hoy</Tag> : null}
              <h3 className="text-lg font-extrabold">{plan.name}</h3>
              <p className="font-bold tabular-nums">{plan.price}</p>
              <p className="text-sm text-ink-2">{plan.detail}</p>
              <p className="mt-auto pt-1 text-sm font-semibold text-muted">{plan.fits}</p>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface FeeStatementViewProps {
  readonly statement: FeeStatement;
  readonly onPay: PayFee;
}

/** Tarifas de NIVEL de la empresa: lo pendiente, lo pagado y cada factura simulada. */
export function FeeStatementView({ statement, onPay }: FeeStatementViewProps) {
  return (
    <section aria-labelledby="tarifas-titulo" className="flex flex-col gap-3">
      <h2 id="tarifas-titulo" className="bar-title text-xl font-extrabold">
        Tarifas de NIVEL
      </h2>
      <p className="text-sm text-muted">{FEE_PAYMENT_NOTICE}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <Eyebrow>Por pagar</Eyebrow>
          <div className="mt-2">
            <Amounts price={statement.pending} />
          </div>
        </Card>
        <Card>
          <Eyebrow>Pagado</Eyebrow>
          <div className="mt-2">
            <Amounts price={statement.paid} />
          </div>
        </Card>
      </div>
      {statement.planSuggestion ? <PlanCard plan={statement.planSuggestion} /> : null}
      {statement.fees.length === 0 ? (
        <p className="text-muted">
          Aún no tienes tarifas. Se genera una cuando una persona acepta tu invitación.
        </p>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line-2">
            {statement.fees.map((fee) => (
              <FeeRow key={fee.id} fee={fee} onPay={onPay} />
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
