"use client";

import { useState } from "react";

import {
  describeWorkArea,
  hasMunicipalityList,
  municipalitiesOf,
  type Place,
  STATE_NAMES,
  WORK_SCOPE_LABELS,
  WORK_SCOPES,
  type WorkArea,
} from "@/lib/venezuela";

import { Button } from "./button";
import { ChoiceChips, chipClass, toggled } from "./choice-chips";
import { SelectField, TextField } from "./field";

/**
 * Zona de trabajo: todo el país, unos estados o unos municipios. Al elegir
 * estados o municipios se abre un panel para escogerlos; "Listo" lo cierra y
 * deja el resumen a la vista.
 */

type Scope = WorkArea["scope"];
type Municipal = Required<Place>;

interface WorkAreaPickerProps {
  readonly id: string;
  readonly legend: string;
  readonly value: WorkArea | null;
  readonly onChange: (area: WorkArea | null) => void;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
}

const SCOPE_CHOICES = WORK_SCOPES.map((scope) => ({ value: scope, label: WORK_SCOPE_LABELS[scope] }));

const statesOf = (area: WorkArea | null) => (area?.scope === "estadal" ? area.states : []);
const placesOf = (area: WorkArea | null) => (area?.scope === "municipal" ? area.places : []);

function emptyArea(scope: Scope): WorkArea | null {
  return scope === "nacional" ? { scope } : null;
}

function StatesPanel({ states, onChange }: { states: readonly string[]; onChange: (s: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATE_NAMES.map((state) => (
        <button
          key={state}
          type="button"
          aria-pressed={states.includes(state)}
          onClick={() => onChange(toggled(states, state))}
          className={chipClass(states.includes(state))}
        >
          {state}
        </button>
      ))}
    </div>
  );
}

const placeKey = (place: Municipal) => `${place.municipality}, ${place.state}`;

function togglePlace(places: readonly Municipal[], place: Municipal): Municipal[] {
  const key = placeKey(place);
  return places.some((item) => placeKey(item) === key)
    ? places.filter((item) => placeKey(item) !== key)
    : [...places, place];
}

/** Para los estados sin lista de municipios: se escribe el nombre. */
function WrittenMunicipality({ id, onAdd }: { readonly id: string; readonly onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  const add = () => {
    if (name.trim().length < 2) return;
    onAdd(name.trim());
    setName("");
  };
  return (
    <div className="flex items-end gap-2">
      <TextField
        id={`${id}-municipio`}
        label="Escribe el municipio"
        placeholder="Ej: Maracaibo"
        value={name}
        maxLength={60}
        wrapperClassName="flex-1"
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
        }}
      />
      <Button type="button" variant="outline" onClick={add}>
        Agregar
      </Button>
    </div>
  );
}

interface MunicipalitiesProps {
  readonly id: string;
  readonly places: readonly Municipal[];
  readonly onChange: (places: Municipal[]) => void;
}

function MunicipalitiesPanel({ id, places, onChange }: MunicipalitiesProps) {
  const [state, setState] = useState(places[0]?.state ?? "Carabobo");
  const pick = (municipality: string) => onChange(togglePlace(places, { state, municipality }));
  const chosen = (municipality: string) =>
    places.some((place) => place.state === state && place.municipality === municipality);
  return (
    <div className="flex flex-col gap-3">
      <SelectField
        id={`${id}-estado`}
        label="Estado"
        value={state}
        onChange={(event) => setState(event.target.value)}
      >
        {STATE_NAMES.map((name) => (
          <option key={name}>{name}</option>
        ))}
      </SelectField>
      {hasMunicipalityList(state) ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label={`Municipios de ${state}`}>
          {municipalitiesOf(state).map((municipality) => (
            <button
              key={municipality}
              type="button"
              aria-pressed={chosen(municipality)}
              onClick={() => pick(municipality)}
              className={chipClass(chosen(municipality))}
            >
              {municipality}
            </button>
          ))}
        </div>
      ) : (
        <WrittenMunicipality id={id} onAdd={pick} />
      )}
      <ChosenPlaces places={places} onRemove={(place) => onChange(togglePlace(places, place))} />
    </div>
  );
}

