import { cx } from "@/lib/cx";

interface ProgressProps {
  /** De 0 a 1. */
  readonly value: number;
  /** Qué mide la barra, para lectores de pantalla ("Avance del curso"). */
  readonly label: string;
  readonly className?: string;
}

/**
 * Barra de avance. Se dibuja con SVG y no con `style`, porque la política de
 * seguridad de contenido (CSP) bloquea los estilos en línea.
 */
export function Progress({ value, label, className }: ProgressProps) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <svg
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cx("block h-2 w-full overflow-hidden rounded-full", className)}
      preserveAspectRatio="none"
    >
      <rect width="100%" height="100%" className="fill-line-2" />
      <rect width={`${percent}%`} height="100%" className="fill-brand" />
    </svg>
  );
}
