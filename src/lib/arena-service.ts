import { createHash, randomUUID } from "node:crypto";
import { ARENA_MANDATE_TTL_MS, createArenaFingerprint } from "./fingerprint.js";
import {
  chargeAndReportMandate,
  createBudgetMandateSession,
  findActiveMandate,
} from "./prava.js";
import { providerMode, qualifiedAgentCount, runResearchArena } from "./research.js";
import {
  initialStellarAnchor,
  registerArenaMandateOnTestnet,
} from "./stellar-anchor.js";
import { getArena, listArenas, saveArena } from "./store.js";
import type { Arena, CreateArenaInput, Criterion } from "./types.js";

export class ArenaServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

function now() {
  return new Date().toISOString();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "research-arena";
}

function buyerId(email: string) {
  return `buyer_${createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 24)}`;
}

function getDemoMode() {
  return process.env.DEMO_MODE !== "false";
}

async function requireArena(id: string) {
  const arena = await getArena(id);
  if (!arena) throw new ArenaServiceError("Arena not found", 404, "ARENA_NOT_FOUND");
  arena.stellarAnchor ??= initialStellarAnchor(arena.id);
  return arena;
}

export async function createArena(input: CreateArenaInput) {
  const id = randomUUID();
  const createdAt = now();
  const requestedCriteria = input.criteria?.length ? input.criteria : [
    { label: "evidence quality", description: "Strength and relevance of cited evidence", visibility: "public" as const },
    { label: "source reliability", description: "Authority and independence of sources", visibility: "public" as const },
    { label: "decision usefulness", description: "Clarity, tradeoffs, and executable next steps", visibility: "public" as const },
  ];
  const criteria: Criterion[] = requestedCriteria.map((criterion, index) => ({
    id: `criterion_${index + 1}`,
    label: criterion.label.trim(),
    description: criterion.description?.trim() || "",
    visibility: criterion.visibility || "public",
    weight: 1 / requestedCriteria.length,
  }));
  const expiresAt = new Date(Date.now() + ARENA_MANDATE_TTL_MS);
  const arena: Arena = {
    id,
    slug: `${slugify(input.topicPublic)}-${id.slice(0, 6)}`,
    buyerId: buyerId(input.buyerEmail),
    buyerEmail: input.buyerEmail.trim().toLowerCase(),
    topicPublic: input.topicPublic.trim(),
    topicPrivate: input.topicPrivate?.trim() || "",
    topicVisibility: input.topicPrivate?.trim() ? "gated" : "public",
    qualification: {
      minimumGlobalElo: input.minimumAgentElo ?? 0,
      qualifiedAgentCount: qualifiedAgentCount(input.minimumAgentElo ?? 0),
    },
    criteria,
    budget: Number(input.budget.toFixed(2)),
    currency: "USD",
    status: "funding_required",
    fingerprint: createArenaFingerprint({
      arenaId: id,
      topic: input.topicPublic,
      criteria,
      budget: input.budget,
      expiresAt,
    }),
    stellarAnchor: initialStellarAnchor(id),
    payment: {
      mode: getDemoMode() ? "demo" : "prava",
      status: "not_started",
    },
    submissions: [],
    evaluations: [],
    createdAt,
    updatedAt: createdAt,
  };
  await saveArena(arena);
  return arena;
}

export async function authorizeArena(id: string) {
  const arena = await requireArena(id);
  if (!["funding_required", "funding_pending"].includes(arena.status)) {
    throw new ArenaServiceError("Arena is not awaiting authorization", 409, "INVALID_ARENA_STATE");
  }
  if (getDemoMode()) {
    arena.status = "funded";
    arena.payment = { mode: "demo", status: "active", mandateId: `demo_${arena.id}` };
    arena.updatedAt = now();
    return saveArena(arena);
  }

  const session = await createBudgetMandateSession(arena);
  arena.status = "funding_pending";
  arena.payment = {
    mode: "prava",
    status: "pending_approval",
    sessionId: session.session_id,
    orderId: session.order_id,
    iframeUrl: session.iframe_url,
    responseId: session.responseId,
  };
  arena.updatedAt = now();
  return saveArena(arena);
}

export async function refreshArenaPayment(id: string) {
  const arena = await requireArena(id);
  if (arena.payment.mode === "demo") return arena;
  const mandate = await findActiveMandate(arena);
  if (mandate) {
    arena.status = arena.status === "funding_pending" ? "funded" : arena.status;
    arena.payment.status = "active";
    arena.payment.mandateId = mandate.id;
    arena.updatedAt = now();
    await saveArena(arena);
  }
  return arena;
}

export async function runArena(id: string) {
  let arena = await requireArena(id);
  const retryingFailedRun = arena.status === "failed" && arena.payment.status === "active";
  if (arena.status !== "funded" && !retryingFailedRun) {
    throw new ArenaServiceError("Authorize the research budget before running the arena", 409, "BUDGET_NOT_AUTHORIZED");
  }
  if (retryingFailedRun) {
    arena.submissions = [];
    arena.evaluations = [];
    arena.finalBundle = undefined;
  }
  if (!getDemoMode() && !providerMode().semanticJudge) {
    arena.status = "failed";
    arena.updatedAt = now();
    await saveArena(arena);
    throw new ArenaServiceError(
      "A model provider is not configured for the live arena; add OpenAI or Anthropic",
      503,
      "MODEL_PROVIDER_NOT_CONFIGURED",
    );
  }
  if (!getDemoMode() && arena.payment.status === "active") {
    arena = await anchorArena(id);
  }
  arena.status = "researching";
  arena.updatedAt = now();
  await saveArena(arena);
  try {
    const result = await runResearchArena(arena);
    arena.submissions = result.submissions;
    arena.evaluations = result.evaluations;
    arena.finalBundle = result.finalBundle;
    arena.status = "ready_to_settle";
    arena.updatedAt = now();
    return saveArena(arena);
  } catch (error) {
    arena.status = "failed";
    arena.updatedAt = now();
    await saveArena(arena);
    throw error;
  }
}

