import { cx } from "@/lib/cx";
import { DEMO_FOOTER } from "@/lib/legal-copy";

/*
 * Los logos van con <img> y no con next/image: ese componente añade un
 * `style` en línea que nuestra política de seguridad de contenido bloquea.
 * Son PNG pequeños y ya optimizados, servidos desde /brand.
 */
/* eslint-disable @next/next/no-img-element */

const H_RATIO = 660 / 200;

interface BrandLogoProps {
  /** `green` sobre fondos claros, `white` sobre tinta o verde. */
  readonly tone?: "green" | "white";
  readonly height?: number;
}

/** Logo horizontal de Bytes Technology. */
export function BytesLogo({ tone = "green", height = 28 }: BrandLogoProps) {
  return (
    <img
      src={`/brand/bytes-h-${tone}.png`}
      alt="Bytes Technology"
      width={Math.round(height * H_RATIO)}
      height={height}
      decoding="async"
    />
  );
}

/** Marca del producto: isotipo de Bytes y la palabra NIVEL en el titular de la marca. */
export function NivelMark({
  tone = "green",
  size = 32,
}: {
  readonly tone?: "green" | "white";
  readonly size?: number;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img src={`/brand/bytes-iso-${tone}.png`} alt="" width={size} height={size} decoding="async" />
      <span className={cx("display text-2xl", tone === "white" ? "text-white" : "text-ink")}>NIVEL</span>
    </span>
  );
}

/** Pie obligatorio de la demo: todo lo que se ve es de ejemplo. */
export function DemoFooter({ className }: { readonly className?: string }) {
  return <footer className={cx("px-4 py-5 text-center text-sm text-muted", className)}>{DEMO_FOOTER}</footer>;
}
