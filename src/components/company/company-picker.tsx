import type { CompanyPersona } from "@/client/company-api";
import { DemoFooter, NivelMark } from "@/components/brand/brand";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Tag } from "@/components/ui/tag";

interface CompanyPickerProps {
  readonly companies: readonly CompanyPersona[];
  readonly onPick: (companyId: string) => void;
  readonly pending: boolean;
  readonly error: string | null;
}

/**
 * Entrada de la demo: no hay cuentas reales, se elige una empresa de ejemplo.
 * El servidor abre la sesión con una cookie firmada; aquí solo se elige.
 */
export function CompanyPicker({ companies, onPick, pending, error }: CompanyPickerProps) {
  return (
    <>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
        <NivelMark />
        <div>
          <Eyebrow className="text-brand">Contratista · web</Eyebrow>
          <h1 className="display mt-2 text-4xl">¿Con qué empresa entras?</h1>
          <p className="mt-2 text-lg text-ink-2">
            Esta es una demo: eliges una empresa de ejemplo para pedir personal.
          </p>
        </div>
        {error ? (
          <Notice tone="alert" urgent>
            {error}
          </Notice>
        ) : null}
        <ul className="flex flex-col gap-3">
          {companies.map((company) => (
            <li key={company.id}>
              <Card className="flex flex-wrap items-center gap-4">
                <Avatar name={company.name} tone="ink" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-extrabold">{company.name}</h2>
                  <p className="text-sm text-muted">
                    {company.zone} · RIF {company.rif}
                  </p>
                  <Tag tone={company.verified ? "ok" : "pending"} className="mt-1.5">
                    {company.verified ? "Empresa verificada" : "Verificación pendiente"}
                  </Tag>
                </div>
                <Button onClick={() => onPick(company.id)} disabled={pending}>
                  Entrar<span className="sr-only"> como {company.name}</span>
                </Button>
              </Card>
            </li>
          ))}
        </ul>
        {companies.length === 0 ? (
          <Notice tone="pending">Aún no hay empresas de ejemplo cargadas.</Notice>
        ) : null}
      </main>
      <DemoFooter className="border-t border-line" />
    </>
  );
}
