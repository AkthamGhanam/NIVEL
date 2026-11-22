"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import type { FeeStatement } from "@/client/company-api";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { LoadingText, Notice } from "@/components/ui/notice";
import { Tag } from "@/components/ui/tag";
import { formatBs, formatUsd, plural } from "@/lib/format";
import { FEE_PAYMENT_NOTICE } from "@/lib/legal-copy";
import {
  FEE_PAYMENT_METHODS,
  type FeePaymentMethod,
  HIRING_FEE_USD,
  NIVEL_BILLING,
  PAYMENT_METHOD_LABELS,
  PLANS,
  type PriceWithIva,
} from "@/lib/pricing";

import { useAction } from "../hooks/use-action";

/** Tasa de ejemplo del seed (Bs por dólar). */
const EXAMPLE_RATE = 36.5;

type FeeLine = FeeStatement["fees"][number];
type PayFee = (feeId: string, method: FeePaymentMethod, reference: string) => Promise<void>;

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

type PayStage = "idle" | "datos" | "verificando";

/** Cuánto tarda la "verificación" del pago simulado: lo justo para que se entienda el paso. */
const VERIFY_MS = 1600;
const REFERENCE_PATTERN = /^[A-Za-z0-9-]{4,30}$/;

function BillingData({ method, totalBs }: { readonly method: FeePaymentMethod; readonly totalBs: string }) {
  return (
    <dl className="grid gap-1 rounded-control bg-canvas px-3.5 py-3 text-[0.9375rem]">
      <div className="flex justify-between gap-3">
        <dt className="text-muted">Monto a pagar</dt>
        <dd className="font-extrabold tabular-nums">{totalBs}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted">Banco</dt>
        <dd className="font-semibold">{NIVEL_BILLING.bank}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted">{method === "pago_movil" ? "Teléfono" : "Cuenta"}</dt>
        <dd className="font-semibold tabular-nums">
          {method === "pago_movil" ? NIVEL_BILLING.pagoMovilPhone : NIVEL_BILLING.account}
        </dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted">RIF</dt>
        <dd className="font-semibold">{NIVEL_BILLING.rif}</dd>
      </div>
      <p className="text-xs text-muted">Datos de ejemplo: la demo no cobra de verdad.</p>
    </dl>
  );
}

interface PayFormProps {
  readonly fee: FeeLine;
  readonly rateBs: number;
  readonly method: FeePaymentMethod;
  readonly onMethod: (method: FeePaymentMethod) => void;
  readonly reference: string;
  readonly onReference: (reference: string) => void;
  readonly problem: string | undefined;
  readonly error: string | null;
  readonly onSubmit: (event: FormEvent) => void;
  readonly onCancel: () => void;
}

/** Datos para pagarle a NIVEL y la referencia del pago hecho. */
function PayForm(props: PayFormProps) {
  const { fee, rateBs, method, onMethod, reference, onReference, problem, error, onSubmit, onCancel } = props;
  const selectId = `tarifa-${fee.id}-medio`;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={selectId} className="text-sm font-bold text-ink-2">
          Medio de pago
        </label>
        <select
          id={selectId}
          value={method}
          onChange={(event) => onMethod(event.target.value as FeePaymentMethod)}
          className="min-h-12 rounded-control border-[1.5px] border-line bg-surface px-3"
        >
          {FEE_PAYMENT_METHODS.map((option) => (
            <option key={option} value={option}>
              {PAYMENT_METHOD_LABELS[option]}
            </option>
          ))}
        </select>
      </div>
      <BillingData method={method} totalBs={`${formatBs(fee.total * rateBs)} (tasa de ejemplo)`} />
      <TextField
        id={`tarifa-${fee.id}-referencia`}
        label="Referencia de tu pago"
        autoComplete="off"
        maxLength={30}
        value={reference}
        error={problem}
        onChange={(event) => onReference(event.target.value)}
      />
      {error ? (
        <Notice tone="alert" urgent>
          {error}
        </Notice>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Ya pagué</Button>
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function PayFlow({
  fee,
  onPay,
  rateBs,
}: {
  readonly fee: FeeLine;
  readonly onPay: PayFee;
  readonly rateBs: number;
}) {
  const [stage, setStage] = useState<PayStage>("idle");
  const [method, setMethod] = useState<FeePaymentMethod>("pago_movil");
  const [reference, setReference] = useState("");
  const [problem, setProblem] = useState<string>();
  const pay = useAction(async () => {
    setStage("verificando");
    await new Promise((resolve) => setTimeout(resolve, VERIFY_MS));
    await onPay(fee.id, method, reference.trim());
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!REFERENCE_PATTERN.test(reference.trim())) {
      setProblem("Escribe la referencia: de 4 a 30 letras o números.");
      return;
    }
    setProblem(undefined);
    void pay.invoke().then((ok) => {
      if (!ok) setStage("datos");
    });
  };
  if (stage === "idle") {
    return (
      <Button className="self-start" onClick={() => setStage("datos")}>
        Pagar factura<span className="sr-only"> {fee.invoiceNumber}</span>
      </Button>
    );
  }
  if (stage === "verificando") {
    return <LoadingText>Verificando tu pago con el banco (simulado)…</LoadingText>;
  }
  return (
    <PayForm
      fee={fee}
      rateBs={rateBs}
      method={method}
      onMethod={setMethod}
      reference={reference}
      onReference={setReference}
      problem={problem}
      error={pay.error}
      onSubmit={submit}
      onCancel={() => setStage("idle")}
    />
  );
}

function FeeRow({
  fee,
  onPay,
  rateBs,
}: {
  readonly fee: FeeLine;
  readonly onPay: PayFee;
  readonly rateBs: number;
}) {
  const paid = fee.status === "pagado";
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">{fee.concept}</p>
        <Tag tone={paid ? "ok" : "pending"}>
          {paid && fee.method ? `Pagada por ${PAYMENT_METHOD_LABELS[fee.method]}` : "Por pagar"}
        </Tag>
      </div>
      <p className="text-sm text-muted">Factura simulada N.º {fee.invoiceNumber}</p>
      <Amounts price={fee} />
      {paid ? (
        <Link
          href={`/factura/${encodeURIComponent(fee.id)}`}
          className="inline-flex min-h-12 items-center self-start font-semibold text-brand underline decoration-2"
        >
          Ver factura digital
        </Link>
      ) : (
        <PayFlow fee={fee} onPay={onPay} rateBs={rateBs} />
      )}
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
  /** Tasa de ejemplo para mostrar el monto en bolívares. */
  readonly rateBs?: number;
}

/** Tarifas de NIVEL de la empresa: lo pendiente, lo pagado y cada factura simulada. */
export function FeeStatementView({ statement, onPay, rateBs = EXAMPLE_RATE }: FeeStatementViewProps) {
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
              <FeeRow key={fee.id} fee={fee} onPay={onPay} rateBs={rateBs} />
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
