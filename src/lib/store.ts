import postgres from "postgres";
import type { Arena } from "./types.js";

declare global {
  var __ackrateArenaMemory: Map<string, Arena> | undefined;
  var __ackrateDatabaseReady: Promise<void> | undefined;
}

const memory = globalThis.__ackrateArenaMemory ?? new Map<string, Arena>();
globalThis.__ackrateArenaMemory = memory;

let database: ReturnType<typeof postgres> | undefined;

function getDatabase() {
  if (!process.env.DATABASE_URL) return undefined;
  database ??= postgres(process.env.DATABASE_URL, {
    max: 5,
    prepare: false,
    idle_timeout: 20,
  });
  return database;
}

async function ensureDatabase() {
  const sql = getDatabase();
  if (!sql) return;
  globalThis.__ackrateDatabaseReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS arenas (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        buyer_email TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS arenas_updated_at_idx ON arenas (updated_at DESC)`;
  })();
  await globalThis.__ackrateDatabaseReady;
}

export async function saveArena(arena: Arena): Promise<Arena> {
  memory.set(arena.id, structuredClone(arena));
  const sql = getDatabase();
  if (sql) {
    await ensureDatabase();
    await sql`
      INSERT INTO arenas (id, slug, buyer_email, status, payload, created_at, updated_at)
      VALUES (
        ${arena.id},
        ${arena.slug},
        ${arena.buyerEmail},
        ${arena.status},
        ${JSON.stringify(arena)},
        ${arena.createdAt},
        ${arena.updatedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        buyer_email = EXCLUDED.buyer_email,
        status = EXCLUDED.status,
        payload = EXCLUDED.payload,
        updated_at = EXCLUDED.updated_at
    `;
  }
  return arena;
}

export async function getArena(id: string): Promise<Arena | null> {
  const cached = memory.get(id);
  if (cached) return structuredClone(cached);
  const sql = getDatabase();
  if (!sql) return null;
  await ensureDatabase();
  const rows = await sql<{ payload: string }[]>`SELECT payload FROM arenas WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) return null;
  const arena = JSON.parse(rows[0].payload) as Arena;
  memory.set(arena.id, arena);
  return structuredClone(arena);
}

export async function listArenas(limit = 12): Promise<Arena[]> {
  const sql = getDatabase();
  if (sql) {
    await ensureDatabase();
    const rows = await sql<{ payload: string }[]>`
      SELECT payload FROM arenas ORDER BY updated_at DESC LIMIT ${limit}
    `;
    return rows.map((row) => JSON.parse(row.payload) as Arena);
  }
  return [...memory.values()]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, limit)
    .map((arena) => structuredClone(arena));
}

export function storageMode(): "postgres" | "memory" {
  return process.env.DATABASE_URL ? "postgres" : "memory";
}
