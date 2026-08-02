/** Minimal SEP-41 helpers (approve + balance) for approving the contract for its
 *  allowance and reading balances — built directly on @stellar/stellar-sdk so
 *  the SDK has no CLI dependency. */
import { Keypair } from "@stellar/stellar-sdk";
import type { NetworkConfig } from "./config.js";
/** User approves the contract for a SEP-41 allowance: approve(from=owner, spender, amount). */
export declare function approve(net: NetworkConfig, tokenId: string, owner: Keypair, spender: string, amount: bigint, expirationLedger?: number): Promise<string>;
/** Read a SEP-41 balance (simulation only, no signing). */
export declare function balance(net: NetworkConfig, tokenId: string, who: string): Promise<bigint>;
