"use client";

import { type FormEvent, useState } from "react";

import { REPORT_KIND_LABELS, REPORT_KINDS, type ReportKind } from "@/client/report-kinds";
import type { ReportInput } from "@/client/worker-api";
import { Button, ButtonLink } from "@/components/ui/button";
import { SelectField, TextAreaField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { HUMAN_REVIEW_NOTICE } from "@/lib/legal-copy";

import { useAction } from "../hooks/use-action";
import { useWorker } from "./worker-gate";

const MAX_TEXT = 2000;

export interface ReportReceipt {
  readonly message: string;
  /** Orientación extra según el tipo (por ejemplo, cómo acudir al INPSASEL). */
  readonly guidance: string | null;
}

/** Confirmación de un reporte: lo revisa una persona, y nada cambia de forma automática. */
export function ReportConfirmation({ receipt }: { readonly receipt: ReportReceipt }) {
  return (
    <>
      <Notice title="Reporte recibido">
        <p>{receipt.message}</p>
        <p className="mt-1">{HUMAN_REVIEW_NOTICE}</p>
      </Notice>
      {receipt.guidance ? (
        <Notice tone="pending" title="También puedes acudir a la autoridad">
          {receipt.guidance}
        </Notice>
      ) : null}
      <ButtonLink href="/trabajador" variant="outline" block>
        Volver al inicio
      </ButtonLink>
    </>
  );
}

interface ReportFormProps {
  readonly initialKind: ReportKind;
  readonly onSubmit: (input: ReportInput) => Promise<void>;
}

export function ReportForm({ initialKind, onSubmit }: ReportFormProps) {
  const [kind, setKind] = useState<ReportKind>(initialKind);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string>();
  const send = useAction(onSubmit);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = text.trim();
    if (clean === "") {
      setProblem("Cuéntanos qué pasó.");
      return;
    }
    setProblem(undefined);
    void send.invoke({ kind, text: clean });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <SelectField
        id="reporte-tipo"
        label="¿Qué pasó?"
        value={kind}
        onChange={(event) => setKind(event.target.value as ReportKind)}
      >
        {REPORT_KINDS.map((option) => (
          <option key={option} value={option}>
            {REPORT_KIND_LABELS[option]}
          </option>
        ))}
      </SelectField>
      <TextAreaField
        id="reporte-texto"
        label="Cuéntanos con tus palabras"
        rows={5}
        maxLength={MAX_TEXT}
        value={text}
        error={problem}
        onChange={(event) => setText(event.target.value)}
      />
      {send.error ? (
        <Notice tone="alert" urgent>
          {send.error}
        </Notice>
      ) : null}
      <p className="text-sm text-muted">{HUMAN_REVIEW_NOTICE}</p>
      <Button type="submit" block disabled={send.pending}>
        {send.pending ? "Enviando…" : "Enviar reporte"}
      </Button>
    </form>
  );
}

/** Ayuda: reporte confidencial que siempre va a revisión humana. */
export function HelpScreen({ initialKind }: { readonly initialKind: ReportKind }) {
  const { api } = useWorker();
  const [receipt, setReceipt] = useState<ReportReceipt>();
  return (
    <>
      <h1 className="display text-3xl">Ayuda</h1>
      {receipt ? (
        <ReportConfirmation receipt={receipt} />
      ) : (
        <ReportForm
          initialKind={initialKind}
          onSubmit={async (input) => setReceipt(await api.report(input))}
        />
      )}
    </>
  );
}
