import type { AcademyPersona } from "@/client/academy-api";
import { DemoFooter, NivelMark } from "@/components/brand/brand";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";

interface AcademyPickerProps {
  readonly academies: readonly AcademyPersona[];
  readonly onPick: (academyId: string) => void;
  readonly pending: boolean;
  readonly error: string | null;
}

/** Entrada de la demo: se elige una academia de ejemplo. El servidor abre la sesión con una cookie firmada. */
export function AcademyPicker({ academies, onPick, pending, error }: AcademyPickerProps) {
  return (
    <>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
        <NivelMark />
        <div>
          <Eyebrow className="text-brand">Academia · panel web</Eyebrow>
          <h1 className="display mt-2 text-4xl">¿Con qué academia entras?</h1>
          <p className="mt-2 text-lg text-ink-2">Esta es una demo: eliges una academia de ejemplo.</p>
        </div>
        {error ? (
          <Notice tone="alert" urgent>
            {error}
          </Notice>
        ) : null}
        <ul className="flex flex-col gap-3">
          {academies.map((academy) => (
            <li key={academy.id}>
              <Card className="flex flex-wrap items-center gap-4">
                <Avatar name={academy.name} tone="ink" />
                <h2 className="min-w-0 flex-1 text-lg font-extrabold">{academy.name}</h2>
                <Button onClick={() => onPick(academy.id)} disabled={pending}>
                  Entrar<span className="sr-only"> como {academy.name}</span>
                </Button>
              </Card>
            </li>
          ))}
        </ul>
        {academies.length === 0 ? (
          <Notice tone="pending">Aún no hay academias de ejemplo cargadas.</Notice>
        ) : null}
      </main>
      <DemoFooter className="border-t border-line" />
    </>
  );
}
