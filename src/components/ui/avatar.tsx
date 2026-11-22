import { cx } from "@/lib/cx";
import { initials } from "@/lib/format";

interface AvatarProps {
  readonly name: string;
  readonly tone?: "brand" | "ink" | "gray";
  readonly size?: "md" | "lg";
}

const TONES = { brand: "bg-brand text-white", ink: "bg-ink text-white", gray: "bg-line text-ink" } as const;
const SIZES = { md: "size-12 text-lg", lg: "size-16 text-2xl" } as const;

/**
 * Círculo con iniciales. Nunca muestra foto: la empresa no ve la cara de
 * nadie antes de invitar (regla legal 8.6). Es decorativo: el nombre va al lado.
 */
export function Avatar({ name, tone = "brand", size = "md" }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "display inline-flex shrink-0 items-center justify-center rounded-full",
        TONES[tone],
        SIZES[size],
      )}
    >
      {initials(name)}
    </span>
  );
}
