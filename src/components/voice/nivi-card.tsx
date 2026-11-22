// Tarjeta plegable para conversar con Nivi desde la app (ofertas del trabajador o pedido del contratista).
"use client";

import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { ChevronIcon, MicIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

import { NiviPanel, NiviProvider } from "./nivi-panel";
import { type NiviSession, useNivi } from "./use-nivi";

interface NiviCardProps {
  readonly title: string;
  readonly hint: string;
  readonly openSession: () => Promise<NiviSession>;
  readonly onActivity?: () => void;
  /** Avisa cuando la persona abre o cierra la conversación, para que la pantalla no la desmonte a medias. */
  readonly onOpenChange?: (open: boolean) => void;
}

function Talk({ openSession, onActivity }: Pick<NiviCardProps, "openSession" | "onActivity">) {
  const nivi = useNivi(openSession);
  const turns = nivi.bubbles.length;
  useEffect(() => {
    if (turns > 0) onActivity?.();
  }, [turns, onActivity]);
  return <NiviPanel nivi={nivi} />;
}

export function NiviCard({ title, hint, openSession, onActivity, onOpenChange }: NiviCardProps) {
  const [open, setOpen] = useState(false);
  const toggle = () => {
    setOpen(!open);
    onOpenChange?.(!open);
  };
  return (
    <Card className="flex flex-col gap-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className="flex min-h-14 w-full items-center gap-3 text-left"
      >
        <span aria-hidden="true" className="relative grid size-16 shrink-0 place-items-center">
          <span className="absolute inset-0 rounded-full border-2 border-brand-tint-2" />
          <span className="absolute inset-[7px] rounded-full border-2 border-brand-2/35" />
          <span className="relative grid size-10 place-items-center rounded-full bg-brand text-white shadow-glow">
            <MicIcon size={22} />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold">{title}</span>
          <span className="block text-sm text-muted">{hint}</span>
        </span>
        <span
          aria-hidden="true"
          className={cx(
            "grid size-10 shrink-0 place-items-center rounded-full bg-line-2 text-ink-2 transition-transform duration-200",
            open && "rotate-180",
          )}
        >
          <ChevronIcon />
        </span>
      </button>
      {open ? (
        <div className="animate-enter">
          <NiviProvider>
            <Talk openSession={openSession} onActivity={onActivity} />
          </NiviProvider>
        </div>
      ) : null}
    </Card>
  );
}
