import type { EventLine } from "@/client/demo-view";
import { Tag } from "@/components/ui/tag";

/**
 * Bitácora en vivo: qué pasó, quién lo hizo y a qué hora, con lo más reciente
 * arriba. Los lectores de pantalla anuncian cada línea nueva con cortesía.
 */
export function EventLog({ lines }: { readonly lines: readonly EventLine[] }) {
  return (
    <section aria-labelledby="bitacora-titulo" className="flex min-h-0 flex-1 flex-col gap-2">
      <h2 id="bitacora-titulo" className="bar-title text-xl font-extrabold">
        Bitácora en vivo
      </h2>
      {lines.length === 0 ? (
        <p className="text-muted">
          Aún no pasa nada. Lo que hagan el contratista y el trabajador aparece aquí.
        </p>
      ) : null}
      <div
        role="log"
        aria-live="polite"
        aria-labelledby="bitacora-titulo"
        tabIndex={0}
        className="@container min-h-0 flex-1 overflow-y-auto"
      >
        {/* En la columna angosta cada línea va en dos renglones; a lo ancho, en uno. */}
        <ol className="flex flex-col divide-y divide-line-2">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex flex-col gap-x-3 gap-y-0.5 py-1.5 @xl:flex-row @xl:items-baseline"
            >
              <span className="flex shrink-0 items-baseline gap-x-2">
                <time className="text-sm text-muted tabular-nums @xl:w-20">{line.time}</time>
                <span className="font-bold">{line.actor}</span>
              </span>
              <span className="min-w-0 flex-1 text-ink-2">{line.label}</span>
              {line.badge ? (
                <span>
                  <Tag tone="ok">{line.badge}</Tag>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
