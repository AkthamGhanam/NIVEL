import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApiRequest } from "@/client/api";
import { createCompanyApi } from "@/client/company-api";
import {
  type AgentConnection,
  type AgentSession,
  createNiviSession,
  type NiviState,
} from "@/client/nivi-session";
import {
  CONSENT_CHOICES,
  heardFacts,
  isRealVisitor,
  REAL_PERSON_NOTICE,
  VOICE_CONSENT_POINTS,
} from "@/client/registration-view";
import { createVoiceApi, waitForProfile } from "@/client/voice-api";
import { createWorkerApi } from "@/client/worker-api";
import { VoiceRequestCard } from "@/components/company/request-screen";
import { ConsentSheet, HeardProfile } from "@/components/registration/registration-views";
import { FORBIDDEN_WORDS, REFERENCE_BAND_NOTICE } from "@/lib/legal-copy";
import { IDS } from "@/server/db/seed/cast";
import { createBrowserFetch } from "@/server/testing/browser-fetch";
import { dispatch, type InProcessApi, startInProcessApi } from "@/server/testing/in-process-api";

import { ApiClient } from "../../../scripts/smoke/client";
import { MICROPHONE_PROMISE, type NiviActions, NiviVoiceView, Transcript } from "./nivi-voice-view";

/**
 * Hablar con Nivi de punta a punta, sin navegador ni ElevenLabs: la pantalla
 * pide su token a las rutas reales y un agente falso hace lo que haría el de
 * verdad (llamar a la herramienta `guardar_perfil` con el contexto firmado).
 */

const CONVERSATION = "conv_registro_voz_01";
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

/** El agente de verdad llama a nuestras herramientas con el secreto y el contexto que recibió al conectar. */
function agentThatSavesProfiles() {
  const connections: AgentConnection[] = [];
  const connect = async (connection: AgentConnection): Promise<AgentSession> => {
    connections.push(connection);
    return {
      conversationId: () => CONVERSATION,
      setMicMuted: noop,
      sendText: (said) => {
        void saveProfile(connection, said);
      },
      end: idle,
    };
  };
  return { connect, connections };
}

async function saveProfile(connection: AgentConnection, said: string) {
  const response = await dispatch(
    new Request(`${server.baseUrl}/api/tools/guardar_perfil`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tool-secret": server.toolSecret,
        "x-nivel-context": connection.dynamicVariables.secret__nivel_contexto ?? "",
      },
      body: JSON.stringify({
        nombre: said,
        mayor_de_edad: "sí",
        oficio: "albañil",
        anos_experiencia: "4",
        tecnicas: ["frisos", "bloques"],
        zona: "vivo por Guacara",
        disponibilidad: "inmediata",
        conversation_id: CONVERSATION,
      }),
    }),
  );
  const answer = (await response.json()) as { say: string };
  connection.callbacks.onMessage({ from: "nivi", text: answer.say });
}

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

