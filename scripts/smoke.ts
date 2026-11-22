/**
 * Smoke del camino dorado contra un servidor en marcha.
 * Uso: npm run smoke                         (http://localhost:3000)
 *      SMOKE_BASE_URL=https://… npm run smoke
 * Necesita DEMO_RESET_KEY en el entorno (la misma del servidor). Reinicia la
 * demo al empezar y al terminar; con `--keep` deja el estado final para verlo.
 */
import { ApiClient } from "./smoke/client";
import { runGoldenPath } from "./smoke/golden-path";

const DEFAULT_BASE_URL = "http://localhost:3000";
const HEALTH_ATTEMPTS = 30;
const HEALTH_PAUSE_MS = 1000;

async function waitUntilHealthy(baseUrl: string): Promise<void> {
  for (let attempt = 1; attempt <= HEALTH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(new URL("/api/health", baseUrl));
      if (response.ok) return;
    } catch {
      // El servidor todavía está arrancando.
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_PAUSE_MS));
  }
  throw new Error(`El servidor no respondió en ${baseUrl}/api/health`);
}

async function main(): Promise<void> {
  const baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL;
  const demoKey = process.env.DEMO_RESET_KEY;
  if (!demoKey) throw new Error("Falta DEMO_RESET_KEY en el entorno");
  await waitUntilHealthy(baseUrl);
  const newClient = () => new ApiClient(baseUrl, (request) => fetch(request), demoKey);
  const workers = new Map<string, ApiClient>();
  const team = newClient();
  const startedAt = performance.now();
  await runGoldenPath(
    {
      company: newClient(),
      team,
      worker: async (workerId) => {
        const existing = workers.get(workerId);
        if (existing) return existing;
        const client = newClient();
        await client.enterAs("worker", workerId);
        workers.set(workerId, client);
        return client;
      },
    },
    (title) => console.warn(`▸ ${title}`),
  );
  if (!process.argv.includes("--keep")) await team.post("/api/demo/reset", { as: "admin" });
  console.warn(`Camino dorado completo en ${Math.round(performance.now() - startedAt)} ms contra ${baseUrl}`);
}

main().catch((error: unknown) => {
  console.error("✗ Smoke fallido:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
