"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import { apiRequest } from "@/client/api";
import {
  browserPreflightDeps,
  type CheckState,
  type CheckStatus,
  createPreflight,
  preflightChecks,
  preflightSummary,
} from "@/client/preflight";
import { Button } from "@/components/ui/button";
import { Tag, type Tone } from "@/components/ui/tag";

const STATUS: Readonly<Record<CheckStatus, { readonly tone: Tone; readonly word: string }>> = {
  pending: { tone: "neutral", word: "Sin probar" },
  running: { tone: "pending", word: "Probando…" },
  ok: { tone: "ok", word: "Listo" },
  fail: { tone: "alert", word: "Falla" },
};

interface CheckRowProps {
  readonly check: CheckState;
  readonly onRun: () => void;
}

/** Una prueba: qué se comprueba, cómo salió (con palabra, no solo color) y el botón para repetirla. */
export function CheckRow({ check, onRun }: CheckRowProps) {
  const { tone, word } = STATUS[check.status];
  const untried = check.status === "pending";
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-2 py-3 last:border-b-0">
      <div className="min-w-0 flex-1 basis-64">
        <p className="flex flex-wrap items-center gap-2 text-lg font-extrabold">
          {check.label}
          <Tag tone={tone}>{word}</Tag>
        </p>
        <p className="text-[0.9375rem] text-ink-2">
          {check.detail ?? (check.manual ? "El navegador pide un toque para probarla." : "En espera.")}
        </p>
      </div>
      <Button
        variant={check.manual && untried ? "primary" : "outline"}
        disabled={check.status === "running"}
        onClick={onRun}
      >
        {untried ? "Probar" : "Probar de nuevo"}
        <span className="sr-only">: {check.label}</span>
      </Button>
    </li>
  );
}

interface PreflightViewProps {
  readonly checks: readonly CheckState[];
  readonly onRun: (id: string) => void;
  readonly onRunAll: () => void;
}

export function PreflightView({ checks, onRun, onRunAll }: PreflightViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="display text-3xl">Chequeo previo</h1>
        <p className="mt-1 text-lg text-ink-2">
          Corre esta lista en la laptop del escenario, con su micrófono y sus cornetas, antes de presentar.
        </p>
      </div>
      <p role="status" className="text-lg font-extrabold">
        {preflightSummary(checks)}
      </p>
      <ul className="rounded-card border-[1.5px] border-line bg-surface px-4">
        {checks.map((check) => (
          <CheckRow key={check.id} check={check} onRun={() => onRun(check.id)} />
        ))}
      </ul>
      <Button variant="outline" className="self-start" onClick={onRunAll}>
        Repetir las pruebas automáticas
      </Button>
      <p className="text-sm text-muted">
        Si el agente de voz falla y lo demás está listo, la demo sigue con el plan B: Nivi sigue un guion sin
        conectarse al agente en vivo. Ensáyalo una vez con conexión para que sus frases queden guardadas.
      </p>
      <Link
        href="/c?planb=1"
        className="inline-flex min-h-12 items-center self-start font-semibold text-brand underline decoration-2"
      >
        Abrir la web del contratista con el plan B
      </Link>
    </div>
  );
}

/** `/admin/chequeo`: corre las pruebas automáticas al abrir y deja las de micrófono y sonido a un toque. */
export function PreflightScreen() {
  const [preflight] = useState(() => createPreflight(preflightChecks(browserPreflightDeps(apiRequest))));
  const checks = useSyncExternalStore(preflight.subscribe, preflight.getState, preflight.getState);
  useEffect(() => void preflight.runAutomatic(), [preflight]);
  return (
    <PreflightView
      checks={checks}
      onRun={(id) => void preflight.run(id)}
      onRunAll={() => void preflight.runAutomatic()}
    />
  );
}
