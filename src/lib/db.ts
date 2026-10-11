import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

type DbResult<T = Record<string, unknown>> = { data: T | null; error: Error | null };
type Operation = "select" | "insert" | "update" | "delete" | "upsert";
type Filter = { column: string; operator: "=" | "<>" | ">" | ">=" | "<" | "<=" | "IN" | "NOT IN"; value: unknown };

const globalDb = globalThis as typeof globalThis & { doctorSitePool?: Pool };
types.setTypeParser(20, (value) => Number.parseInt(value, 10));
types.setTypeParser(1700, (value) => Number.parseFloat(value));

export const pool = globalDb.doctorSitePool || new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/doctor_site",
  max: Number(process.env.POSTGRES_POOL_SIZE || 10),
  ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});

if (process.env.NODE_ENV !== "production") globalDb.doctorSitePool = pool;

function identifier(value: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return `"${value}"`;
}

function columns(value: string) {
  if (!value || value === "*") return "*";
  return value.split(",").map((item) => identifier(item.trim())).join(", ");
}

function dbValue(value: unknown) {
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return value;
}

class QueryBuilder<T extends QueryResultRow = QueryResultRow> implements PromiseLike<DbResult<T[]>> {
  private operation: Operation = "select";
  private selected = "*";
  private payload: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private filters: Filter[] = [];
  private ordering: { column: string; ascending: boolean }[] = [];
  private rowLimit?: number;
  private conflictColumn?: string;

  constructor(private readonly table: string) { identifier(table); }

  select(value = "*") { this.selected = value; return this; }
  insert(value: Record<string, unknown> | Record<string, unknown>[]) { this.operation = "insert"; this.payload = value; return this; }
  update(value: Record<string, unknown>) { this.operation = "update"; this.payload = value; return this; }
  delete() { this.operation = "delete"; return this; }
  upsert(value: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) { this.operation = "upsert"; this.payload = value; this.conflictColumn = options?.onConflict; return this; }
  eq(column: string, value: unknown) { return this.addFilter(column, "=", value); }
  neq(column: string, value: unknown) { return this.addFilter(column, "<>", value); }
  gt(column: string, value: unknown) { return this.addFilter(column, ">", value); }
  gte(column: string, value: unknown) { return this.addFilter(column, ">=", value); }
  lt(column: string, value: unknown) { return this.addFilter(column, "<", value); }
  lte(column: string, value: unknown) { return this.addFilter(column, "<=", value); }
  in(column: string, value: unknown[]) { return this.addFilter(column, "IN", value); }
  not(column: string, operator: string, value: unknown) {
    if (operator !== "in") throw new Error(`Unsupported NOT operator: ${operator}`);
    const parsed = typeof value === "string" ? value.replace(/^\(|\)$/g, "").split(",").map((item) => item.trim()) : value;
    return this.addFilter(column, "NOT IN", parsed);
  }
  order(column: string, options?: { ascending?: boolean }) { identifier(column); this.ordering.push({ column, ascending: options?.ascending !== false }); return this; }
  limit(value: number) { this.rowLimit = Math.max(0, Math.floor(value)); return this; }

  async single(): Promise<DbResult<T>> { return this.executeOne(false); }
  async maybeSingle(): Promise<DbResult<T>> { return this.executeOne(true); }

  then<TResult1 = DbResult<T[]>, TResult2 = never>(onfulfilled?: ((value: DbResult<T[]>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private addFilter(column: string, operator: Filter["operator"], value: unknown) { identifier(column); this.filters.push({ column, operator, value }); return this; }

  private async executeOne(optional: boolean): Promise<DbResult<T>> {
    const result = await this.limit(2).execute();
    if (result.error) return { data: null, error: result.error };
    const rows = result.data || [];
    if (rows.length === 1) return { data: rows[0]!, error: null };
    if (optional && rows.length === 0) return { data: null, error: null };
    return { data: null, error: new Error(rows.length === 0 ? "Row not found" : "Multiple rows returned") };
  }

  private where(values: unknown[]) {
    if (!this.filters.length) return "";
    const clauses = this.filters.map((filter) => {
      const col = identifier(filter.column);
      if (filter.operator === "IN" || filter.operator === "NOT IN") {
        const list = Array.isArray(filter.value) ? filter.value : [];
        if (!list.length) return filter.operator === "IN" ? "FALSE" : "TRUE";
        const placeholders = list.map((item) => { values.push(dbValue(item)); return `$${values.length}`; });
        return `${col} ${filter.operator} (${placeholders.join(", ")})`;
      }
      values.push(dbValue(filter.value));
      return `${col} ${filter.operator} $${values.length}`;
    });
    return ` WHERE ${clauses.join(" AND ")}`;
  }

  private async execute(): Promise<DbResult<T[]>> {
    try {
      if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) throw new Error("DATABASE_URL is required in production");
      const values: unknown[] = [];
      const table = identifier(this.table);
      let sql: string;

      if (this.operation === "select") {
        sql = `SELECT ${columns(this.selected)} FROM ${table}${this.where(values)}`;
        if (this.ordering.length) sql += ` ORDER BY ${this.ordering.map((item) => `${identifier(item.column)} ${item.ascending ? "ASC" : "DESC"}`).join(", ")}`;
        if (this.rowLimit !== undefined) sql += ` LIMIT ${this.rowLimit}`;
      } else if (this.operation === "delete") {
        sql = `DELETE FROM ${table}${this.where(values)} RETURNING ${columns(this.selected)}`;
      } else if (this.operation === "update") {
        const payload = this.payload as Record<string, unknown>;
        const set = Object.entries(payload).map(([key, value]) => { values.push(dbValue(value)); return `${identifier(key)} = $${values.length}`; });
        sql = `UPDATE ${table} SET ${set.join(", ")}${this.where(values)} RETURNING ${columns(this.selected)}`;
      } else {
        const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Record<string, unknown>[];
        if (!rows.length || !rows[0]) return { data: [], error: null };
        const keys = Object.keys(rows[0]);
        const groups = rows.map((row) => `(${keys.map((key) => { values.push(dbValue(row[key])); return `$${values.length}`; }).join(", ")})`);
        sql = `INSERT INTO ${table} (${keys.map(identifier).join(", ")}) VALUES ${groups.join(", ")}`;
        if (this.operation === "upsert") {
          if (!this.conflictColumn) throw new Error("Upsert requires onConflict");
          const conflict = identifier(this.conflictColumn);
          const updates = keys.filter((key) => key !== this.conflictColumn).map((key) => `${identifier(key)} = EXCLUDED.${identifier(key)}`);
          sql += ` ON CONFLICT (${conflict}) DO ${updates.length ? `UPDATE SET ${updates.join(", ")}` : "NOTHING"}`;
        }
        sql += ` RETURNING ${columns(this.selected)}`;
      }

      const result = await pool.query<T>(sql, values);
      return { data: result.rows, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error("Database query failed") };
    }
  }
}

export const db = {
  from<T extends QueryResultRow = QueryResultRow>(table: string) { return new QueryBuilder<T>(table); },
  async transaction<T>(callback: (client: PoolClient) => Promise<T>) {
    const client = await pool.connect();
    try { await client.query("BEGIN"); const result = await callback(client); await client.query("COMMIT"); return result; }
    catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  },
};
