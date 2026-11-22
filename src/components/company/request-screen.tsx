// Pantalla principal del contratista: pedir cuadrilla (formulario o Nivi), tablero y costos.
"use client";

import { type ReactNode, useCallback, useState } from "react";

import { errorMessage } from "@/client/api";
import type { InviteSelection, RequestBoard, RequestInput } from "@/client/company-api";
import { contractorScript } from "@/client/plan-b";
import { createScriptedNivi } from "@/client/scripted-nivi";
import { createSpeechPlayer } from "@/client/speech-player";
import { Card } from "@/components/ui/card";
import { CrewIcon } from "@/components/ui/icons";
import { Disclosure } from "@/components/ui/disclosure";
import { LoadingText, NotEmployerNotice, Notice } from "@/components/ui/notice";
import { SeatRing } from "@/components/ui/rings";
import { TelegramCard } from "@/components/telegram/telegram-card";
import { NiviCard, NiviCardFrame } from "@/components/voice/nivi-card";
import { NiviPanel } from "@/components/voice/nivi-panel";
import { useScriptedNivi } from "@/components/voice/use-scripted-nivi";

import { useAction } from "../hooks/use-action";
import { useLive } from "../hooks/use-live";
import { CandidateList, CrewBanner, InvitationList, ReplacementCard, RequestHeader } from "./board";
import { useCompany } from "./company-gate";
import { CostPanel } from "./cost-panel";
import { RequestForm } from "./request-form";

interface BoardViewProps {
  readonly board: RequestBoard;
  readonly onInvite: (choice: InviteSelection) => void;
  readonly pending: boolean;
  readonly error: string | null;
}

export function BoardView({ board, onInvite, pending, error }: BoardViewProps) {
  const open = board.request.status === "abierta";
  return (
    <div className="flex flex-col gap-5">
      <RequestHeader request={board.request} />
      <CrewBanner board={board} />
      {error ? (
        <Notice tone="alert" urgent>
          {error}
        </Notice>
      ) : null}
      {open && board.suggestedReplacement ? (
        <ReplacementCard candidate={board.suggestedReplacement} onInvite={onInvite} pending={pending} />
      ) : null}
      <InvitationList invitations={board.invitations} />
      {open ? <CandidateList board={board} onInvite={onInvite} pending={pending} /> : null}
    </div>
  );
}

export function EmptyBoard() {
  return (
    <section className="console flex flex-col items-center gap-6 rounded-panel p-6 text-center sm:flex-row sm:p-8 sm:text-left">
      <SeatRing filled={0} total={4} className="w-36 shrink-0 opacity-90">
        <CrewIcon size={36} />
      </SeatRing>
      <div className="flex flex-col gap-2">
        <p className="eyebrow text-signal">Sin solicitudes activas</p>
        <h1 className="display text-3xl sm:text-4xl">Arma tu cuadrilla en minutos</h1>
        <p className="text-lg text-muted-on-ink">
          Di qué oficio necesitas, cuántas personas, desde cuándo y cuánto pagas al día. Verás quién cumple,
          cuánto cuesta contratar en regla y quién aceptó.
        </p>
      </div>
    </section>
  );
}

const NIVI_CARD = { title: "Pídela con Nivi", hint: "Dile qué personal necesitas" } as const;

function ScriptedTalk() {
  const { company, api, board } = useCompany();
  const nivi = useScriptedNivi(() => {
    const player = createSpeechPlayer({ audioUrlFor: api.speak });
    return createScriptedNivi({
      script: () => contractorScript({ api, zone: company.zone, refresh: board.refresh }),
      speak: player.speak,
      stopSpeaking: player.stop,
    });
  });
  return <NiviPanel nivi={nivi} />;
}

/** Con una solicitud activa, lo único en primer plano es la cuadrilla; costos y otro pedido quedan plegados. */
function ActiveRequest({ again, ...view }: BoardViewProps & { readonly again: ReactNode }) {
  return (
    <>
      <BoardView {...view} />
      <Disclosure title="Ver costos y comprobantes">
        <CostPanel board={view.board} />
      </Disclosure>
      <Disclosure title="Hacer otro pedido">{again}</Disclosure>
    </>
  );
}

export function RequestScreen({ planB = false }: { readonly planB?: boolean }) {
  const { company, api, board: store } = useCompany();
  const live = useLive(store);
  const invite = useAction(async (requestId: string, choice: InviteSelection) => {
    await api.invite(requestId, choice);
    await store.refresh();
  });
  const publish = async (input: RequestInput) => {
    await api.createRequest(input);
    await store.refresh();
  };
  const refreshBoard = useCallback(() => void store.refresh(), [store]);
  const board = live.data ?? null;

  const form = <RequestForm key="formulario" zone={company.zone} onSubmit={publish} />;
  const [talking, setTalking] = useState(false);
  const niviCard = { ...NIVI_CARD, onOpenChange: setTalking };
  const nivi = planB ? (
    <NiviCardFrame key="nivi" {...niviCard}>
      <ScriptedTalk />
    </NiviCardFrame>
  ) : (
    <NiviCard key="nivi" {...niviCard} openSession={api.voice} onActivity={refreshBoard} />
  );
  // Una conversación abierta se queda en su sitio aunque aparezca el tablero: si la tarjeta cambiara de
  // lugar se desmontaría y Nivi se cortaría justo al crear la solicitud. En plan B siempre va arriba.
  const niviOnTop = !board || talking || planB;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      {live.error !== undefined && !live.loading ? (
        <Notice tone="pending">{errorMessage(live.error)}</Notice>
      ) : null}
      {live.loading ? <LoadingText>Nivi está revisando tus solicitudes…</LoadingText> : null}
      {!live.loading && !board ? (
        <h1 id="pedir-titulo" className="display text-3xl sm:text-4xl">
          Pide tu cuadrilla
        </h1>
      ) : null}
      {!live.loading && niviOnTop ? nivi : null}
      {!live.loading && board ? (
        <ActiveRequest
          board={board}
          onInvite={(choice) => void invite.invoke(board.request.id, choice)}
          pending={invite.pending}
          error={invite.error}
          again={niviOnTop ? [form] : [nivi, form]}
        />
      ) : null}
      {!live.loading && !board ? <Card>{form}</Card> : null}
      <Disclosure title="Más opciones">
        <TelegramCard role="company" />
        <NotEmployerNotice />
      </Disclosure>
    </div>
  );
}
