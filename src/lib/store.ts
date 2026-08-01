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

function useSupabaseSchema() {
  return process.env.DATABASE_PROVIDER?.trim().toLowerCase() === "supabase";
}

async function syncSupabaseArena(arena: Arena) {
  const sql = getDatabase();
  if (!sql || !useSupabaseSchema()) return;

  await sql.begin(async (transaction) => {
    await transaction`
      UPDATE arenas SET
        buyer_id = ${arena.buyerId},
        topic_public = ${arena.topicPublic},
        topic_private = ${arena.topicPrivate || null},
        topic_visibility = ${arena.topicVisibility},
        minimum_global_elo = ${arena.qualification.minimumGlobalElo},
        qualified_agent_count = ${arena.qualification.qualifiedAgentCount},
        budget = ${arena.budget},
        currency = ${arena.currency},
        fingerprint = ${transaction.json(arena.fingerprint)}
      WHERE id = ${arena.id}
    `;

    for (const criterion of arena.criteria) {
      await transaction`
        INSERT INTO arena_criteria (
          arena_id, criterion_id, label, description, weight, visibility
        ) VALUES (
          ${arena.id}, ${criterion.id}, ${criterion.label}, ${criterion.description},
          ${criterion.weight}, ${criterion.visibility}
        )
        ON CONFLICT (arena_id, criterion_id) DO UPDATE SET
          label = EXCLUDED.label,
          description = EXCLUDED.description,
          weight = EXCLUDED.weight,
          visibility = EXCLUDED.visibility
      `;
    }

    await transaction`
      INSERT INTO payments (
        arena_id, mode, status, authorized_budget, settlement_amount, currency,
        session_id, mandate_id, transaction_id, order_id, provider_response_id,
        error_code
      ) VALUES (
        ${arena.id}, ${arena.payment.mode}, ${arena.payment.status}, ${arena.budget},
        ${arena.finalBundle?.totalPrice ?? null}, ${arena.currency},
        ${arena.payment.sessionId ?? null}, ${arena.payment.mandateId ?? null},
        ${arena.payment.transactionId ?? null}, ${arena.payment.orderId ?? null},
        ${arena.payment.responseId ?? null}, ${arena.payment.error ?? null}
      )
      ON CONFLICT (arena_id) DO UPDATE SET
        mode = EXCLUDED.mode,
        status = EXCLUDED.status,
        authorized_budget = EXCLUDED.authorized_budget,
        settlement_amount = EXCLUDED.settlement_amount,
        currency = EXCLUDED.currency,
        session_id = EXCLUDED.session_id,
        mandate_id = EXCLUDED.mandate_id,
        transaction_id = EXCLUDED.transaction_id,
        order_id = EXCLUDED.order_id,
        provider_response_id = EXCLUDED.provider_response_id,
        error_code = EXCLUDED.error_code,
        updated_at = NOW()
    `;

    for (const submission of arena.submissions) {
      await transaction`
        INSERT INTO arena_participants (
          arena_id, agent_id, qualification_elo, qualified,
          private_context_disclosed, submitted_at
        ) VALUES (
          ${arena.id}, ${submission.agentId}, ${submission.globalElo}, TRUE,
          ${arena.topicVisibility === "gated"}, ${arena.updatedAt}
        )
        ON CONFLICT (arena_id, agent_id) DO UPDATE SET
          qualification_elo = EXCLUDED.qualification_elo,
          qualified = EXCLUDED.qualified,
          private_context_disclosed = EXCLUDED.private_context_disclosed,
          submitted_at = EXCLUDED.submitted_at
      `;

      const sourceCount = new Set(submission.report.findings.map((finding) => finding.sourceUrl)).size;
      const discarded = arena.status === "complete" && !submission.isWinner;
      await transaction`
        INSERT INTO arena_submissions (
          id, arena_id, agent_id, provider, bid_amount, global_elo, arena_elo,
          is_winner, disposition, report, finding_count, source_count,
          submitted_at, discarded_at
        ) VALUES (
          ${submission.id}, ${arena.id}, ${submission.agentId}, ${submission.provider},
          ${submission.bidAmount}, ${submission.globalElo}, ${submission.elo},
          ${submission.isWinner},
          ${discarded ? "discarded" : submission.isWinner ? "winner" : "submitted"},
          ${discarded ? null : transaction.json(submission.report)},
          ${submission.report.findings.length}, ${sourceCount}, ${arena.updatedAt},
          ${discarded ? arena.updatedAt : null}
        )
        ON CONFLICT (id) DO UPDATE SET
          bid_amount = EXCLUDED.bid_amount,
          global_elo = EXCLUDED.global_elo,
          arena_elo = EXCLUDED.arena_elo,
          is_winner = EXCLUDED.is_winner,
          disposition = EXCLUDED.disposition,
          report = EXCLUDED.report,
          finding_count = EXCLUDED.finding_count,
          source_count = EXCLUDED.source_count,
          discarded_at = EXCLUDED.discarded_at,
          updated_at = NOW()
      `;
    }

    for (const evaluation of arena.evaluations) {
      await transaction`
        INSERT INTO arena_evaluations (
          id, arena_id, criterion_id, left_submission_id,
          right_submission_id, winner_submission_id, rationale
        ) VALUES (
          ${evaluation.id}, ${arena.id}, ${evaluation.criterionId},
          ${evaluation.leftSubmissionId}, ${evaluation.rightSubmissionId},
          ${evaluation.winnerSubmissionId}, ${evaluation.rationale}
        )
        ON CONFLICT (id) DO UPDATE SET
          winner_submission_id = EXCLUDED.winner_submission_id,
          rationale = EXCLUDED.rationale
      `;
    }

    if (arena.status === "complete" && arena.finalBundle) {
      for (const winner of arena.submissions.filter((submission) => submission.isWinner)) {
        await transaction`
          INSERT INTO settlements (
            arena_id, submission_id, agent_id, amount, currency, status,
            prava_transaction_id
          ) VALUES (
            ${arena.id}, ${winner.id}, ${winner.agentId}, ${winner.bidAmount},
            ${arena.currency}, 'completed', ${arena.payment.transactionId ?? null}
          )
          ON CONFLICT (arena_id, submission_id) DO UPDATE SET
            amount = EXCLUDED.amount,
            currency = EXCLUDED.currency,
            status = EXCLUDED.status,
            prava_transaction_id = EXCLUDED.prava_transaction_id,
            updated_at = NOW()
        `;
      }
    }
  });
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
    await syncSupabaseArena(arena);
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

export function storageMode(): "supabase" | "postgres" | "memory" {
  if (!process.env.DATABASE_URL) return "memory";
  return useSupabaseSchema() ? "supabase" : "postgres";
}