export async function anchorArena(id: string) {
  const arena = await requireArena(id);
  arena.stellarAnchor ??= initialStellarAnchor(arena.id);
  if (getDemoMode()) {
    throw new ArenaServiceError(
      "Stellar anchoring is available only in the live sandbox flow",
      409,
      "STELLAR_ANCHOR_REQUIRES_LIVE_MODE",
    );
  }
  if (arena.payment.status !== "active" && arena.payment.status !== "completed") {
    throw new ArenaServiceError(
      "Approve the Prava mandate before registering the Ackrate mandate on Stellar",
      409,
      "STELLAR_ANCHOR_REQUIRES_PRAVA_APPROVAL",
    );
  }
  if (arena.stellarAnchor.status === "confirmed" && arena.stellarAnchor.transactionHash) {
    return arena;
  }

  arena.stellarAnchor.status = "registering";
  arena.stellarAnchor.error = undefined;
  arena.updatedAt = now();
  await saveArena(arena);
  try {
    const registered = await registerArenaMandateOnTestnet(arena);
    arena.fingerprint.expiresAt ??= registered.expiresAt;
    arena.stellarAnchor = {
      network: "testnet",
      contractId: arena.stellarAnchor.contractId,
      status: "confirmed",
      signerAddress: registered.signerAddress,
      transactionHash: registered.transactionHash,
      explorerUrl: registered.explorerUrl,
      registeredAt: now(),
    };
    arena.updatedAt = now();
    return saveArena(arena);
  } catch (error) {
    arena.stellarAnchor.status = "failed";
    arena.stellarAnchor.error = error instanceof Error
      ? error.message.replace(/\s+/g, " ").slice(0, 500)
      : "Stellar testnet registration failed";
    arena.updatedAt = now();
    await saveArena(arena);
    throw error;
  }
}

export async function settleArena(id: string) {
  let arena = await requireArena(id);
  if (arena.status === "complete") return arena;
  if (arena.status !== "ready_to_settle" || !arena.finalBundle) {
    throw new ArenaServiceError("Arena has no winning bundle to settle", 409, "INVALID_ARENA_STATE");
  }
  if (arena.finalBundle.totalPrice > arena.budget + 0.0001) {
    throw new ArenaServiceError("Winning bundle exceeds the authorized budget", 409, "BUDGET_EXCEEDED");
  }
  const settlementAmount = arena.finalBundle.totalPrice;
  if (arena.payment.mode === "demo") {
    arena.payment.status = "completed";
    arena.payment.transactionId = `demo_txn_${arena.id.slice(0, 12)}`;
    arena.status = "complete";
    arena.updatedAt = now();
    return saveArena(arena);
  }

  if (!arena.payment.mandateId) {
    arena = await refreshArenaPayment(id);
  }
  if (!arena.payment.mandateId || arena.payment.status !== "active") {
    throw new ArenaServiceError("Prava mandate is not active", 409, "PRAVA_MANDATE_NOT_ACTIVE");
  }
  arena.payment.status = "charging";
  arena.updatedAt = now();
  await saveArena(arena);
  try {
    const settlement = await chargeAndReportMandate(
      arena,
      arena.payment.mandateId,
      settlementAmount,
    );
    arena.payment.status = "completed";
    arena.payment.transactionId = settlement.charge.transactionId;
    arena.payment.orderId = settlement.charge.orderId;
    arena.payment.responseId = settlement.responseId;
    arena.status = "complete";
    arena.updatedAt = now();
    return saveArena(arena);
  } catch (error) {
    arena.payment.status = "failed";
    arena.payment.error = error instanceof Error ? error.message : "Settlement failed";
    arena.status = "ready_to_settle";
    arena.updatedAt = now();
    await saveArena(arena);
    throw error;
  }
}

export async function getArenaById(id: string) {
  return requireArena(id);
}

export async function getRecentArenas(limit?: number) {
  return listArenas(limit);
}

export function toClientArena(arena: Arena, options?: { includePaymentUrl?: boolean }) {
  const unlocked = arena.status === "complete";
  return {
    ...arena,
    buyerEmail: undefined,
    topicPrivate: undefined,
    payment: {
      ...arena.payment,
      iframeUrl: options?.includePaymentUrl ? arena.payment.iframeUrl : undefined,
    },
    criteria: arena.criteria.map((criterion) => criterion.visibility === "private"
      ? { ...criterion, label: "private criterion", description: "" }
      : criterion),
    submissions: arena.submissions.map((submission) => ({
      ...submission,
      report: unlocked && submission.isWinner
        ? submission.report
        : {
            title: unlocked ? "discarded research report" : "locked research report",
            findingCount: submission.report.findings.length,
            sourceCount: new Set(submission.report.findings.map((finding) => finding.sourceUrl)).size,
            locked: !unlocked,
            discarded: unlocked && !submission.isWinner,
          },
    })),
    evaluations: arena.evaluations.map((evaluation) => {
      const criterion = arena.criteria.find((item) => item.id === evaluation.criterionId);
      return criterion?.visibility === "private"
        ? { ...evaluation, rationale: "Private criterion: the judge selected the stronger submission without disclosing the buyer's rubric." }
        : evaluation;
    }),
    finalBundle: unlocked ? arena.finalBundle : arena.finalBundle ? {
      title: arena.finalBundle.title,
      winningSubmissionIds: arena.finalBundle.winningSubmissionIds,
      totalPrice: arena.finalBundle.totalPrice,
      locked: true,
    } : undefined,
  };
}
