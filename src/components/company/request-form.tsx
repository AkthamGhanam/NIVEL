"use client";

import { type FormEvent, useState } from "react";

import { ApiError } from "@/client/api";
import type { RequestInput } from "@/client/company-api";
import {
  type DraftProblems,
  newRequestDraft,
  parseRequestDraft,
  problemsFromApi,
  REQUEST_LIMITS,
  type RequestDraft,
} from "@/client/request-draft";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { PlacePicker } from "@/components/ui/work-area-picker";
import { localDate } from "@/lib/dates";
import { type GeoFix, SITE_PIN_MAX_ACCURACY_M } from "@/lib/geo";
import { FIRST_TRIMESTER_DAYS } from "@/lib/legal-cost";
import { LEVEL_NAMES, type Level } from "@/lib/level";
import { durationOf, HIRE_DURATIONS, type HireDuration } from "@/lib/profile-options";
import { CONTRACT_TYPE_LABELS, CONTRACT_TYPES, TRADE_LABELS, TRADES } from "@/lib/trades";

import { accuracyLabel, SitePin } from "./site-pin";

const LEVELS = [1, 2, 3, 4, 5] as const satisfies readonly Level[];
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

interface RequestFormProps {
  /** Zona de la empresa: la obra de la demo queda en su sede. */
  readonly zone: string;
  /** Publica la solicitud. Si falla, lanza el error de la API. */
  readonly onSubmit: (input: RequestInput) => Promise<void>;
}

interface FormState {
  readonly draft: RequestDraft;
  readonly problems: DraftProblems;
  readonly failure: string | null;
  readonly sending: boolean;
  /** Punto exacto de la obra, si el contratista lo fijó con su ubicación. */
  readonly site: GeoFix | null;
}

const WEAK_SIGNAL =
  "La señal de ubicación está débil. Sal a un lugar abierto, espera unos segundos y vuelve a intentar.";

function useRequestForm({ zone, onSubmit }: RequestFormProps) {
  const [form, setForm] = useState<FormState>(() => ({
    draft: newRequestDraft(zone, localDate(new Date())),
    problems: {},
    failure: null,
    sending: false,
    site: null,
  }));

  const pinSite = (site: GeoFix | null) => {
    if (site?.accuracyM !== undefined && site.accuracyM > SITE_PIN_MAX_ACCURACY_M)
      throw new Error(WEAK_SIGNAL);
    setForm((current) => ({ ...current, site }));
  };

  const change = <Field extends keyof RequestDraft>(field: Field, value: RequestDraft[Field]) =>
    setForm((current) => ({
      ...current,
      draft: { ...current.draft, [field]: value },
      problems: { ...current.problems, [field]: undefined },
    }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.sending) return;
    const parsed = parseRequestDraft(form.draft, localDate(new Date()));
    if (!parsed.ok) {
      setForm((current) => ({
        ...current,
        problems: parsed.problems,
        failure: "Revisa los datos marcados.",
      }));
      return;
    }
    setForm((current) => ({ ...current, problems: {}, failure: null, sending: true }));
    try {
      await onSubmit(form.site ? { ...parsed.input, site: form.site } : parsed.input);
      setForm((current) => ({ ...current, sending: false }));
    } catch (error) {
      const problems = error instanceof ApiError ? problemsFromApi(error.details) : {};
      const failure = error instanceof ApiError ? error.message : "Algo falló. Intenta de nuevo.";
      setForm((current) => ({ ...current, problems, failure, sending: false }));
    }
  };

  return { form, change, submit, pinSite };
}

type Change = <Field extends keyof RequestDraft>(field: Field, value: RequestDraft[Field]) => void;

interface SectionProps {
  readonly draft: RequestDraft;
  readonly problems: DraftProblems;
  readonly change: Change;
}

/** A quién se busca: oficio, cuántas personas y desde qué nivel. */
function PeopleFields({ draft, problems, change }: SectionProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          id="solicitud-oficio"
          label="Oficio"
          value={draft.trade}
          onChange={(event) => change("trade", event.target.value as RequestDraft["trade"])}
        >
          {TRADES.map((trade) => (
            <option key={trade} value={trade}>
              {capitalize(TRADE_LABELS[trade].singular)}
            </option>
          ))}
        </SelectField>
        <TextField
          id="solicitud-cantidad"
          label="Cuántas personas"
          inputMode="numeric"
          value={draft.quantity}
          error={problems.quantity}
          onChange={(event) => change("quantity", event.target.value)}
        />
      </div>
      <SelectField
        id="solicitud-nivel"
        label="Nivel mínimo"
        value={draft.minLevel}
        error={problems.minLevel}
        onChange={(event) => change("minLevel", event.target.value)}
      >
        {LEVELS.map((level) => (
          <option key={level} value={level}>
            Nivel {level} · {LEVEL_NAMES[level]}
          </option>
        ))}
      </SelectField>
    </>
  );
}

