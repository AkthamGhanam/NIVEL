import { PhoneFrame } from "@/components/ui/phone-frame";

/** Permisos que las dos vistas necesitan dentro del marco: voz, audio y ubicación al marcar. */
const FRAME_PERMISSIONS = "microphone; autoplay; geolocation";

/**
 * Las dos vistas de la demo lado a lado, cada una en su propio marco del
 * mismo origen: el teléfono del trabajador y la web del contratista. Con el
 * plan B, la web del contratista conversa con el guion en vez del agente en vivo.
 */
export function DemoStage({ planB = false }: { readonly planB?: boolean }) {
  return (
    <>
      <section
        aria-labelledby="escena-trabajador"
        className="flex shrink-0 flex-col items-center gap-2 md:h-[900px] xl:h-auto xl:min-h-0"
      >
        <h2 id="escena-trabajador" className="eyebrow text-muted">
          Trabajador · app
        </h2>
        <PhoneFrame fit>
          <iframe
            src="/t?demo=1"
            title="App del trabajador"
            allow={FRAME_PERMISSIONS}
            className="w-full flex-1 border-0"
          />
        </PhoneFrame>
      </section>
      <section
        aria-labelledby="escena-contratista"
        className="flex min-h-0 flex-1 flex-col gap-2 lg:min-w-[30rem] xl:min-w-0"
      >
        <h2 id="escena-contratista" className="eyebrow text-muted">
          Contratista · web
        </h2>
        <iframe
          src={planB ? "/c?planb=1" : "/c"}
          title="Web del contratista"
          allow={FRAME_PERMISSIONS}
          className="h-[700px] w-full flex-1 rounded-card border-[1.5px] border-line bg-surface lg:h-auto lg:min-h-0"
        />
      </section>
    </>
  );
}
