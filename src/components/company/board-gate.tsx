"use client";

import type { ReactNode } from "react";

import { errorMessage } from "@/client/api";
import type { RequestBoard } from "@/client/company-api";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingText, Notice } from "@/components/ui/notice";

import { useLive } from "../hooks/use-live";
import { useCompany } from "./company-gate";

/**
 * Las secciones de obra, pagos y calificación parten de la solicitud activa.
 * Este marco resuelve lo común: cargando, sin conexión y "aún no hay solicitud".
 */
interface BoardGateProps {
  readonly children: (board: RequestBoard) => ReactNode;
  /** Nivel del título de "aún no hay solicitud": `h2` si la pantalla ya tiene su propio `h1`. */
  readonly emptyTitleAs?: "h1" | "h2";
}

export function BoardGate({ children, emptyTitleAs: EmptyTitle = "h1" }: BoardGateProps) {
  const { board: store } = useCompany();
  const live = useLive(store);
  if (live.loading) {
    return <LoadingText>Nivi está revisando tu obra…</LoadingText>;
  }
  return (
    <div className="flex flex-col gap-4">
      {live.error === undefined ? null : <Notice tone="pending">{errorMessage(live.error)}</Notice>}
      {live.data ? children(live.data) : null}
      {!live.data && live.error === undefined ? (
        <Card className="mx-auto flex w-full max-w-2xl flex-col items-start gap-3 p-6">
          <EmptyTitle className="display text-3xl">Aún no has pedido personal</EmptyTitle>
          <p className="text-lg text-ink-2">
            Cuando armes tu cuadrilla, aquí verás la obra, los pagos y las calificaciones.
          </p>
          <ButtonLink href="/contratista">Pedir cuadrilla</ButtonLink>
        </Card>
      ) : null}
    </div>
  );
}
