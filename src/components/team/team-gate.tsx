"use client";

import { createContext, type FormEvent, type ReactNode, use, useState } from "react";

import { apiRequest, errorMessage } from "@/client/api";
import { createLiveStore, type LiveStore } from "@/client/live-store";
import { createTeamApi, type DemoState, type TeamApi } from "@/client/team-api";
import { NivelMark } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { LoadingText, Notice } from "@/components/ui/notice";
import { DEMO_FOOTER } from "@/lib/legal-copy";

import { useAction } from "../hooks/use-action";
import { useLive } from "../hooks/use-live";

export interface TeamSession {
  readonly api: TeamApi;
  /** Estado de la demo (personas, banderas del bot y de la simulación). */
  readonly state: LiveStore<DemoState>;
}

const TeamContext = createContext<TeamSession | null>(null);

/** Sesión del equipo de NIVEL. Solo se usa dentro de `TeamGate`. */
export function useTeam(): TeamSession {
  const session = use(TeamContext);
  if (!session) throw new Error("useTeam se usa dentro de TeamGate");
  return session;
}

function createSession(): TeamSession {
  const api = createTeamApi(apiRequest);
  return { api, state: createLiveStore((signal) => api.state(signal)) };
}

function GateFrame({ children }: { readonly children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-16">
      <NivelMark />
      {children}
      <p className="mt-auto text-center text-xs text-muted">{DEMO_FOOTER}</p>
    </main>
  );
}

interface KeyFormProps {
  readonly title: string;
  readonly onEnter: (key: string) => void;
  readonly pending: boolean;
  readonly error: string | null;
}

/** Pide la clave del equipo. No se guarda en el navegador: el servidor la cambia por una sesión. */
export function TeamKeyForm({ title, onEnter, pending, error }: KeyFormProps) {
  const [key, setKey] = useState("");
  const [problem, setProblem] = useState<string>();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (key.trim() === "") {
      setProblem("Escribe la clave del equipo.");
      return;
    }
    setProblem(undefined);
    onEnter(key.trim());
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <div>
        <Eyebrow className="text-brand">Equipo NIVEL</Eyebrow>
        <h1 className="display mt-1 text-3xl">{title}</h1>
        <p className="mt-1 text-ink-2">Esta pantalla es solo para el equipo que presenta.</p>
      </div>
      <TextField
        id="clave-equipo"
        label="Clave del equipo"
        type="password"
        autoComplete="off"
        maxLength={256}
        value={key}
        error={problem}
        onChange={(event) => setKey(event.target.value)}
      />
      {error ? (
        <Notice tone="alert" urgent>
          {error}
        </Notice>
      ) : null}
      <Button type="submit" block disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

interface TeamGateProps {
  /** Nombre de la pantalla que se abre, para el título de la entrada. */
  readonly title: string;
  readonly children: ReactNode;
}

/**
 * Puerta de las pantallas del equipo (Modo Jurado y administración). El
 * servidor decide: sin la sesión del equipo, ninguna de sus rutas responde.
 */
export function TeamGate({ title, children }: TeamGateProps) {
  const [session] = useState(createSession);
  const state = useLive(session.state);
  const enter = useAction(async (key: string) => {
    await session.api.enter(key);
    await session.state.refresh();
  });

  if (state.loading) {
    return (
      <GateFrame>
        <LoadingText>Abriendo {title}…</LoadingText>
      </GateFrame>
    );
  }
  if (!state.data) {
    return (
      <GateFrame>
        <Notice tone="alert" urgent>
          {errorMessage(state.error)}
        </Notice>
        <Button onClick={() => void session.state.refresh()}>Intentar de nuevo</Button>
      </GateFrame>
    );
  }
  if (!state.data.active.admin) {
    return (
      <GateFrame>
        <TeamKeyForm
          title={title}
          onEnter={(key) => void enter.invoke(key)}
          pending={enter.pending}
          error={enter.error}
        />
      </GateFrame>
    );
  }
  return <TeamContext value={session}>{children}</TeamContext>;
}
