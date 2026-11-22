"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { cx } from "@/lib/cx";
import { RATING_CATEGORIES, RATING_TAGS, type RatingCategory, type RatingRole } from "@/lib/rating-tags";

import { useAction } from "../hooks/use-action";

const SCORES = [1, 2, 3, 4, 5] as const;
const MAX_COMMENT = 500;

type Scores = Partial<Record<RatingCategory, number>>;

/** Opción con forma de botón: el control real es un radio o una casilla, accesible por teclado. */
const OPTION =
  "flex min-h-12 cursor-pointer items-center justify-center rounded-control border-[1.5px] border-line bg-surface " +
  "px-3 font-bold has-checked:border-brand has-checked:bg-brand has-checked:text-white " +
  "has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-2";

interface ScoreGroupProps {
  readonly name: string;
  readonly legend: string;
  readonly value: number | undefined;
  readonly onChange: (score: number) => void;
}

/** Una categoría del 1 al 5, con números y no con estrellas. */
function ScoreGroup({ name, legend, value, onChange }: ScoreGroupProps) {
  return (
    <fieldset>
      <legend className="text-sm font-bold text-ink-2">{legend}</legend>
      <div className="mt-1 grid grid-cols-5 gap-2">
        {SCORES.map((score) => (
          <label key={score} className={OPTION}>
            <input
              type="radio"
              name={name}
              value={score}
              checked={value === score}
              onChange={() => onChange(score)}
              className="sr-only"
            />
            {score}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface TagGroupProps {
  readonly name: string;
  readonly options: readonly string[];
  readonly selected: readonly string[];
  readonly onToggle: (tag: string) => void;
}

function TagGroup({ name, options, selected, onToggle }: TagGroupProps) {
  return (
    <fieldset>
      <legend className="text-sm font-bold text-ink-2">Lo que más destacó (opcional)</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((tag) => (
          <label key={tag} className={cx(OPTION, "font-semibold")}>
            <input
              type="checkbox"
              name={name}
              value={tag}
              checked={selected.includes(tag)}
              onChange={() => onToggle(tag)}
              className="sr-only"
            />
            {tag}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Problem({ message }: { readonly message: string | null }) {
  if (!message) return null;
  return (
    <Notice tone="alert" urgent>
      {message}
    </Notice>
  );
}

export interface RatingValues {
  readonly contractId: string;
  readonly quality: number;
  readonly punctuality: number;
  readonly safety: number;
  readonly attitude: number;
  readonly tags: readonly string[];
  readonly comment?: string;
}

interface RatingFormProps {
  /** Quién califica: decide los nombres de las categorías y las etiquetas disponibles. */
  readonly role: RatingRole;
  readonly contractId: string;
  /** A quién se califica, para los textos de ayuda y los lectores de pantalla. */
  readonly subject: string;
  /** Texto fijo de la revisión legal que acompaña al formulario (regla 8.3). */
  readonly notice: string;
  readonly onSubmit: (input: RatingValues) => Promise<void>;
}

const KEYS = ["quality", "punctuality", "safety", "attitude"] as const satisfies readonly RatingCategory[];
const isComplete = (scores: Scores): scores is Record<RatingCategory, number> =>
  KEYS.every((key) => scores[key] !== undefined);

/** Calificación privada y doble ciega, por categorías del 1 al 5 y etiquetas cerradas. */
export function RatingForm({ role, contractId, subject, notice, onSubmit }: RatingFormProps) {
  const [scores, setScores] = useState<Scores>({});
  const [tags, setTags] = useState<readonly string[]>([]);
  const [comment, setComment] = useState("");
  const [incomplete, setIncomplete] = useState(false);
  const send = useAction(onSubmit);
  const id = `calificar-${contractId}`;

  const toggle = (tag: string) =>
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!isComplete(scores)) {
      setIncomplete(true);
      return;
    }
    setIncomplete(false);
    const text = comment.trim();
    void send.invoke({ contractId, ...scores, tags, ...(text ? { comment: text } : {}) });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-muted">Del 1 al 5: 1 es bajo y 5 es excelente.</p>
      {RATING_CATEGORIES[role].map((category) => (
        <ScoreGroup
          key={category.key}
          name={`${id}-${category.key}`}
          legend={category.label}
          value={scores[category.key]}
          onChange={(score) => setScores((current) => ({ ...current, [category.key]: score }))}
        />
      ))}
      <TagGroup name={`${id}-etiquetas`} options={RATING_TAGS[role]} selected={tags} onToggle={toggle} />
      <TextAreaField
        id={`${id}-comentario`}
        label="Comentario (opcional)"
        hint={`${subject} lo verá junto con tu calificación.`}
        rows={2}
        maxLength={MAX_COMMENT}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
      />
      <Problem message={incomplete ? "Elige un número en cada categoría." : send.error} />
      <p className="text-sm font-semibold text-muted">{notice}</p>
      <Button type="submit" className="self-start" disabled={send.pending}>
        {send.pending ? "Enviando…" : "Enviar calificación"}
        <span className="sr-only"> de {subject}</span>
      </Button>
    </form>
  );
}
