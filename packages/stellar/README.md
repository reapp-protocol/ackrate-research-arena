# @ackrate/stellar 0.2.3

The Soroban layer for **ackrate**: agent-driven payments on Stellar, enforced
on-chain by the **MandateRegistry** contract.

This package is the low-level building block. It provides a typed
MandateRegistry client generated from the gate-checked contract interface,
Stellar testnet configuration, a keypair signing adapter, and minimal SEP-41
token helpers.

> **Most apps want [`@ackrate/core`](https://www.npmjs.com/package/@ackrate/core), not this.**
> `core` wraps these pieces into a mandate-validated payment in under 10 lines.
> Use `@ackrate/stellar` when you need direct, typed access to the contract.

## Install

```bash
npm install @ackrate/stellar@0.2.3 @stellar/stellar-sdk@14.5.0
```

The package ships ESM JavaScript and built-in TypeScript declarations.

## What it exports

| Export | What it is |
|---|---|
| `TESTNET` | `NetworkConfig` for Stellar testnet: RPC, passphrase, live MandateRegistry ID, and native asset |
| `registryClient(net, signer)` | Factory for the typed MandateRegistry client |
| `Client`, `Mandate`, `PendingUpgrade`, `Errors` | Contract bindings generated from the exact `simple-v0.2.3` release WASM |
| `keypairSigner(keypair, passphrase)` | Adapts a Stellar `Keypair` into a transaction signer |
| `token.approve(...)`, `token.balance(...)` | Minimal SEP-41 token helpers |

`TESTNET.mandateRegistryId` points to the live upgradeable testnet contract:

[`CCHQ5G4Y4YBMY6D3TYYJSVJVCKUM22Q6TMKCCHVAHY4X7K6QELQACZRM`](https://stellar.expert/explorer/testnet/contract/CCHQ5G4Y4YBMY6D3TYYJSVJVCKUM22Q6TMKCCHVAHY4X7K6QELQACZRM)

Its on-chain WASM hash is
`ba370a80369daa0a0dea2554410dca6f2a9f7a76ba707cb92a83434e2fe76e87`,
matching the reproducible
[`simple-v0.2.3` release artifact](https://github.com/reapp-protocol/reapp-protocol-contracts/releases/tag/simple-v0.2.3_contracts_simple_mandate_registry_mandate-registry_pkg0.2.3_cli25.1.0).

The binding exposes `get_admin`, `set_admin`, `pause`, `unpause`, `is_paused`,
`get_pending_upgrade`, `get_upgrade_delay`, and the one-hour
`schedule_upgrade`, `cancel_upgrade`, and `execute_upgrade` lifecycle alongside
the unchanged mandate interface. Upgrade execution requires current-admin
authorization, an elapsed delay, and paused state; the contract ID and storage
are preserved.

## Typed contract methods

| Method | Typed input or result |
|---|---|
| `register_mandate` | user, agent, merchant, asset, budget, expiry, and 32-byte mandate ID |
| `get_mandate` | mandate ID → `Result<Mandate>` |
| `validate_mandate` | mandate ID, merchant, amount, and expected sequence → `Result<void>` |
| `execute_payment` | mandate ID, amount, and expected sequence → contract-enforced transfer |
| `revoke_mandate` | mandate ID → user-authorized revocation |
| `get_admin`, `set_admin` | read or rotate the operational authority |
| `pause`, `unpause`, `is_paused` | control or read the money-path stop state |
| `schedule_upgrade` | new 32-byte WASM hash → earliest execution timestamp |
| `get_pending_upgrade`, `cancel_upgrade` | inspect or cancel the scheduled change |
| `get_upgrade_delay` | fixed `3600n` seconds |
| `execute_upgrade` | same-address code replacement after all three controls pass |

## Example: read a mandate from the contract

```ts
import { TESTNET, keypairSigner, registryClient } from "@ackrate/stellar";
import { Keypair } from "@stellar/stellar-sdk";

const signer = keypairSigner(
  Keypair.fromSecret(process.env.STELLAR_SECRET!),
  TESTNET.networkPassphrase,
);
const registry = registryClient(TESTNET, signer);

const mandate = (await registry.get_mandate({ mandate_id })).result.unwrap();
console.log(mandate.status, mandate.spent); // e.g. Active, 0n
```

Operational reads are typed too:

```ts
const admin = (await registry.get_admin()).result;
const paused = (await registry.is_paused()).result;
const delay = (await registry.get_upgrade_delay()).result; // 3600n
```

## Security boundary

The contract is the source of truth. Every spend is validated and consumed
on-chain by `execute_payment`, so a buggy or malicious client cannot exceed the
mandate. Keep secret keys server-side, use disposable keys on testnet, and never
log signed transactions or bearer proofs.

For the complete agent → payment flow, use
[`@ackrate/core`](https://www.npmjs.com/package/@ackrate/core).

Apache-2.0.
