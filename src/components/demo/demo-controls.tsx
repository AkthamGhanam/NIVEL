"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";

import type { RealProfilesToday } from "@/client/team-api";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { QrCode } from "@/components/ui/qr-code";
import { Switch } from "@/components/ui/switch";
import { plural } from "@/lib/format";

interface ResetControlProps {
  readonly onReset: () => void;
  readonly pending: boolean;
}

/** Reiniciar la demo borra lo hecho: pide confirmar en un segundo paso. */
export function ResetControl({ onReset, pending }: ResetControlProps) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button variant="outline" disabled={pending} onClick={() => setConfirming(true)}>
        Reiniciar demo
      </Button>
    );
  }
  return (
    <div role="group" aria-label="Confirmar reinicio" className="flex flex-wrap items-center gap-2">
      <p className="text-sm font-semibold text-ink-2">
        Se borra lo hecho en la demo. Los perfiles reales se conservan.
      </p>
      <Button
        variant="danger"
        disabled={pending}
        onClick={() => {
          setConfirming(false);
          onReset();
        }}
      >
        Sí, reiniciar
      </Button>
      <Button variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
        Cancelar
      </Button>
    </div>
  );
}

export interface DemoControlsProps extends ResetControlProps {
  readonly bot: boolean;
  readonly onBot: (on: boolean) => void;
  readonly onFastForward: () => void;
  /** Plan B: la voz del contratista sigue el guion, sin depender del agente en vivo. */
  readonly planB: boolean;
  readonly onPlanB: (on: boolean) => void;
  /** Resultado de la última acción, en palabras. */
  readonly notice: string | null;
  readonly error: string | null;
}

interface SwitchTextProps {
  /** Prefijo de los ids que nombran y describen el interruptor de al lado. */
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}

function SwitchText({ id, title, children }: SwitchTextProps) {
  return (
    <div>
      <p id={`${id}-titulo`} className="font-extrabold">
        {title}
      </p>
      <p id={`${id}-ayuda`} className="text-sm text-muted">
        {children}
      </p>
    </div>
  );
}

/** Controles del presentador: avanzar la obra, reiniciar y el bot que responde por tres personas. */
export function DemoControls(props: DemoControlsProps) {
  const { bot, onBot, planB, onPlanB, onFastForward, onReset, pending, notice, error } = props;
  return (
    <section aria-label="Controles de la demo" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button disabled={pending} onClick={onFastForward}>
          Avanzar a fin de obra
        </Button>
        <ResetControl onReset={onReset} pending={pending} />
        <div className="flex items-center gap-3">
          <Switch
            checked={bot}
            onChange={onBot}
            labelledBy="bot-titulo"
            describedBy="bot-ayuda"
            disabled={pending}
          />
          <SwitchText id="bot" title="Bot de demo">
            {bot ? "Rafael, José y Luis responden solos" : "Apagado: nadie responde solo"}
          </SwitchText>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={planB} onChange={onPlanB} labelledBy="planb-titulo" describedBy="planb-ayuda" />
          <SwitchText id="planb" title="Plan B de voz">
            {planB ? "Nivi sigue el guion, sin el agente en vivo" : "Apagado: Nivi conversa en vivo"}
          </SwitchText>
        </div>
        <Link
          href="/demo/check"
          className="inline-flex min-h-12 items-center font-semibold text-brand underline decoration-2"
        >
          Chequeo previo
        </Link>
      </div>
      {error ? (
        <Notice tone="alert" urgent>
          {error}
        </Notice>
      ) : null}
      {notice && !error ? <p role="status">{notice}</p> : null}
    </section>
  );
}

/** Nombres que se listan bajo la cifra: con más, la lista le quitaría el lugar a la bitácora. */
const PROFILES_SHOWN = 4;

/** Cuántas personas reales se registraron hoy. Solo nombre de pila, oficio y zona. */
export function RealProfiles({ data }: { readonly data: RealProfilesToday | undefined }) {
  return (
    <section aria-labelledby="reales-titulo" className="flex flex-col gap-1">
      <h2 id="reales-titulo" className="text-sm font-bold text-ink-2">
        Perfiles reales creados hoy
      </h2>
      <p className="display text-4xl">{data ? data.count : "…"}</p>
      {data && data.count > 0 ? (
        <ul className="text-sm text-ink-2">
          {data.profiles.slice(0, PROFILES_SHOWN).map((profile, index) => (
            <li key={`${profile.firstName}-${index}`}>
              {profile.firstName} · {profile.trade} · {profile.zone}
            </li>
          ))}
          {data.count > PROFILES_SHOWN ? <li>y {data.count - PROFILES_SHOWN} más</li> : null}
        </ul>
      ) : null}
      {data?.count === 0 ? (
        <p className="text-sm text-muted">{plural(0, "persona real", "personas reales")} por ahora.</p>
      ) : null}
    </section>
  );
}

/** QR para que el público cree su perfil con Nivi en su teléfono. Sin enlace público, lo dice. */
export function JoinCode({ joinUrl }: { readonly joinUrl: string | null }) {
  return (
    <section aria-labelledby="qr-titulo" className="flex flex-col gap-2">
      <h2 id="qr-titulo" className="text-sm font-bold text-ink-2">
        Regístrate con tu voz
      </h2>
      {joinUrl ? (
        <>
          <QrCode
            value={joinUrl}
            label="Código QR para registrarte en la app del trabajador"
            className="size-28"
          />
          <p className="text-sm break-all text-muted">{joinUrl}</p>
        </>
      ) : (
        <p className="text-sm text-muted">
          El QR aparece cuando la demo está publicada con su dirección (`NEXT_PUBLIC_APP_URL`).
        </p>
      )}
    </section>
  );
}