function ChosenPlaces({
  places,
  onRemove,
}: {
  places: readonly Municipal[];
  onRemove: (p: Municipal) => void;
}) {
  if (places.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Municipios elegidos">
      {places.map((place) => (
        <li key={placeKey(place)}>
          <button
            type="button"
            onClick={() => onRemove(place)}
            className="min-h-10 rounded-full bg-brand-tint px-3 text-sm font-semibold text-brand"
            aria-label={`Quitar ${placeKey(place)}`}
          >
            {placeKey(place)} ✕
          </button>
        </li>
      ))}
    </ul>
  );
}

interface PanelProps {
  readonly id: string;
  readonly scope: Scope;
  readonly value: WorkArea | null;
  readonly onChange: (area: WorkArea | null) => void;
  readonly onDone: () => void;
}

function AreaPanel({ id, scope, value, onChange, onDone }: PanelProps) {
  const title = scope === "estadal" ? "Elige los estados" : "Elige los municipios";
  return (
    <section
      aria-label={title}
      className="flex animate-enter flex-col gap-3 rounded-card border-[1.5px] border-brand bg-brand-tint/40 p-3"
    >
      <p className="font-bold text-ink">{title}</p>
      {scope === "estadal" ? (
        <StatesPanel
          states={statesOf(value)}
          onChange={(states) => onChange(states.length > 0 ? { scope: "estadal", states } : null)}
        />
      ) : (
        <MunicipalitiesPanel
          id={id}
          places={placesOf(value)}
          onChange={(places) => onChange(places.length > 0 ? { scope: "municipal", places } : null)}
        />
      )}
      <Button type="button" onClick={onDone} disabled={value === null} className="self-start">
        Listo
      </Button>
    </section>
  );
}

export function WorkAreaPicker({ id, legend, value, onChange, hint, error }: WorkAreaPickerProps) {
  const [scope, setScope] = useState<Scope | null>(value?.scope ?? null);
  const [open, setOpen] = useState(false);
  const choose = (next: Scope) => {
    setScope(next);
    setOpen(next !== "nacional");
    if (next !== value?.scope) onChange(emptyArea(next));
  };
  return (
    <ChoiceChips
      id={id}
      legend={legend}
      options={SCOPE_CHOICES}
      selected={scope ? [scope] : []}
      onToggle={choose}
      hint={hint}
      error={error}
    >
      {scope && scope !== "nacional" && open ? (
        <AreaPanel id={id} scope={scope} value={value} onChange={onChange} onDone={() => setOpen(false)} />
      ) : null}
      {scope && scope !== "nacional" && !open && value ? (
        <p className="flex flex-wrap items-center gap-2 text-ink-2">
          <span className="font-semibold">{describeWorkArea(value)}</span>
          <button type="button" className="font-semibold text-brand underline" onClick={() => setOpen(true)}>
            Cambiar
          </button>
        </p>
      ) : null}
    </ChoiceChips>
  );
}

interface PlacePickerProps {
  readonly id: string;
  readonly value: Place;
  readonly onChange: (place: Place) => void;
  readonly error?: string | undefined;
}

/** Un solo lugar (la obra): estado y municipio. */
export function PlacePicker({ id, value, onChange, error }: PlacePickerProps) {
  const listed = hasMunicipalityList(value.state);
  return (
    <div className="grid grid-cols-2 gap-3">
      <SelectField
        id={`${id}-estado`}
        label="Estado de la obra"
        value={value.state}
        onChange={(event) => onChange({ state: event.target.value })}
      >
        {STATE_NAMES.map((name) => (
          <option key={name}>{name}</option>
        ))}
      </SelectField>
      {listed ? (
        <SelectField
          id={`${id}-municipio`}
          label="Municipio"
          value={value.municipality ?? ""}
          error={error}
          onChange={(event) => onChange({ state: value.state, municipality: event.target.value })}
        >
          <option value="" disabled>
            Elige
          </option>
          {municipalitiesOf(value.state).map((name) => (
            <option key={name}>{name}</option>
          ))}
        </SelectField>
      ) : (
        <TextField
          id={`${id}-municipio`}
          label="Municipio"
          placeholder="Ej: Maracaibo"
          maxLength={60}
          value={value.municipality ?? ""}
          error={error}
          onChange={(event) => onChange({ state: value.state, municipality: event.target.value })}
        />
      )}
    </div>
  );
}
