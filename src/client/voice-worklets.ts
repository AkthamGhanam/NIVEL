// Worklets de audio del SDK de voz servidos desde nuestro origen: la política de seguridad no admite scripts `blob:`.
export const WORKLET_PATHS = Object.freeze({
  rawAudioProcessor: "/elevenlabs/rawAudioProcessor.js",
  audioConcatProcessor: "/elevenlabs/audioConcatProcessor.js",
});
