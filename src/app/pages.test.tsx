import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FORBIDDEN_WORDS } from "@/lib/legal-copy";

import StyleGuidePage from "./estilo/page";
import LevelsPage from "./legal/niveles/page";
import PrivacyPage from "./legal/privacidad/page";
import TermsPage from "./legal/terminos/page";
import NotFound from "./not-found";
import HomePage from "./page";

/**
 * Las páginas estáticas, renderizadas en el servidor: estructura accesible y
 * las reglas de la revisión legal sobre lo que se puede y no se puede decir.
 */

const PAGES: ReadonlyArray<readonly [string, () => ReactElement]> = [
  ["inicio", HomePage],
  ["términos", TermsPage],
  ["privacidad", PrivacyPage],
  ["niveles", LevelsPage],
  ["sistema visual", StyleGuidePage],
  ["no encontrada", NotFound],
];

const render = (Page: () => ReactElement) => renderToStaticMarkup(<Page />);
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const count = (markup: string, pattern: RegExp) => markup.match(pattern)?.length ?? 0;

describe.each(PAGES)("página de %s", (_name, Page) => {
  const markup = render(Page);

  it("tiene un solo título principal y una región principal", () => {
    expect(count(markup, /<h1[\s>]/g)).toBe(1);
    expect(count(markup, /<main[\s>]/g)).toBe(1);
  });

  it("no usa palabras prohibidas por la revisión legal ni medios de pago no permitidos", () => {
    const lower = text(markup).toLowerCase();

    for (const word of FORBIDDEN_WORDS) expect(lower).not.toContain(word);
  });

  it("no lleva estilos en línea y toda imagen tiene texto alternativo", () => {
    expect(markup).not.toMatch(/\sstyle="/);
    expect(count(markup, /<img /g)).toBe(count(markup, /<img [^>]*alt="/g));
  });

  it("avisa que es una demo con datos de ejemplo", () => {
    expect(markup).toContain("Demo · nombres, empresas y cifras de ejemplo");
  });
});

describe("páginas legales", () => {
  it("los términos dicen que NIVEL no es el patrono y publican las tarifas con el IVA aparte", () => {
    const terms = text(render(TermsPage));

    expect(terms).toContain("NIVEL es la plataforma, no el patrono.");
    expect(terms).toContain("$30 más IVA");
    expect(terms).toContain("Plan Obra: $39 al mes más IVA, con 3 contrataciones incluidas");
    expect(terms).toContain("Pago Móvil o transferencia");
    expect(terms).toContain("comisión de 15 %");
    expect(terms).toContain("Garantía de búsqueda de 7 días");
  });

  it("la página de niveles publica la tabla completa y la regla de las calificaciones", () => {
    const levels = render(LevelsPage);

    expect(count(levels, /<tr[\s>]/g)).toBe(6);
    expect(count(levels, /scope="row"/g)).toBe(5);
    expect(text(levels)).toContain("Nivel 5 · Maestro");
    expect(text(levels)).toContain("$160 a $240");
    expect(text(levels)).toContain("nunca bajan tu nivel por sí solas");
    expect(text(levels)).toContain("No es una promesa de salario");
  });

  it("privacidad explica los cinco permisos por separado y los cuatro derechos", () => {
    const privacy = text(render(PrivacyPage));

    for (const permission of ["Voz:", "Selfie:", "Ubicación:", "Avisos:", "Compartir perfil:"]) {
      expect(privacy).toContain(permission);
    }
    for (const right of ["Ver todo", "Descargarlo", "Corregir", "Borrar tu cuenta"]) {
      expect(privacy).toContain(right);
    }
    expect(privacy).toContain("nunca un mapa en vivo");
    expect(privacy).toContain("mayores de 18 años");
  });
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "api" ? [] : sourceFiles(path);
    return /\.tsx$/.test(entry.name) && !entry.name.includes(".test.") ? [path] : [];
  });
}

describe("textos de toda la interfaz", () => {
  it("ningún archivo de pantallas o componentes contiene una palabra prohibida", () => {
    const files = [...sourceFiles(join("src", "app")), ...sourceFiles(join("src", "components"))];
    const offenders = files.filter((file) => {
      const content = readFileSync(file, "utf8").toLowerCase();
      return FORBIDDEN_WORDS.some((word) => content.includes(word));
    });

    expect(files.length).toBeGreaterThan(10);
    expect(offenders).toEqual([]);
  });
});
