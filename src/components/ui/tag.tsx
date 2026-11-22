import type { ComponentProps } from "react";

import { cx } from "@/lib/cx";
import { type Level, LEVEL_NAMES } from "@/lib/level";

/** Estado en una palabra. El color nunca es la única señal: el texto siempre dice el estado. */
export type Tone = "neutral" | "ok" | "pending" | "alert" | "dark";

const TONES: Readonly<Record<Tone, string>> = {
  neutral: "bg-line-2 text-ink-2",
  ok: "bg-brand-tint text-brand",
  pending: "bg-amber-bg text-amber",
  alert: "bg-danger-bg text-danger",
  dark: "bg-ink text-white",
};

type TagProps = ComponentProps<"span"> & { readonly tone?: Tone };

export function Tag({ tone = "neutral", className, ...rest }: TagProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-[0.8125rem] font-bold",
        TONES[tone],
        className,
      )}
      {...rest}
    />
  );
}

/** "Nivel 3 · Probado". El nombre del nivel sale de la fórmula pública. */
export function LevelBadge({ level, short = false }: { readonly level: Level; readonly short?: boolean }) {
  return <Tag tone="dark">{short ? `Nivel ${level}` : `Nivel ${level} · ${LEVEL_NAMES[level]}`}</Tag>;
}

/** Cinta de sección: "TRABAJADOR · APP", "CONTRATISTA · WEB". */
export function Chip({ className, ...rest }: ComponentProps<"span">) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-chip bg-brand px-3 py-1.5 text-[0.8125rem] font-extrabold tracking-widest text-white uppercase",
        className,
      )}
      {...rest}
    />
  );
}
