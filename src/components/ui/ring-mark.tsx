// Marca de agua con los anillos de Bytes, para el fondo de los menús de tinta. Decorativa.
import { cx } from "@/lib/cx";

const RADII = [18, 32, 46, 60, 74, 88] as const;

export function RingMark({ className }: { readonly className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 200" className={cx("text-white/[0.06]", className)}>
      {RADII.map((radius) => (
        <circle
          key={radius}
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}
