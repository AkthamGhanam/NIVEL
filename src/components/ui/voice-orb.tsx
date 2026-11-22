import { cx } from "@/lib/cx";

/** En qué está Nivi. El texto de estado siempre acompaña al orbe: nunca depende solo de la animación. */
export type OrbState = "idle" | "listening" | "thinking" | "speaking";

export const ORB_STATUS: Readonly<Record<OrbState, string>> = {
  idle: "Toca para hablar con Nivi",
  listening: "Tu turno: habla ahora",
  thinking: "Nivi está pensando…",
  speaking: "Nivi está hablando",
};

const RING_DELAYS = ["", "[animation-delay:600ms]", "[animation-delay:1200ms]"] as const;

interface VoiceOrbProps {
  readonly state: OrbState;
  readonly size?: "md" | "lg";
}

const SIZES = { md: "size-28", lg: "size-40" } as const;

/**
 * Orbe de voz: círculo verde con anillos concéntricos, eco del isotipo de Bytes.
 * Los anillos laten mientras Nivi escucha o habla. Es decorativo; el estado se
 * anuncia con el texto de `ORB_STATUS` en una región `aria-live`.
 */
export function VoiceOrb({ state, size = "lg" }: VoiceOrbProps) {
  const active = state === "listening" || state === "speaking";
  return (
    <div className="flex flex-col items-center gap-4">
      <div aria-hidden="true" className={cx("relative flex items-center justify-center", SIZES[size])}>
        {active
          ? RING_DELAYS.map((delay) => (
              <span
                key={delay}
                className={cx(
                  "absolute inset-0 rounded-full border-[3px] border-brand animate-orb-ring",
                  delay,
                )}
              />
            ))
          : null}
        <span className="absolute inset-[8%] rounded-full border-[3px] border-brand-tint-2" />
        <span className="absolute inset-[20%] rounded-full border-[3px] border-brand-2/40" />
        <span
          className={cx(
            "absolute inset-[32%] rounded-full bg-brand transition-transform duration-200",
            state === "thinking" && "animate-pulse",
            state === "speaking" && "scale-110",
          )}
        />
      </div>
      <p role="status" aria-live="polite" className="text-base font-bold text-ink">
        {ORB_STATUS[state]}
      </p>
    </div>
  );
}
