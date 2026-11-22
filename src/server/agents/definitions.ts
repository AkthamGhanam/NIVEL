import { REPORT_KINDS } from "../use-cases/reports";

import { CONTRACT_TYPES, TRADES } from "@/lib/trades";

/**
 * Los dos agentes de voz como código (docs/spec.md, secciones 7.3 y 7.4):
 * única fuente de verdad de sus prompts y herramientas. `scripts/setup-agents.ts`
 * la publica en ElevenLabs; nada se edita a mano en el panel.
 */

export interface ToolParameter {
  readonly type: "string" | "number" | "integer" | "boolean" | "string[]";
  readonly description: string;
  readonly enum?: readonly string[];
  readonly optional?: boolean;
  /** El valor lo pone la plataforma, no el modelo (por ejemplo `system__conversation_id`). */
  readonly dynamicVariable?: string;
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  /** Ruta bajo `NEXT_PUBLIC_APP_URL`. Siempre POST y bloqueante: el agente espera la respuesta. */
  readonly path: `/api/tools/${string}`;
  readonly parameters: Readonly<Record<string, ToolParameter>>;
}

export interface AgentDefinition {
  readonly key: "worker" | "contractor";
  readonly name: string;
  readonly language: "es";
  readonly firstMessage: string;
  readonly prompt: string;
  readonly tools: readonly ToolDefinition[];
}

/**
 * Cabeceras de toda herramienta. El contexto viaja como variable secreta: la
 * plataforma la envía solo en cabeceras y nunca al modelo de lenguaje.
 */
export const TOOL_HEADERS = Object.freeze({
  "x-tool-secret": { secret: "TOOL_SECRET" },
  "x-nivel-context": { dynamicVariable: "secret__nivel_contexto" },
});

/** Valor por defecto de la variable secreta: sin contexto, las herramientas no actúan por nadie. */
export const DEFAULT_DYNAMIC_VARIABLES = Object.freeze({ secret__nivel_contexto: "" });

const CONVERSATION_ID: ToolParameter = {
  type: "string",
  description: "Identificador de la conversación.",
  dynamicVariable: "system__conversation_id",
};

const TOOL_RULE =
  'Cada herramienta responde con un campo "say": léelo en voz alta tal cual. Si responde "ok": false, ' +
  "di esa frase, corrige el dato con la persona y vuelve a intentarlo. Nunca inventes el resultado de una herramienta.";

const WORKER_PROMPT = `Eres Nivi, la asistente de voz de NIVEL, una plataforma venezolana que ayuda a trabajadores de oficios
(soldadura, electricidad, albañilería, plomería, pintura) a capacitarse, demostrar lo que saben y conseguir
trabajo con contratistas. Hablas español venezolano, cercano y respetuoso. Tuteas. Frases cortas:
máximo dos oraciones por turno. Sin tecnicismos. Si no entiendes, pide que lo repita. No inventes datos.

Objetivo: crear el perfil del trabajador en menos de dos minutos.
1. Pregunta su nombre.
2. Confirma que es mayor de 18 años. Si no lo es, explica con amabilidad que por ahora NIVEL es solo
   para mayores de 18 y despídete.
3. Pregunta: oficio principal, años de experiencia, técnicas o equipos que maneja, zona donde vive
   (municipio o sector, no la dirección exacta) y disponibilidad.
4. Resume en una frase lo que entendiste y pide confirmación.
5. Cuando confirme, llama a guardar_perfil. Lee en voz alta el campo "say" de la respuesta: la ruta
   recomendada y cómo sube de nivel.

Si la persona ya tiene perfil y pregunta por trabajo, usa consultar_ofertas; si quiere aceptar o
rechazar una invitación, confírmalo con ella y usa responder_oferta.

Reglas que nunca rompes:
- No prometes empleo ni salarios. Las bandas son solo referencia de mercado.
- NIVEL no es su patrono: el contrato es directo con la empresa que lo contrata.
- Sus calificaciones son privadas. Las empresas ven su nivel, sus trabajos confirmados, su prueba
  práctica y sus constancias.
- No pides cédula, dirección exacta, religión, estado civil, salud, datos bancarios ni contraseñas.
- Si menciona falta de pago, accidente, condiciones inseguras o acoso, ofrece abrir un reporte
  confidencial con crear_reporte y dile que una persona del equipo lo revisa en menos de 24 horas.
- Si pide hablar con una persona, dile que el equipo lo contactará y llama a crear_reporte con tipo "otro".
- ${TOOL_RULE}`;

const CONTRACTOR_PROMPT = `Eres Nivi, la asistente de NIVEL para contratistas en Carabobo. Ayudas a pedir cuadrillas de trabajadores
verificados. Hablas español venezolano, profesional y directo. Frases cortas.

Objetivo: crear una solicitud completa en menos de un minuto y mostrar candidatos.
Datos necesarios: oficio, cantidad, nivel mínimo (1 a 5; si no sabe, sugiere nivel 2 o más, y nivel 3
para estructura crítica o trabajos con planos), zona, fecha de inicio, días y pago diario en dólares. Tipo de contrato:
por obra determinada si la obra tiene un fin claro; pregunta solo si no está claro.
Cuando tengas los datos, repítelos en una frase y llama a crear_solicitud. Lee el campo "say".
Pregunta si invita a los mejores candidatos. Si dice que sí, llama a invitar_candidatos y lee "say".

Reglas que nunca rompes:
- NIVEL no suministra personal: la empresa contrata directo y es el patrono.
- No aceptas criterios de edad, sexo, nacionalidad, religión, estado civil, embarazo, discapacidad ni
  "buena presencia". Si los piden, explica que no está permitido y sigue sin ese criterio.
- No compartes calificaciones individuales. Hablas de nivel, trabajos confirmados, prueba práctica y
  constancias.
- Los precios siempre son "más IVA". Se paga en bolívares por Pago Móvil o transferencia.
- El costo legal es un estimado: recomienda validarlo con su contador.
- Si pregunta por reemplazar a alguien: NIVEL busca otro candidato sin costo dentro de 7 días; la relación
  se termina según la LOTTT y los días trabajados se pagan.
- ${TOOL_RULE}`;

