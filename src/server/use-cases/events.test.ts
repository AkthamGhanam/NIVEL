import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestApp, type TestApp } from "../testing/test-app";
import { listEventsSince, logEvent } from "./events";

/**
 * Orden de la bitácora. El reloj de las pruebas está fijo, así que todos los
 * eventos caen en el mismo milisegundo: es el caso que antes salía barajado.
 */

let app: TestApp;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(() => app.close());

describe("bitácora", () => {
  it("los eventos del mismo instante salen en el orden en que se registraron", async () => {
    const before = (await listEventsSince(app.context, undefined)).length;
    const labels = Array.from({ length: 12 }, (_, index) => `paso ${index + 1}`);
    for (const label of labels) await logEvent(app.context, { actor: "Prueba", type: "paso", label });

    const listed = await listEventsSince(app.context, undefined);
    const steps = listed.slice(before);

    expect(new Set(steps.map((event) => event.ts)).size).toBe(1);
    expect(steps.map((event) => event.label)).toEqual(labels);
  });

  it("guarda solo lo indicado y redondea la latencia", async () => {
    await logEvent(app.context, {
      actor: "Nivi",
      type: "tts",
      label: "TTS · nota de voz",
      detail: { characters: 42 },
      latencyMs: 12.6,
      product: "tts",
    });

    const last = (await listEventsSince(app.context, undefined)).at(-1);

    expect(last).toMatchObject({ actor: "Nivi", product: "tts", latencyMs: 13, detail: { characters: 42 } });
  });
});
