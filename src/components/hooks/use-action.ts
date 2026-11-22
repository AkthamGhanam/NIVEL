"use client";

import { useState } from "react";

import { errorMessage } from "@/client/api";

export interface ActionState {
  readonly pending: boolean;
  /** Mensaje para mostrar si la última vez falló. */
  readonly error: string | null;
}

/**
 * Envoltorio de una acción que habla con el servidor (invitar, pagar,
 * calificar): dice si está en curso, evita el doble clic y guarda el error
 * en palabras que se le pueden mostrar a la persona.
 */
export function useAction<Args extends readonly unknown[]>(
  run: (...args: Args) => Promise<void>,
): ActionState & { readonly invoke: (...args: Args) => Promise<boolean> } {
  const [state, setState] = useState<ActionState>({ pending: false, error: null });

  const invoke = async (...args: Args): Promise<boolean> => {
    if (state.pending) return false;
    setState({ pending: true, error: null });
    try {
      await run(...args);
      setState({ pending: false, error: null });
      return true;
    } catch (error) {
      setState({ pending: false, error: errorMessage(error) });
      return false;
    }
  };

  return { ...state, invoke };
}