describe("registro hablando con Nivi", () => {
  it("la hoja de permiso dice qué se guarda, deja escucharlo y las dos salidas dicen que se acepta", () => {
    const sheet = html(<ConsentSheet real={false} onAccept={noop} />);
    const real = html(<ConsentSheet real onAccept={noop} />);

    for (const point of VOICE_CONSENT_POINTS) expect(sheet).toContain(point);
    expect(text(sheet)).toContain("NIVEL no guarda el audio");
    expect(text(sheet)).toContain("Solo para personas mayores de 18 años");
    expect(sheet).toMatch(
      /Escuchar antes de aceptar.*<audio controls="" preload="none" src="\/audio\/privacidad\.mp3"/,
    );
    expect(sheet).toMatch(/<a [^>]*href="\/legal\/privacidad"/);
    expect(CONSENT_CHOICES.map((choice) => choice.mode)).toEqual(["nota", "texto"]);
    for (const choice of CONSENT_CHOICES) expect(choice.label).toMatch(/^Acepto/);
    expect(sheet).toMatch(
      /Acepto y quiero hablar con Nivi<\/button>.*Acepto, pero prefiero escribir<\/button>/,
    );
    expect(sheet).toMatch(/<a [^>]*href="\/t"[^>]*>Ya tengo perfil<\/a>/);
    expect(sheet).not.toContain(REAL_PERSON_NOTICE);
    expect(real).toContain(REAL_PERSON_NOTICE);
    expect([
      isRealVisitor("1"),
      isRealVisitor("true"),
      isRealVisitor(undefined),
      isRealVisitor(["1"]),
    ]).toEqual([true, false, false, false]);
  });

  it("al guardar Nivi el perfil, la pantalla lo recoge, queda con la sesión abierta y muestra lo que entendió", async () => {
    const request = browser();
    const voice = createVoiceApi(request);
    const agent = agentThatSavesProfiles();
    const nivi = createNiviSession({
      fetchToken: () => voice.token("worker", { registration: true, real: true, consent: true }),
      connect: agent.connect,
      mode: "texto",
    });
    const waiting = new AbortController();

    await nivi.start();
    const conversationId = nivi.getState().conversationId ?? "";
    const claimed = waitForProfile(() => voice.claimProfile(conversationId, waiting.signal), {
      signal: waiting.signal,
      intervalMs: 5,
    });
    nivi.sendText("María Fernanda Gómez");
    const created = await claimed;
    const profile = await createWorkerApi(request).profile();
    const markup = html(<HeardProfile profile={profile} />);

    expect(agent.connections[0]).toMatchObject({ textOnly: true, token: "token-agente-trabajador" });
    expect(created).toMatchObject({ firstName: "María", level: 1 });
    await vi.waitFor(() => expect(nivi.getState().lines).toHaveLength(2));
    expect(nivi.getState().lines[1]?.text).toContain("Tu perfil quedó en Nivel 1");
    expect(heardFacts(profile)).toEqual([
      { label: "Nombre", value: "María Fernanda Gómez" },
      { label: "Oficio", value: profile.tradeLabel },
      { label: "Experiencia", value: "4 años" },
      { label: "Técnicas", value: "frisos, bloques" },
      { label: "Zona", value: "Guacara" },
      { label: "Disponibilidad", value: "inmediata" },
    ]);
    expect(heardFacts({ ...profile, yearsExp: 1, skills: [] }).map((fact) => fact.value)).toEqual(
      expect.arrayContaining(["1 año", "Sin anotar"]),
    );
    expect(text(markup)).toContain("Esto entendimos, María");
    expect(text(markup)).toContain("Nivel 1 · Aprendiz");
    expect(markup).toContain(REFERENCE_BAND_NOTICE);
    expect(markup).toMatch(/<a [^>]*href="\/t"[^>]*>Confirmar y entrar<\/a>/);
    expect(markup).toMatch(/<a [^>]*href="\/t\/mis-datos"[^>]*>Corregir<\/a>/);
    // Recién creado, el perfil no se comparte con empresas hasta que la persona lo active.
    expect(profile.consents.share_profile).toBeNull();
  });

  it("mientras no hay perfil sigue esperando; deja de preguntar cuando la pantalla se va", async () => {
    const voice = createVoiceApi(browser());
    const waiting = new AbortController();
    const claim = vi.fn(() => voice.claimProfile("conv_que_no_existe", waiting.signal));

    const pending = waitForProfile(claim, { signal: waiting.signal, intervalMs: 5 });
    await vi.waitFor(() => expect(claim.mock.calls.length).toBeGreaterThan(2));
    waiting.abort();

    expect(await pending).toBeUndefined();
    await expect(
      waitForProfile(() => voice.claimProfile("id malo"), { signal: new AbortController().signal }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      waitForProfile(() => Promise.reject(new Error("otra cosa")), { signal: new AbortController().signal }),
    ).rejects.toThrow("otra cosa");
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
