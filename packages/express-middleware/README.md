# @ackrate/express-middleware 0.2.3

Fail-closed Express 4/5 paid JSON routes for **ackrate** on Stellar.

The middleware authenticates an exact-origin GET challenge, independently
verifies on-chain settlement, atomically claims fulfillment, stores the exact
JSON result before sending it, and replays those bytes during recovery. One
settlement can never re-run arbitrary fulfillment work.

## Install

```bash
npm install @ackrate/express-middleware@0.2.3 express@5.2.1
```

## Safe paid route

```ts
import express from "express";
import {
  InMemoryBoundRedemptionStore,
  createBoundReappPaidJsonRoute,
} from "@ackrate/express-middleware";

const app = express();

const paidResearch = createBoundReappPaidJsonRoute({
  merchant: process.env.ACKRATE_MERCHANT_ADDRESS!,
  sourceAccount: process.env.ACKRATE_READ_SOURCE_ADDRESS!,
  audience: "https://api.example",
  challengeSecret: process.env.ACKRATE_CHALLENGE_SECRET!,
  amount: "1.00",
  resource: (request) => request.originalUrl,
  redemptionStore: new InMemoryBoundRedemptionStore(), // demo only
}, async ({ request, payment }) => ({
  body: {
    ok: true,
    resource: request.params.id,
    data: await loadResearchOnce(request.params.id),
    settledTx: payment.txHash,
  },
}));

app.get("/source/:id", paidResearch);
app.listen(4021);
```

The callback receives no Express `Response` and cannot stream. Its JSON result
is bounded, hashed, and committed before any response bytes are written.

## Bound-v2 authorization

Before fulfillment, the package requires:

1. bound-v2 capability negotiation before payment;
2. an authenticated challenge binding origin, method, path, query, network,
   registry, merchant, asset, amount, decimals, ID, and validity window;
3. a canonical Stellar Ed25519 proof binding the challenge, transaction hash,
   and mandate ID;
4. the configured network passphrase and one successful fresh transaction;
5. one unambiguous payment event from the configured MandateRegistry;
6. matching mandate user, agent, merchant, and asset identities; and
7. one same-transaction SEP-41 transfer from user to merchant.

A copied public transaction hash cannot unlock protected data. Relaying a
genuine quote through another origin also fails because the signed audience
must equal the requested origin.

## Atomic fulfillment state

`BoundRedemptionStore` owns settlement binding and immutable response bytes in
one linearizable state machine:

```text
missing -> executing -> completed(exact JSON bytes)
```

- First valid proof: verify, claim, and execute once.
- Same proof while executing: return `503`; never start the callback again.
- Same proof after completion: replay exact stored bytes.
- Same transaction with another proof: return `409`.
- Store or RPC outage: return `503`; never expose protected output.
- Callback exception: store and replay one sanitized terminal result.

`InMemoryBoundRedemptionStore` is for tests and one-process demos only.
Production needs a shared durable linearizable implementation. Never use a
lease that silently turns an executing claim back into runnable work.

## Response behavior

| Condition | Status |
|---|---:|
| Missing or wrong bound-v2 capability | `426` before payment |
| Method other than GET | `405` |
| Missing, malformed, expired, mismatched, or unverified proof | `402` |
| Same settlement with a different proof | `409` |
| Existing execution or infrastructure outage | `503` |
| New completed fulfillment | stored 2xx JSON |
| Exact completed recovery | byte-identical stored 2xx JSON |

All responses are private/no-store. Treat proofs and stored result material as
sensitive and never log them.

## Primary API

| Export | Purpose |
|---|---|
| `createBoundReappPaidJsonRoute(options, fulfill)` | Safe result-storing paid route wrapper |
| `resolveBoundReappInterruptedDelivery(...)` | Trusted recovery for interrupted completion storage |
| `InMemoryBoundRedemptionStore` | One-process development store |
| `createStellarPaymentVerifier(...)` | Independent on-chain payment verifier |

The legacy function names are stable public API identifiers. Package branding,
imports, configuration, and documentation use lowercase ackrate.

## Contract evidence

- Contract: [`CCHQ5G4Y…CZRM`](https://stellar.expert/explorer/testnet/contract/CCHQ5G4Y4YBMY6D3TYYJSVJVCKUM22Q6TMKCCHVAHY4X7K6QELQACZRM)
- WASM SHA-256: `ba370a80369daa0a0dea2554410dca6f2a9f7a76ba707cb92a83434e2fe76e87`
- Release: [`simple-v0.2.3`](https://github.com/reapp-protocol/reapp-protocol-contracts/releases/tag/simple-v0.2.3_contracts_simple_mandate_registry_mandate-registry_pkg0.2.3_cli25.1.0)

Apache-2.0.
