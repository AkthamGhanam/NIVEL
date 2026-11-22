import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "../../../../scripts/smoke/client";
import { reports, workers } from "../../db/schema";
import { IDS } from "../../db/seed/cast";
import { dispatch, type InProcessApi, startInProcessApi } from "../../testing/in-process-api";

/**
 * Herramientas de los agentes de voz, llamadas como las llama ElevenLabs:
 * por las rutas reales, con `x-tool-secret` y el contexto firmado en la cabecera.
 */

const AGENT_IDS = { worker: "agente-trabajador", contractor: "agente-empresa" };
const VOICE_KEY = "clave-de-voz";
const CONVERSATION = "conv_registro_0001";

let api: InProcessApi;
let company: ApiClient;
let team: ApiClient;
let voiceFetch: ReturnType<typeof vi.fn>;

interface ToolAnswer {
  ok: boolean;
  say: string;
  [field: string]: unknown;
}
interface VoiceSession {
  token: string;
  dynamicVariables: { secret__nivel_contexto: string };
}

const newClient = () => new ApiClient(api.baseUrl, dispatch, api.demoKey);

/** Llama una herramienta como lo hace el agente. `ip` aísla las pruebas de límite de intentos. */
async function callTool(
  name: string,
  body: unknown,
  options: { context?: string; secret?: string; ip?: string } = {},
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-tool-secret": options.secret ?? api.toolSecret,
    "x-forwarded-for": options.ip ?? "198.51.100.1",
  };
  if (options.context) headers["x-nivel-context"] = options.context;
  const response = await dispatch(
    new Request(`${api.baseUrl}/api/tools/${name}`, { method: "POST", headers, body: JSON.stringify(body) }),
  );
  return { status: response.status, headers: response.headers, data: (await response.json()) as ToolAnswer };
}

const openVoice = async (client: ApiClient, query: string) =>
  (await client.get<VoiceSession>(`/api/el/token?${query}`)).dynamicVariables.secret__nivel_contexto;

async function database() {
  const { app } = await import("../../app");
  return (await app()).handle.db;
}

const SCRIPT_REQUEST = {
  oficio: "soldador",
  cantidad: "3",
  nivel_minimo: 2,
  zona: "Los Guayos",
  fecha_inicio: "el martes",
  dias: "5",
  pago_diario_usd: 25,
};

const silenceLogs = () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
};

beforeEach(silenceLogs);

beforeAll(async () => {
  silenceLogs();
  api = startInProcessApi();
  vi.stubEnv("ELEVENLABS_API_KEY", VOICE_KEY);
  vi.stubEnv("EL_AGENT_WORKER_ID", AGENT_IDS.worker);
  vi.stubEnv("EL_AGENT_CONTRACTOR_ID", AGENT_IDS.contractor);
  voiceFetch = vi.fn(async () => new Response(JSON.stringify({ token: "token-de-conversacion" })));
  vi.stubGlobal("fetch", voiceFetch);
  team = newClient();
  company = newClient();
  await team.post("/api/demo/reset", { as: "admin" });
  await team.post("/api/demo/bot", { as: "admin", body: { state: "off" } });
  await company.enterAs("company", IDS.activeCompany);
});

afterAll(() => {
  vi.unstubAllGlobals();
  api.dispose();
});

