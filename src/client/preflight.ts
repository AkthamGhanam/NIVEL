import { type ApiRequest, errorMessage } from "./api";
import { SOUNDS } from "./level-up";
import { CONTRACTOR_OPENING } from "./plan-b";
import { playAudio } from "./speech-player";
import { testMicrophone } from "./voice-recorder";

/**
 * Chequeo previo de la demo (sección 12): antes de subir al escenario se
 * comprueba, desde la misma laptop, cada pieza de la que depende la demo. Cada
 * prueba usa las rutas reales; ninguna cambia los datos de la demo.
 */

export type CheckStatus = "pending" | "running" | "ok" | "fail";

export interface CheckOutcome {
  readonly ok: boolean;
  /** Qué se comprobó o qué falta, en palabras. */
  readonly detail: string;
}

export interface Check {
  readonly id: string;
  readonly label: string;
  /** El navegador solo deja probarla tras un toque (micrófono y sonido). */
  readonly manual: boolean;
  readonly run: () => Promise<CheckOutcome>;
}

export interface CheckState {
  readonly id: string;
  readonly label: string;
  readonly manual: boolean;
  readonly status: CheckStatus;
  readonly detail: string | null;
}

/** Efectos de sonido de la app (sección 7.6). */
export const SOUND_EFFECT_URLS: readonly string[] = Object.freeze(Object.values(SOUNDS));

/** Lista de audios pregenerados que publica `npm run audio:gen`. */
export const AUDIO_MANIFEST_URL = "/audio/manifest.json";
/** El audio con el que se prueba la salida de sonido: el resumen de privacidad, que ya viene pregenerado. */
export const SOUND_TEST_URL = "/audio/privacidad.mp3";

/** Del manifiesto solo se aceptan rutas de audio de la propia app. */
const isAudioPath = (url: string) => /^\/(audio|sfx)\/[\w./-]+\.mp3$/.test(url) && !url.includes("..");

export interface PreflightDeps {
  readonly request: ApiRequest;
  /** Verdadero si el archivo se puede descargar desde la app. */
  readonly fileExists: (url: string) => Promise<boolean>;
  /** Direcciones de los audios pregenerados, según el manifiesto. */
  readonly listAudio: () => Promise<readonly string[]>;
  /** Pide el micrófono y lo suelta. Falla con un mensaje para la persona si no hay permiso. */
  readonly openMicrophone: () => Promise<void>;
  /** Reproduce un audio hasta el final. Falso si no sonó. */
  readonly playSound: (url: string) => Promise<boolean>;
}

const AS_TEAM = { as: "admin" } as const;
const ok = (detail: string): CheckOutcome => ({ ok: true, detail });

async function missingFiles(urls: readonly string[], fileExists: PreflightDeps["fileExists"]) {
  const found = await Promise.all(urls.map((url) => fileExists(url).catch(() => false)));
  return urls.filter((_, index) => !found[index]);
}

async function filesOutcome(urls: readonly string[], deps: PreflightDeps): Promise<CheckOutcome> {
  if (urls.length === 0) return { ok: false, detail: "No hay ningún audio en la lista." };
  const missing = await missingFiles(urls, deps.fileExists);
  if (missing.length === 0) return ok(`${urls.length} de ${urls.length} archivos disponibles.`);
  return { ok: false, detail: `Faltan ${missing.length} de ${urls.length}: ${missing.join(", ")}` };
}

async function tokenOutcome(request: ApiRequest, query: string): Promise<CheckOutcome> {
  const { token } = await request<{ token: string }>(`/api/el/token?${query}`);
  return token ? ok("El agente entregó un token de conversación.") : { ok: false, detail: "Llegó vacío." };
}

const auto = (id: string, label: string, run: Check["run"]): Check => ({ id, label, manual: false, run });
const byHand = (id: string, label: string, run: Check["run"]): Check => ({ id, label, manual: true, run });

/** Servidor, base, los dos agentes y la voz: lo que depende de las claves del servidor. */
function serviceChecks(request: ApiRequest): readonly Check[] {
  return [
    auto("servidor", "Servidor y base de datos", async () => {
      const state = await request<{ personas: { workers: readonly unknown[] } }>("/api/state", AS_TEAM);
      return ok(`La base respondió con ${state.personas.workers.length} trabajadores de ejemplo.`);
    }),
    auto("agente-trabajador", "Agente de voz del trabajador", () =>
      tokenOutcome(request, "agent=worker&registro=1&consent=1"),
    ),
    auto("agente-empresa", "Agente de voz de la empresa", () => tokenOutcome(request, "agent=contractor")),
    auto("voz", "Voz de Nivi para frases", async () => {
      const options = { ...AS_TEAM, method: "POST", body: { text: CONTRACTOR_OPENING } } as const;
      const { cached } = await request<{ cached: boolean }>("/api/voice/tts", options);
      return ok(
        cached ? "El saludo de Nivi ya estaba guardado." : "Se generó y se guardó el saludo de Nivi.",
      );
    }),
  ];
}

