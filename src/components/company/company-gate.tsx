// Puerta de la web del contratista: sesión de empresa, acceso y tablero en vivo.
"use client";

import { createContext, type ReactNode, use, useState } from "react";

import { apiRequest, errorMessage } from "@/client/api";
import {
  type CompanyApi,
  type CompanyPersona,
  type CompanySignupInput,
  createCompanyApi,
  type RequestBoard,
} from "@/client/company-api";
import { createLiveStore, type LiveStore } from "@/client/live-store";
import { Button } from "@/components/ui/button";
import { LoadingText, Notice } from "@/components/ui/notice";

import { useAction } from "../hooks/use-action";
import { useLive } from "../hooks/use-live";
import { CompanyAccess } from "./company-access";
import { CompanyShell } from "./company-shell";

export const BOARD_POLL_MS = 2000;

export interface CompanySession {
  readonly company: CompanyPersona;
  readonly api: CompanyApi;

  readonly board: LiveStore<RequestBoard | null>;
}

const CompanyContext = createContext<CompanySession | null>(null);

export function useCompany(): CompanySession {
  const session = use(CompanyContext);
  if (!session) throw new Error("useCompany se usa dentro de CompanyGate");
  return session;
}

function createSessionStores() {
  const api = createCompanyApi(apiRequest);
  return {
    api,
    state: createLiveStore((signal) => api.state(signal)),
    board: createLiveStore((signal) => api.board(signal), { intervalMs: BOARD_POLL_MS }),
  };
}

function GateMessage({ children }: { readonly children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-16">{children}</div>;
}

export function CompanyGate({ children }: { readonly children: ReactNode }) {
  const [stores] = useState(createSessionStores);
  const [choosing, setChoosing] = useState(false);
  const state = useLive(stores.state);
  const enter = useAction(async (companyId: string) => {
    await stores.api.enter(companyId);

    await Promise.all([stores.state.refresh(), stores.board.refresh()]);
    setChoosing(false);
  });
  const register = useAction(async (input: CompanySignupInput) => {
    await stores.api.register(input);
    await Promise.all([stores.state.refresh(), stores.board.refresh()]);
    setChoosing(false);
  });

  if (state.loading) {
    return (
      <GateMessage>
        <LoadingText>Abriendo tu empresa…</LoadingText>
      </GateMessage>
    );
  }
  if (!state.data) {
    return (
      <GateMessage>
        <Notice tone="alert" urgent>
          {errorMessage(state.error)}
        </Notice>
        <Button className="self-start" onClick={() => void stores.state.refresh()}>
          Intentar de nuevo
        </Button>
      </GateMessage>
    );
  }
  const { personas, activeCompany: company } = state.data;
  if (!company || choosing) {
    return (
      <CompanyAccess
        accounts={personas.companies}
        initialTab={choosing ? "entrar" : "crear"}
        onPick={(companyId) => void enter.invoke(companyId)}
        onRegister={(input) => void register.invoke(input)}
        pending={enter.pending || register.pending}
        error={register.error ?? enter.error}
      />
    );
  }
  return (
    <CompanyContext value={{ company, api: stores.api, board: stores.board }}>
      <CompanyShell company={company} onSwitch={() => setChoosing(true)}>
        {children}
      </CompanyShell>
    </CompanyContext>
  );
}
