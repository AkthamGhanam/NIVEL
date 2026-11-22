// Acceso del trabajador: crear el perfil con Nivi o escribiendo, o entrar con una cuenta registrada o de demostración.
"use client";

import { useState } from "react";

import type { AccessKey } from "@/client/demo-access";
import type { WorkerApi, WorkerPersona, WorkerSignupInput } from "@/client/worker-api";
import { AccessLogin } from "@/components/access/account-key";
import { AccessFrame, type AccessTab } from "@/components/access/access-frame";
import { type Account, AccountList } from "@/components/access/account-list";
import { Notice } from "@/components/ui/notice";
import { cx } from "@/lib/cx";
import { TRADE_LABELS, type Trade } from "@/lib/trades";

import { NiviRegistration } from "./nivi-registration";
import { WorkerSignupForm } from "./worker-signup-form";

const tradeLabel = (trade: string) => TRADE_LABELS[trade as Trade]?.singular ?? trade;

export const workerAccount = (worker: WorkerPersona): Account => ({
  id: worker.id,
  name: worker.name,
  detail: `${tradeLabel(worker.trade)} · ${worker.zone}`,
  badge: `Nivel ${worker.level}`,
  registered: worker.registered,
});

type Method = "voz" | "texto";

interface WorkerAccessProps {
  readonly api: WorkerApi;
  readonly accounts: readonly WorkerPersona[];
  readonly onPick: (workerId: string) => void;
  readonly onRegister: (input: WorkerSignupInput, access: AccessKey) => void;
  readonly onLogin: (key: AccessKey) => Promise<string | null>;
  readonly onRegistered: () => void;
  readonly pending: boolean;
  readonly error: string | null;
  readonly initialTab?: AccessTab;
}

const METHODS: ReadonlyArray<{ readonly value: Method; readonly label: string }> = [
  { value: "voz", label: "Con Nivi" },
  { value: "texto", label: "Prefiero escribir" },
];

function MethodSwitch({
  method,
  onChange,
}: {
  readonly method: Method;
  readonly onChange: (method: Method) => void;
}) {
  return (
    <div role="group" aria-label="Cómo crear tu perfil" className="flex gap-2">
      {METHODS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={method === option.value}
          onClick={() => onChange(option.value)}
          className={cx(
            "min-h-12 rounded-full border-2 px-4 font-bold transition-colors duration-150",
            method === option.value
              ? "border-brand bg-brand-tint text-brand"
              : "border-line text-muted hover:border-ink-2",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function CreateProfile(props: WorkerAccessProps) {
  const [method, setMethod] = useState<Method>("voz");
  return (
    <div className="flex flex-col gap-4">
      <MethodSwitch method={method} onChange={setMethod} />
      {method === "voz" ? (
        <>
          <p className="text-ink-2">
            Nivi te pregunta tu nombre, tus oficios, tu experiencia y dónde quieres trabajar. Puedes hablarle
            o escribirle.
          </p>
          <NiviRegistration api={props.api} onRegistered={props.onRegistered} />
        </>
      ) : (
        <WorkerSignupForm onSubmit={props.onRegister} pending={props.pending} error={props.error} />
      )}
    </div>
  );
}

export function WorkerAccess(props: WorkerAccessProps) {
  const [tab, setTab] = useState<AccessTab>(props.initialTab ?? "crear");
  return (
    <AccessFrame
      kicker="Para trabajadores de oficio"
      title="Tu oficio, con un nivel que se comprueba"
      text="Crea tu perfil en dos minutos y recibe ofertas de trabajo en regla."
      tab={tab}
      onTab={setTab}
      createLabel="Crear mi perfil"
    >
      {tab === "crear" ? (
        <CreateProfile {...props} />
      ) : (
        <div className="flex flex-col gap-4">
          <AccessLogin
            documentLabel="Cédula"
            placeholder="Ej: V-12345678"
            onLogin={props.onLogin}
            pending={props.pending}
          />
          <p className="text-sm font-bold text-muted">O toca tu cuenta</p>
          {props.error ? (
            <Notice tone="alert" urgent>
              {props.error}
            </Notice>
          ) : null}
          <AccountList
            accounts={props.accounts.map(workerAccount)}
            onPick={props.onPick}
            pending={props.pending}
          />
        </div>
      )}
    </AccessFrame>
  );
}
