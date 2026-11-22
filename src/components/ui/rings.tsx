// Anillos de NIVEL: el isotipo de Bytes convertido en medidor. Son decorativos; el texto de al lado dice el dato.
import type { ReactNode } from "react";

import { cx } from "@/lib/cx";
import type { Level } from "@/lib/level";

const LEVEL_RADII = [46, 59, 72, 85, 98] as const;
/** Cada anillo alcanzado entra un poco después del anterior: un solo momento de movimiento al cargar. */
const DRAW_DELAYS = [
  "",
  "[animation-delay:140ms]",
  "[animation-delay:280ms]",
  "[animation-delay:420ms]",
  "[animation-delay:560ms]",
] as const;

type RingTone = "ink" | "light";

const TRACK: Readonly<Record<RingTone, string>> = { ink: "stroke-ink-line", light: "stroke-line-2" };
const LIT: Readonly<Record<RingTone, string>> = { ink: "stroke-signal", light: "stroke-brand" };
const NEXT: Readonly<Record<RingTone, string>> = { ink: "stroke-brand-on-ink", light: "stroke-brand-2" };

interface LevelRingsProps {
  readonly level: Level;
  /** Sobre la consola de tinta o sobre una tarjeta blanca. */
  readonly tone?: RingTone;
  readonly className?: string;
  /** Lo que va en el centro, casi siempre el número del nivel. */
  readonly children?: ReactNode;
}

/**
 * Cinco anillos, uno por nivel, del centro hacia afuera. Los alcanzados se
 * encienden; el siguiente queda punteado, como "lo que viene".
 */
export function LevelRings({ level, tone = "ink", className, children }: LevelRingsProps) {
  return (
    <div className={cx("relative grid aspect-square place-items-center", className)}>
      <svg aria-hidden="true" viewBox="0 0 200 200" className="absolute inset-0 size-full">
        {LEVEL_RADII.map((radius, index) => {
          const ring = index + 1;
          const reached = ring <= level;
          const next = ring === level + 1;
          return (
            <g key={radius}>
              <circle cx="100" cy="100" r={radius} fill="none" strokeWidth="7" className={TRACK[tone]} />
              {reached ? (
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  strokeWidth="7"
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray="1"
                  transform="rotate(-90 100 100)"
                  data-ring="reached"
                  className={cx(LIT[tone], "animate-ring-draw", DRAW_DELAYS[index])}
                />
              ) : null}
              {next ? (
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="2 7"
                  data-ring="next"
                  className={NEXT[tone]}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="relative">{children}</div>
    </div>
  );
}

interface SeatRingProps {
  readonly filled: number;
  readonly total: number;
  /** Si se da, el anillo se anuncia como barra de avance con este nombre ("Cuadrilla 2 de 3"). */
  readonly label?: string;
  readonly className?: string;
  readonly children?: ReactNode;
}

const SEAT_GAP = 2.2;

/**
 * Un anillo partido en tantos tramos como puestos tiene la cuadrilla. Cada
 * persona que acepta enciende un tramo.
 */
export function SeatRing({ filled, total, label, className, children }: SeatRingProps) {
  const seats = Math.max(1, Math.floor(total));
  const lit = Math.min(seats, Math.max(0, Math.floor(filled)));
  const step = 100 / seats;
  const length = seats === 1 ? 100 : step - SEAT_GAP;
  const progress = label
    ? {
        role: "progressbar",
        "aria-label": label,
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-valuenow": Math.round((lit / seats) * 100),
      }
    : {};
  return (
    <div className={cx("relative grid aspect-square place-items-center", className)} {...progress}>
      <svg aria-hidden="true" viewBox="0 0 200 200" className="absolute inset-0 size-full">
        <circle cx="100" cy="100" r="66" fill="none" strokeWidth="1.5" className="stroke-ink-line" />
        <circle cx="100" cy="100" r="50" fill="none" strokeWidth="1.5" className="stroke-ink-line" />
        <g transform="rotate(-90 100 100)">
          {Array.from({ length: seats }, (_, index) => (
            <circle
              key={index}
              cx="100"
              cy="100"
              r="86"
              fill="none"
              strokeWidth="12"
              pathLength={100}
              strokeDasharray={`${length} ${100 - length}`}
              strokeDashoffset={-index * step}
              data-seat={index < lit ? "filled" : "open"}
              className={index < lit ? "stroke-signal" : "stroke-ink-line"}
            />
          ))}
        </g>
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}
