import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { type ApiRequest, createApiRequest } from "@/client/api";
import { createCompanyApi } from "@/client/company-api";
import {
  AUDIO_MANIFEST_URL,
  browserPreflightDeps,
  type CheckState,
  createPreflight,
  preflightChecks,
} from "@/client/preflight";
import { createTeamApi } from "@/client/team-api";
import { FORBIDDEN_WORDS } from "@/lib/legal-copy";
import { IDS } from "@/server/db/seed/cast";
import { createBrowserFetch } from "@/server/testing/browser-fetch";
import { type InProcessApi, startInProcessApi } from "@/server/testing/in-process-api";

import { CheckRow, PreflightView } from "./preflight-screen";

/**
 * El chequeo previo contra las rutas reales: lo que la lista pinta en verde o
 * en rojo es lo que el servidor de verdad responde. Los archivos se buscan en
 * `public/`, como los serviría la app.
 */

let server: InProcessApi;
let request: ApiRequest;

const noop = () => undefined;
const rendered: string[] = [];
const html = (element: ReactElement) => {
  const markup = renderToStaticMarkup(element);
  rendered.push(markup);
  return markup;
};
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

/** Sirve los archivos de `public/` como lo haría la app. */
const publicFiles: typeof fetch = async (input) => {
  const path = join(process.cwd(), "public", String(input));
  if (!existsSync(path)) return new Response(null, { status: 404 });
  return String(input) === AUDIO_MANIFEST_URL ? new Response(readFileSync(path)) : new Response(null);
};

async function automatic() {
  const preflight = createPreflight(preflightChecks(browserPreflightDeps(request, publicFiles)));
  await preflight.runAutomatic();
  const state = preflight.getState();
  return { state, byId: Object.fromEntries(state.map((check) => [check.id, check])) };
}

const check = (changes: Partial<CheckState> = {}): CheckState => ({
  id: "servidor",
  label: "Servidor y base de datos",
  manual: false,
  status: "pending",
  detail: null,
  ...changes,
});

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

beforeAll(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  server = startInProcessApi();
  vi.stubEnv("ELEVENLABS_API_KEY", "clave-de-voz");
  vi.stubEnv("EL_AGENT_WORKER_ID", "agente-trabajador");
  vi.stubEnv("EL_AGENT_CONTRACTOR_ID", "agente-contratista");
  vi.stubEnv("EL_VOICE_ID", "voz-nivi");
  // ElevenLabs entrega tokens y sintetiza el saludo; las pantallas usan su propio `fetch`.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL) =>
      url.pathname.startsWith("/v1/text-to-speech")
        ? new Response(new Uint8Array([73, 68, 51]))
        : new Response(JSON.stringify({ token: "token-de-agente" })),
    ),
  );
  request = createApiRequest(createBrowserFetch(server.baseUrl));
  const team = createTeamApi(request);
  await team.enter(server.demoKey);
  await team.reset();
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  server.dispose();
});

describe("chequeo previo contra el servidor real", () => {
  it("antes de que una empresa entre, su agente sale en rojo con el motivo y lo demás pasa", async () => {
    const { byId } = await automatic();

    expect(byId["agente-empresa"]).toMatchObject({ status: "fail", detail: "Primero entra como empresa." });
    expect(byId.servidor).toMatchObject({
      status: "ok",
      detail: expect.stringMatching(/^La base respondió con \d+ trabajadores/),
    });
    expect(byId.audios).toMatchObject({
      status: "ok",
      detail: expect.stringMatching(/^(\d+) de \1 archivos/),
    });
    expect(byId["agente-trabajador"]?.status).toBe("ok");
    expect(byId.voz?.detail).toBe("Se generó y se guardó el saludo de Nivi.");
    expect(byId.microfono?.status).toBe("pending");
  });

  it("con una empresa con sesión su agente pasa, y la voz repetida sale de la caché", async () => {
    await createCompanyApi(request).enter(IDS.activeCompany);

    const { byId } = await automatic();

    expect(byId["agente-empresa"]?.status).toBe("ok");
    expect(byId.voz?.detail).toBe("El saludo de Nivi ya estaba guardado.");
  });

  it("el chequeo no cambia los datos de la demo", async () => {
    const team = createTeamApi(request);
    const before = (await team.events(undefined)).length;

    await automatic();

    expect((await team.events(undefined)).length).toBe(before);
    expect((await team.realProfiles()).count).toBe(0);
  });

  it("sin las claves de voz, los agentes salen en rojo y el servidor y los audios siguen en verde", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    vi.resetModules();

    const { byId } = await automatic();

    for (const id of ["agente-trabajador", "agente-empresa"]) {
      expect(byId[id], id).toMatchObject({ status: "fail", detail: "El servidor aún no está configurado." });
    }
    expect(byId.servidor?.status).toBe("ok");
    expect(byId.audios?.status).toBe("ok");
  });
});

describe("pantalla del chequeo previo", () => {
  it("cada prueba dice su estado con una palabra, no solo con color, y se puede repetir", () => {
    const untried = html(<CheckRow check={check({ manual: true, label: "Micrófono" })} onRun={noop} />);
    const running = html(<CheckRow check={check({ status: "running" })} onRun={noop} />);
    const passed = html(
      <CheckRow check={check({ status: "ok", detail: "La base respondió." })} onRun={noop} />,
    );
    const failed = html(
      <CheckRow check={check({ status: "fail", detail: "Faltan 1 de 3: /sfx/exito.mp3" })} onRun={noop} />,
    );

    expect(text(untried)).toContain("Sin probar");
    expect(text(untried)).toContain("El navegador pide un toque para probarla.");
    expect(text(untried)).toMatch(/Probar\s*: Micrófono/);
    expect(text(running)).toContain("Probando…");
    expect(running).toMatch(/<button[^>]*disabled=""/);
    expect(text(passed)).toContain("Listo");
    expect(text(passed)).toContain("Probar de nuevo");
    expect(text(failed)).toContain("Falla");
    expect(text(failed)).toContain("Faltan 1 de 3: /sfx/exito.mp3");
    expect(text(html(<CheckRow check={check()} onRun={noop} />))).toContain("En espera.");
  });

  it("arriba resume cuántas pasaron, anuncia los cambios y recuerda el plan B", () => {
    const checks = [
      check({ status: "ok", detail: "La base respondió." }),
      check({
        id: "voz",
        label: "Voz de Nivi para frases",
        status: "fail",
        detail: "El servidor aún no está configurado.",
      }),
    ];
    const markup = html(<PreflightView checks={checks} onRun={noop} onRunAll={noop} />);

    expect(markup).toMatch(/<h1[^>]*>Chequeo previo<\/h1>/);
    expect(markup).toMatch(/<p role="status"[^>]*>1 de 2 pruebas fallaron/);
    expect(markup.match(/<li /g)).toHaveLength(2);
    expect(markup).toContain('href="/demo"');
    expect(text(markup)).toContain("la demo sigue con el plan B");
  });

  it("nada de lo pintado lleva estilos en línea ni palabras prohibidas", () => {
    expect(rendered.length).toBeGreaterThan(5);
    for (const markup of rendered) {
      const lower = text(markup).toLowerCase();
      expect(markup).not.toMatch(/\sstyle=/);
      for (const word of FORBIDDEN_WORDS) expect(lower).not.toContain(word.toLowerCase());
    }
  });
});
