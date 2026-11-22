// Tarjeta "Conectar Telegram": un toque abre el bot ya conectado a la cuenta de quien tiene la sesión.
"use client";

import { useState } from "react";

import { apiRequest } from "@/client/api";
import { createLiveStore } from "@/client/live-store";
import { createTelegramApi, type TelegramLinkStatus } from "@/client/telegram-api";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SendIcon } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { cx } from "@/lib/cx";

import { useAction } from "../hooks/use-action";
import { useLive } from "../hooks/use-live";

type Role = "worker" | "company";

/** Mientras la persona va a Telegram y vuelve, se consulta seguido para mostrar "conectado" sin recargar. */
const STATUS_POLL_MS = 4000;

const COPY: Readonly<Record<Role, { readonly off: string; readonly on: string }>> = {
  worker: {
    off: "Recibe cada oferta en tu Telegram y acéptala con un toque, sin abrir la app.",
    on: "Te avisamos ahí de cada oferta. Puedes aceptar o rechazar con un toque.",
  },
  company: {
    off: "Pide personal desde Telegram y recibe un aviso cuando alguien acepta o llega a la obra.",
    on: "Ahí pides personal y te avisamos quién acepta y quién llega a la obra.",
  },
};

interface TelegramCardViewProps {
  readonly role: Role;
  readonly status: TelegramLinkStatus;
  /** Enlace recién creado para abrir el bot. Vence en minutos y sirve una sola vez. */
  readonly url: string | null;
  readonly pending: boolean;
  readonly error: string | null;
  readonly onConnect: () => void;
  readonly onDisconnect: () => void;
}

export function TelegramCardView(props: TelegramCardViewProps) {
  const { role, status, url, pending, error, onConnect, onDisconnect } = props;
  if (!status.available) return null;
  const { linked } = status;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cx(
            "grid size-12 shrink-0 place-items-center rounded-full",
            linked ? "bg-brand text-white" : "bg-brand-tint text-brand",
          )}
        >
          <SendIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p role="status" className="text-lg font-extrabold">
            {linked ? "Telegram conectado" : "Conecta tu Telegram"}
          </p>
          <p className="text-sm text-muted">{linked ? COPY[role].on : COPY[role].off}</p>
        </div>
      </div>
      {linked ? (
        <Button variant="outline" disabled={pending} onClick={onDisconnect}>
          Desconectar Telegram
        </Button>
      ) : url ? (
        <>
          <a href={url} target="_blank" rel="noreferrer" className={buttonClass({ block: true })}>
            Abrir Telegram y tocar «Iniciar»
          </a>
          <p className="text-sm text-muted">El enlace sirve una sola vez y vence en 15 minutos.</p>
        </>
      ) : (
        <Button variant="outline" disabled={pending} onClick={onConnect}>
          {pending ? "Preparando el enlace…" : "Conectar Telegram"}
        </Button>
      )}
      {error ? (
        <Notice tone="alert" urgent>
          {error}
        </Notice>
      ) : null}
    </Card>
  );
}

export function TelegramCard({ role }: { readonly role: Role }) {
  const [api] = useState(() => createTelegramApi(apiRequest, role));
  const [store] = useState(() =>
    createLiveStore((signal) => api.status(signal), { intervalMs: STATUS_POLL_MS }),
  );
  const live = useLive(store);
  const [url, setUrl] = useState<string | null>(null);
  const connect = useAction(async () => setUrl((await api.link()).url));
  const disconnect = useAction(async () => {
    await api.unlink();
    setUrl(null);
    await store.refresh();
  });
  if (!live.data) return null;
  return (
    <TelegramCardView
      role={role}
      status={live.data}
      url={url}
      pending={connect.pending || disconnect.pending}
      error={connect.error ?? disconnect.error}
      onConnect={() => void connect.invoke()}
      onDisconnect={() => void disconnect.invoke()}
    />
  );
}
