# @ackrate/core 0.3.2

Create an agent, connect to the live MandateRegistry contract on Stellar, and
run a crash-safe mandate-validated payment through a small typed surface.

`@ackrate/core` is the high-level TypeScript SDK for **ackrate**. A user signs a
mandate that fixes a budget, a single merchant, and an expiry. An agent can
spend against that mandate, but every payment is validated and consumed
on-chain before funds move.

The SDK is untrusted by design. It never custodies funds and it does not enforce
the spending limit. If the SDK has a bug or an agent key is compromised, the
contract still rejects overspending, the wrong merchant, replayed sequences,
expired mandates, and revoked mandates.

## Install

```bash
npm install @ackrate/core@0.3.2 @stellar/stellar-sdk@14.5.0
```

The package ships ESM JavaScript and built-in TypeScript declarations.

## Quick start: Stellar testnet

```ts
import { ackrate } from "@ackrate/core";
import { Keypair } from "@stellar/stellar-sdk";

const user = Keypair.fromSecret(process.env.USER_SECRET!);
const agent = Keypair.fromSecret(process.env.AGENT_SECRET!);

const mandate = ackrate.createIntentMandate({
  user: user.publicKey(),
  agent: agent.publicKey(),
  merchant: process.env.MERCHANT_ADDRESS!,
  asset: ackrate.testnet.nativeSac,
  maxAmount: "5.00",
  expiry: Math.floor(Date.now() / 1000) + 3600,
});

await ackrate.registerMandate(mandate, { signer: user });
await ackrate.approveBudget(mandate, { signer: user });

const txHash = await ackrate.agent({ mandate, signer: agent }).pay("1.00", {
  onPrepared: (pending) => paymentJournal.save(pending),
});

console.log(txHash);
```

After `pay` returns, one real payment has settled on testnet. The returned
64-character hash can be opened in Stellar Expert.

## How it works

1. `createIntentMandate` builds the mandate and canonical ID locally.
2. `registerMandate` stores it on-chain with the user's signature.
3. `approveBudget` grants the contract a SEP-41 allowance capped at the budget.
4. `pay` calls `execute_payment` with the agent's signature.
5. The contract checks agent, merchant, expiry, budget, and sequence atomically.

The allowance belongs to the contract—not the agent and not the SDK.

## Paying for a resource with bound-v2 x402

`agent.fetch(url)` handles the paid HTTP round trip. For new endpoints, use
`proofPolicy: "bound-v2-only"`. The authenticated challenge binds the exact
public origin, method, path, query, network, registry, merchant, asset, amount,
and validity window.

```ts
import { ackrate, getSettlementReceipt } from "@ackrate/core";

const paymentAgent = ackrate.agent({
  mandate,
  signer: agent,
  proofPolicy: "bound-v2-only",
  receiptStore,
});

const response = await paymentAgent.fetch("https://merchant.example/report");
const result = await response.json();
const receipt = getSettlementReceipt(response);

await persistAcceptedResult(result, receipt);
await paymentAgent.acknowledgeDelivery(receipt!);
```

The receipt must become durable before broadcast. If settlement or delivery is
uncertain, `DeliveryPendingError` carries the exact receipt and transaction
hash. Retry that receipt; do not create another payment.

```ts
import { DeliveryPendingError } from "@ackrate/core";

try {
  await paymentAgent.fetch("https://merchant.example/report");
} catch (error) {
  if (!(error instanceof DeliveryPendingError)) throw error;

  const response = await paymentAgent.retryDelivery(error.receipt);
  const result = await response.json();
  await persistAcceptedResult(result, error.receipt);
  await paymentAgent.acknowledgeDelivery(error.receipt);
}
```

`retryDelivery` never pays, signs, or submits a new transaction. Redirects are
disabled so proof material cannot be forwarded to another origin.

## Primary API

