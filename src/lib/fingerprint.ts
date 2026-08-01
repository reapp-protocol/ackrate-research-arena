import { createHash } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import { ackrate } from "@ackrate/core";
import { bindIntentMandate } from "@ackrate/ap2";
import type { AckrateFingerprint, Criterion } from "./types.js";

function publicKeyFor(label: string): string {
  const seed = createHash("sha256").update(`ackrate research arena:${label}`).digest();
  return Keypair.fromRawEd25519Seed(seed).publicKey();
}

export function createArenaFingerprint(input: {
  arenaId: string;
  topic: string;
  criteria: Criterion[];
  budget: number;
  expiresAt: Date;
}): AckrateFingerprint {
  const buyer = publicKeyFor(`${input.arenaId}:buyer`);
  const judge = publicKeyFor(`${input.arenaId}:judge`);
  const merchant = publicKeyFor("ackrate:research-marketplace");
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

  return {
    intentHash: binding.intentHash,
    mandateId: binding.mandate.id,
    bindingVersion: binding.bindingVersion,
    package: "@ackrate/ap2",
  };
}
