import pg from "pg";

const sourceUrl = process.env.SUPABASE_MIGRATION_URL;
const sourceKey = process.env.SUPABASE_MIGRATION_SERVICE_KEY;
const databaseUrl = process.env.DATABASE_URL;
if (!sourceUrl || !sourceKey || !databaseUrl) throw new Error("Set SUPABASE_MIGRATION_URL, SUPABASE_MIGRATION_SERVICE_KEY and DATABASE_URL");

const tables = ["settings", "page_content", "blog_posts", "faq_answers", "slots", "bfm_bookings", "brt_bookings", "psychology_bookings", "program_enrollments", "consultation_enrollments", "products", "orders", "reviews", "media_gallery", "psychology_programs", "psychology_rooms", "push_tokens"];
const numericTypes = new Set(["smallint", "integer", "bigint", "numeric", "decimal", "real", "double precision"]);
const pool = new pg.Pool({ connectionString: databaseUrl, ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : undefined });

function normalizeValue(value, destinationType) {
  if (value === null || value === undefined) return value;
  if (numericTypes.has(destinationType) && typeof value === "string") {
    const numeric = value.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
    if (numeric && Number.isFinite(Number(numeric))) return Number(numeric);
  }
  return typeof value === "object" ? JSON.stringify(value) : value;
}

for (const table of tables) {
  const destination = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1", [table]);
  const columnTypes = new Map(destination.rows.map((row) => [row.column_name, row.data_type]));
  const allowed = new Set(columnTypes.keys());
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(`${sourceUrl}/rest/v1/${table}?select=*`, { headers: { apikey: sourceKey, Authorization: `Bearer ${sourceKey}`, Range: `${offset}-${offset + 999}` } });
    if (!response.ok) { console.warn(`Skip ${table}: ${response.status} ${await response.text()}`); break; }
    const page = await response.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  if (!rows.length) { console.log(`${table}: empty`); continue; }
  for (const sourceRow of rows) {
    const row = { ...sourceRow };
    if (table === "consultation_enrollments") {
      row.name ||= row.client_name;
      row.phone ||= row.client_phone;
      row.message ||= row.notes;
    }
    const destinationIdType = columnTypes.get("id");
    const sourceIdIsUuid = typeof row.id === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(row.id);
    if (["smallint", "integer", "bigint"].includes(destinationIdType) && sourceIdIsUuid && allowed.has("legacy_id")) {
      row.legacy_id = row.id;
    }
    const keys = Object.keys(row).filter((key) => {
      if (!allowed.has(key)) return false;
      const destinationType = columnTypes.get(key);
      const value = row[key];
      const destinationIsInteger = ["smallint", "integer", "bigint"].includes(destinationType);
      const sourceIsUuid = typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
      // A few independent Supabase content tables used UUID primary keys. Their
      // PostgreSQL replacements use generated integers and have no inbound FKs.
      return !(key === "id" && destinationIsInteger && sourceIsUuid);
    });
    if (!keys.length) continue;
    const values = keys.map((key) => normalizeValue(row[key], columnTypes.get(key)));
    const quoted = keys.map((key) => `"${key.replaceAll('"', '""')}"`);
    const placeholders = keys.map((_, index) => `$${index + 1}`);
    await pool.query(`INSERT INTO "${table}" (${quoted.join(",")}) VALUES (${placeholders.join(",")}) ON CONFLICT DO NOTHING`, values);
  }
  console.log(`${table}: ${rows.length} rows imported`);
}

for (const table of ["page_content", "consultation_enrollments", "reviews", "media_gallery", "psychology_programs", "psychology_rooms"]) {
  await pool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), true)`);
}

await pool.end();
