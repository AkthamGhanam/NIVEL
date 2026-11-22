import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";

import { createTableSql, tableName } from "./ddl";
import { schema } from "./schema";

describe("createTableSql", () => {
  it("genera claves, NOT NULL, valores por defecto, UNIQUE, CHECK de enums y claves foráneas", () => {
    const sql = createTableSql(schema.payments);

    expect(sql).toContain(`CREATE TABLE IF NOT EXISTS "payments"`);
    expect(sql).toContain(`"id" TEXT PRIMARY KEY NOT NULL`);
    expect(sql).toContain(`"receipt_number" TEXT NOT NULL UNIQUE`);
    expect(sql).toContain(`CHECK ("method" IN ('pago_movil', 'transferencia'))`);
    expect(sql).toContain(`FOREIGN KEY ("contract_id") REFERENCES "contracts" ("id")`);
  });

  it("no admite el canal WhatsApp ni medios de pago fuera de la regla legal", () => {
    const allDdl = Object.values(schema).map(createTableSql).join("\n").toLowerCase();

    for (const forbidden of ["whatsapp", "zelle", "usdt"]) expect(allDdl).not.toContain(forbidden);
  });

  it("escribe los valores por defecto numéricos, booleanos y de texto", () => {
    const sample = sqliteTable("sample", {
      count: integer("count").default(3),
      active: integer("active", { mode: "boolean" }).default(true),
      label: text("label").default("it's"),
    });

    const sql = createTableSql(sample);

    expect(sql).toContain(`"count" INTEGER DEFAULT 3`);
    expect(sql).toContain(`"active" INTEGER DEFAULT 1`);
    expect(sql).toContain(`"label" TEXT DEFAULT 'it''s'`);
  });

  it("rechaza identificadores que no sean snake_case simple", () => {
    const hostile = sqliteTable("ok", { bad: text('x"; DROP TABLE workers; --') });

    expect(() => createTableSql(hostile)).toThrow(/Identificador SQL inválido/);
  });

  it("rechaza valores por defecto que no sabe escribir", () => {
    const odd = sqliteTable("odd", { data: text("data", { mode: "json" }).default({ a: 1 }) });

    expect(() => createTableSql(odd)).toThrow(/Valor por defecto no soportado/);
  });

  it("devuelve el nombre real de la tabla", () => {
    expect(tableName(schema.jobRequests)).toBe("job_requests");
  });
});
