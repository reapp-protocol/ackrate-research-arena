import { ackrate } from "@ackrate/core";
import { rpc } from "@stellar/stellar-sdk";
import { arenaTestnetSigner, rebuildArenaBinding } from "./fingerprint.js";
import type { Arena, StellarAnchorState } from "./types.js";

const TRANSACTION_HASH = /^[0-9a-f]{64}$/i;

export const STELLAR_CONTRACT_ID = ackrate.testnet.mandateRegistryId;

export function stellarContractExplorerUrl() {
  return `https://stellar.expert/explorer/testnet/contract/${STELLAR_CONTRACT_ID}`;
}

export function stellarTransactionExplorerUrl(transactionHash: string) {
  if (!TRANSACTION_HASH.test(transactionHash)) throw new Error("Invalid Stellar transaction hash");
  return `https://stellar.expert/explorer/testnet/tx/${transactionHash.toLowerCase()}`;
}

export function initialStellarAnchor(arenaId: string): StellarAnchorState {
  return {
    network: "testnet",
    contractId: STELLAR_CONTRACT_ID,
    status: "not_started",
    signerAddress: arenaTestnetSigner(arenaId).publicKey(),
  };
}

async function ensureTestnetAccount(publicKey: string) {
  const server = new rpc.Server(ackrate.testnet.rpcUrl);
  try {
    await server.getAccount(publicKey);
  } catch {
    await server.requestAirdrop(publicKey);
    await server.getAccount(publicKey);
  }
}

export async function registerArenaMandateOnTestnet(arena: Arena) {
  if (arena.stellarAnchor.contractId !== STELLAR_CONTRACT_ID) {
    throw new Error("Arena is not configured for the published Ackrate testnet contract");
  }
  const { binding, signer, intentExpiry } = rebuildArenaBinding(arena);
  if (signer.publicKey() !== arena.stellarAnchor.signerAddress) {
    throw new Error("Arena testnet signer does not match its recorded public address");
  }
  if (binding.mandate.id !== arena.fingerprint.mandateId) {
    throw new Error("Refusing to register a mandate that does not match the arena fingerprint");
  }

  await ensureTestnetAccount(signer.publicKey());
  const transactionHash = await ackrate.registerMandate(binding.mandate, { signer });
  if (!TRANSACTION_HASH.test(transactionHash)) {
    throw new Error("Stellar did not return a valid transaction hash");
  }
  return {
    transactionHash: transactionHash.toLowerCase(),
    explorerUrl: stellarTransactionExplorerUrl(transactionHash),
    signerAddress: signer.publicKey(),
    expiresAt: intentExpiry,
  };
}
