/**
 * Entrar con cédula (o RIF) y contraseña, en la demo, sin base de datos: el
 * teléfono guarda solo una huella SHA-256 de "rol|documento|contraseña" junto
 * al id de la cuenta. Ni la cédula ni la contraseña quedan escritas.
 * En producción esto vive en el servidor con Argon2id.
 */

export type AccessRole = "worker" | "company";

export interface AccessKey {
  /** Cédula (V-12345678) o RIF (J-12345678-9). */
  readonly document: string;
  readonly password: string;
}

const STORAGE_KEY = "nivel.accesos";
export const MIN_PASSWORD = 6;

export const normalizeDocument = (text: string): string => text.toUpperCase().replace(/[\s.-]/g, "");

async function fingerprint(role: AccessRole, key: AccessKey): Promise<string> {
  const data = new TextEncoder().encode(`${role}|${normalizeDocument(key.document)}|${key.password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readAll(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Guarda la huella de acceso de una cuenta recién creada. Si el navegador no deja, se sigue sin ella. */
export async function rememberAccess(role: AccessRole, key: AccessKey, accountId: string): Promise<boolean> {
  try {
    const all = readAll();
    all[await fingerprint(role, key)] = accountId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

/** La cuenta que corresponde a ese documento y contraseña en este teléfono, o null. */
export async function findAccess(role: AccessRole, key: AccessKey): Promise<string | null> {
  try {
    return readAll()[await fingerprint(role, key)] ?? null;
  } catch {
    return null;
  }
}
