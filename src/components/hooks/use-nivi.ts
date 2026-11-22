"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { createNiviSession, type NiviDeps, type NiviSession, type NiviState } from "@/client/nivi-session";

/**
 * Una conversación con Nivi para la pantalla que la monta. Al salir de la
 * pantalla la conversación se cierra: no queda un micrófono abierto.
 */
export function useNivi(deps: NiviDeps): { readonly state: NiviState; readonly session: NiviSession } {
  // Las dependencias se toman una sola vez: la conversación vive lo que vive la pantalla.
  const [session] = useState(() => createNiviSession(deps));
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState);
  useEffect(() => () => void session.stop(), [session]);
  return { state, session };
}
