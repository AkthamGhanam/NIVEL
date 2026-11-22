import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { AGENTS, DEFAULT_DYNAMIC_VARIABLES, TOOL_HEADERS } from "./definitions";

const tools = AGENTS.flatMap((agent) => agent.tools);
const routeFile = (path: string) => join(process.cwd(), "src", "app", path, "route.ts");
const toolsSource = readFileSync(join(process.cwd(), "src", "server", "http", "api", "tools.ts"), "utf8");

describe("agentes como código", () => {
  it("define los dos agentes en español con sus 7 herramientas", () => {
    expect(AGENTS.map((agent) => agent.key)).toEqual(["worker", "contractor"]);
    expect(AGENTS.every((agent) => agent.language === "es")).toBe(true);
    expect(tools.map((tool) => tool.name)).toEqual([
      "guardar_perfil",
      "crear_reporte",
      "consultar_ofertas",
      "responder_oferta",
      "crear_solicitud",
      "invitar_candidatos",
      "calcular_costo_legal",
    ]);
  });

  it("cada herramienta apunta a una ruta que existe y declara los mismos campos que valida el servidor", () => {
    for (const tool of tools) {
      expect(tool.path).toBe(`/api/tools/${tool.name}`);
      expect(existsSync(routeFile(tool.path)), tool.path).toBe(true);
      expect(toolsSource).toContain(`name: "${tool.name}"`);
      for (const field of Object.keys(tool.parameters)) {
        expect(toolsSource, `${tool.name}.${field}`).toMatch(new RegExp(`\\b${field}:`));
      }
    }
  });

  it("ninguna herramienta deja que el modelo elija en nombre de quién actúa", () => {
    const fields = tools.flatMap((tool) => Object.keys(tool.parameters));

    expect(fields).not.toContain("worker_id");
    expect(fields).not.toContain("company_id");
    expect(TOOL_HEADERS["x-nivel-context"].dynamicVariable).toBe("secret__nivel_contexto");
    expect(DEFAULT_DYNAMIC_VARIABLES.secret__nivel_contexto).toBe("");
  });

  it("los prompts respetan las reglas legales y no usan palabras prohibidas", () => {
    const [worker, contractor] = AGENTS;
    const everything = AGENTS.map((agent) => `${agent.firstMessage} ${agent.prompt}`).join(" ");

    expect(worker?.prompt).toContain("NIVEL no es su patrono");
    expect(worker?.prompt).toContain("No prometes empleo ni salarios");
    expect(contractor?.prompt).toContain("la empresa contrata directo y es el patrono");
    expect(contractor?.prompt).toContain('Los precios siempre son "más IVA"');
    expect(everything).not.toMatch(
      /garantizad|certificado oficial|100\s?% verificado|sin riesgo laboral|sin pasivos|zelle|usdt/i,
    );
  });
});
