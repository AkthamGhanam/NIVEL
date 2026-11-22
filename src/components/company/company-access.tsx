// Acceso del contratista: registrar la empresa o entrar con una empresa registrada o de demostración.
"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import type { CompanyPersona, CompanySignupInput } from "@/client/company-api";
import { AccessFrame, type AccessTab } from "@/components/access/access-frame";
import { type Account, AccountList } from "@/components/access/account-list";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { ZONES } from "@/lib/zones";

interface CompanyAccessProps {
  readonly accounts: readonly CompanyPersona[];
  readonly onPick: (companyId: string) => void;
  readonly onRegister: (input: CompanySignupInput) => void;
  readonly pending: boolean;
  readonly error: string | null;
  readonly initialTab?: AccessTab;
}

export const companyAccount = (company: CompanyPersona): Account => ({
  id: company.id,
  name: company.name,
  detail: `${company.zone} · RIF ${company.rif}`,
  ...(company.verified ? { badge: "Verificada" } : {}),
  registered: company.registered,
});

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
}: Pick<CompanyAccessProps, "onRegister" | "pending" | "error">) {
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

export function CompanyAccess({
  accounts,
  onPick,
  onRegister,
  pending,
  error,
  initialTab,
}: CompanyAccessProps) {
  const [tab, setTab] = useState<AccessTab>(initialTab ?? "crear");
  return (
    <AccessFrame
      kicker="Para contratistas y empresas"
      title="Tu cuadrilla completa, en regla y en minutos"
      text="Pide personal, elige a quién invitar y conoce el costo legal antes de contratar."
      tab={tab}
      onTab={setTab}
      createLabel="Registrar mi empresa"
    >
      {tab === "crear" ? (
        <CompanySignupForm onRegister={onRegister} pending={pending} error={error} />
      ) : (
        <div className="flex flex-col gap-3">
          {error ? (
            <Notice tone="alert" urgent>
              {error}
            </Notice>
          ) : null}
          <AccountList accounts={accounts.map(companyAccount)} onPick={onPick} pending={pending} />
        </div>
      )}
    </AccessFrame>
  );
}
