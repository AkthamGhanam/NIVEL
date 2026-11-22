// "La obra es aquí": el contratista fija el punto exacto de la obra con la ubicación de su teléfono.
"use client";

import { accuracyLabel, precisePosition } from "@/client/geolocation";
import { Button } from "@/components/ui/button";
import { PinIcon } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { cx } from "@/lib/cx";
import type { GeoFix } from "@/lib/geo";

import { useAction } from "../hooks/use-action";

interface SitePinViewProps {
  /** La obra ya tiene su punto exacto. */
  readonly pinned: boolean;
  /** Detalle de la lectura recién tomada, por ejemplo "±12 m". */
  readonly detail?: string | undefined;
  readonly pending: boolean;
  readonly error: string | null;
  readonly onPin: () => void;
  readonly onClear?: (() => void) | undefined;
}

export function SitePinView({ pinned, detail, pending, error, onPin, onClear }: SitePinViewProps) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className={cx(
          "flex items-start gap-3 rounded-control border-[1.5px] px-3.5 py-3",
          pinned ? "border-brand-tint-2 bg-brand-tint" : "border-line bg-canvas",
        )}
      >
        <span aria-hidden="true" className={cx("mt-0.5 shrink-0", pinned ? "text-brand" : "text-muted")}>
          <PinIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p role="status" className="font-bold">
            {pinned ? "Ubicación de la obra fijada" : "La obra aún no tiene ubicación exacta"}
          </p>
          <p className="text-sm text-ink-2">
            {pinned
              ? `Las llegadas se verifican contra este punto${detail ? ` (precisión ${detail})` : ""}.`
              : "Hazlo parado en la obra. Sin esto usamos la zona de tu empresa y la llegada no se puede verificar bien."}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onPin} disabled={pending} className="flex-1">
          {pending ? "Buscando tu ubicación…" : pinned ? "Volver a fijar aquí" : "Usar mi ubicación actual"}
        </Button>
        {pinned && onClear ? (
          <Button variant="outline" onClick={onClear} disabled={pending}>
            Quitar
          </Button>
        ) : null}
      </div>
      {error ? (
        <Notice tone="alert" urgent>
          {error}
        </Notice>
      ) : null}
    </div>
  );
}

interface SitePinProps {
  readonly pinned: boolean;
  readonly detail?: string | undefined;
  /** Recibe la lectura del GPS. Si falla (por ejemplo, señal débil), lanza el error para mostrarlo. */
  readonly onFix: (fix: GeoFix) => Promise<void> | void;
  readonly onClear?: (() => void) | undefined;
}

/** Pide la ubicación solo al tocar el botón, escucha unos segundos y entrega la mejor lectura. */
export function SitePin({ pinned, detail, onFix, onClear }: SitePinProps) {
  const action = useAction(async () => {
    await onFix(await precisePosition());
  });
  return (
    <SitePinView
      pinned={pinned}
      detail={detail}
      pending={action.pending}
      error={action.error}
      onPin={() => void action.invoke()}
      onClear={onClear}
    />
  );
}

export { accuracyLabel };