const DURATION_CHOICES = HIRE_DURATIONS.map((duration) => ({ value: duration.key, label: duration.label }));

/** Dónde y cuándo es la obra: estado y municipio, día de inicio y horario. */
function SiteFields({ draft, problems, change }: SectionProps) {
  return (
    <>
      <PlacePicker
        id="solicitud-lugar"
        value={{ state: draft.state, municipality: draft.municipality }}
        error={problems.municipality}
        onChange={(place) => {
          change("state", place.state);
          change("municipality", place.municipality ?? "");
        }}
      />
      <TextField
        id="solicitud-inicio"
        label="Empieza el"
        type="date"
        value={draft.startDate}
        error={problems.startDate}
        onChange={(event) => change("startDate", event.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          id="solicitud-entrada"
          label="Desde (hora)"
          type="time"
          value={draft.startTime}
          onChange={(event) => change("startTime", event.target.value)}
        />
        <TextField
          id="solicitud-salida"
          label="Hasta (hora)"
          type="time"
          value={draft.endTime}
          error={problems.endTime}
          onChange={(event) => change("endTime", event.target.value)}
        />
      </div>
    </>
  );
}

/** Cuánto tiempo se contrata. Decide cómo se calculan las prestaciones (LOTTT, art. 142). */
function DurationField({ draft, change }: SectionProps) {
  const days = durationOf(draft.duration).days;
  return (
    <ChoiceChips<HireDuration>
      id="solicitud-duracion"
      legend="¿Por cuánto tiempo quieres contratar?"
      options={DURATION_CHOICES}
      selected={[draft.duration]}
      onToggle={(duration) => change("duration", duration)}
      hint={
        days < FIRST_TRIMESTER_DAYS
          ? "Menos de 3 meses: el costo legal suma vacaciones y utilidades proporcionales, y prestaciones de 5 días de salario por mes (LOTTT, art. 142, literal e)."
          : draft.duration === "indefinido"
            ? "Contrato indefinido: estimamos los primeros 3 meses, con prestaciones de 15 días por trimestre (LOTTT, art. 142)."
            : "Desde 3 meses: prestaciones de 15 días de salario por trimestre (LOTTT, art. 142, literal a)."
      }
    />
  );
}

function PayField({ draft, problems, change }: SectionProps) {
  return (
    <TextField
      id="solicitud-pago"
      label="Pago diario (USD)"
      inputMode="decimal"
      value={draft.dailyPayUsd}
      error={problems.dailyPayUsd}
      onChange={(event) => change("dailyPayUsd", event.target.value)}
    />
  );
}

/** Lo que casi nunca cambia: tipo de contrato y una nota opcional. */
function TermsFields({ draft, problems, change }: SectionProps) {
  return (
    <>
      <SelectField
        id="solicitud-contrato"
        label="Tipo de contrato"
        value={draft.contractType}
        onChange={(event) => change("contractType", event.target.value as RequestDraft["contractType"])}
      >
        {CONTRACT_TYPES.map((type) => (
          <option key={type} value={type}>
            {CONTRACT_TYPE_LABELS[type]}
          </option>
        ))}
      </SelectField>
      <TextAreaField
        id="solicitud-nota"
        label="Nota para la vacante (opcional)"
        rows={2}
        maxLength={REQUEST_LIMITS.notes}
        value={draft.notes}
        error={problems.notes}
        onChange={(event) => change("notes", event.target.value)}
      />
    </>
  );
}

/** Formulario de "pedir personal": la alternativa a pedirlo hablando con Nivi. */
export function RequestForm(props: RequestFormProps) {
  const { form, change, submit, pinSite } = useRequestForm(props);
  const section = { draft: form.draft, problems: form.problems, change };
  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-3">
      <PeopleFields {...section} />
      <SiteFields {...section} />
      <DurationField {...section} />
      <PayField {...section} />
      <Disclosure title="Más opciones" plain>
        <SitePin
          pinned={form.site !== null}
          detail={form.site ? accuracyLabel(form.site) : undefined}
          onFix={pinSite}
          onClear={() => pinSite(null)}
        />
        <TermsFields {...section} />
      </Disclosure>
      {form.failure ? (
        <Notice tone="alert" urgent>
          {form.failure}
        </Notice>
      ) : null}
      <Button type="submit" block disabled={form.sending}>
        {form.sending ? "Buscando personas…" : "Buscar personas"}
      </Button>
    </form>
  );
}
