/**
 * Solo se reproduce audio servido por la propia app: nunca una dirección
 * externa que venga guardada en un dato o en una respuesta.
 */
export const sameSiteAudio = (url: string | null | undefined): string | null =>
  typeof url === "string" && /^\/(?![/\\])/.test(url) ? url : null;
