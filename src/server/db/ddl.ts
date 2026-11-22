import { getTableConfig, type SQLiteColumn, type SQLiteTable } from "drizzle-orm/sqlite-core";

/**
 * Genera el DDL a partir del esquema de Drizzle, que es la única fuente de
 * verdad. Así el esquema tipado y las tablas reales no pueden divergir.
 * Todo el SQL sale de identificadores y literales definidos en el código:
 * aquí nunca entra texto de usuarios.
 */

const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/;

function quoteIdentifier(name: string): string {
  if (!IDENTIFIER_PATTERN.test(name)) throw new Error(`Identificador SQL inválido: ${name}`);
  return `"${name}"`;
}

const quoteLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;

function defaultClause(column: SQLiteColumn): string {
  if (!column.hasDefault || column.default === undefined) return "";
  const value = column.default;
  if (typeof value === "boolean") return ` DEFAULT ${value ? 1 : 0}`;
  if (typeof value === "number") return ` DEFAULT ${value}`;
  if (typeof value === "string") return ` DEFAULT ${quoteLiteral(value)}`;
  throw new Error(`Valor por defecto no soportado en la columna ${column.name}`);
}

function enumCheck(column: SQLiteColumn): string {
  const values = column.enumValues;
  if (!values || values.length === 0) return "";
  return ` CHECK (${quoteIdentifier(column.name)} IN (${values.map(quoteLiteral).join(", ")}))`;
}

function columnSql(column: SQLiteColumn): string {
  const parts = [quoteIdentifier(column.name), column.getSQLType().toUpperCase()];
  if (column.primary) parts.push("PRIMARY KEY");
  if (column.notNull) parts.push("NOT NULL");
  if (column.isUnique) parts.push("UNIQUE");
  return parts.join(" ") + defaultClause(column) + enumCheck(column);
}

/** `CREATE TABLE IF NOT EXISTS` para una tabla del esquema. */
export function createTableSql(table: SQLiteTable): string {
  const config = getTableConfig(table);
  const foreignKeys = config.foreignKeys.map((foreignKey) => {
    const reference = foreignKey.reference();
    const local = reference.columns.map((column) => quoteIdentifier(column.name)).join(", ");
    const foreign = reference.foreignColumns.map((column) => quoteIdentifier(column.name)).join(", ");
    const foreignTable = quoteIdentifier(getTableConfig(reference.foreignTable).name);
    return `FOREIGN KEY (${local}) REFERENCES ${foreignTable} (${foreign})`;
  });
  const definitions = [...config.columns.map(columnSql), ...foreignKeys];
  return `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(config.name)} (\n  ${definitions.join(",\n  ")}\n)`;
}

export const tableName = (table: SQLiteTable): string => getTableConfig(table).name;

/** Nombres de las columnas de una tabla según el esquema. */
export const columnNames = (table: SQLiteTable): string[] =>
  getTableConfig(table).columns.map((column) => column.name);

/**
 * `ALTER TABLE … ADD COLUMN` para una columna que el esquema tiene y la base
 * todavía no. SQLite solo puede agregar columnas opcionales o con valor por
 * defecto, y nunca claves ni UNIQUE: en esos casos se falla con un error claro
 * en vez de dejar la base a medias.
 */
export function addColumnSql(table: SQLiteTable, columnName: string): string {
  const config = getTableConfig(table);
  const column = config.columns.find((candidate) => candidate.name === columnName);
  if (!column) throw new Error(`La tabla ${config.name} no tiene la columna ${columnName}`);
  const addable = !column.primary && !column.isUnique && (!column.notNull || column.hasDefault);
  if (!addable) {
    throw new Error(`La columna ${config.name}.${columnName} no se puede agregar a una tabla que ya existe`);
  }
  return `ALTER TABLE ${quoteIdentifier(config.name)} ADD COLUMN ${columnSql(column)}`;
}
