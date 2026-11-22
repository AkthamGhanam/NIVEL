import { qrDrawing } from "@/client/qr";
import { cx } from "@/lib/cx";

interface QrCodeProps {
  /** Texto del código, normalmente un enlace. */
  readonly value: string;
  /** Qué abre el código, para quien no lo ve. */
  readonly label: string;
  readonly className?: string;
}

/** Código QR dibujado en la propia página, negro sobre blanco para que cualquier cámara lo lea. */
export function QrCode({ value, label, className }: QrCodeProps) {
  const { size, path } = qrDrawing(value);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={cx("rounded-control bg-white", className)}
    >
      <path d={path} className="fill-ink" />
    </svg>
  );
}