describe("acceso a las herramientas", () => {
  it("sin el secreto de herramientas responde 401, y bloquea la IP tras 10 intentos errados", async () => {
    const ip = "203.0.113.50";
    const attempts = [];
    for (let attempt = 0; attempt < 10; attempt += 1) {
      attempts.push((await callTool("calcular_costo_legal", {}, { secret: `errado-${attempt}`, ip })).status);
    }
    const blocked = await callTool("calcular_costo_legal", {}, { ip });

    expect(new Set(attempts)).toEqual(new Set([401]));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("la sesión de una persona no sirve para llamar herramientas", async () => {
    const response = await company.call("POST", "/api/tools/calcular_costo_legal", { body: {} });

    expect(response.status).toBe(401);
  });
});

describe("conversación de la empresa", () => {
  let context: string;
  let requestId: string;

  it("el token exige sesión de empresa y trae el contexto firmado", async () => {
    const anonymous = await newClient().call("GET", "/api/el/token?agent=contractor");
    const session = await company.get<VoiceSession>("/api/el/token?agent=contractor");
    context = session.dynamicVariables.secret__nivel_contexto;
    const [url, init] = voiceFetch.mock.calls.at(-1) as [URL, RequestInit];

    expect(anonymous.status).toBe(401);
    expect(session.token).toBe("token-de-conversacion");
    expect(url.searchParams.get("agent_id")).toBe(AGENT_IDS.contractor);
    expect(init.headers).toEqual({ "xi-api-key": VOICE_KEY });
    expect(context).not.toContain(IDS.activeCompany);
  });

  it("crear_solicitud entiende números dichos como texto y responde la frase del guion", async () => {
    const { status, data } = await callTool("crear_solicitud", SCRIPT_REQUEST, { context });
    requestId = data.solicitud_id as string;

    expect(status).toBe(200);
    expect(data).toMatchObject({ ok: true, cumplen: 6, costo_legal: { por_trabajador: 196.67 } });
    expect((data.top as Array<{ nombre_corto: string }>).map((entry) => entry.nombre_corto)).toEqual([
      "Rafael T.",
      "José P.",
      "Luis M.",
    ]);
    expect(data.say).toContain("6 soldadores de nivel 2 o más cumplen cerca de Los Guayos.");
    expect(data.say).toMatch(/¿Invito a los 3 mejores\?$/);
  });

  it("invitar_candidatos invita a los 3 mejores y los nombra", async () => {
    const { data } = await callTool(
      "invitar_candidatos",
      { solicitud_id: requestId, cantidad: 3 },
      { context },
    );

    expect(data.say).toBe("Invité a Rafael T., José P. y Luis M. Te aviso en pantalla cuando respondan.");
    expect(data.invitados).toHaveLength(3);
  });

  it("sin contexto, con uno alterado o con el de un trabajador no crea nada y lo dice", async () => {
    const before = await company.get<{ board: { request: { id: string } } }>("/api/requests/active");
    const rafael = newClient();
    await rafael.enterAs("worker", IDS.rafael);
    const workerContext = await openVoice(rafael, "agent=worker");
    const forged = `${context.slice(0, -3)}abc`;

    for (const attempt of [undefined, forged, workerContext]) {
      const { status, data } = await callTool(
        "crear_solicitud",
        { ...SCRIPT_REQUEST, company_id: IDS.activeCompany },
        attempt ? { context: attempt } : {},
      );
      expect(status).toBe(200);
      expect(data).toEqual({ ok: false, say: "Para esto primero entra a NIVEL como empresa." });
    }
    const after = await company.get<{ board: { request: { id: string } } }>("/api/requests/active");
    expect(after.board.request.id).toBe(before.board.request.id);
  });

  it("rechaza criterios discriminatorios con una frase que explica por qué", async () => {
    const { data } = await callTool(
      "crear_solicitud",
      { ...SCRIPT_REQUEST, zona: "Los Guayos, solo hombres" },
      { context },
    );

    expect(data.ok).toBe(false);
    expect(data.say).toMatch(/sexo o género/);
  });

  it("si faltan datos le dice al agente cuáles volver a preguntar", async () => {
    const { status, data } = await callTool(
      "crear_solicitud",
      { oficio: "carpintero", cantidad: "tres" },
      { context },
    );

    expect(status).toBe(200);
    expect(data.ok).toBe(false);
    expect(data.say).toMatch(/oficio, cantidad, nivel_minimo/);
  });

  it("calcular_costo_legal no necesita contexto y siempre habla de un estimado", async () => {
    const { data } = await callTool("calcular_costo_legal", { pago_diario_usd: "25", dias: 5, cantidad: 3 });
    const invalid = await callTool("calcular_costo_legal", { pago_diario_usd: 25, dias: 0, cantidad: 3 });

    expect(data).toMatchObject({ ok: true, total: 590 });
    expect(data.say).toContain("Estimado. Valídalo con tu contador.");
    expect(invalid.data).toMatchObject({ ok: false });
  });
});

describe("conversación del trabajador con sesión", () => {
  let rafaelContext: string;
  let luisInvitation: string;

  beforeAll(async () => {
    const rafael = newClient();
    await rafael.enterAs("worker", IDS.rafael);
    rafaelContext = await openVoice(rafael, "agent=worker");
    const luis = newClient();
    await luis.enterAs("worker", IDS.luis);
    const { offers } = await luis.get<{ offers: Array<{ invitationId: string }> }>("/api/invitations");
    luisInvitation = offers[0]?.invitationId as string;
  });

  it("consultar_ofertas cuenta la invitación abierta de quien habla", async () => {
    const { data } = await callTool("consultar_ofertas", { worker_id: IDS.luis }, { context: rafaelContext });

    expect(data.ofertas).toHaveLength(1);
    expect(data.say).toContain("Constructora Los Guayos te invita como soldador en Los Guayos");
  });

  it("no deja responder la invitación de otra persona aunque el modelo mande su id", async () => {
    const { data } = await callTool(
      "responder_oferta",
      { invitacion_id: luisInvitation, acepta: "sí", worker_id: IDS.luis },
      { context: rafaelContext },
    );

    expect(data).toEqual({ ok: false, say: "No tienes permiso para hacer esto." });
  });

  it("responder_oferta acepta con un sí hablado y nunca dice el código de firma", async () => {
    const offers = await callTool("consultar_ofertas", {}, { context: rafaelContext });
    const invitationId = (offers.data.ofertas as Array<{ invitacion_id: string }>)[0]?.invitacion_id;
    const { data } = await callTool(
      "responder_oferta",
      { invitacion_id: invitationId, acepta: "Sí" },
      { context: rafaelContext },
    );

    expect(data).toMatchObject({ ok: true, estado: "aceptada" });
    expect(data.say).toContain("NIVEL no es tu patrono");
    expect(JSON.stringify(data)).not.toMatch(/otp|\b\d{6}\b/);
  });

  it("sin perfil ni contexto invita a registrarse en vez de fallar", async () => {
    const offers = await callTool("consultar_ofertas", {});
    const answer = await callTool("responder_oferta", { invitacion_id: luisInvitation, acepta: false });

    expect(offers.data.say).toContain("primero necesito tu perfil");
    expect(answer.data).toMatchObject({ ok: true, estado: "sin_perfil" });
  });
});

describe("registro por voz", () => {
  const PROFILE = {
    nombre: "  María   Fernanda Gómez ",
    mayor_de_edad: "sí",
    oficio: "albañil",
    anos_experiencia: "4",
    tecnicas: ["frisos", "bloques"],
    zona: "vivo por Guacara",
    disponibilidad: "inmediata",
    conversation_id: CONVERSATION,
  };
  let context: string;
  let workerId: string;

  it("sin aceptar el permiso en pantalla no entrega el token de registro", async () => {
    const visitor = newClient();
    const refused = await visitor.call("GET", "/api/el/token?agent=worker&real=1");
    context = await openVoice(visitor, "agent=worker&real=1&consent=1");

    expect(refused.status).toBe(422);
    expect(context).toBeTruthy();
  });

  it("guardar_perfil crea el perfil real en Nivel 1 con su consentimiento y su ruta", async () => {
    const { data } = await callTool("guardar_perfil", PROFILE, { context });
    workerId = data.worker_id as string;
    const [saved] = await (await database()).select().from(workers).where(eq(workers.id, workerId));

    expect(data).toMatchObject({
      ok: true,
      creado: true,
      nivel: 1,
      banda_referencia: { min: 160, max: 240 },
    });
    expect(data.say).toContain("Listo, María. Tu perfil quedó en Nivel 1: Aprendiz.");
    expect(saved).toMatchObject({
      name: "María Fernanda Gómez",
      trade: "albanil",
      yearsExp: 4,
      zone: "Guacara",
      level: 1,
      isReal: true,
      isAdult: true,
      createdVia: "voz",
      consentShareProfileAt: null,
    });
    expect(saved?.consentVoiceAt).not.toBeNull();
  });

  it("si el agente repite la llamada no duplica el perfil", async () => {
    const { data } = await callTool("guardar_perfil", { ...PROFILE, nombre: "Otra Persona" }, { context });

    expect(data.worker_id).toBe(workerId);
  });

  it("la pantalla que habló recoge su perfil y queda con la sesión abierta", async () => {
    const phone = newClient();
    const missing = await phone.call("GET", "/api/workers/by-conversation/conv_que_no_existe");
    const { profile } = await phone.get<{ profile: { workerId: string; firstName: string } }>(
      `/api/workers/by-conversation/${CONVERSATION}`,
    );
    const level = await phone.get<{ level: number; workerId: string }>("/api/level");

    expect(missing.status).toBe(404);
    expect(profile).toMatchObject({ workerId, firstName: "María" });
    expect(level).toMatchObject({ level: 1, workerId });
  });

  it("no registra a menores de edad ni a quien no dio su permiso", async () => {
    const minor = await callTool(
      "guardar_perfil",
      { ...PROFILE, mayor_de_edad: "no", conversation_id: "conv_menor_0001" },
      { context },
    );
    const noConsent = await callTool("guardar_perfil", { ...PROFILE, conversation_id: "conv_sin_permiso" });
    const created = await (await database()).select().from(workers).where(eq(workers.createdVia, "voz"));

    expect(minor.data).toMatchObject({ ok: true, creado: false });
    expect(minor.data.say).toContain("mayores de 18");
    expect(noConsent.data.ok).toBe(false);
    expect(noConsent.data.say).toContain("necesito tu permiso");
    expect(created).toHaveLength(1);
  });

  it("pide repetir un nombre que no parece un nombre, sin guardar nada", async () => {
    const { data } = await callTool(
      "guardar_perfil",
      { ...PROFILE, nombre: "12345", conversation_id: "conv_nombre_raro" },
      { context },
    );

    expect(data).toEqual({ ok: false, say: "No entendí bien el nombre. ¿Me lo repites?" });
  });

  it("un perfil real no aparece en las búsquedas hasta que la persona acepta compartirlo", async () => {
    const companyContext = await openVoice(company, "agent=contractor");
    const search = { ...SCRIPT_REQUEST, oficio: "albanil", nivel_minimo: 1, cantidad: 1 };
    const before = await callTool("crear_solicitud", search, { context: companyContext });
    await (
      await database()
    )
      .update(workers)
      .set({ consentShareProfileAt: new Date().toISOString() })
      .where(eq(workers.id, workerId));
    const after = await callTool("crear_solicitud", search, { context: companyContext });

    expect(after.data.cumplen).toBe((before.data.cumplen as number) + 1);
  });

  it("crear_reporte queda a nombre de quien se registró en la conversación y orienta al INPSASEL", async () => {
    const { data } = await callTool("crear_reporte", {
      tipo: "inseguridad",
      descripcion: "No nos dieron careta para soldar",
      empresa: "la Constructora Los Guayos",
      conversation_id: CONVERSATION,
    });
    const [saved] = await (
      await database()
    )
      .select()
      .from(reports)
      .where(eq(reports.id, data.caso_id as string));

    expect(data.say).toContain("Una persona del equipo lo revisa en menos de 24 horas.");
    expect(data.say).toContain("INPSASEL");
    expect(saved).toMatchObject({
      reporterWorkerId: workerId,
      companyId: IDS.activeCompany,
      status: "en_revision",
      transcript: "No nos dieron careta para soldar",
    });
  });

  it("también acepta un reporte de alguien sin perfil, sin empresa reconocida", async () => {
    const { data } = await callTool("crear_reporte", {
      tipo: "otro",
      descripcion: "Quiero hablar con alguien",
      empresa: "xy",
    });
    const [saved] = await (
      await database()
    )
      .select()
      .from(reports)
      .where(eq(reports.id, data.caso_id as string));

    expect(data.ok).toBe(true);
    expect(saved).toMatchObject({ reporterWorkerId: null, companyId: null });
  });
});

describe("bitácora y servicio de voz", () => {
  it("registra cada herramienta con su latencia, sin nombres ni lo que se dijo", async () => {
    await team.post("/api/state", { body: { role: "admin", key: api.demoKey } });
    const { events } = await team.get<{
      events: Array<{ type: string; product: string; latencyMs: number | null }>;
    }>("/api/events");
    const toolEvents = events.filter((event) => event.type.startsWith("herramienta_"));
    const serialized = JSON.stringify(events);

    expect(toolEvents.length).toBeGreaterThan(5);
    expect(
      toolEvents.every((event) => event.product === "agents" && typeof event.latencyMs === "number"),
    ).toBe(true);
    expect(serialized).toContain("Perfil nuevo por voz · albañil · Guacara · persona real");
    expect(serialized).not.toMatch(/María|Gómez|careta/);
  });

  it("si el servicio de voz no responde devuelve 502 con un mensaje útil, tras un reintento", async () => {
    voiceFetch.mockClear();
    voiceFetch.mockImplementation(async () => new Response("{}", { status: 503 }));
    const response = await company.call<{ error: { code: string; message: string } }>(
      "GET",
      "/api/el/token?agent=contractor",
    );

    expect(response.status).toBe(502);
    expect(response.data.error.code).toBe("voz_no_disponible");
    expect(voiceFetch).toHaveBeenCalledTimes(2);
  });

  it("limita cuántas conversaciones puede abrir una misma IP", async () => {
    voiceFetch.mockImplementation(async () => new Response(JSON.stringify({ token: "t" })));
    const headers = { "x-forwarded-for": "203.0.113.77" };
    let last = 200;
    for (let attempt = 0; attempt < 61; attempt += 1) {
      last = (await company.call("GET", "/api/el/token?agent=contractor", { headers })).status;
    }

    expect(last).toBe(429);
  });

  it("sin las claves de voz configuradas responde 503 y el resto de la API sigue en pie", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    vi.resetModules();
    const fresh = newClient();
    await fresh.enterAs("company", IDS.activeCompany);

    expect((await fresh.call("GET", "/api/el/token?agent=contractor")).status).toBe(503);
    expect((await fresh.call("GET", "/api/requests/active")).status).toBe(200);
  });
});
