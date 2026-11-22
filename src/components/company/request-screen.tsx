// Pantalla principal del contratista: pedir cuadrilla (formulario o Nivi), tablero y costos.
"use client";

import { useCallback } from "react";

import { errorMessage } from "@/client/api";
import type { InviteSelection, RequestBoard, RequestInput } from "@/client/company-api";
import { contractorScript } from "@/client/plan-b";
import { createScriptedNivi } from "@/client/scripted-nivi";
import { createSpeechPlayer } from "@/client/speech-player";
import { Card, Eyebrow } from "@/components/ui/card";
import { LoadingText, Notice } from "@/components/ui/notice";
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
    <Card className="flex flex-col gap-2 p-6">
      <Eyebrow className="text-brand">Sin solicitudes activas</Eyebrow>
      <h1 className="display text-3xl">Arma tu cuadrilla en minutos</h1>
      <p className="text-lg text-ink-2">
        Di qué oficio necesitas, cuántas personas, desde cuándo y cuánto pagas al día. Verás quién cumple,
        cuánto cuesta contratar en regla y quién aceptó.
      </p>
    </Card>
  );
}

const NIVI_CARD = {
  title: "Pídela con Nivi",
  hint: "Dile qué personal necesitas, hablando o escribiendo",
} as const;

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

  return (
    <div className="grid gap-6 xl:grid-cols-[19rem_minmax(0,1fr)_19rem]">
      <section aria-labelledby="pedir-titulo" className="flex min-w-0 flex-col gap-4">
        <div>
          {planB ? (
            <NiviCardFrame {...NIVI_CARD}>
              <ScriptedTalk />
            </NiviCardFrame>
          ) : (
            <NiviCard {...NIVI_CARD} openSession={api.voice} onActivity={refreshBoard} />
          )}
        </div>
        <Card className="flex flex-col gap-4">
          <h2 id="pedir-titulo" className="display text-2xl">
            Pide tu cuadrilla
          </h2>
          <RequestForm zone={company.zone} onSubmit={publish} />
        </Card>
      </section>
      <div className="flex min-w-0 flex-col gap-4">
        {live.error !== undefined && !live.loading ? (
          <Notice tone="pending">{errorMessage(live.error)}</Notice>
        ) : null}
        {live.loading ? <LoadingText>Nivi está revisando tus solicitudes…</LoadingText> : null}
        {!live.loading && board ? (
          <BoardView
            board={board}
            onInvite={(choice) => void invite.invoke(board.request.id, choice)}
            pending={invite.pending}
            error={invite.error}
          />
        ) : null}
        {!live.loading && !board && live.error === undefined ? <EmptyBoard /> : null}
      </div>
      <CostPanel board={board} />
    </div>
  );
}
