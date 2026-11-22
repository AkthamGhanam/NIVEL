import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type DatabaseHandle, migrate, openDatabase } from "./client";
import { addColumnSql, createTableSql } from "./ddl";
import { schema } from "./schema";

let directory: string;
let handle: DatabaseHandle;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "nivel-migrate-"));
  handle = openDatabase({ url: `file:${join(directory, "old.db")}` });
});

afterEach(() => {
  handle.client.close();
  rmSync(directory, { recursive: true, force: true });
});

const columnsOf = async (table: string) =>
  (await handle.client.execute(`PRAGMA table_info("${table}")`)).rows.map((row) => String(row.name));

describe("migrate", () => {
  it("agrega las columnas nuevas a una tabla que ya existía, sin perder sus filas", async () => {
    // La tabla tal como era antes de agregar "Abierto a trabajar" y el borrado de cuenta.
    const oldWorkers = createTableSql(schema.workers)
      .split("\n")
      .filter((line) => !/"open_to_work"|"deleted_at"/.test(line))
      .join("\n");
    await handle.client.execute(oldWorkers);
    await handle.client.execute(
      `INSERT INTO "workers" ("id", "name", "trade", "skills", "zone", "lat", "lng", "availability", "created_via", "created_at")
       VALUES ('w-1', 'Persona de Antes', 'soldador', '[]', 'Valencia', 10.1, -68, 'inmediata', 'seed', '2026-11-01T00:00:00Z')`,
    );
    const before = await columnsOf("workers");

    await migrate(handle);
    await migrate(handle);

    const [worker] = (await handle.client.execute(`SELECT * FROM "workers"`)).rows;
    expect(before).not.toContain("open_to_work");
    expect(await columnsOf("workers")).toEqual(expect.arrayContaining(["open_to_work", "deleted_at"]));
    expect(worker).toMatchObject({ id: "w-1", name: "Persona de Antes", open_to_work: 1, deleted_at: null });
  });

  it("en una base vacía crea todas las tablas del esquema", async () => {
    await migrate(handle);
    const tables = (await handle.client.execute(`SELECT name FROM sqlite_master WHERE type = 'table'`)).rows;

    expect(tables).toHaveLength(Object.keys(schema).length);
  });
});

describe("addColumnSql", () => {
  const sample = sqliteTable("sample", {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    required: text("required").notNull(),
    count: integer("count").notNull().default(0),
    note: text("note"),
  });

  it("escribe el ALTER de una columna opcional o con valor por defecto", () => {
    expect(addColumnSql(sample, "note")).toBe(`ALTER TABLE "sample" ADD COLUMN "note" TEXT`);
    expect(addColumnSql(sample, "count")).toBe(
      `ALTER TABLE "sample" ADD COLUMN "count" INTEGER NOT NULL DEFAULT 0`,
    );
  });

  it("se niega a agregar claves, columnas únicas u obligatorias sin valor por defecto", () => {
    for (const column of ["id", "code", "required"]) {
      expect(() => addColumnSql(sample, column)).toThrow(/no se puede agregar/);
    }
    expect(() => addColumnSql(sample, "otra")).toThrow(/no tiene la columna/);
  });
});
