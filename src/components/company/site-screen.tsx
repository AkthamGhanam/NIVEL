"use client";

import type { RequestBoard } from "@/client/company-api";
import {
  attendanceLine,
  contractStatus,
  type CrewMember,
  requestFacts,
  siteLog,
} from "@/client/company-view";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Progress } from "@/components/ui/progress";
import { LevelBadge, Tag } from "@/components/ui/tag";
import { formatDay } from "@/lib/format";
import { REPLACEMENT_WARNING, SEARCH_GUARANTEE_NOTICE } from "@/lib/legal-copy";

import { BoardGate } from "./board-gate";

function AttendanceCard({ member }: { readonly member: CrewMember }) {
  const status = contractStatus(member.status);
  const last = member.lastAttendance;
  const progress = `Día ${member.daysAttended} de ${member.days}`;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={member.shortName} tone="ink" />
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold">
            {member.shortName}
            <LevelBadge level={member.level} short />
          </h3>
          <Tag tone={status.tone} className="mt-1">
            {status.label}
          </Tag>
        </div>
      </div>
      {last ? (
        <p className="text-lg font-semibold">
          <span className="text-muted">{formatDay(last.date)} · </span>
          {attendanceLine(last)}
        </p>
      ) : (
        <p className="text-muted">Aún no ha marcado su entrada.</p>
      )}
      {last && !last.insideGeofence ? (
        <Tag tone="alert" className="self-start">
          Marcó fuera del área de la obra
        </Tag>
      ) : null}
      {last?.note ? <p className="text-ink-2">Motivo: {last.note}</p> : null}
      <div>
        <p className="mb-1 text-sm font-semibold text-ink-2">{progress}</p>
        <Progress value={member.daysAttended / member.days} label={`${member.shortName}: ${progress}`} />
      </div>
    </Card>
  );
}

function SiteLog({ crew }: { readonly crew: readonly CrewMember[] }) {
  const entries = siteLog(crew);
  return (
    <section aria-labelledby="bitacora-titulo">
      <h2 id="bitacora-titulo" className="bar-title text-xl font-extrabold">
        Bitácora
      </h2>
      {entries.length === 0 ? (
        <p className="mt-3 text-muted">Todavía no hay jornadas registradas.</p>
      ) : (
        <Card className="mt-3 p-0">
          <ol className="divide-y divide-line-2">
            {entries.map((entry) => (
              <li key={entry.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5">
                <span className="w-24 shrink-0 text-sm font-semibold text-muted">
                  {formatDay(entry.date)}
                </span>
                <span className="font-bold">{entry.shortName}</span>
                <span className="text-ink-2">{entry.line}</span>
                {entry.insideGeofence ? null : <Tag tone="alert">Fuera del área</Tag>}
                {entry.note ? (
                  <span className="basis-full text-sm text-ink-2">Motivo: {entry.note}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </Card>
      )}
    </section>
  );
}

/** Obra en curso: quién llegó, a qué hora real y cuántos días lleva cada persona. */
export function SiteView({ board }: { readonly board: RequestBoard }) {
  const [, ...facts] = requestFacts(board.request);
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <Eyebrow>Obra en curso</Eyebrow>
        <h1 className="display mt-1 text-3xl sm:text-4xl">Obra en {board.request.zone}</h1>
        <p className="mt-2 text-lg text-ink-2">{facts.join(" · ")}</p>
      </header>
      {board.crew.length === 0 ? (
        <Card className="flex flex-col items-start gap-3 p-6">
          <p className="text-lg text-ink-2">
            Aún no hay nadie contratado. Cuando una persona acepte tu invitación, verás aquí su firma y su
            asistencia.
          </p>
          <ButtonLink href="/c">Ver la solicitud</ButtonLink>
        </Card>
      ) : (
        <>
          <section aria-labelledby="asistencia-titulo">
            <h2 id="asistencia-titulo" className="bar-title text-xl font-extrabold">
              Asistencia
            </h2>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {board.crew.map((member) => (
                <li key={member.contractId}>
                  <AttendanceCard member={member} />
                </li>
              ))}
            </ul>
          </section>
          <SiteLog crew={board.crew} />
        </>
      )}
      <Notice tone="pending" title="Si necesitas reemplazar a alguien">
        <p>{REPLACEMENT_WARNING}</p>
        <p className="mt-1">{SEARCH_GUARANTEE_NOTICE}</p>
      </Notice>
    </div>
  );
}

export function SiteScreen() {
  return <BoardGate>{(board) => <SiteView board={board} />}</BoardGate>;
}
