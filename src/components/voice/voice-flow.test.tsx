import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApiRequest } from "@/client/api";
import { createCompanyApi } from "@/client/company-api";
import type { NiviState } from "@/client/nivi-session";
import { createVoiceApi } from "@/client/voice-api";
import { createWorkerApi } from "@/client/worker-api";
import { VoiceRequestCard } from "@/components/company/request-screen";
import { FORBIDDEN_WORDS } from "@/lib/legal-copy";
import { IDS } from "@/server/db/seed/cast";
import { createBrowserFetch } from "@/server/testing/browser-fetch";
import { dispatch, type InProcessApi, startInProcessApi } from "@/server/testing/in-process-api";

import { ApiClient } from "../../../scripts/smoke/client";
import { MICROPHONE_PROMISE, type NiviActions, NiviVoiceView, Transcript } from "./nivi-voice-view";

/**
 * Hablar con Nivi sin navegador ni ElevenLabs: la pantalla pide su token a las
 * rutas reales, y la vista se prueba en cada estado de la conversación.
 */

let server: InProcessApi;
let team: ApiClient;

const noop = () => undefined;
const idle = async () => undefined;
const actions: NiviActions = {
  start: idle,
  stop: idle,
  setMode: noop,
  hold: noop,
  release: noop,
  sendText: noop,
};
const rendered: string[] = [];
const html = (element: ReactElement) => {
  const markup = renderToStaticMarkup(element);
  rendered.push(markup);
  return markup;
};
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const browser = () => createApiRequest(createBrowserFetch(server.baseUrl));
const state = (changes: Partial<NiviState> = {}): NiviState => ({
  status: "idle",
  mode: "nota",
  activity: "idle",
  talking: false,
  lines: [],
  error: null,
  conversationId: null,
  ...changes,
});

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

beforeAll(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  server = startInProcessApi();
  vi.stubEnv("ELEVENLABS_API_KEY", "clave-de-voz");
  vi.stubEnv("EL_AGENT_WORKER_ID", "agente-trabajador");
  vi.stubEnv("EL_AGENT_CONTRACTOR_ID", "agente-contratista");
  // ElevenLabs solo entrega tokens en estas pruebas; el cliente de las pantallas usa su propio `fetch`.
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: URL) =>
        new Response(JSON.stringify({ token: `token-${url.searchParams.get("agent_id")}` })),
    ),
  );
  team = new ApiClient(server.baseUrl, dispatch, server.demoKey);
  await team.post("/api/demo/reset", { as: "admin" });
});

afterAll(() => {
  vi.unstubAllGlobals();
  server.dispose();
});

describe("permiso para abrir una conversación", () => {
  it("un trabajador con sesión habla como él mismo; la empresa necesita su propia sesión", async () => {
    const request = browser();
    const voice = createVoiceApi(request);
    await createWorkerApi(request).enter(IDS.carlos);

    const worker = await voice.token("worker");

    expect(worker.token).toBe("token-agente-trabajador");
    expect(worker.dynamicVariables.secret__nivel_contexto).toMatch(/\S{20,}/);
    await expect(voice.token("contractor")).rejects.toMatchObject({ status: 401 });
    await createCompanyApi(request).enter(IDS.activeCompany);
    expect((await voice.token("contractor")).token).toBe("token-agente-contratista");
  });

  it("quien se registra no recibe token sin aceptar el permiso en pantalla", async () => {
    const voice = createVoiceApi(browser());

    await expect(voice.token("worker", { registration: true, real: true })).rejects.toMatchObject({
      status: 422,
      message: "Necesitamos tu permiso para usar tu voz y guardar tu perfil.",
    });
    expect((await voice.token("worker", { registration: true, real: true, consent: true })).token).toBe(
      "token-agente-trabajador",
    );
  });
});

