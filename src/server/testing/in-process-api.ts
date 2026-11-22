import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { vi } from "vitest";

import type { RouteHandler } from "../http/endpoint";

/**
 * Ejecuta las rutas reales de `src/app/api` dentro del proceso de pruebas,
 * sin levantar un servidor: resuelve la URL al archivo `route.ts` igual que
 * Next.js (carpetas estáticas primero, luego `[param]`) y llama a su manejador.
 * Así las pruebas cubren el cableado real y no una copia.
 */

const API_ROOT = join(process.cwd(), "src", "app", "api");
/** Secretos de un solo uso: se generan en cada corrida, no hay ninguno escrito en el código. */
const ephemeralSecret = () => randomBytes(32).toString("hex");
const DYNAMIC_SEGMENT = /^\[(\w+)\]$/;

interface ResolvedRoute {
  readonly file: string;
  readonly params: Record<string, string>;
}

function resolveRoute(pathname: string): ResolvedRoute | undefined {
  const segments = pathname
    .replace(/^\/api\/?/, "")
    .split("/")
    .filter(Boolean);
  let directory = API_ROOT;
  const params: Record<string, string> = {};
  for (const segment of segments) {
    if (existsSync(join(directory, segment))) {
      directory = join(directory, segment);
      continue;
    }
    const dynamic = readdirSync(directory).find((entry) => DYNAMIC_SEGMENT.test(entry));
    const name = dynamic?.match(DYNAMIC_SEGMENT)?.[1];
    if (!dynamic || !name) return undefined;
    params[name] = decodeURIComponent(segment);
    directory = join(directory, dynamic);
  }
  const file = join(directory, "route.ts");
  return existsSync(file) ? { file, params } : undefined;
}

const notFound = () => new Response(null, { status: 404 });

/** Transporte para `ApiClient` que despacha a los archivos de ruta. */
export async function dispatch(request: Request): Promise<Response> {
  const route = resolveRoute(new URL(request.url).pathname);
  if (!route) return notFound();
  const handlers = (await import(/* @vite-ignore */ route.file)) as Record<string, RouteHandler | undefined>;
  const handler = handlers[request.method];
  if (!handler) return new Response(null, { status: 405 });
  return handler(request, { params: Promise.resolve(route.params) });
}

export interface InProcessApi {
  readonly baseUrl: string;
  readonly demoKey: string;
  readonly toolSecret: string;
  readonly dispose: () => void;
}

/** Prepara el entorno (base temporal y secretos de prueba) antes de importar ninguna ruta. */
export function startInProcessApi(): InProcessApi {
  const directory = mkdtempSync(join(tmpdir(), "nivel-api-"));
  vi.stubEnv("TURSO_DATABASE_URL", `file:${join(directory, "api.db")}`);
  const demoKey = ephemeralSecret();
  const toolSecret = ephemeralSecret();
  vi.stubEnv("TOOL_SECRET", toolSecret);
  vi.stubEnv("SESSION_SECRET", ephemeralSecret());
  vi.stubEnv("DEMO_RESET_KEY", demoKey);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  return {
    baseUrl: "http://localhost:3000",
    demoKey,
    toolSecret,
    dispose: () => {
      vi.unstubAllEnvs();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
