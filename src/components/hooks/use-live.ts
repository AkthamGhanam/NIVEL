"use client";

import { useSyncExternalStore } from "react";

import type { LiveState, LiveStore } from "@/client/live-store";

/** Conecta un dato en vivo con React: la pantalla se repinta cuando cambia. */
export function useLive<T>(store: LiveStore<T>): LiveState<T> {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
