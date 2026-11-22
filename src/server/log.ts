type LogLevel = "info" | "warn" | "error";

type LogFields = Readonly<Record<string, string | number | boolean | null | undefined>>;

/**
 * Logs estructurados: una línea JSON por evento, con correlation ID.
 * Nunca recibe cuerpos de petición, cookies, claves ni datos personales.
 */
export function log(level: LogLevel, message: string, fields: LogFields = {}): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg: message, ...fields });
  if (level === "error") console.error(line);
  else console.warn(line);
}
