// Tablero del contratista: solicitud activa, avance de la cuadrilla, invitaciones y elección de candidatos.
"use client";

import { useState } from "react";

import type { InviteSelection, RequestBoard } from "@/client/company-api";
import {
  candidateFacts,
  crewProgress,
  invitationStatus,
  requestFacts,
  seatsToFill,
  uninvitedCandidates,
} from "@/client/company-view";
import { Avatar } from "@/components/ui/avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SeatRing } from "@/components/ui/rings";
import { LevelBadge, Tag } from "@/components/ui/tag";
import { cx } from "@/lib/cx";
import { tradeCount } from "@/lib/trades";

type Candidate = RequestBoard["candidates"][number];

const CREATED_VIA = {
  voz: "Pedida por voz",
  web: "Pedida por formulario",
  seed: "Solicitud de ejemplo",
} as const;

export function RequestHeader({ request }: { readonly request: RequestBoard["request"] }) {
  return (
    <header key={request.id} className="animate-enter">
      <Eyebrow>{CREATED_VIA[request.createdVia]}</Eyebrow>
      <h1 className="display mt-1 text-3xl sm:text-4xl">
        {tradeCount(request.trade, request.quantity)} en {request.zone}
      </h1>
      <p className="mt-2 text-lg text-ink-2">{requestFacts(request).slice(1).join(" · ")}</p>
    </header>
  );
}

function CandidateSummary({
  candidate,
  muted = false,
}: {
  readonly candidate: Candidate;
  readonly muted?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar name={candidate.shortName} tone={muted ? "gray" : "ink"} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-lg font-bold">
          {candidate.shortName}
          <LevelBadge level={candidate.level} short />
        </p>
        <p className="text-sm text-muted">{candidateFacts(candidate).join(" · ")}</p>
      </div>
    </div>
  );
}

/** La consola del contratista: un tramo del anillo por puesto; se enciende cuando alguien acepta. */
export function CrewBanner({ board }: { readonly board: RequestBoard }) {
  const progress = crewProgress(board);
  const { quantity } = board.request;
  const filled = Math.min(board.accepted, quantity);
  const open = quantity - filled;
  return (
    <section
      aria-label="Avance de la cuadrilla"
      className="console flex flex-col items-center gap-5 rounded-panel p-5 sm:flex-row sm:p-6"
    >
      <SeatRing filled={filled} total={quantity} label={progress.label} className="w-36 shrink-0">
        <span aria-hidden="true" className="display figures block text-5xl leading-none">
          {filled}
        </span>
        <span aria-hidden="true" className="figures text-sm font-semibold text-muted-on-ink">
          de {quantity}
        </span>
      </SeatRing>
      <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center sm:items-start sm:text-left">
        <p role="status" className={cx("display text-2xl sm:text-3xl", progress.complete && "text-signal")}>
          {progress.label}
        </p>
        {progress.complete ? (
          <ButtonLink href="/c/obra" variant="outline" className="border-transparent">
            Ver la obra
          </ButtonLink>
        ) : (
          <p className="text-muted-on-ink">
            {open === 1 ? "Falta 1 puesto por ocupar." : `Faltan ${open} puestos por ocupar.`} La primera
            persona que acepta ocupa el puesto.
          </p>
        )}
      </div>
    </section>
  );
}

