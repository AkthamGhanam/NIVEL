import type { WorkerPersona } from "@/client/worker-api";
import { NivelMark } from "@/components/brand/brand";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { LevelBadge } from "@/components/ui/tag";
import { DEMO_FOOTER } from "@/lib/legal-copy";
import type { Level } from "@/lib/level";
import { TRADE_LABELS, type Trade } from "@/lib/trades";

interface WorkerPickerProps {
  readonly workers: readonly WorkerPersona[];
  readonly onPick: (workerId: string) => void;
  readonly pending: boolean;
  readonly error: string | null;
}

const tradeLabel = (trade: string) => TRADE_LABELS[trade as Trade]?.singular ?? trade;

/**
 * Entrada de la demo: se elige un personaje de ejemplo. Las personas reales
 * registradas en el evento nunca aparecen aquí ni se puede entrar como ellas.
 */
export function WorkerPicker({ workers, onPick, pending, error }: WorkerPickerProps) {
  return (
    <main className="flex flex-1 flex-col gap-4 px-4 py-5">
      <NivelMark />
      <div>
        <Eyebrow className="text-brand">Trabajador · app</Eyebrow>
        <h1 className="display mt-1 text-3xl">¿Quién eres hoy?</h1>
        <p className="mt-1 text-ink-2">Esta es una demo: eliges a una persona de ejemplo.</p>
      </div>
      {error ? (
        <Notice tone="alert" urgent>
          {error}
        </Notice>
      ) : null}
      <ul className="flex flex-col divide-y divide-line-2">
        {workers.map((worker) => (
          <li key={worker.id} className="flex items-center gap-3 py-2.5">
            <Avatar name={worker.name} tone="ink" />
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">{worker.name}</h2>
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
      {workers.length === 0 ? <Notice tone="pending">Aún no hay personas de ejemplo cargadas.</Notice> : null}
      <p className="text-center text-xs text-muted">{DEMO_FOOTER}</p>
    </main>
  );
}
