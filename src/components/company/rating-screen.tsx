"use client";

import type { RatingInput, RequestBoard } from "@/client/company-api";
import { canRate, type CrewMember } from "@/client/company-view";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { LevelBadge, Tag } from "@/components/ui/tag";

import { BoardGate } from "./board-gate";
import { useCompany } from "./company-gate";
import { RatingForm } from "./rating-form";

type SubmitRating = (input: RatingInput) => Promise<void>;

function RatingCard({ member, onSubmit }: { readonly member: CrewMember; readonly onSubmit: SubmitRating }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={member.shortName} tone="ink" />
        <h2 className="flex flex-1 flex-wrap items-center gap-2 text-lg font-bold">
          {member.shortName}
          <LevelBadge level={member.level} short />
        </h2>
      </div>
      {member.ratedByCompany ? (
        <Tag tone="ok" className="self-start">
          Ya enviaste tu calificación
        </Tag>
      ) : null}
      {canRate(member) ? <RatingForm member={member} onSubmit={onSubmit} /> : null}
      {!member.ratedByCompany && !canRate(member) ? (
        <p className="text-ink-2">
          Podrás calificar cuando registres el pago y {member.shortName} confirme que lo recibió.
        </p>
      ) : null}
    </Card>
  );
}

interface RatingViewProps {
  readonly board: RequestBoard;
  readonly onSubmit: SubmitRating;
}

/** Calificación privada y doble ciega de cada persona de la cuadrilla. */
export function RatingView({ board, onSubmit }: RatingViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header>
        <h1 className="display text-3xl sm:text-4xl">Califica a tu cuadrilla</h1>
        <p className="mt-2 text-lg text-ink-2">
          Tu calificación es privada: solo la ve la persona, y solo cuando ella también te califique. Nunca se
          muestra a otras empresas.
        </p>
      </header>
      {board.crew.length === 0 ? (
        <Notice tone="pending">Aún no hay nadie contratado en esta solicitud.</Notice>
      ) : (
        <ul className="flex flex-col gap-4">
          {board.crew.map((member) => (
            <li key={member.contractId}>
              <RatingCard member={member} onSubmit={onSubmit} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RatingScreen() {
  const { api, board: store } = useCompany();
  const submit = async (input: RatingInput) => {
    await api.rate(input);
    await store.refresh();
  };
  return <BoardGate>{(board) => <RatingView board={board} onSubmit={submit} />}</BoardGate>;
}
