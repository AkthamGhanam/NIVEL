"use client";

import { type ComponentProps, type FormEvent, type ReactNode, useState } from "react";

import { errorMessage } from "@/client/api";
import { createLiveStore } from "@/client/live-store";
import {
  parseProfileDraft,
  PROFILE_LIMITS,
  profileDraft,
  type EditableProfile,
  type ProfileDraft,
  type ProfileProblems,
} from "@/client/profile-draft";
import type { AccountDeletion, ConsentKind, MyData, MyProfile, ProfileCorrection } from "@/client/worker-api";
import { CONSENT_OPTIONS, receivedRatingLines } from "@/client/worker-view";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { LoadingText, Notice } from "@/components/ui/notice";
import { Switch } from "@/components/ui/switch";
import { LevelBadge, Tag } from "@/components/ui/tag";
import { formatDateTime } from "@/lib/format";

import { useAction } from "../hooks/use-action";
import { useLive } from "../hooks/use-live";
import { useWorker } from "./worker-gate";

/** Lo que NIVEL sabe de la persona, a la vista. */
export function ProfileSummary({ profile }: { readonly profile: MyProfile }) {
  return (
    <Card className="flex flex-col gap-2">
      <LevelBadge level={profile.level.level} />
      <p className="text-xl font-extrabold">{profile.name}</p>
      <p className="text-ink-2">
        {profile.tradeLabel} · {profile.zone}
      </p>
      {profile.skills.length > 0 ? (
        <ul aria-label="Habilidades" className="flex flex-wrap gap-2">
          {profile.skills.map((skill) => (
            <li key={skill}>
              <Tag>{skill}</Tag>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

type FieldSpec = { readonly field: keyof ProfileDraft; readonly id: string; readonly label: string } & Pick<
  ComponentProps<typeof TextField>,
  "hint" | "autoComplete" | "inputMode" | "maxLength"
>;

const PROFILE_FIELDS: readonly FieldSpec[] = [
  {
    field: "name",
    id: "dato-nombre",
    label: "Nombre y apellido",
    autoComplete: "name",
    maxLength: PROFILE_LIMITS.text,
  },
  { field: "zone", id: "dato-zona", label: "Municipio o sector", maxLength: PROFILE_LIMITS.text },
  {
    field: "availability",
    id: "dato-disponibilidad",
    label: "Cuándo puedes trabajar",
    maxLength: PROFILE_LIMITS.text,
  },
  { field: "yearsExp", id: "dato-experiencia", label: "Años de experiencia", inputMode: "numeric" },
  {
    field: "skills",
    id: "dato-habilidades",
    label: "Habilidades",
    hint: "Sepáralas con comas. Por ejemplo: soldadura MIG, lectura de planos.",
  },
];

interface ProfileFormProps {
  readonly profile: MyProfile;
  /** Guarda y devuelve el perfil como quedó en el servidor (por ejemplo, con la zona ya normalizada). */
  readonly onSave: (changes: ProfileCorrection) => Promise<EditableProfile>;
}

/** Corregir mis datos. El oficio y el nivel no se editan aquí: salen de hechos verificables. */
export function ProfileForm({ profile, onSave }: ProfileFormProps) {
  const [draft, setDraft] = useState<ProfileDraft>(() => profileDraft(profile));
  const [problems, setProblems] = useState<ProfileProblems>({});
  const [saved, setSaved] = useState(false);
  const save = useAction(async (changes: ProfileCorrection) => {
    setDraft(profileDraft(await onSave(changes)));
    setSaved(true);
  });
  const set = (field: keyof ProfileDraft) => (event: { target: { value: string } }) => {
    setSaved(false);
    setDraft({ ...draft, [field]: event.target.value });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseProfileDraft(draft, profile);
    setProblems(parsed.ok ? {} : parsed.problems);
    if (parsed.ok) void save.invoke(parsed.changes);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      {PROFILE_FIELDS.map(({ field, id, ...input }) => (
        <TextField
          key={field}
          id={id}
          {...input}
          value={draft[field]}
          error={problems[field]}
          onChange={set(field)}
        />
      ))}
      {save.error ? (
        <Notice tone="alert" urgent>
          {save.error}
        </Notice>
      ) : null}
      {saved ? <p role="status">Guardamos tus cambios.</p> : null}
      <Button type="submit" variant="outline" block disabled={save.pending}>
        {save.pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}

interface ConsentListProps {
  readonly consents: MyProfile["consents"];
  readonly onChange: (kind: ConsentKind, granted: boolean) => void;
  readonly pending: boolean;
}

/** Un interruptor por permiso. Se conceden y se retiran por separado, en cualquier momento. */
export function ConsentList({ consents, onChange, pending }: ConsentListProps) {
  return (
    <ul className="flex flex-col gap-3">
      {CONSENT_OPTIONS.map(({ kind, label, hint }) => (
        <li key={kind}>
          <Card className="flex items-center justify-between gap-3">
            <div>
              <p id={`permiso-${kind}`} className="font-extrabold">
                {label}
              </p>
              <p id={`permiso-${kind}-ayuda`} className="text-sm text-muted">
                {hint}
              </p>
            </div>
            <Switch
              checked={consents[kind] !== null}
              onChange={(granted) => onChange(kind, granted)}
              labelledBy={`permiso-${kind}`}
              describedBy={`permiso-${kind}-ayuda`}
              disabled={pending}
            />
          </Card>
        </li>
      ))}
    </ul>
  );
}

/** Calificaciones privadas que las empresas le dieron a la persona. Solo ella las ve. */
export function ReceivedRatings({ ratings }: { readonly ratings: MyData["ratingsReceived"] }) {
  if (ratings.length === 0) {
    return <p className="text-muted">Aún no tienes calificaciones. Aparecen aquí al terminar un trabajo.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {ratings.map((rating) => (
        <li key={`${rating.company}-${rating.date}`}>
          <Card className="flex flex-col gap-2">
            <Eyebrow>
              {rating.company} · {formatDateTime(rating.date)}
            </Eyebrow>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
              {receivedRatingLines(rating).map((line) => (
                <div key={line.label}>
                  <dt className="text-sm text-muted">{line.label}</dt>
                  <dd className="font-bold">{line.score}</dd>
                </div>
              ))}
            </dl>
            {rating.tags.length > 0 ? (
              <ul aria-label="Lo que destacó la empresa" className="flex flex-wrap gap-2">
                {rating.tags.map((tag) => (
                  <li key={tag}>
                    <Tag tone="ok">{tag}</Tag>
                  </li>
                ))}
              </ul>
            ) : null}
            {rating.comment ? <p className="text-ink-2">{rating.comment}</p> : null}
          </Card>
        </li>
      ))}
    </ul>
  );
}

interface DeleteAccountProps {
  readonly onDelete: () => Promise<void>;
}

/** Borrar la cuenta pide confirmar en un segundo paso: no se puede deshacer. */
export function DeleteAccount({ onDelete }: DeleteAccountProps) {
  const [confirming, setConfirming] = useState(false);
  const remove = useAction(onDelete);
  if (!confirming) {
    return (
      <Button variant="danger" block onClick={() => setConfirming(true)}>
        Borrar mi cuenta
      </Button>
    );
  }
  return (
    <Notice tone="alert" title="¿Borrar tu cuenta?">
      <p>
        Se borran tu perfil, tus cursos, tus constancias y tus calificaciones. No se puede deshacer. Si ya
        trabajaste con contrato, tu nombre queda solo en los recibos de pago, que la empresa debe conservar
        por ley.
      </p>
      {remove.error ? (
        <p role="alert" className="mt-2 font-bold text-danger">
          {remove.error}
        </p>
      ) : null}
      <div className="mt-3 flex flex-col gap-2">
        <Button variant="danger" block disabled={remove.pending} onClick={() => void remove.invoke()}>
          {remove.pending ? "Borrando…" : "Sí, borrar mi cuenta"}
        </Button>
        <Button variant="outline" block disabled={remove.pending} onClick={() => setConfirming(false)}>
          No, conservarla
        </Button>
      </div>
    </Notice>
  );
}

/** Despedida tras borrar la cuenta: dice qué se borró y qué se conserva por ley. */
export function AccountDeleted({
  deletion,
  onDone,
}: {
  readonly deletion: AccountDeletion;
  readonly onDone: () => void;
}) {
  return (
    <>
      <h1 className="display text-3xl">Cuenta borrada</h1>
      <Notice urgent>{deletion.message}</Notice>
      <Button block onClick={onDone}>
        Entendido
      </Button>
    </>
  );
}

function Section({
  id,
  title,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="bar-title text-xl font-extrabold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Mis datos (regla legal 8.12): ver, corregir, descargar y borrar; y cada permiso por separado. */
export function MyDataScreen() {
  const { api, profile: profileStore, refreshSession } = useWorker();
  const [dataStore] = useState(() => createLiveStore((signal) => api.myData(signal)));
  const profile = useLive(profileStore);
  const data = useLive(dataStore);
  const [deletion, setDeletion] = useState<AccountDeletion>();
  const correct = async (changes: ProfileCorrection) => {
    const updated = await api.correctProfile(changes);
    await profileStore.refresh();
    return updated;
  };
  const consent = useAction(async (kind: ConsentKind, granted: boolean) => {
    await api.setConsent(kind, granted);
    await profileStore.refresh();
  });

  if (deletion) return <AccountDeleted deletion={deletion} onDone={() => void refreshSession()} />;
  if (profile.loading) return <LoadingText>Nivi está buscando tus datos…</LoadingText>;
  if (!profile.data) return <Notice tone="alert">{errorMessage(profile.error)}</Notice>;
  return (
    <>
      <h1 className="display text-3xl">Mis datos</h1>
      <ProfileSummary profile={profile.data} />
      <Section id="datos-corregir" title="Corregir mis datos">
        <ProfileForm profile={profile.data} onSave={correct} />
      </Section>
      <Section id="datos-permisos" title="Mis permisos">
        {consent.error ? <Notice tone="alert">{consent.error}</Notice> : null}
        <ConsentList
          consents={profile.data.consents}
          onChange={(kind, granted) => void consent.invoke(kind, granted)}
          pending={consent.pending}
        />
      </Section>
      <Section id="datos-calificaciones" title="Mis calificaciones privadas">
        <p className="text-sm text-muted">Solo tú las ves. Las empresas no ven las de otras empresas.</p>
        {data.loading ? <LoadingText>Buscando tus calificaciones…</LoadingText> : null}
        {data.data ? <ReceivedRatings ratings={data.data.ratingsReceived} /> : null}
        {!data.loading && !data.data ? <Notice tone="pending">{errorMessage(data.error)}</Notice> : null}
      </Section>
      <Section id="datos-descargar" title="Descargar o borrar">
        <a
          href="/api/me/data"
          download="mis-datos-nivel.json"
          className={buttonClass({ variant: "outline", block: true })}
        >
          Descargar mis datos
        </a>
        <DeleteAccount onDelete={async () => setDeletion(await api.deleteAccount())} />
      </Section>
    </>
  );
}
