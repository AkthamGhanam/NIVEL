"use client";

import { errorMessage } from "@/client/api";
import type { InviteSelection, RequestBoard, RequestInput } from "@/client/company-api";
import { Card, Eyebrow } from "@/components/ui/card";
import { LoadingText, Notice } from "@/components/ui/notice";

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

/** Centro de `/contratista`: la solicitud activa, quién aceptó y a quién más se puede invitar. */
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

/** Pantalla principal del contratista: pedir personal, tablero en vivo y costos. */
export function RequestScreen() {
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

  return (
    <div className="grid gap-6 xl:grid-cols-[19rem_minmax(0,1fr)_19rem]">
      <section aria-labelledby="pedir-titulo">
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
