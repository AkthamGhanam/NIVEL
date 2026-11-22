import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type DatabaseHandle, migrate, openDatabase } from "./client";
import { tableName } from "./ddl";
import { resetDemo } from "./reset";
import { schema } from "./schema";

const NOW = new Date("2026-11-22T06:30:00Z");
const MAX_RESET_MS = 3000;

let directory: string;
let handle: DatabaseHandle;

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "nivel-db-"));
  handle = openDatabase({ url: `file:${join(directory, "test.db")}` });
  await migrate(handle);
});

afterAll(() => {
  handle.client.close();
  rmSync(directory, { recursive: true, force: true });
});

/** Huella del contenido completo de la base, tabla por tabla y fila por fila. */
async function contentHash(): Promise<string> {
  const hash = createHash("sha256");
  for (const table of Object.values(schema)) {
    const name = tableName(table);
    const result = await handle.client.execute(`SELECT * FROM "${name}" ORDER BY 1`);
    hash.update(name).update(JSON.stringify(result.rows));
  }
  return hash.digest("hex");
}

const realWorker = {
  id: "w-real-1",
  name: "María",
  isAdult: true,
  trade: "electricista" as const,
  skills: [],
  zone: "Valencia",
  lat: 10.162,
  lng: -68.007,
  availability: "Tardes",
  createdVia: "voz" as const,
  isReal: true,
  createdAt: NOW.toISOString(),
};

describe("migrate", () => {
  it("es idempotente y activa las claves foráneas", async () => {
    await expect(migrate(handle)).resolves.toBeUndefined();
  });

  it("rechaza valores fuera de los enums cerrados", async () => {
    const insertWhatsapp = handle.client.execute({
      sql: `INSERT INTO workers (id, name, trade, skills, zone, lat, lng, availability, created_via, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: ["w-x", "X", "soldador", "[]", "Z", 0, 0, "-", "whatsapp", NOW.toISOString()],
    });

    await expect(insertWhatsapp).rejects.toThrow(/CHECK/i);
  });
});

describe("resetDemo", () => {
  it("carga el seed completo en menos de 3 segundos", async () => {
    const startedAt = performance.now();

    const summary = await resetDemo(handle, { now: NOW, keepRealWorkers: true });

    expect(performance.now() - startedAt).toBeLessThan(MAX_RESET_MS);
    expect(summary.insertedRows).toBeGreaterThan(400);
    expect(await handle.db.$count(schema.workers)).toBe(40);
  });

  it("es idempotente: dos resets seguidos dejan la base idéntica", async () => {
    await resetDemo(handle, { now: NOW, keepRealWorkers: true });
    const first = await contentHash();

    await resetDemo(handle, { now: NOW, keepRealWorkers: true });

    expect(await contentHash()).toBe(first);
  });

  it("borra lo que pasó en la demo y vuelve al seed", async () => {
    await resetDemo(handle, { now: NOW, keepRealWorkers: true });
    const clean = await contentHash();
    await handle.db.insert(schema.events).values({
      id: "ev-1",
      ts: NOW.toISOString(),
      actor: "demo",
      type: "prueba",
      label: "evento de prueba",
      product: "app",
    });
    expect(await contentHash()).not.toBe(clean);

    await resetDemo(handle, { now: NOW, keepRealWorkers: true });

    expect(await contentHash()).toBe(clean);
  });

  it("conserva los perfiles de personas reales", async () => {
    await resetDemo(handle, { now: NOW, keepRealWorkers: true });
    await handle.db.insert(schema.workers).values(realWorker);

    const summary = await resetDemo(handle, { now: NOW, keepRealWorkers: true });

    expect(summary.keptRealWorkers).toBe(1);
    expect(await handle.db.$count(schema.workers)).toBe(41);
  });

  it("borra también los perfiles reales cuando se pide explícitamente", async () => {
    const summary = await resetDemo(handle, { now: NOW, keepRealWorkers: false });

    expect(summary.keptRealWorkers).toBe(0);
    expect(await handle.db.$count(schema.workers)).toBe(40);
  });

  it("no deja la base a medias si el seed falla (todo o nada)", async () => {
    await resetDemo(handle, { now: NOW, keepRealWorkers: true });
    const before = await contentHash();
    await handle.client.execute(`DROP TABLE "demo_state"`);

    await expect(resetDemo(handle, { now: NOW, keepRealWorkers: true })).rejects.toThrow();

    await migrate(handle);
    await handle.db.insert(schema.demoState).values((await import("./seed/build")).buildSeed(NOW).demoState);
    expect(await contentHash()).toBe(before);
  });
});
