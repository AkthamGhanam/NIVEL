import { MAX_NOTE_SECONDS, noteClock } from "@/client/voice-recorder";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingText, Notice } from "@/components/ui/notice";
import { Progress } from "@/components/ui/progress";

import type { VoiceNoteControls } from "../hooks/use-voice-note";

/** Lo que se promete antes de pedir el micrófono (regla de minimización de datos). */
export const VOICE_REPORT_PROMISE =
  "Graba una nota de hasta 60 segundos. No guardamos el audio: solo el texto, y lo revisa una persona del equipo.";

function Recording({ note }: { readonly note: VoiceNoteControls }) {
  return (
    <>
      <p role="status" className="flex items-center gap-2 font-bold text-ink">
        <span aria-hidden="true" className="size-3 shrink-0 animate-pulse rounded-full bg-danger" />
        Grabando
      </p>
      {/* El reloj cambia cada segundo: no se anuncia solo para no interrumpir a quien habla. */}
      <p className="text-sm font-semibold text-ink-2">{noteClock(note.seconds)}</p>
      <Progress value={note.seconds / MAX_NOTE_SECONDS} label="Tiempo de la nota de voz" />
      <Button block onClick={note.finish}>
        Terminar y enviar
      </Button>
      <Button block variant="outline" onClick={note.cancel}>
        Descartar
      </Button>
    </>
  );
}

function Waiting({ phase }: { readonly phase: VoiceNoteControls["phase"] }) {
  return (
    <LoadingText>
      {phase === "starting" ? "Esperando el permiso del micrófono…" : "Nivi está escribiendo lo que dijiste…"}
    </LoadingText>
  );
}

/** Reporte dicho con la voz: grabar, ver el tiempo y enviar. El formulario escrito siempre queda debajo. */
export function VoiceReportPanel({ note }: { readonly note: VoiceNoteControls }) {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-extrabold">Cuéntalo con tu voz</h2>
      <p className="text-[0.9375rem] text-ink-2">{VOICE_REPORT_PROMISE}</p>
      {note.phase === "recording" ? <Recording note={note} /> : null}
      {note.phase === "starting" || note.phase === "sending" ? <Waiting phase={note.phase} /> : null}
      {note.phase === "idle" ? (
        <Button block variant="ink" onClick={note.start}>
          Grabar nota de voz
        </Button>
      ) : null}
      {note.error ? (
        <Notice tone="alert" urgent>
          {note.error}
        </Notice>
      ) : null}
    </Card>
  );
}
