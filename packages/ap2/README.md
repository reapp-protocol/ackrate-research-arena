# @ackrate/ap2 0.3.1

Signed AP2 v0.1 mandate validation for contract-enforced **ackrate** payments on
Stellar.

`@ackrate/ap2` turns the supported AP2 `IntentMandate` subset into a versioned
Stellar Ed25519 credential, validates it at mandate admission, and returns the
exact ackrate mandate to register on-chain. Validation covers the signature,
trusted user, merchant scope, amount, expiry, binding hash, and one-time replay
state.

This is a narrow fail-closed profile for AP2 v0.1—not a universal verifier for
every upstream VC or JWS shape. It deliberately has no HTTP or x402 dependency.

## Install

```bash
npm install @ackrate/ap2@0.3.1 @ackrate/core@0.3.2 @stellar/stellar-sdk@14.5.0
```

## Signed validator quick start

```ts
import {
  InMemoryAp2ReplayStore,
  createAp2ComplianceValidator,
  signAp2Mandate,
} from "@ackrate/ap2";
import { ackrate } from "@ackrate/core";

const credential = signAp2Mandate({
  intent: {
    user_cart_confirmation_required: false,
    natural_language_description: "Buy one research dataset",
    merchants: [MERCHANT_ADDRESS],
    intent_expiry: new Date(
      (Math.floor(Date.now() / 1000) + 3600) * 1000,
    ).toISOString(),
  },
  stellar: {
    user: USER_KEY.publicKey(),
    agent: AGENT_KEY.publicKey(),
    asset: ackrate.testnet.nativeSac,
    maxAmount: "5.00",
  },
}, USER_KEY);

const validator = createAp2ComplianceValidator({
  replayStore: new InMemoryAp2ReplayStore(), // development only
  replayNamespace: `stellar-testnet:${ackrate.testnet.mandateRegistryId}`,
});

const accepted = await validator.validateAndConsume({
  credential,
  expectedUser: USER_KEY.publicKey(),
  merchant: MERCHANT_ADDRESS,
  amount: "1.00",
});

await ackrate.registerMandate(accepted.binding.mandate, { signer: USER_KEY });
await ackrate.approveBudget(accepted.binding.mandate, { signer: USER_KEY });
```

`expectedUser`, `merchant`, and `amount` must come from trusted application
state. Never authorize a payment from untrusted request fields.

## Replay semantics

`validateAndConsume` consumes a mandate hash once when a signed mandate is
admitted. It is not called before every purchase because one mandate can cover
multiple payments.

Every later payment still passes through `MandateRegistry.execute_payment`,
which atomically enforces merchant, cumulative budget, expiry, agent
authorization, and monotonic sequence.

`InMemoryAp2ReplayStore` is only for tests, demos, and one-process development.
Production must provide a durable, shared, linearizable `consumeOnce(record)`
implementation. Store errors fail closed.

```ts
import type { Ap2ReplayStore } from "@ackrate/ap2";

const replayStore: Ap2ReplayStore = {
  async consumeOnce(record) {
    return durableAtomicInsert(record); // "consumed" or "duplicate"
  },
};
```

## What is signed

`signAp2Mandate` runs the same fail-closed AP2-to-contract binding as
`bindIntentMandate`. The credential contains:

- exact credential, AP2, data-key, binding, and signature versions;
- a normalized one-merchant AP2 intent;
- Stellar user, agent, asset, maximum amount, decimals, and binding nonce;
- the recomputed on-chain mandate hash; and
- a canonical 64-byte Stellar Ed25519 signature.

Unknown keys are rejected at every credential level. If a future AP2 version
adds a constraint this package does not understand, validation fails instead of
silently dropping it.

## Supported AP2 subset

The profile is pinned to
[`AP2 v0.1.0`](https://github.com/google-agentic-commerce/AP2/releases/tag/v0.1.0).

| AP2 field | Enforced behavior |
|---|---|
| `user_cart_confirmation_required` | Must be explicitly `false` |
| `natural_language_description` | Canonically bound into the intent hash |
| `merchants` | Exactly one valid Stellar address; becomes contract merchant scope |
| `intent_expiry` | Future ISO 8601 timestamp with timezone and whole-second precision |
| `skus` | Must be absent or empty because the contract does not enforce SKU constraints |
| `requires_refundability` | Must be absent or `false` because the contract does not enforce it |

## Stable validation errors

| Code | Meaning |
|---|---|
| `INVALID_CREDENTIAL` | malformed, unknown, noncanonical, or invalid identity data |
| `UNSUPPORTED_VERSION` | unsupported credential, AP2, binding, or signature version |
| `INVALID_SIGNATURE` | invalid Ed25519 signature |
| `SIGNER_MISMATCH` | signed user differs from trusted user |
| `BINDING_MISMATCH` | payload does not recompute to the envelope mandate hash |
| `MERCHANT_MISMATCH` | merchant falls outside signed scope |
| `INVALID_AMOUNT` | malformed, non-positive, over-precision, or out-of-range amount |
| `AMOUNT_EXCEEDS_MANDATE` | request exceeds the signed maximum |
| `EXPIRED` | signed intent has expired |
| `REPLAYED` | mandate hash was already admitted in this namespace |
| `REPLAY_STORE_UNAVAILABLE` | atomic replay storage failed |

## API

| Export | Purpose |
|---|---|
| `signAp2Mandate(input, signer)` | Bind and sign the supported intent with a Stellar user key |
| `createAp2ComplianceValidator(options)` | Build the signature, scope, amount, expiry, and replay validator |
| `Ap2ValidationError` | Typed fail-closed error with stable codes |
| `InMemoryAp2ReplayStore` | Single-process development replay store |
| `bindIntentMandate(input)` | Validate and bind without signing an envelope |
| `normalizeAp2Intent(intent)` | Normalize the supported AP2 subset |
| `canonicalizeJson(value)` | Recursively key-sort JSON for deterministic binding |

## Contract target

The default is the live upgradeable MandateRegistry on Stellar testnet:

[`CCHQ5G4Y4YBMY6D3TYYJSVJVCKUM22Q6TMKCCHVAHY4X7K6QELQACZRM`](https://stellar.expert/explorer/testnet/contract/CCHQ5G4Y4YBMY6D3TYYJSVJVCKUM22Q6TMKCCHVAHY4X7K6QELQACZRM)

WASM SHA-256:
`ba370a80369daa0a0dea2554410dca6f2a9f7a76ba707cb92a83434e2fe76e87`.

## Compatibility

The legacy binding prefix and signing domain are immutable wire values. They
remain unchanged so existing signed credentials and the deployed contract stay
interoperable. Product branding, package names, imports, and examples use
lowercase ackrate.

Apache-2.0.
