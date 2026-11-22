// Acceso del contratista: registrar la empresa o entrar con una empresa registrada o de demostración.
"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import type { CompanyPersona, CompanySignupInput } from "@/client/company-api";
import { type AccessKey, MIN_PASSWORD } from "@/client/demo-access";
import { AccessLogin, PasswordField } from "@/components/access/account-key";
import { AccessFrame, type AccessTab } from "@/components/access/access-frame";
import { type Account, AccountList } from "@/components/access/account-list";
import { Button } from "@/components/ui/button";
import { ChoiceChips, single } from "@/components/ui/choice-chips";
import { TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { WorkAreaPicker } from "@/components/ui/work-area-picker";
import { COMPANY_SECTORS, type CompanySector } from "@/lib/profile-options";
import { describeWorkArea, type WorkArea } from "@/lib/venezuela";

interface CompanyAccessProps {
  readonly accounts: readonly CompanyPersona[];
  readonly onPick: (companyId: string) => void;
  readonly onRegister: (input: CompanySignupInput, access: AccessKey) => void;
  readonly onLogin: (key: AccessKey) => Promise<string | null>;
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

interface CompanyDraft {
  readonly name: string;
  readonly rif: string;
  readonly sector: CompanySector | null;
  readonly workArea: WorkArea | null;
  readonly password: string;
  readonly consent: boolean;
}

type CompanyProblems = Partial<Record<keyof CompanyDraft, string>>;

const EMPTY_COMPANY: CompanyDraft = {
  name: "",
  rif: "",
  sector: null,
  workArea: null,
  password: "",
  consent: false,
};

const RIF = /^[JGVEPC]-?\d{8}-?\d$/;

export function companyProblems(draft: CompanyDraft): CompanyProblems {
  const found: CompanyProblems = {
    name: draft.name.trim().length >= 2 ? undefined : "Escribe el nombre de la empresa.",
    rif: RIF.test(draft.rif.trim().toUpperCase().replace(/\s+/g, ""))
      ? undefined
      : "El RIF va así: J-12345678-9.",
    sector: draft.sector ? undefined : "Elige el tipo de empresa.",
    workArea: draft.workArea ? undefined : "Elige dónde trabajan.",
    password:
      draft.password.length >= MIN_PASSWORD ? undefined : `Usa al menos ${MIN_PASSWORD} letras o números.`,
    consent: draft.consent ? undefined : "Acepta los términos para seguir.",
  };
  return Object.fromEntries(Object.entries(found).filter(([, problem]) => problem));
}

export function toCompanySignup(
  draft: CompanyDraft,
): { input: CompanySignupInput; access: AccessKey } | null {
  if (!draft.sector || !draft.workArea || !draft.consent) return null;
  return {
    input: {
      name: draft.name.trim(),
      rif: draft.rif.trim(),
      zone: describeWorkArea(draft.workArea),
      kind: "contratista",
      sector: draft.sector,
      workArea: draft.workArea,
      consent: true,
    },
    access: { document: draft.rif, password: draft.password },
  };
}

const SECTOR_CHOICES = COMPANY_SECTORS.map((sector) => ({ value: sector, label: sector }));

interface DraftProps {
  readonly draft: CompanyDraft;
  readonly problems: CompanyProblems;
  readonly update: (changes: Partial<CompanyDraft>) => void;
}

function CompanyFields({ draft, problems, update }: DraftProps) {
  return (
    <>
      <TextField
        id="empresa-nombre"
        label="Nombre de la empresa"
        placeholder="Ej: Montajes Carabobo C.A."
        autoComplete="organization"
        maxLength={80}
        value={draft.name}
        error={problems.name}
        onChange={(event) => update({ name: event.target.value })}
      />
      <TextField
        id="empresa-rif"
        label="RIF"
        placeholder="Ej: J-12345678-9"
        hint="Con el RIF y tu contraseña vuelves a entrar. Nuestro equipo lo verifica antes de mostrar el sello."
        maxLength={14}
        autoCapitalize="characters"
        value={draft.rif}
        error={problems.rif}
        onChange={(event) => update({ rif: event.target.value })}
      />
      <ChoiceChips<CompanySector>
        id="empresa-sector"
        legend="¿Qué tipo de empresa es?"
        options={SECTOR_CHOICES}
        selected={single(draft.sector)}
        error={problems.sector}
        onToggle={(sector) => update({ sector })}
      />
      <WorkAreaPicker
        id="empresa-zonas"
        legend="Zonas de trabajo"
        hint="Dónde hacen obras o tienen planta. Puedes elegir varias."
        value={draft.workArea}
        error={problems.workArea}
        onChange={(workArea) => update({ workArea })}
      />
      <PasswordField
        id="empresa-clave"
        label="Crea una contraseña"
        value={draft.password}
        error={problems.password}
        onChange={(password) => update({ password })}
      />
    </>
  );
}

function CompanySignupForm({
  onRegister,
  pending,
  error,
}: Pick<CompanyAccessProps, "onRegister" | "pending" | "error">) {
  const [draft, setDraft] = useState<CompanyDraft>(EMPTY_COMPANY);
  const [problems, setProblems] = useState<CompanyProblems>({});
  const update = (changes: Partial<CompanyDraft>) => setDraft((current) => ({ ...current, ...changes }));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = companyProblems(draft);
    setProblems(found);
    const signup = Object.keys(found).length === 0 ? toCompanySignup(draft) : null;
    if (signup) onRegister(signup.input, signup.access);
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-label="Registrar mi empresa">
      <CompanyFields draft={draft} problems={problems} update={update} />
      <label className="flex min-h-12 items-start gap-3 text-ink-2">
        <input
          type="checkbox"
          checked={draft.consent}
          onChange={(event) => update({ consent: event.target.checked })}
          className="mt-1 size-5 shrink-0 accent-brand"
        />
        <span>
          Acepto los{" "}
          <Link href="/legal/terminos" className="font-semibold text-brand underline decoration-2">
            términos de uso
          </Link>
          . Entiendo que NIVEL es la plataforma y que el patrono siempre es mi empresa.
        </span>
      </label>
      {problems.consent ? <p className="text-sm font-semibold text-danger">{problems.consent}</p> : null}
      {error ? (
        <Notice tone="alert" urgent>
          {error}
        </Notice>
      ) : null}
      <Button type="submit" block disabled={pending}>
        {pending ? "Registrando…" : "Registrar mi empresa"}
      </Button>
    </form>
  );
}

export function CompanyAccess({
  accounts,
  onPick,
  onRegister,
  onLogin,
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
        <div className="flex flex-col gap-4">
          <AccessLogin
            documentLabel="RIF"
            placeholder="Ej: J-12345678-9"
            onLogin={onLogin}
            pending={pending}
          />
          <p className="text-sm font-bold text-muted">O toca tu empresa</p>
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
