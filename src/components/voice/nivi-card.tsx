// Tarjeta plegable para conversar con Nivi desde la app (ofertas del trabajador o pedido del contratista).
"use client";

import { type ReactNode, useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { MicIcon } from "@/components/ui/icons";

import { NiviPanel, NiviProvider } from "./nivi-panel";
import { type NiviSession, useNivi } from "./use-nivi";

interface NiviCardProps {
  readonly title: string;
  readonly hint: string;
  readonly openSession: () => Promise<NiviSession>;
  readonly onActivity?: () => void;
}

function Talk({ openSession, onActivity }: Pick<NiviCardProps, "openSession" | "onActivity">) {
  const nivi = useNivi(openSession);
  const turns = nivi.bubbles.length;
  useEffect(() => {
    if (turns > 0) onActivity?.();
  }, [turns, onActivity]);
  return <NiviPanel nivi={nivi} />;
}

interface NiviCardFrameProps extends Pick<NiviCardProps, "title" | "hint"> {
  readonly children: ReactNode;
}

export function NiviCardFrame({ title, hint, children }: NiviCardFrameProps) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="flex flex-col gap-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-14 w-full items-center gap-3 text-left"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-white">
          <MicIcon size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold">{title}</span>
          <span className="block text-sm text-muted">{hint}</span>
        </span>
        <span
          aria-hidden="true"
          className={open ? "rotate-180 text-muted transition-transform" : "text-muted transition-transform"}
        >
          ▾
        </span>
      </button>
      {open ? <div className="animate-enter">{children}</div> : null}
    </Card>
  );
}

export function NiviCard({ title, hint, openSession, onActivity }: NiviCardProps) {
  return (
    <NiviCardFrame title={title} hint={hint}>
      <NiviProvider>
        <Talk openSession={openSession} onActivity={onActivity} />
      </NiviProvider>
    </NiviCardFrame>
  );
}
