// Marca: logos de Bytes, isotipo de NIVEL y distintivo discreto de versión demo.
import { cx } from "@/lib/cx";
import { DEMO_FOOTER } from "@/lib/legal-copy";

/* eslint-disable @next/next/no-img-element */

const H_RATIO = 660 / 200;

interface BrandLogoProps {
  readonly tone?: "green" | "white";
  readonly height?: number;
}

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

export function DemoFooter({ className }: { readonly className?: string }) {
  return (
    <footer className={cx("flex justify-center px-4 py-4", className)}>
      <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-muted">
        {DEMO_FOOTER}
      </span>
    </footer>
  );
}