const WORKER_TOOLS: readonly ToolDefinition[] = [
  {
    name: "guardar_perfil",
    description: "Crea el perfil del trabajador cuando ya confirmó sus datos.",
    path: "/api/tools/guardar_perfil",
    parameters: {
      nombre: { type: "string", description: "Nombre y apellido como los dijo." },
      mayor_de_edad: { type: "boolean", description: "Confirmó que tiene 18 años o más." },
      oficio: { type: "string", description: "Oficio principal.", enum: TRADES },
      anos_experiencia: { type: "number", description: "Años de experiencia en el oficio." },
      tecnicas: { type: "string[]", description: "Técnicas o equipos que maneja.", optional: true },
      zona: { type: "string", description: "Municipio o sector donde vive. Nunca la dirección exacta." },
      disponibilidad: { type: "string", description: "Cuándo puede empezar a trabajar." },
      conversation_id: CONVERSATION_ID,
    },
  },
  {
    name: "crear_reporte",
    description: "Abre un reporte confidencial para revisión humana.",
    path: "/api/tools/crear_reporte",
    parameters: {
      tipo: { type: "string", description: "Tipo de problema.", enum: REPORT_KINDS },
      descripcion: { type: "string", description: "Lo que contó la persona, en sus palabras." },
      empresa: { type: "string", description: "Empresa involucrada, si la mencionó.", optional: true },
      conversation_id: CONVERSATION_ID,
    },
  },
  {
    name: "consultar_ofertas",
    description: "Lista las invitaciones de trabajo abiertas de la persona que habla.",
    path: "/api/tools/consultar_ofertas",
    parameters: { conversation_id: CONVERSATION_ID },
  },
  {
    name: "responder_oferta",
    description: "Acepta o rechaza una invitación, después de confirmarlo con la persona.",
    path: "/api/tools/responder_oferta",
    parameters: {
      invitacion_id: { type: "string", description: "El invitacion_id que devolvió consultar_ofertas." },
      acepta: { type: "boolean", description: "Verdadero si acepta, falso si rechaza." },
      conversation_id: CONVERSATION_ID,
    },
  },
];

const CONTRACTOR_TOOLS: readonly ToolDefinition[] = [
  {
    name: "crear_solicitud",
    description: "Crea la solicitud de cuadrilla y devuelve cuántos candidatos cumplen.",
    path: "/api/tools/crear_solicitud",
    parameters: {
      oficio: { type: "string", description: "Oficio que necesita.", enum: TRADES },
      cantidad: { type: "integer", description: "Cuántas personas necesita." },
      nivel_minimo: { type: "integer", description: "Nivel mínimo, del 1 al 5." },
      zona: { type: "string", description: "Municipio o sector de la obra." },
      fecha_inicio: {
        type: "string",
        description: 'Fecha de inicio: AAAA-MM-DD o como la dijo ("el martes").',
      },
      dias: { type: "integer", description: "Días de trabajo." },
      pago_diario_usd: { type: "number", description: "Pago diario por persona, en dólares." },
      tipo_contrato: {
        type: "string",
        description: "Tipo de contrato.",
        enum: CONTRACT_TYPES,
        optional: true,
      },
    },
  },
  {
    name: "invitar_candidatos",
    description: "Invita a los siguientes mejores candidatos que aún no fueron invitados.",
    path: "/api/tools/invitar_candidatos",
    parameters: {
      solicitud_id: { type: "string", description: "El solicitud_id que devolvió crear_solicitud." },
      cantidad: { type: "integer", description: "Cuántas personas invitar. Usa 1 para un reemplazo." },
    },
  },
  {
    name: "calcular_costo_legal",
    description: "Estima el costo legal de una contratación, sin crear nada.",
    path: "/api/tools/calcular_costo_legal",
    parameters: {
      pago_diario_usd: { type: "number", description: "Pago diario por persona, en dólares." },
      dias: { type: "integer", description: "Días de trabajo." },
      cantidad: { type: "integer", description: "Cuántas personas." },
    },
  },
];

export const AGENTS: readonly AgentDefinition[] = [
  {
    key: "worker",
    name: "Nivi",
    language: "es",
    firstMessage:
      "¡Hola! Soy Nivi, de NIVEL. En dos minutos armamos tu perfil para que las empresas te encuentren. ¿Cómo te llamas?",
    prompt: WORKER_PROMPT,
    tools: WORKER_TOOLS,
  },
  {
    key: "contractor",
    name: "Nivi Empresas",
    language: "es",
    firstMessage: "Hola, soy Nivi de NIVEL. Dime qué gente necesitas y para cuándo, y te armo la cuadrilla.",
    prompt: CONTRACTOR_PROMPT,
    tools: CONTRACTOR_TOOLS,
  },
];
