"use client";

import { useState } from "react";

import { crewTimer, crewTimerLabel, eventLines } from "@/client/demo-view";
import { createEventFeed } from "@/client/event-feed";
import { createLiveStore } from "@/client/live-store";
import type { EventRow, TeamApi } from "@/client/team-api";
import { NivelMark } from "@/components/brand/brand";
import { plural } from "@/lib/format";
import { DEMO_FOOTER } from "@/lib/legal-copy";

import { useAction } from "../hooks/use-action";
import { useLive } from "../hooks/use-live";
import { useNow } from "../hooks/use-now";
import { useTeam } from "../team/team-gate";
import { DemoControls, JoinCode, RealProfiles } from "./demo-controls";
import { DemoStage } from "./demo-stage";
import { EventLog } from "./event-log";

/** Cada cuánto se pide lo nuevo de la bitácora: el jurado ve cada paso casi al instante. */
export const EVENTS_POLL_MS = 1500;
const PROFILES_POLL_MS = 10_000;

function createDemoStores(api: TeamApi) {
  const feed = createEventFeed<EventRow>((since, signal) => api.events(since, signal));
  return {
    feed,
    events: createLiveStore((signal) => feed.load(signal), { intervalMs: EVENTS_POLL_MS }),
    profiles: createLiveStore((signal) => api.realProfiles(signal), { intervalMs: PROFILES_POLL_MS }),
  };
}

/** Lo que hace cada control: llama al servidor y devuelve, en palabras, lo que pasó. */
function demoWork(api: TeamApi, onReset: () => void) {
  return {
    reset: async () => {
      await api.reset();
      onReset();
      return "Demo reiniciada.";
    },
    fastForward: async () => {
      const { daysAdded } = await api.fastForward();
      return `Se completaron ${plural(daysAdded, "día", "días")} de asistencia.`;
    },
    setBot: async (on: boolean) => {
      await api.setBot(on);
      return on ? "Bot de demo encendido." : "Bot de demo apagado.";
    },
  };
}

/** Contador de la cuadrilla. Vive aparte para que el segundero no repinte los dos marcos. */
function CrewClock({ events }: { readonly events: readonly EventRow[] }) {
  const now = useNow();
  return (
    <p role="timer" aria-live="off" className="display text-2xl text-brand-on-ink tabular-nums">
      {crewTimerLabel(crewTimer(events), now)}
    </p>
  );
}

interface DemoScreenProps {
  /** Enlace público a la app del trabajador, para el QR. Nulo si la demo corre sin dirección pública. */
  readonly joinUrl: string | null;
}

/** Modo Jurado: las dos vistas lado a lado, la bitácora en vivo y los controles del presentador. */
export function DemoScreen({ joinUrl }: DemoScreenProps) {
  const { api, state } = useTeam();
  const [stores] = useState(() => createDemoStores(api));
  // Al reiniciar se vuelven a cargar los dos marcos: muestran los datos recién sembrados.
  const [round, setRound] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const flags = useLive(state).data?.flags;
  const events = useLive(stores.events).data ?? [];
  const profiles = useLive(stores.profiles).data;

  const refreshAll = () => Promise.all([state.refresh(), stores.events.refresh(), stores.profiles.refresh()]);
  const action = useAction(async (work: () => Promise<string>) => {
    setNotice(null);
    const done = await work();
    await refreshAll();
    setNotice(done);
  });
  const work = demoWork(api, () => {
    stores.feed.clear();
    setRound((current) => current + 1);
  });

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-canvas xl:h-dvh xl:flex-none xl:overflow-hidden">
      <header className="on-dark flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-ink px-4 py-3 lg:px-6">
        <div className="flex items-center gap-4">
          <NivelMark tone="white" size={28} />
          <h1 className="display text-2xl text-white">Modo Jurado</h1>
        </div>
        <CrewClock events={events} />
      </header>
      <main className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 lg:px-6">
        <DemoControls
          bot={flags?.bot ?? false}
          onBot={(on) => void action.invoke(() => work.setBot(on))}
          onFastForward={() => void action.invoke(work.fastForward)}
          onReset={() => void action.invoke(work.reset)}
          pending={action.pending}
          notice={notice}
          error={action.error}
        />
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:flex-wrap xl:flex-nowrap">
          <DemoStage key={round} />
          <aside
            aria-label="Bitácora y público"
            className="flex max-h-[32rem] flex-col gap-4 rounded-card border-[1.5px] border-line bg-surface p-4 lg:w-full xl:max-h-none xl:min-h-0 xl:w-64 xl:shrink-0 2xl:w-80"
          >
            <EventLog lines={eventLines(events)} />
            <div className="flex flex-wrap gap-x-8 gap-y-4 border-t border-line-2 pt-3">
              <RealProfiles data={profiles} />
              <JoinCode joinUrl={joinUrl} />
            </div>
          </aside>
        </div>
      </main>
      <footer className="px-4 pb-4 text-center text-xs text-muted">{DEMO_FOOTER}</footer>
    </div>
  );
}