| Export | Purpose |
|---|---|
| `ackrate.createIntentMandate(input, net?)` | Build a typed mandate and canonical ID locally |
| `ackrate.registerMandate(mandate, opts, net?)` | Register the mandate on-chain with the user signer |
| `ackrate.approveBudget(mandate, opts, net?)` | Approve the contract's SEP-41 allowance |
| `ackrate.agent(options, net?)` | Bind an agent signer to one mandate |
| `agent.pay(amount, lifecycle)` | Execute a contract-enforced payment |
| `agent.fetch(url, init?)` | Negotiate, settle, and retry a bound paid request |
| `agent.retryDelivery(receipt, init?)` | Retry delivery with the existing proof only |
| `agent.acknowledgeDelivery(receipt)` | Clear durable pending state after business commit |
| `agent.reconcilePendingSettlement(record?)` | Query one prepared hash without creating a payment |
| `ackrate.revokeMandate(mandate, opts, net?)` | Revoke future spending with the user signer |
| `toStroops(value, decimals?)` | Convert a decimal string to an exact `bigint` amount |
| `Errors` | Typed MandateRegistry contract error map |

### Mandate input

| Field | Type | Meaning |
|---|---|---|
| `user` | `string` | Stellar account that owns funds and signs the mandate |
| `agent` | `string` | Only account allowed to call `execute_payment` |
| `merchant` | `string` | Single on-chain payee scope |
| `asset` | `string` | SEP-41 asset contract ID |
| `maxAmount` | `string` | Total decimal-string budget, such as `"5.00"` |
| `expiry` | `number` | Unix timestamp after which payment is rejected |
| `decimals` | `number?` | Token decimals; defaults to 7 |
| `nonce` | `string?` | Optional deterministic nonce |

## Crash-safe settlement

Every direct `pay` call requires a `PaymentSubmissionLifecycle`. Its
`onPrepared` hook receives the signed hash, sequence, and validity deadline
before broadcast. Persist that record atomically or throw to abort without
sending.

For a retryable business operation, pass the immutable `expectedSeq`. The SDK
checks it before signing, and the contract checks it again at execution. While
a settlement is unresolved, further payments fail closed.

## Amounts

Amounts are decimal strings, never floating-point numbers. Values such as
`"5.00"`, `"0.01"`, and `"100"` are valid. Scientific notation, negatives,
excess precision, ambiguous values, and i128 overflow are rejected.

## Contract guarantees

| Error | Contract refusal |
|---|---|
| `Errors[4]` | mandate expired |
| `Errors[5]` | mandate revoked |
| `Errors[6]` | budget exceeded |
| `Errors[7]` | merchant out of scope |
| `Errors[8]` | replayed or incorrect sequence |
| `Errors[9]` | invalid amount |
| `Errors[10]` | contract money path paused |

## Network and contract

The default is Stellar testnet and the live upgradeable MandateRegistry:

[`CCHQ5G4Y4YBMY6D3TYYJSVJVCKUM22Q6TMKCCHVAHY4X7K6QELQACZRM`](https://stellar.expert/explorer/testnet/contract/CCHQ5G4Y4YBMY6D3TYYJSVJVCKUM22Q6TMKCCHVAHY4X7K6QELQACZRM)

The deployed WASM SHA-256 is
`ba370a80369daa0a0dea2554410dca6f2a9f7a76ba707cb92a83434e2fe76e87`,
matching the reproducible
[`simple-v0.2.3` release](https://github.com/reapp-protocol/reapp-protocol-contracts/releases/tag/simple-v0.2.3_contracts_simple_mandate_registry_mandate-registry_pkg0.2.3_cli25.1.0).

Use [`@ackrate/stellar`](https://www.npmjs.com/package/@ackrate/stellar) when
you need the lower-level typed contract client directly.

## Compatibility

The deprecated `reapp` export and legacy wire-domain strings remain available
only to preserve compatibility with already signed credentials and the deployed
contract profile. New application code should use `ackrate` and `@ackrate/*`
imports.

Apache-2.0.
