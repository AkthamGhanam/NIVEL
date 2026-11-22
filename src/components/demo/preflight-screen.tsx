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
import { NivelMark } from "@/components/brand/brand";
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
    <div className="flex min-h-dvh flex-1 flex-col bg-canvas">
      <header className="on-dark flex flex-wrap items-center gap-4 bg-ink px-4 py-3 lg:px-6">
        <NivelMark tone="white" size={28} />
        <h1 className="display text-2xl text-white">Chequeo previo</h1>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
        <p className="text-lg text-ink-2">
          Corre esta lista en la laptop del escenario, con su micrófono y sus cornetas, antes de presentar.
        </p>
        <p role="status" className="text-lg font-extrabold">
          {preflightSummary(checks)}
        </p>
        <ul className="rounded-card border-[1.5px] border-line bg-surface px-4">
          {checks.map((check) => (
            <CheckRow key={check.id} check={check} onRun={() => onRun(check.id)} />
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="outline" onClick={onRunAll}>
            Repetir las pruebas automáticas
          </Button>
          <Link
            href="/demo"
            className="inline-flex min-h-12 items-center font-semibold text-brand underline decoration-2"
          >
            Volver al Modo Jurado
          </Link>
        </div>
        <p className="text-sm text-muted">
          Si el agente de voz falla y lo demás está listo, la demo sigue con el plan B: actívalo en el Modo
          Jurado. Ensáyalo una vez con conexión para que las frases de Nivi queden guardadas.
        </p>
      </main>
    </div>
  );
}

/** `/demo/check`: corre las pruebas automáticas al abrir y deja las de micrófono y sonido a un toque. */
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