describe("Nivi en pantalla", () => {
  it("antes de conectar explica para qué es el micrófono y ofrece los tres modos", () => {
    const markup = html(<NiviVoiceView state={state()} actions={actions} />);
    const written = html(<NiviVoiceView state={state({ mode: "texto" })} actions={actions} />);

    expect(markup).toContain(MICROPHONE_PROMISE);
    expect(MICROPHONE_PROMISE).toContain("No guardamos el audio");
    expect(markup).toMatch(/role="group" aria-label="Cómo quieres hablar con Nivi"/);
    expect(markup).toMatch(/aria-pressed="true"[^>]*>(<svg.*?<\/svg>)Nota de voz<\/button>/);
    expect(markup.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(markup).toMatch(/<button[^>]*>Hablar con Nivi<\/button>/);
    expect(markup).toMatch(/role="status"[^>]*>Toca para hablar con Nivi/);
    // En texto no se pide micrófono.
    expect(written).not.toContain(MICROPHONE_PROMISE);
    expect(written).toMatch(/<button[^>]*>Escribirle a Nivi<\/button>/);
  });

  it("mientras conecta lo dice con palabras y deja cancelar", () => {
    const markup = html(
      <NiviVoiceView state={state({ status: "connecting", activity: "thinking" })} actions={actions} />,
    );

    expect(markup).toMatch(/role="status".*Conectando con Nivi…/);
    expect(markup).toMatch(/<button[^>]*>Cancelar<\/button>/);
    expect(markup).not.toContain("Hablar con Nivi<");
  });

  it("cada modo en vivo tiene su control: mantener presionado, colgar o escribir", () => {
    const live = (changes: Partial<NiviState>) =>
      html(<NiviVoiceView state={state({ status: "live", ...changes })} actions={actions} />);
    const note = live({ mode: "nota" });
    const talking = live({ mode: "nota", talking: true, activity: "listening" });
    const call = live({ mode: "llamada", activity: "speaking" });
    const written = live({ mode: "texto" });

    expect(note).toMatch(/aria-pressed="false"[^>]*>Mantén presionado para hablar<\/button>/);
    expect(note).toMatch(/<button[^>]*>Terminar<\/button>/);
    expect(talking).toMatch(/aria-pressed="true"[^>]*>Te escucho… suelta para enviar<\/button>/);
    expect(talking).toContain("Nivi te escucha");
    expect(call).toContain("Micrófono abierto");
    expect(call).toContain("Nivi está hablando");
    expect(call).toMatch(/<button[^>]*>Colgar<\/button>/);
    expect(written).toMatch(/<label for="nivi-mensaje"[^>]*>Escríbele a Nivi<\/label>/);
    expect(written).toMatch(/<button type="submit"[^>]*>Enviar<\/button>/);
    expect(written).not.toContain("Mantén presionado");
  });

  it("todo lo que suena también se lee, y dice quién habla a quien no ve la pantalla", () => {
    const lines = [
      { id: 1, from: "nivi" as const, text: "¡Hola! Soy Nivi. ¿Cómo te llamas?" },
      { id: 2, from: "persona" as const, text: "<b>Carlos</b>" },
    ];
    const markup = html(<Transcript lines={lines} />);

    expect(markup).toMatch(/role="log" aria-label="Conversación con Nivi" tabindex="0"/);
    expect(text(markup)).toContain("Nivi: ¡Hola! Soy Nivi. ¿Cómo te llamas? Tú: ");
    // Lo dicho se pinta como texto, nunca como HTML.
    expect(markup).toContain("&lt;b&gt;Carlos&lt;/b&gt;");
    expect(html(<Transcript lines={[]} />)).toBe("");
  });

  it("una falla se anuncia de inmediato y deja volver a intentar", () => {
    const markup = html(
      <NiviVoiceView state={state({ error: "No pudimos conectar con Nivi." })} actions={actions} />,
    );

    expect(markup).toMatch(/role="alert".*No pudimos conectar con Nivi\./);
    expect(markup).toMatch(/<button[^>]*>Hablar con Nivi<\/button>/);
  });

  it("la empresa tiene su panel para pedir la cuadrilla hablando, en modo llamada", () => {
    const markup = html(<VoiceRequestCard />);

    expect(markup).toMatch(/<h2[^>]*>Pídela hablando<\/h2>/);
    expect(markup).toMatch(/aria-pressed="true"[^>]*>(<svg.*?<\/svg>)Llamada<\/button>/);
    expect(markup).toMatch(/<button[^>]*>Hablar con Nivi<\/button>/);
  });
});

describe("reglas que valen para todas las pantallas de voz", () => {
  it("nada de lo pintado lleva estilos en línea, palabras prohibidas ni recursos de fuera", () => {
    expect(rendered.length).toBeGreaterThan(10);
    for (const markup of rendered) {
      const lower = markup.toLowerCase();
      expect(markup).not.toMatch(/ style="/);
      expect(markup).not.toMatch(/https?:\/\//);
      for (const word of FORBIDDEN_WORDS) expect(lower).not.toContain(word);
    }
  });
});
