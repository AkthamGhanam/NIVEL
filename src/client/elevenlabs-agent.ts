import type { ConnectAgent } from "./nivi-session";

/**
 * Conexión real con un agente de ElevenLabs desde el navegador (WebRTC). Es
 * la única pieza de la app que conoce el SDK de voz; el resto habla con la
 * interfaz `AgentSession`. El SDK se carga solo cuando alguien empieza a hablar.
 */

/**
 * Copias de los worklets del SDK servidas desde nuestro propio origen: así la
 * política de seguridad de contenido no tiene que permitir scripts `blob:`.
 * Una prueba comprueba que son idénticas a las del paquete instalado.
 */
export const WORKLET_PATHS = Object.freeze({
  rawAudioProcessor: "/elevenlabs/rawAudioProcessor.js",
  audioConcatProcessor: "/elevenlabs/audioConcatProcessor.js",
});

export const connectElevenLabsAgent: ConnectAgent = async ({
  token,
  dynamicVariables,
  textOnly,
  callbacks,
}) => {
  const { Conversation } = await import("@elevenlabs/client");
  const conversation = await Conversation.startSession({
    conversationToken: token,
    connectionType: "webrtc",
    dynamicVariables: { ...dynamicVariables },
    textOnly,
    workletPaths: { ...WORKLET_PATHS },
    onMessage: ({ message, role }) =>
      callbacks.onMessage({ from: role === "user" ? "persona" : "nivi", text: message }),
    onModeChange: ({ mode }) => callbacks.onSpeaking(mode === "speaking"),
    onDisconnect: (details) => callbacks.onEnd(details.reason === "error" ? details.message : undefined),
    // El detalle técnico va a la consola del navegador, nunca a la pantalla ni con lo que se dijo.
    onError: (message) => console.warn("nivi_voice_error", message),
  });
  return {
    conversationId: () => conversation.getId(),
    setMicMuted: (muted) => {
      if (!textOnly) conversation.setMicMuted(muted);
    },
    sendText: (text) => conversation.sendUserMessage(text),
    end: () => conversation.endSession(),
  };
};
