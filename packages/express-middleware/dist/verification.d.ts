import { Buffer } from "buffer";
import { xdr } from "@stellar/stellar-sdk";
import { type NetworkConfig } from "@ackrate/stellar";
import type { PaymentVerifier } from "./types.js";
export interface DecodedValue {
    /** Original ScVal discriminant, retained so string/symbol and numeric types cannot blur. */
    type: string;
    value: unknown;
}
export interface DecodedEvent {
    type: string;
    contractId: string | null;
    topics: readonly DecodedValue[];
    data: DecodedValue;
}
export interface PaymentCheck {
    merchant: string;
    registryId: string;
    priceStroops: bigint;
}
export type PaymentSelection = {
    ok: true;
    amount: bigint;
    mandateId: Buffer;
} | {
    ok: false;
    reason: string;
};
export interface LoadedTransaction {
    status: string;
    ledger?: number;
    latestLedger?: number;
    events?: readonly DecodedEvent[];
}
export interface LoadedMandate {
    user: string;
    agent: string;
    merchant: string;
    asset: string;
}
export interface StellarVerifierOptions {
    networkConfig: NetworkConfig;
    sourceAccount?: string;
    pollAttempts?: number;
    pollIntervalMs?: number;
    maxProofAgeLedgers?: number;
    allowHttpRpc?: boolean;
    /** Injection points used by deterministic tests and alternate trusted RPC stacks. */
    loadNetworkPassphrase?: () => Promise<string>;
    loadTransaction?: (txHash: string) => Promise<LoadedTransaction>;
    loadMandate?: (mandateId: Buffer) => Promise<LoadedMandate>;
    wait?: (milliseconds: number) => Promise<void>;
}
export declare function extractContractEvents(meta: xdr.TransactionMeta): xdr.ContractEvent[];
export declare function interpretEvents(events: readonly xdr.ContractEvent[]): DecodedEvent[];
/** Pure, fail-closed selection of one unambiguous registry payment event. */
export declare function selectPayment(decoded: readonly DecodedEvent[], check: PaymentCheck): PaymentSelection;
export interface TransferCheck {
    asset: string;
    user: string;
    merchant: string;
    amount: bigint;
}
/** Require exactly one matching SEP-41 transfer emitted by the configured asset. */
export declare function selectTransfer(decoded: readonly DecodedEvent[], check: TransferCheck): {
    ok: true;
} | {
    ok: false;
    reason: string;
};
export declare function createStellarPaymentVerifier(options: StellarVerifierOptions): PaymentVerifier;
