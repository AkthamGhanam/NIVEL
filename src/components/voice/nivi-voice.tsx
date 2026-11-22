"use client";

import { useEffect, useEffectEvent, useState } from "react";

import { apiRequest } from "@/client/api";
import { connectElevenLabsAgent } from "@/client/elevenlabs-agent";
import { type NiviMode, rememberedMode, rememberMode, type VoiceAgent } from "@/client/nivi-session";
import { createVoiceApi, type TokenOptions } from "@/client/voice-api";

import { useNivi } from "../hooks/use-nivi";
import { NiviVoiceView } from "./nivi-voice-view";

interface NiviVoiceProps {
  readonly agent: VoiceAgent;
  /** Modo con el que abre la pantalla si la persona aún no eligió uno. */
  readonly defaultMode: NiviMode;
  readonly token?: TokenOptions;
  /**
   * Recordar en este teléfono el modo elegido. En el registro va apagado: allí
   * el modo es el que la persona acaba de escoger al aceptar.
   */
  readonly remember?: boolean;
  /** Avisa el id de la conversación apenas se abre (para recoger lo que guarden las herramientas). */
  readonly onConversation?: (conversationId: string) => void;
}

/** Hablar con Nivi: conecta la vista con el agente real y recuerda el modo elegido en este teléfono. */
export function NiviVoice({ agent, defaultMode, token, remember = true, onConversation }: NiviVoiceProps) {
  const [voice] = useState(() => createVoiceApi(apiRequest));
  const { state, session } = useNivi({
    fetchToken: () => voice.token(agent, token),
    connect: connectElevenLabsAgent,
    mode: defaultMode,
  });
  const announce = useEffectEvent((conversationId: string) => onConversation?.(conversationId));

  // El modo recordado se lee después de pintar: el servidor no conoce el almacenamiento del teléfono.
  useEffect(() => {
    if (remember) session.setMode(rememberedMode({ agent }, defaultMode));
  }, [session, agent, defaultMode, remember]);
  useEffect(() => {
    if (state.conversationId) announce(state.conversationId);
  }, [state.conversationId]);

  const setMode = (mode: NiviMode) => {
    if (remember) rememberMode({ agent }, mode);
    session.setMode(mode);
  };
  const { start, stop, hold, release, sendText } = session;
  return <NiviVoiceView state={state} actions={{ start, stop, hold, release, sendText, setMode }} />;
}