export function InvitationList({ invitations }: { readonly invitations: RequestBoard["invitations"] }) {
  if (invitations.length === 0) return null;
  return (
    <section aria-labelledby="invitaciones-titulo">
      <h2 id="invitaciones-titulo" className="bar-title text-xl font-extrabold">
        Invitaciones
      </h2>
      <Card className="mt-3 p-0">
        <ul className="divide-y divide-line-2">
          {invitations.map((invitation) => {
            const status = invitationStatus(invitation.status);
            return (
              <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                {invitation.candidate ? (
                  <CandidateSummary
                    candidate={invitation.candidate}
                    muted={invitation.status === "rechazada"}
                  />
                ) : (
                  <p className="flex-1 text-muted">Esta persona ya no está disponible.</p>
                )}
                <Tag tone={status.tone}>{status.label}</Tag>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}

interface InviteProps {
  readonly onInvite: (choice: InviteSelection) => void;
  readonly pending: boolean;
}

export const MAX_SELECTION = 10;

export function ReplacementCard({
  candidate,
  onInvite,
  pending,
}: InviteProps & { readonly candidate: Candidate }) {
  return (
    <Card selected className="flex animate-enter flex-col gap-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <Eyebrow className="text-brand">Reemplazo sugerido</Eyebrow>
        <div className="mt-1.5">
          <CandidateSummary candidate={candidate} />
        </div>
      </div>
      <Button
        onClick={() => onInvite({ workerIds: [candidate.workerId] })}
        disabled={pending}
        className="w-full sm:w-auto"
      >
        Invitar<span className="sr-only"> a {candidate.shortName}</span>
      </Button>
    </Card>
  );
}

const bestLabel = (count: number, first: boolean) => {
  if (count === 1) return first ? "Invitar al mejor" : "Invitar al siguiente mejor";
  return first ? `Invitar a los ${count} mejores` : `Invitar a los ${count} siguientes`;
};

const selectedLabel = (count: number) =>
  count === 1 ? "Invitar a 1 persona elegida" : `Invitar a las ${count} personas elegidas`;

const matchingTitle = (count: number, first: boolean) => {
  const more = first ? "" : " más";
  return count === 1 ? `1 persona${more} cumple` : `${count} personas${more} cumplen`;
};

function useSelection(available: readonly Candidate[]) {
  const [chosen, setChosen] = useState<readonly string[]>([]);
  const ids = new Set(available.map((candidate) => candidate.workerId));
  const selected = chosen.filter((id) => ids.has(id));
  const toggle = (workerId: string) =>
    setChosen((current) =>
      current.includes(workerId)
        ? current.filter((id) => id !== workerId)
        : current.length < MAX_SELECTION
          ? [...current, workerId]
          : current,
    );
  return { selected, toggle, clear: () => setChosen([]) };
}

function SelectableCandidate({
  candidate,
  checked,
  disabled,
  onToggle,
}: {
  readonly candidate: Candidate;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <li>
      <label
        className={cx(
          "flex cursor-pointer items-center gap-3 px-4 py-3",
          checked ? "bg-brand-tint" : "hover:bg-line-2/60",
          disabled && !checked && "cursor-not-allowed opacity-60",
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled && !checked}
          onChange={onToggle}
          className="size-5 shrink-0 accent-brand"
        />
        <span className="sr-only">Elegir a {candidate.shortName}</span>
        <CandidateSummary candidate={candidate} />
      </label>
    </li>
  );
}

function SelectableList({
  candidates,
  selection,
  pending,
}: {
  readonly candidates: readonly Candidate[];
  readonly selection: ReturnType<typeof useSelection>;
  readonly pending: boolean;
}) {
  return (
    <>
      <p className="text-ink-2">
        Marca a quien quieras invitar. La primera persona que acepte ocupa el puesto.
      </p>
      <Card className="p-0">
        <ul aria-label="Personas que cumplen" className="divide-y divide-line-2 overflow-hidden rounded-card">
          {candidates.map((candidate) => (
            <SelectableCandidate
              key={candidate.workerId}
              candidate={candidate}
              checked={selection.selected.includes(candidate.workerId)}
              disabled={pending || selection.selected.length >= MAX_SELECTION}
              onToggle={() => selection.toggle(candidate.workerId)}
            />
          ))}
        </ul>
      </Card>
    </>
  );
}

function SelectionBar({
  count,
  onClear,
  onInvite,
  pending,
}: {
  readonly count: number;
  readonly onClear: () => void;
  readonly onInvite: () => void;
  readonly pending: boolean;
}) {
  return (
    <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-card border-[1.5px] border-brand bg-surface p-3 shadow-sm">
      <p role="status" className="font-bold">
        {count} elegida{count === 1 ? "" : "s"}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onClear} disabled={pending}>
          Quitar selección
        </Button>
        <Button onClick={onInvite} disabled={pending}>
          {selectedLabel(count)}
        </Button>
      </div>
    </div>
  );
}

export function CandidateList({ board, onInvite, pending }: InviteProps & { readonly board: RequestBoard }) {
  const candidates = uninvitedCandidates(board);
  const selection = useSelection(candidates);
  const toInvite = Math.min(seatsToFill(board), candidates.length);
  const firstRound = board.invitations.length === 0;

  const showBest =
    toInvite > 0 && !selection.selected.length && (!board.suggestedReplacement || toInvite > 1);
  const inviteSelected = () => {
    onInvite({ workerIds: selection.selected });
    selection.clear();
  };
  return (
    <section aria-labelledby="candidatos-titulo" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="candidatos-titulo" className="bar-title text-xl font-extrabold">
          {matchingTitle(firstRound ? board.matching : candidates.length, firstRound)}
        </h2>
        {showBest ? (
          <Button variant="outline" onClick={() => onInvite({ quantity: toInvite })} disabled={pending}>
            {bestLabel(toInvite, firstRound)}
          </Button>
        ) : null}
      </div>
      {board.matching === 0 ? (
        <Notice tone="pending">
          Nadie cumple todavía con ese nivel cerca de la obra. Prueba con un nivel menor o con otra fecha.
        </Notice>
      ) : null}
      {candidates.length > 0 ? (
        <SelectableList candidates={candidates} selection={selection} pending={pending} />
      ) : null}
      {selection.selected.length > 0 ? (
        <SelectionBar
          count={selection.selected.length}
          onClear={selection.clear}
          onInvite={inviteSelected}
          pending={pending}
        />
      ) : null}
    </section>
  );
}
