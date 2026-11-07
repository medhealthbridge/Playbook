// Creates/updates the database: Better Auth tables, then db/schema.sql.
// Usage: node --env-file=.env.local scripts/migrate.mjs
import { readFileSync } from "node:fs";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { getMigrations } from "better-auth/db/migration";
import { admin } from "better-auth/plugins";

neonConfig.webSocketConstructor = WebSocket;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const { toBeCreated, toBeAdded, runMigrations } = await getMigrations({
  database: pool,
  emailAndPassword: { enabled: true },
  plugins: [admin()],
});
console.log("auth tables to create:", toBeCreated.map((t) => t.table).join(", ") || "none");
console.log("auth columns to add:", toBeAdded.map((t) => `${t.table}(${Object.keys(t.fields).join(",")})`).join(", ") || "none");
await runMigrations();

const sql = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
await pool.query(sql);
const { rows } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1");
console.log("tables:", rows.map((r) => r.table_name).join(", "));
await pool.end();
