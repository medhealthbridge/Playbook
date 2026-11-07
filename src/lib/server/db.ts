import "server-only";
import { Pool, neonConfig } from "@neondatabase/serverless";

// Node 22+ provides a global WebSocket; the Neon driver uses it for pooled connections.
if (typeof WebSocket !== "undefined") neonConfig.webSocketConstructor = WebSocket;

const g = globalThis as unknown as { __playbookPool?: Pool };

export function getPool(): Pool {
  if (!g.__playbookPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    g.__playbookPool = new Pool({ connectionString: url, max: 5 });
  }
  return g.__playbookPool;
}

/** Run a parameterised query and return its rows. */
export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query(text, params);
  return res.rows as T[];
}

export async function q1<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

/** Run several statements atomically. */
export async function tx<T>(fn: (query: <R = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<R[]>) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(async (text, params = []) => (await client.query(text, params)).rows);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function audit(actorId: string | null, action: string, targetType: string, targetId: string | null, meta: Record<string, unknown> = {}) {
  await q("INSERT INTO audit_log (actor_id, action, target_type, target_id, meta) VALUES ($1, $2, $3, $4, $5)", [actorId, action, targetType, targetId, JSON.stringify(meta)]);
}
