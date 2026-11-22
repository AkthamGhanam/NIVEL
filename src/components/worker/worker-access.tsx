"use client";

import { useState } from "react";

import type { WorkerApi, WorkerPersona, WorkerSignupInput } from "@/client/worker-api";
import { NivelMark } from "@/components/brand/brand";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { LevelBadge } from "@/components/ui/tag";
import { cx } from "@/lib/cx";
import type { Level } from "@/lib/level";
import { TRADE_LABELS, type Trade } from "@/lib/trades";

import { NiviRegistration } from "./nivi-registration";
import { WorkerSignupForm } from "./worker-signup-form";

const tradeLabel = (trade: string) => TRADE_LABELS[trade as Trade]?.singular ?? trade;

type Method = "voz" | "texto";

interface WorkerAccessProps {
  readonly api: WorkerApi;
  /** Cuentas de prueba del seed. Las personas reales nunca aparecen aquí. */
  readonly demoAccounts: readonly WorkerPersona[];
  readonly onPickDemo: (workerId: string) => void;
  readonly onRegister: (input: WorkerSignupInput) => void;
  /** Nivi guardó el perfil y la sesión ya está abierta. */
  readonly onRegistered: () => void;
  readonly pending: boolean;
  readonly error: string | null;
}

function MethodTabs({
  method,
  onChange,
}: {
  readonly method: Method;
  readonly onChange: (method: Method) => void;
}) {
  const options: ReadonlyArray<{ value: Method; label: string }> = [
    { value: "voz", label: "Hablando con Nivi" },
    { value: "texto", label: "Prefiero escribir" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Cómo crear tu perfil"
      className="grid grid-cols-2 gap-1 rounded-control bg-line-2 p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          id={`metodo-${option.value}`}
          aria-selected={method === option.value}
          aria-controls={`panel-${option.value}`}
          onClick={() => onChange(option.value)}
          className={cx(
            "min-h-12 rounded-control px-2 text-[0.9375rem] font-bold",
            method === option.value ? "bg-surface text-ink shadow-sm" : "text-muted",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DemoAccounts({
  accounts,
  onPick,
  pending,
}: {
  readonly accounts: readonly WorkerPersona[];
  readonly onPick: (workerId: string) => void;
  readonly pending: boolean;
}) {
  return (
    <details className="group rounded-card border-[1.5px] border-line bg-surface">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-bold text-ink-2">
        ¿Vienes a probar NIVEL? Entra con una cuenta de prueba
        <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-line px-4 pb-2">
        {accounts.length === 0 ? (
          <p className="py-3 text-sm text-muted">Las cuentas de prueba aún no están cargadas.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-2">
            {accounts.map((worker) => (
              <li key={worker.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={worker.name} tone="ink" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{worker.name}</p>
                  <p className="text-sm text-muted">
                    {tradeLabel(worker.trade)} · {worker.zone}
                  </p>
                  <LevelBadge level={worker.level as Level} short />
                </div>
                <Button variant="outline" onClick={() => onPick(worker.id)} disabled={pending}>
                  Entrar<span className="sr-only"> como {worker.name}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

/**
 * Entrada de la app del trabajador: crear el perfil hablando con Nivi o
 * escribiendo. Las cuentas de prueba quedan a un lado, para quien viene a probar.
 */
export function WorkerAccess(props: WorkerAccessProps) {
  const [method, setMethod] = useState<Method>("voz");
  return (
    <main className="flex flex-col gap-6">
      <NivelMark />
      <div>
        <Eyebrow className="text-brand">Para trabajadores de oficio</Eyebrow>
        <h1 className="display mt-1 text-3xl sm:text-4xl">Tu perfil de oficio, listo en dos minutos</h1>
        <p className="mt-2 text-lg text-ink-2">
          Cuéntanos qué sabes hacer y empieza a recibir ofertas de trabajo en regla, con un nivel que se puede
          comprobar.
        </p>
      </div>
      <Card className="flex flex-col gap-5 p-5">
        <MethodTabs method={method} onChange={setMethod} />
        <div role="tabpanel" id={`panel-${method}`} aria-labelledby={`metodo-${method}`}>
          {method === "voz" ? (
            <div className="flex flex-col gap-3">
              <p className="text-ink-2">
                Nivi te hace cinco preguntas: tu nombre, tu oficio, tu experiencia, qué sabes hacer y dónde
                vives. Habla como en una nota de voz.
              </p>
              <NiviRegistration api={props.api} onRegistered={props.onRegistered} />
            </div>
          ) : (
            <WorkerSignupForm onSubmit={props.onRegister} pending={props.pending} error={props.error} />
          )}
        </div>
      </Card>
      {method === "voz" && props.error ? (
        <Notice tone="alert" urgent>
          {props.error}
        </Notice>
      ) : null}
      <DemoAccounts accounts={props.demoAccounts} onPick={props.onPickDemo} pending={props.pending} />
    </main>
  );
}
