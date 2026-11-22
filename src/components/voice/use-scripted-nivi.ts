// Plan B: la conversación guionizada con la misma forma que la de verdad, para pintarla con el mismo panel.
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import type { ScriptedNivi } from "@/client/scripted-nivi";

import type { Nivi } from "./use-nivi";

export function useScriptedNivi(create: () => ScriptedNivi): Nivi {
  const [conversation] = useState(create);
  const state = useSyncExternalStore(conversation.subscribe, conversation.getState, conversation.getState);
  useEffect(() => conversation.stop, [conversation]);
  return {
    muted: false,
    toggleMute: () => undefined,
    voice: false,
    start: async (mode) => conversation.start(mode),
    send: conversation.send,
    stop: conversation.stop,
    mode: state.mode,
    live: state.live,
    connected: state.live,
    orb: state.activity,
    starting: false,
    problem: null,
    bubbles: [...state.bubbles],
    conversationId: null,
    ended: state.ended,
  };
}
