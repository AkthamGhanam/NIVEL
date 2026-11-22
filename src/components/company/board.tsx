import type { RequestBoard } from "@/client/company-api";
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
import { Progress } from "@/components/ui/progress";
import { LevelBadge, Tag } from "@/components/ui/tag";
import { tradeCount } from "@/lib/trades";

type Candidate = RequestBoard["candidates"][number];

const CREATED_VIA = {
  voz: "Pedida por voz",
  web: "Pedida por formulario",
  seed: "Solicitud de ejemplo",
} as const;

/** Encabezado de la solicitud activa. Entra con una animación corta cuando llega una nueva. */
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

/** Lo único que se ve de una persona: nombre corto, nivel y hechos verificables. Sin foto ni estrellas. */
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

/** Avance de la cuadrilla. Se anuncia a los lectores de pantalla cada vez que cambia. */
export function CrewBanner({ board }: { readonly board: RequestBoard }) {
  const progress = crewProgress(board);
  if (progress.complete) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border-[1.5px] border-brand bg-brand-tint px-5 py-4">
        <p role="status" className="display text-2xl text-brand">
          {progress.label}
        </p>
        <ButtonLink href="/c/obra" variant="ink">
          Ver la obra
        </ButtonLink>
      </div>
    );
  }
  return (
    <Card className="flex flex-col gap-2">
      <p role="status" className="text-lg font-extrabold">
        {progress.label}
      </p>
      <Progress value={board.accepted / board.request.quantity} label={progress.label} />
    </Card>
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
  /** Invita a las siguientes N mejores personas que aún no fueron invitadas. */
  readonly onInvite: (quantity: number) => void;
  readonly pending: boolean;
}

/** Alguien rechazó y falta gente: el siguiente mejor candidato, a un clic. */
export function ReplacementCard({
  candidate,
  onInvite,
  pending,
}: InviteProps & { readonly candidate: Candidate }) {
  return (
    <Card selected className="flex animate-enter flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <Eyebrow className="text-brand">Reemplazo sugerido</Eyebrow>
        <div className="mt-1.5">
          <CandidateSummary candidate={candidate} />
        </div>
      </div>
      <Button onClick={() => onInvite(1)} disabled={pending}>
        Invitar<span className="sr-only"> a {candidate.shortName}</span>
      </Button>
    </Card>
  );
}

const inviteLabel = (count: number, first: boolean) => {
  if (count === 1) return first ? "Invitar al mejor" : "Invitar a 1 más";
  return first ? `Invitar a los ${count} mejores` : `Invitar a ${count} más`;
};

/** "6 personas cumplen" antes de invitar; después, "3 personas más cumplen". */
const matchingTitle = (count: number, first: boolean) => {
  const more = first ? "" : " más";
  return count === 1 ? `1 persona${more} cumple` : `${count} personas${more} cumplen`;
};

/** Personas que cumplen y aún no fueron invitadas, las mejores primero. */
export function CandidateList({ board, onInvite, pending }: InviteProps & { readonly board: RequestBoard }) {
  const candidates = uninvitedCandidates(board);
  const toInvite = Math.min(seatsToFill(board), candidates.length);
  const firstRound = board.invitations.length === 0;
  // Con un solo puesto por cubrir tras un rechazo, la tarjeta de reemplazo ya ofrece invitar.
  const showInvite = toInvite > 0 && (board.suggestedReplacement === null || toInvite > 1);
  return (
    <section aria-labelledby="candidatos-titulo" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="candidatos-titulo" className="bar-title text-xl font-extrabold">
          {matchingTitle(firstRound ? board.matching : candidates.length, firstRound)}
        </h2>
        {showInvite ? (
          <Button onClick={() => onInvite(toInvite)} disabled={pending}>
            {inviteLabel(toInvite, firstRound)}
          </Button>
        ) : null}
      </div>
      {board.matching === 0 ? (
        <Notice tone="pending">
          Nadie cumple todavía con ese nivel cerca de la obra. Prueba con un nivel menor o con otra fecha.
        </Notice>
      ) : null}
      {candidates.length > 0 ? (
        <Card className="p-0">
          <ul className="divide-y divide-line-2">
            {candidates.map((candidate) => (
              <li key={candidate.workerId} className="flex px-4 py-3">
                <CandidateSummary candidate={candidate} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}
