"use client";

import { currentPosition } from "@/client/geolocation";
import type { AttendanceInput, ContractDetail } from "@/client/worker-api";
import { currentJob, jobStep, type JobStep, stepAction } from "@/client/worker-view";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { LoadingText, Notice } from "@/components/ui/notice";
import { formatDay, formatTime } from "@/lib/format";

import { useAction } from "../hooks/use-action";
import { useLive } from "../hooks/use-live";
import { ContractGate } from "./contract-gate";
import { HelpLink, NextStep } from "./home-screen";
import { useWorker } from "./worker-gate";

type Mark = (simulated: boolean) => void;

interface MarkControlsProps {
  readonly step: Extract<JobStep, "marcar_entrada" | "marcar_salida">;
  readonly onMark: Mark;
  readonly pending: boolean;
  readonly error: string | null;
  readonly canSimulate: boolean;
}

/** "Llegué a la obra" y "Marcar mi salida": la ubicación se pide solo al tocar el botón. */
export function MarkControls({ step, onMark, pending, error, canSimulate }: MarkControlsProps) {
  const arriving = step === "marcar_entrada";
  return (
    <div className="flex flex-col gap-2">
      <Button block disabled={pending} onClick={() => onMark(false)}>
        {pending ? "Confirmando dónde estás…" : arriving ? "Llegué a la obra" : "Marcar mi salida"}
      </Button>
      <p className="text-sm text-muted">
        Usamos tu ubicación solo en este momento, para confirmar que estás en la obra. No te seguimos.
      </p>
      {error ? (
        <Notice tone="alert" urgent>
          {error}
        </Notice>
      ) : null}
      {canSimulate ? (
        <Button block variant="outline" disabled={pending} onClick={() => onMark(true)}>
          Simular que estoy en la obra (demo)
        </Button>
      ) : null}
    </div>
  );
}

export function AttendanceList({ days }: { readonly days: ContractDetail["attendance"] }) {
  if (days.length === 0) return null;
  return (
    <section aria-labelledby="jornadas-titulo">
      <h2 id="jornadas-titulo" className="bar-title text-xl font-extrabold">
        Tus jornadas
      </h2>
      <ol className="mt-2 flex flex-col divide-y divide-line-2">
        {days.map((day) => (
          <li key={day.date} className="flex items-baseline justify-between gap-3 py-2">
            <span className="font-semibold">{formatDay(day.date)}</span>
            <span className="text-right text-ink-2">
              {day.checkInAt ? `Entrada ${formatTime(day.checkInAt)}` : "Sin entrada"}
              {day.checkOutAt ? ` · Salida ${formatTime(day.checkOutAt)}` : ""}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

interface SiteViewProps extends Omit<MarkControlsProps, "step"> {
  readonly contract: ContractDetail;
}

/** La obra de la persona: marcar entrada y salida, y ver sus jornadas. */
export function SiteView({ contract, ...controls }: SiteViewProps) {
  const step = jobStep(contract);
  const done = Math.min(contract.attendance.length, contract.days);
  return (
    <>
      <Card className="flex flex-col gap-1">
        <Eyebrow>{contract.companyName}</Eyebrow>
        <p className="text-lg font-extrabold">
          Día {done} de {contract.days}
        </p>
      </Card>
      {step === "marcar_entrada" || step === "marcar_salida" ? (
        <MarkControls step={step} {...controls} />
      ) : (
        <NextStep action={stepAction(step, contract.id)} />
      )}
      <AttendanceList days={contract.attendance} />
      <HelpLink href="/t/ayuda?tipo=inseguridad">Reportar un problema en la obra</HelpLink>
    </>
  );
}

interface SiteControlsProps {
  readonly contract: ContractDetail;
  readonly refresh: () => Promise<void>;
}

/** Conecta los botones con el servidor: pide la ubicación, marca y vuelve a leer el contrato. */
function SiteControls({ contract, refresh }: SiteControlsProps) {
  const { api, canSimulateSite } = useWorker();
  const leaving = jobStep(contract) === "marcar_salida";
  const action = useAction(async (simulated: boolean) => {
    const input: AttendanceInput = simulated
      ? { contractId: contract.id, simulated: true }
      : { contractId: contract.id, position: await currentPosition() };
    await (leaving ? api.checkOut(input) : api.checkIn(input));
    await refresh();
  });
  return (
    <SiteView
      contract={contract}
      onMark={(simulated) => void action.invoke(simulated)}
      pending={action.pending}
      error={action.error}
      canSimulate={canSimulateSite}
    />
  );
}

export function SiteScreen() {
  const { offers: store } = useWorker();
  const live = useLive(store);
  const job = currentJob(live.data ?? []);
  return (
    <>
      <h1 className="display text-3xl">Tu obra</h1>
      {live.loading ? <LoadingText>Nivi está buscando tu trabajo…</LoadingText> : null}
      {!live.loading && !job ? (
        <>
          <Notice tone="pending">
            Aún no tienes un trabajo activo. Cuando aceptes una oferta, aquí marcarás tu entrada.
          </Notice>
          <ButtonLink href="/t" variant="outline" block>
            Ver mis ofertas
          </ButtonLink>
        </>
      ) : null}
      {job ? (
        <ContractGate key={job.contractId} contractId={job.contractId}>
          {(contract, refresh) => <SiteControls contract={contract} refresh={refresh} />}
        </ContractGate>
      ) : null}
    </>
  );
}
