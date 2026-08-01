import { createHash } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import { ackrate } from "@ackrate/core";
import { bindIntentMandate } from "@ackrate/ap2";
import type { AckrateFingerprint, Arena, Criterion } from "./types.js";

export const ARENA_MANDATE_TTL_MS = 6 * 24 * 60 * 60 * 1000;

function keypairFor(label: string): Keypair {
  const seed = createHash("sha256").update(`ackrate research arena:${label}`).digest();
  return Keypair.fromRawEd25519Seed(seed);
}

export function arenaTestnetSigner(arenaId: string): Keypair {
  return keypairFor(`${arenaId}:buyer`);
}

function createBinding(input: {
  arenaId: string;
  topic: string;
  criteria: Criterion[];
  budget: number;
  expiresAt: Date;
}) {
  const buyer = arenaTestnetSigner(input.arenaId).publicKey();
  const judge = keypairFor(`${input.arenaId}:judge`).publicKey();
  const merchant = keypairFor("ackrate:research-marketplace").publicKey();
  const intentExpiry = input.expiresAt.toISOString().replace(/\.\d{3}Z$/, "Z");
  const binding = bindIntentMandate({
    intent: {
      user_cart_confirmation_required: false,
      natural_language_description: `${input.topic}\nEvaluation: ${input.criteria
        .map((criterion) => criterion.label)
        .join(", ")}`,
      merchants: [merchant],
      skus: [],
      requires_refundability: false,
      intent_expiry: intentExpiry,
    },
    stellar: {
      user: buyer,
      agent: judge,
      asset: ackrate.testnet.nativeSac,
      maxAmount: input.budget.toFixed(2),
      nonce: input.arenaId,
    },
  });
  return { binding, intentExpiry };
}

export function createArenaFingerprint(input: {
  arenaId: string;
  topic: string;
  criteria: Criterion[];
  budget: number;
  expiresAt: Date;
}): AckrateFingerprint {
  const { binding, intentExpiry } = createBinding(input);

  return {
    intentHash: binding.intentHash,
    mandateId: binding.mandate.id,
    bindingVersion: binding.bindingVersion,
    package: "@ackrate/ap2",
    expiresAt: intentExpiry,
  };
}

export function rebuildArenaBinding(arena: Arena) {
  const exactExpiry = arena.fingerprint.expiresAt;
  const candidateExpiries = exactExpiry
    ? [new Date(exactExpiry)]
    : Array.from({ length: 121 }, (_, offset) => new Date(
        Date.parse(arena.createdAt) + ARENA_MANDATE_TTL_MS + offset * 1000,
      ));

  for (const expiresAt of candidateExpiries) {
    const result = createBinding({
      arenaId: arena.id,
      topic: arena.topicPublic,
      criteria: arena.criteria,
      budget: arena.budget,
      expiresAt,
    });
    if (result.binding.mandate.id === arena.fingerprint.mandateId) {
      return {
        ...result,
        signer: arenaTestnetSigner(arena.id),
      };
    }
  }

  throw new Error("Arena fingerprint does not match its reconstructed Stellar mandate");
}
