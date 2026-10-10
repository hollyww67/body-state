import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(scriptDir, "../migrations");
await access(migrationsDir);

const files = (await readdir(migrationsDir))
  .filter((file) => /^\d+.*\.sql$/i.test(file))
  .sort((left, right) => left.localeCompare(right, "en", { numeric: true }));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

const client = await pool.connect();
try {
  await client.query("SELECT pg_advisory_lock($1)", [827364219]);
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const appliedResult = await client.query("SELECT filename FROM schema_migrations");
  const applied = new Set(appliedResult.rows.map((row) => row.filename));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`Applied migration: ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  console.log("PostgreSQL schema is up to date");
} finally {
  await client.query("SELECT pg_advisory_unlock($1)", [827364219]).catch(() => undefined);
  client.release();
  await pool.end();
}
