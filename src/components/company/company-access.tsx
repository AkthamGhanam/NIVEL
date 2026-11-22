"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import type { CompanyPersona, CompanySignupInput } from "@/client/company-api";
import { DemoFooter, NivelMark } from "@/components/brand/brand";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { SelectField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Tag } from "@/components/ui/tag";
import { ZONES } from "@/lib/zones";

interface CompanyAccessProps {
  /** Empresas de prueba del seed. Las empresas reales nunca aparecen aquí. */
  readonly demoAccounts: readonly CompanyPersona[];
  readonly onPickDemo: (companyId: string) => void;
  readonly onRegister: (input: CompanySignupInput) => void;
  readonly pending: boolean;
  readonly error: string | null;
}

const BENEFITS = [
  "Pides tu cuadrilla por voz o escribiendo, en minutos.",
  "Ves el nivel comprobable de cada persona y quién aceptó, en vivo.",
  "Sabes cuánto cuesta contratar en regla antes de invitar a nadie.",
] as const;

/** Lee el formulario de registro y arma lo que espera el servidor. */
export function readCompanySignup(data: FormData): CompanySignupInput {
  const text = (name: string) => String(data.get(name) ?? "").trim();
  return {
    name: text("empresa"),
    rif: text("rif"),
    zone: text("zona"),
    kind: text("tipo") === "empresa" ? "empresa" : "contratista",
    consent: true,
  };
}

function CompanyFields() {
  return (
    <>
      <TextField
        id="empresa-nombre"
        name="empresa"
        label="Nombre de la empresa"
        autoComplete="organization"
        required
        minLength={2}
        maxLength={80}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="empresa-rif"
          name="rif"
          label="RIF"
          placeholder="J-12345678-9"
          hint="Lo verifica nuestro equipo antes de mostrar el sello"
          required
          minLength={10}
          maxLength={14}
          autoCapitalize="characters"
        />
        <SelectField id="empresa-tipo" name="tipo" label="Tipo" defaultValue="contratista">
          <option value="contratista">Contratista de obras</option>
          <option value="empresa">Empresa con mantenimiento propio</option>
        </SelectField>
      </div>
      <TextField
        id="empresa-zona"
        name="zona"
        label="Zona"
        hint="Municipio donde trabajan normalmente"
        list="zonas-empresa"
        required
        maxLength={80}
      />
      <datalist id="zonas-empresa">
        {Object.values(ZONES).map((zone) => (
          <option key={zone.name} value={zone.name} />
        ))}
      </datalist>
    </>
  );
}

function CompanySignupForm({
  onRegister,
  pending,
  error,
}: Omit<CompanyAccessProps, "demoAccounts" | "onPickDemo">) {
  const [consent, setConsent] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (consent) onRegister(readCompanySignup(new FormData(event.currentTarget)));
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-label="Registrar mi empresa">
      <CompanyFields />
      <label className="flex min-h-12 items-start gap-3 text-ink-2">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1 size-5 shrink-0 accent-brand"
          required
        />
        <span>
          Acepto los{" "}
          <Link href="/legal/terminos" className="font-semibold text-brand underline decoration-2">
            términos de uso
          </Link>
          . Entiendo que NIVEL es la plataforma y que el patrono siempre es mi empresa.
        </span>
      </label>
      {error ? (
        <Notice tone="alert" urgent>
          {error}
        </Notice>
      ) : null}
      <Button type="submit" block disabled={pending || !consent}>
        {pending ? "Registrando…" : "Registrar mi empresa"}
      </Button>
    </form>
  );
}

function DemoAccounts({
  accounts,
  onPick,
  pending,
}: {
  readonly accounts: readonly CompanyPersona[];
  readonly onPick: (companyId: string) => void;
  readonly pending: boolean;
}) {
  return (
    <details className="group rounded-card border-[1.5px] border-line bg-surface">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-bold text-ink-2">
        ¿Vienes a probar NIVEL? Entra con una empresa de prueba
        <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-line px-4 pb-2">
        {accounts.length === 0 ? (
          <p className="py-3 text-sm text-muted">Las empresas de prueba aún no están cargadas.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-2">
            {accounts.map((company) => (
              <li key={company.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <Avatar name={company.name} tone="ink" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{company.name}</p>
                  <p className="text-sm text-muted">
                    {company.zone} · RIF {company.rif}
                  </p>
                  <Tag tone={company.verified ? "ok" : "pending"} className="mt-1">
                    {company.verified ? "Empresa verificada" : "Verificación pendiente"}
                  </Tag>
                </div>
                <Button variant="outline" onClick={() => onPick(company.id)} disabled={pending}>
                  Entrar<span className="sr-only"> como {company.name}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

/**
 * Entrada de la web del contratista: registrar la empresa o entrar con una
 * empresa de prueba. El servidor abre la sesión con una cookie firmada.
 */
export function CompanyAccess({ demoAccounts, onPickDemo, onRegister, pending, error }: CompanyAccessProps) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-canvas">
      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-4 py-10 lg:grid-cols-[1fr_28rem] lg:items-start lg:py-16">
        <section className="flex flex-col gap-5">
          <NivelMark />
          <div>
            <Eyebrow className="text-brand">Para contratistas y empresas</Eyebrow>
            <h1 className="display mt-2 text-4xl sm:text-5xl">
              Tu cuadrilla completa, en regla y en minutos
            </h1>
          </div>
          <ul className="flex flex-col gap-3 text-lg text-ink-2">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="flex gap-3">
                <span aria-hidden="true" className="mt-2.5 size-2 shrink-0 rounded-full bg-brand" />
                {benefit}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="registro-empresa" className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4 p-5">
            <h2 id="registro-empresa" className="text-xl font-extrabold">
              Registra tu empresa
            </h2>
            <CompanySignupForm onRegister={onRegister} pending={pending} error={error} />
          </Card>
          <DemoAccounts accounts={demoAccounts} onPick={onPickDemo} pending={pending} />
        </section>
      </main>
      <DemoFooter className="border-t border-line" />
    </div>
  );
}