/** Micrófono y cornetas de esta laptop: el navegador solo deja probarlos tras un toque. */
function deviceChecks(deps: PreflightDeps): readonly Check[] {
  return [
    byHand("microfono", "Micrófono", async () => {
      await deps.openMicrophone();
      return ok("El navegador dio permiso y el micrófono abrió.");
    }),
    byHand("salida", "Salida de audio", async () => {
      const sounded = await deps.playSound(SOUND_TEST_URL);
      return sounded
        ? ok("El audio se reprodujo completo. Confirma que se oyó por las cornetas.")
        : { ok: false, detail: "El navegador no pudo reproducir el audio de prueba." };
    }),
  ];
}

/** Las pruebas, en el orden en que se muestran. */
export function preflightChecks(deps: PreflightDeps): readonly Check[] {
  return [
    ...serviceChecks(deps.request),
    auto("audios", "Audios pregenerados", async () => filesOutcome(await deps.listAudio(), deps)),
    auto("sonidos", "Efectos de sonido", () => filesOutcome(SOUND_EFFECT_URLS, deps)),
    ...deviceChecks(deps),
  ];
}

export interface Preflight {
  readonly getState: () => readonly CheckState[];
  readonly subscribe: (listener: () => void) => () => void;
  /** Corre una prueba; si ya está corriendo, no la repite. */
  readonly run: (id: string) => Promise<void>;
  /** Corre a la vez todas las que no necesitan un toque. */
  readonly runAutomatic: () => Promise<void>;
}

export function createPreflight(checks: readonly Check[]): Preflight {
  let state: readonly CheckState[] = checks.map(({ id, label, manual }) => ({
    id,
    label,
    manual,
    status: "pending",
    detail: null,
  }));
  const listeners = new Set<() => void>();

  const update = (id: string, change: Pick<CheckState, "status" | "detail">) => {
    state = state.map((check) => (check.id === id ? { ...check, ...change } : check));
    listeners.forEach((listener) => listener());
  };

  const run = async (id: string) => {
    const check = checks.find((candidate) => candidate.id === id);
    if (!check || state.find((current) => current.id === id)?.status === "running") return;
    update(id, { status: "running", detail: null });
    try {
      const outcome = await check.run();
      update(id, { status: outcome.ok ? "ok" : "fail", detail: outcome.detail });
    } catch (error) {
      update(id, { status: "fail", detail: errorMessage(error) });
    }
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    run,
    runAutomatic: async () => {
      await Promise.all(checks.filter((check) => !check.manual).map((check) => run(check.id)));
    },
  };
}

/** Resumen de arriba: cuántas pasaron, cuántas fallaron y cuántas faltan por probar. */
export function preflightSummary(state: readonly CheckState[]): string {
  const count = (status: CheckStatus) => state.filter((check) => check.status === status).length;
  const failed = count("fail");
  const waiting = count("pending") + count("running");
  if (failed > 0) return `${failed} de ${state.length} pruebas fallaron. Revisa las marcadas antes de salir.`;
  if (waiting > 0) return `${count("ok")} de ${state.length} pruebas listas. Faltan ${waiting} por probar.`;
  return `Todo listo: las ${state.length} pruebas pasaron.`;
}

type Fetch = typeof fetch;

/** Las piezas del navegador que usa el chequeo. `fetch` se inyecta en las pruebas. */
export function browserPreflightDeps(request: ApiRequest, fetchFile: Fetch = fetch): PreflightDeps {
  return {
    request,
    fileExists: async (url) => (await fetchFile(url, { method: "HEAD", cache: "no-store" })).ok,
    listAudio: async () => {
      const response = await fetchFile(AUDIO_MANIFEST_URL, { cache: "no-store" });
      if (!response.ok) return [];
      return Object.keys((await response.json()) as Record<string, unknown>).filter(isAudioPath);
    },
    openMicrophone: () => testMicrophone(),
    playSound: (url) => playAudio(url),
  };
}
