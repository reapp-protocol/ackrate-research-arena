import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  ARENA_MANDATE_TTL_MS,
  arenaTestnetSigner,
  createArenaFingerprint,
  rebuildArenaBinding,
} from "./fingerprint.js";
import {
  STELLAR_CONTRACT_ID,
  initialStellarAnchor,
  stellarContractExplorerUrl,
  stellarTransactionExplorerUrl,
} from "./stellar-anchor.js";
import type { Arena, Criterion } from "./types.js";

function fixtureArena(): Arena {
  const id = randomUUID();
  const createdAt = "2026-08-02T01:02:03.456Z";
  const criteria: Criterion[] = [{
    id: "criterion_1",
    label: "evidence quality",
    description: "Primary and recent sources",
    weight: 1,
    visibility: "public",
  }];
  const expiresAt = new Date(Date.parse(createdAt) + ARENA_MANDATE_TTL_MS);
  return {
    id,
    slug: `arena-${id.slice(0, 6)}`,
    buyerId: "buyer_fixture",
    buyerEmail: "buyer@example.com",
    topicPublic: "Which verified research strategy should this team purchase?",
    topicPrivate: "",
    topicVisibility: "public",
    qualification: { minimumGlobalElo: 0, qualifiedAgentCount: 3 },
    criteria,
    budget: 25,
    currency: "USD",
    status: "funded",
    fingerprint: createArenaFingerprint({
      arenaId: id,
      topic: "Which verified research strategy should this team purchase?",
      criteria,
      budget: 25,
      expiresAt,
    }),
    stellarAnchor: initialStellarAnchor(id),
    payment: { mode: "prava", status: "active", mandateId: "prava_fixture" },
    submissions: [],
    evaluations: [],
    createdAt,
    updatedAt: createdAt,
  };
}

test("rebuilds the exact AP2 mandate that the arena fingerprint commits to", () => {
  const arena = fixtureArena();
  const rebuilt = rebuildArenaBinding(arena);

  assert.equal(rebuilt.binding.mandate.id, arena.fingerprint.mandateId);
  assert.equal(rebuilt.binding.intentHash, arena.fingerprint.intentHash);
  assert.equal(rebuilt.signer.publicKey(), arena.stellarAnchor.signerAddress);
  assert.equal(rebuilt.signer.publicKey(), arenaTestnetSigner(arena.id).publicKey());
});

test("reconstructs legacy fingerprints without trusting an unverified expiry", () => {
  const arena = fixtureArena();
  delete arena.fingerprint.expiresAt;

  const rebuilt = rebuildArenaBinding(arena);
  assert.equal(rebuilt.binding.mandate.id, arena.fingerprint.mandateId);
  assert.equal(rebuilt.intentExpiry, "2026-08-08T01:02:03Z");
});

test("pins the published testnet contract and validates transaction links", () => {
  assert.equal(STELLAR_CONTRACT_ID, "CCHQ5G4Y4YBMY6D3TYYJSVJVCKUM22Q6TMKCCHVAHY4X7K6QELQACZRM");
  assert.equal(
    stellarContractExplorerUrl(),
    `https://stellar.expert/explorer/testnet/contract/${STELLAR_CONTRACT_ID}`,
  );
  const hash = "a".repeat(64);
  assert.equal(
    stellarTransactionExplorerUrl(hash),
    `https://stellar.expert/explorer/testnet/tx/${hash}`,
  );
  assert.throws(() => stellarTransactionExplorerUrl("not-a-hash"), /Invalid Stellar transaction hash/);
});
