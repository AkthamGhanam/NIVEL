"use client";

import { useState } from "react";

import type { ResetSummary } from "@/client/team-api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingText, Notice } from "@/components/ui/notice";
import { Switch } from "@/components/ui/switch";

import { useAction } from "../hooks/use-action";
import { useLive } from "../hooks/use-live";
import { useTeam } from "../team/team-gate";
import { createLiveStore } from "@/client/live-store";

interface ConfirmButtonProps {
  readonly label: string;
  readonly warning: string;
  readonly confirmLabel: string;
  readonly danger?: boolean;
  readonly pending: boolean;
  readonly onConfirm: () => void;
}

/** Acción que borra datos: pide confirmar en un segundo paso, en la misma página. */
export function ConfirmButton({
  label,
  warning,
  confirmLabel,
  danger = false,
  pending,
  onConfirm,
}: ConfirmButtonProps) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button variant={danger ? "danger" : "outline"} disabled={pending} onClick={() => setConfirming(true)}>
        {label}
      </Button>
    );
  }
  return (
    <div role="group" aria-label={`Confirmar: ${label}`} className="flex flex-col gap-2">
      <p className="font-semibold text-ink-2">{warning}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          disabled={pending}
          onClick={() => {
            setConfirming(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export const resetNotice = (summary: ResetSummary, all: boolean) =>
  all
    ? `Listo: todo quedó como el seed (${summary.insertedRows} filas). No queda ningún registro real.`
    : `Listo: la demo volvió al seed y se conservaron ${summary.keptRealWorkers} perfiles reales.`;

function ResetCard({ onDone }: { readonly onDone: (message: string) => void }) {
  const { api } = useTeam();
  const reset = useAction(async (all: boolean) => onDone(resetNotice(await api.reset(all), all)));
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-xl font-extrabold">Reiniciar datos</h2>
      <p className="text-ink-2">
        Vuelve a cargar las personas, empresas y academias de ejemplo en /t y /c. Las solicitudes,
        invitaciones, contratos y pagos se borran.
      </p>
      <ConfirmButton
        label="Reiniciar la demo"
        warning="Se borra lo hecho en la demo. Los perfiles y empresas registrados de verdad se conservan."
        confirmLabel="Sí, reiniciar"
        pending={reset.pending}
        onConfirm={() => void reset.invoke(false)}
      />
      <ConfirmButton
        label="Borrar todo y empezar de cero"
        warning="Se borra todo, también los perfiles y empresas registrados de verdad. No se puede deshacer."
        confirmLabel="Sí, borrar todo"
        danger
        pending={reset.pending}
        onConfirm={() => void reset.invoke(true)}
      />
      {reset.error ? (
        <Notice tone="alert" urgent>
          {reset.error}
        </Notice>
      ) : null}
    </Card>
  );
}

function DemoHelpersCard({ onDone }: { readonly onDone: (message: string) => void }) {
  const { api } = useTeam();
  const [store] = useState(() => createLiveStore((signal) => api.state(signal)));
  const state = useLive(store);
  const bot = useAction(async (on: boolean) => {
    await api.setBot(on);
    await store.refresh();
  });
  const forward = useAction(async () => {
    const result = await api.fastForward();
    onDone(`La obra avanzó ${result.daysAdded} días: ya se puede cerrar y pagar.`);
  });
  if (state.loading) return <LoadingText>Revisando la demo…</LoadingText>;
  const on = state.data?.flags.bot ?? false;
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-xl font-extrabold">Ayudas para presentar</h2>
      <div className="flex items-center gap-3">
        <Switch
          checked={on}
          onChange={(next) => void bot.invoke(next)}
          labelledBy="bot-titulo"
          describedBy="bot-ayuda"
          disabled={bot.pending}
        />
        <div>
          <p id="bot-titulo" className="font-extrabold">
            Bot de demo
          </p>
          <p id="bot-ayuda" className="text-sm text-muted">
            {on ? "Rafael, José y Luis responden solos a las ofertas" : "Apagado: nadie responde solo"}
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        disabled={forward.pending}
        onClick={() => void forward.invoke()}
        className="self-start"
      >
        Avanzar la obra activa a su fin
      </Button>
      {bot.error || forward.error ? (
        <Notice tone="alert" urgent>
          {bot.error ?? forward.error}
        </Notice>
      ) : null}
    </Card>
  );
}

/** Lo que antes estaba en el Modo Jurado: reiniciar los datos y las ayudas para presentar /t y /c. */
export function DataScreen() {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="display text-3xl">Datos de la demo</h1>
      {message ? (
        <p
          role="status"
          className="rounded-card border-[1.5px] border-brand bg-brand-tint px-4 py-3 font-semibold"
        >
          {message}
        </p>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-2">
        <ResetCard onDone={setMessage} />
        <DemoHelpersCard onDone={setMessage} />
      </div>
    </div>
  );
}
