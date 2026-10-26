// Aplica en orden las migraciones de /supabase/migrations aún no ejecutadas.
// Uso: npm run migrate   (lee SUPABASE_DB_URL de .env.local)
import { readdirSync, readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error("Falta SUPABASE_DB_URL en .env.local");

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(
  "create table if not exists public._migrations (name text primary key, applied_at timestamptz default now())",
);
// Sin políticas + RLS: la API pública no puede leer esta tabla.
await client.query("alter table public._migrations enable row level security");
const done = new Set((await client.query("select name from public._migrations")).rows.map((r) => r.name));

for (const file of readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(file)) continue;
  console.log("Aplicando", file);
  try {
    await client.query("begin");
    await client.query(readFileSync(`supabase/migrations/${file}`, "utf8"));
    await client.query("insert into public._migrations (name) values ($1)", [file]);
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  }
}
await client.end();
console.log("Migraciones al día");
