"use client";

import { useState } from "react";

import { errorMessage } from "@/client/api";
import type { InviteSelection, RequestBoard, RequestInput } from "@/client/company-api";
import { contractorScript, PLAN_B_TOKEN } from "@/client/plan-b";
import { createScriptedAgent } from "@/client/scripted-agent";
import { createSpeechPlayer } from "@/client/speech-player";
import { Card, Eyebrow } from "@/components/ui/card";
import { LoadingText, Notice } from "@/components/ui/notice";
import { NiviVoice } from "@/components/voice/nivi-voice";

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

/** Centro de `/c`: la solicitud activa, quién aceptó y a quién más se puede invitar. */
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

/**
 * Plan B: Nivi sigue el guion del camino dorado sin conectarse al agente en
 * vivo. Cada turno ejecuta la misma acción real, así que el tablero y la
 * bitácora cambian igual; la pantalla es la misma.
 */
function ScriptedNivi() {
  const { company, api, board } = useCompany();
  const [connection] = useState(() => {
    const player = createSpeechPlayer({ audioUrlFor: api.speak });
    const script = () => contractorScript({ api, zone: company.zone, refresh: board.refresh });
    return {
      fetchToken: async () => PLAN_B_TOKEN,
      connect: createScriptedAgent({ script, speak: player.speak, stopSpeaking: player.stop }),
    };
  });
  return <NiviVoice agent="contractor" defaultMode="llamada" connection={connection} />;
}

/**
 * Pedir la cuadrilla hablando con Nivi. Lo que el agente crea o invita aparece
 * en el tablero de al lado, que se actualiza solo; el formulario sigue debajo.
 */
export function VoiceRequestCard({ planB = false }: { readonly planB?: boolean }) {
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="display text-2xl">Pídela hablando</h2>
        <p className="text-[0.9375rem] text-ink-2">
          Dile a Nivi qué oficio necesitas, cuántas personas, desde cuándo y cuánto pagas al día.
        </p>
      </div>
      {planB ? <ScriptedNivi /> : <NiviVoice agent="contractor" defaultMode="llamada" />}
    </Card>
  );
}

/** Pantalla principal del contratista: pedir personal, tablero en vivo y costos. */
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
  const board = live.data ?? null;

  // En una sola columna (teléfono o ventana angosta) el tablero va justo después de la voz:
  // lo que Nivi crea se ve sin bajar. En pantallas anchas, voz y formulario comparten la primera columna.
  return (
    <div className="grid gap-6 xl:grid-cols-[19rem_minmax(0,1fr)_19rem] xl:grid-rows-[auto_1fr]">
      <div className="xl:col-start-1 xl:row-start-1">
        <VoiceRequestCard planB={planB} />
      </div>
      <div className="flex min-w-0 flex-col gap-4 xl:col-start-2 xl:row-span-2 xl:row-start-1">
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
      <section aria-labelledby="pedir-titulo" className="xl:col-start-1 xl:row-start-2">
        <Card className="flex flex-col gap-4">
          <h2 id="pedir-titulo" className="display text-2xl">
            Pide tu cuadrilla
          </h2>
          <RequestForm zone={company.zone} onSubmit={publish} />
        </Card>
      </section>
      <div className="xl:col-start-3 xl:row-span-2 xl:row-start-1">
        <CostPanel board={board} />
      </div>
    </div>
  );
}
