/**
 * @ackrate/core — create an agent, connect to the testnet MandateRegistry, and
 * execute a crash-safe mandate-validated payment through a small typed surface.
 *
 * The SDK is UNTRUSTED infrastructure: it never holds the allowance (only the
 * contract does), and every spend is validated + consumed on-chain by
 * `execute_payment`. A buggy or malicious SDK cannot exceed the mandate.
 *
 *   const m = ackrate.createIntentMandate({ user, agent, merchant, asset, maxAmount: "5.00", expiry });
 *   await ackrate.registerMandate(m, { signer: userKey });
 *   await ackrate.approveBudget(m,   { signer: userKey });
 *   const agent = ackrate.agent({ mandate: m, signer: agentKey });
 *   await agent.pay("1.00", { onPrepared: (pending) => paymentJournal.save(pending) });
 */
import { Buffer } from "buffer";
import { Keypair } from "@stellar/stellar-sdk";
import { type NetworkConfig } from "@ackrate/stellar";
import { type PaymentProof } from "./x402.js";
export { Errors } from "@ackrate/stellar";
export * from "./x402.js";
export interface CreateIntentMandateInput {
    user: string;
    agent: string;
    merchant: string;
    asset: string;
    /** Human amount, e.g. "5.00". */
    maxAmount: string;
    /** Unix seconds after which the mandate is dead. */
    expiry: number;
    /** Token decimals (default 7, matching Stellar assets). */
    decimals?: number;
    /** Optional explicit nonce; defaults to a unique value so ids don't collide. */
    nonce?: string;
}
export interface IntentMandate {
    /** Canonical hash hex — the on-chain mandate id (`vc_hash`). */
    id: string;
    idBuffer: Buffer;
    user: string;
    agent: string;
    merchant: string;
    asset: string;
    /** Budget in stroops. */
    maxAmount: bigint;
    expiry: number;
    decimals: number;
}
export interface SignerInput {
    signer: Keypair | string;
}
export type PaymentProofPolicy = "legacy-compatible" | "bound-v2-only";
/**
 * Chain settlement evidence retained when HTTP delivery becomes uncertain.
 * Treat `proof` as sensitive bearer data. Bound proofs authorize only the
 * exact signed request, but anyone holding one may repeat that same request.
 */
export interface SettlementReceipt {
    receiptId: string;
    proofVersion: 1 | 2;
    url: string;
    method: string;
    txHash: string;
    mandateId: string;
    amount: string;
    submittedAt: number;
    validUntil: number;
    proof: Readonly<PaymentProof>;
}
/**
 * Durable receipt storage required by paid `fetch`. Implementations must
 * protect receipts as sensitive bearer material, make `savePending` durable
 * before broadcast, enumerate them across restarts, and clear only after
 * explicit application acknowledgment.
 */
export interface SettlementReceiptStore {
    savePending(receipt: Readonly<SettlementReceipt>): Promise<void>;
    clearPending(receiptId: string): Promise<void>;
    listPending(): Promise<ReadonlyArray<Readonly<SettlementReceipt>>>;
}
/**
 * Domain-separated integrity id for the complete recovery envelope. This is
 * not an authentication secret: the proof remains sensitive bearer material.
 * Covering the URL and method makes accidental or stale envelope mutation fail
 * before any HTTP request is attempted.
 */
export declare function createSettlementReceiptId(receipt: Omit<Readonly<SettlementReceipt>, "receiptId">): string;
/** Return the exact settlement receipt associated with a successful paid response. */
export declare function getSettlementReceipt(response: Response): Readonly<SettlementReceipt> | undefined;
/**
 * A canonical signed payment hash exists and broadcast may have been attempted,
 * but final settlement or paid HTTP delivery is not confirmed. Do not pay
 * again. Reconcile and retry the exact included receipt.
 */
export declare class DeliveryPendingError extends Error {
    readonly receipt: Readonly<SettlementReceipt>;
    constructor(receipt: Readonly<SettlementReceipt>, cause: unknown);
}
export interface PendingSettlement {
    txHash: string;
    mandateId: string;
    amount: string;
    expectedSeq: string;
    submittedAt: number;
    /** Exact signed transaction max-time. A missing ledger result is not safely
     *  final until this time has elapsed and RPC history still covers it. */
    validUntil: number;
    receiptId?: string;
}
export type SettlementReconciliation = {
    kind: "none";
} | {
    kind: "pending";
    settlement: Readonly<PendingSettlement>;
} | {
    kind: "succeeded";
    settlement: Readonly<PendingSettlement>;
    deliveryPending: boolean;
} | {
    kind: "failed";
    settlement: Readonly<PendingSettlement>;
} | {
    kind: "expired";
    settlement: Readonly<PendingSettlement>;
};
/** Broadcast was attempted for a signed transaction whose final result is unknown. */
export declare class SettlementUncertainError extends Error {
    readonly settlement: Readonly<PendingSettlement>;
    constructor(settlement: Readonly<PendingSettlement>, cause: unknown);
}
/** A finalized transaction returned a typed MandateRegistry contract rejection. */
export declare class PaymentRejectedError extends Error {
    readonly mandateId: string;
    constructor(mandateId: string, cause: unknown);
}
export interface PaymentSubmissionLifecycle {
    holdUntilDelivery?: boolean;
    /** Optional immutable operation sequence. When supplied, the SDK refuses to
     *  prepare if current contract state has already advanced, making a lost-
     *  response retry fail before another transaction can be created. */
    expectedSeq?: string | number | bigint;
    /** Runs after signing and hash derivation but before broadcast. Throwing
     *  aborts without submitting, so callers can make the hash durable first. */
    onPrepared: (settlement: Readonly<PendingSettlement>) => void | string | Promise<void | string | undefined>;
    onSubmitted?: (txHash: string) => string | undefined;
}
/**
 * Convert a human amount to stroops (i128). Strict by design — this is money:
 * only a non-negative decimal like "5" or "5.00" is accepted. Negatives,
 * multiple dots, scientific notation, garbage, more than `decimals` fraction
 * digits, or a value too large for i128 all throw rather than silently produce a
 * wrong on-chain value.
 */
export declare function toStroops(human: string, decimals?: number): bigint;
/** An agent bound to a registered mandate. Its only power is `pay`, and every
 *  payment is enforced on-chain against the mandate. */
export declare class Agent {
    private readonly net;
    private readonly mandate;
    private readonly agentKeypair;
    private readonly proofPolicy;
    private readonly receiptStore?;
    private pendingSettlement?;
    private readonly paymentClaimOwner;
    private paymentClaimKey?;
    constructor(net: NetworkConfig, mandate: IntentMandate, agentKeypair: Keypair, proofPolicy?: PaymentProofPolicy, receiptStore?: SettlementReceiptStore | undefined);
    private claimPaymentOperation;
    private releasePaymentOperation;
    private hydratePendingReceipt;
    /** Execute a mandate-validated payment of `amount` (human, e.g. "1.00").
     *  Reads the current sequence, then calls the contract's `execute_payment`
     *  (agent-signed). Throws if the contract rejects it. Returns the tx hash. */
    pay(amount: string, lifecycle: PaymentSubmissionLifecycle): Promise<string>;
    getPendingSettlement(): Readonly<PendingSettlement> | undefined;
    /** Query RPC for a previously prepared/submitted transaction without creating
     *  a new one. Pass a durable journal record after process restart. */
    reconcilePendingSettlement(restored?: Readonly<PendingSettlement>): Promise<SettlementReconciliation>;
    /**
     * Retry delivery with an already-settled proof. This method never calls
     * `pay`, never signs, and never creates another on-chain transaction.
     */
    retryDelivery(receipt: Readonly<SettlementReceipt>, init?: RequestInit): Promise<Response>;
    /**
     * Application-level delivery commit. Call only after the complete response
     * has been validated and any business result is durably recorded. Until this
     * succeeds, the retained receipt keeps every new payment fail-closed.
     */
    acknowledgeDelivery(receipt: Readonly<SettlementReceipt>): Promise<void>;
    /**
     * x402 round-trip. GET `url`; if the server answers 402 Payment Required, read
     * the payment requirement, settle it on-chain via `execute_payment` (the same
     * path as `pay`), and retry the request with an `X-PAYMENT` settlement proof.
     * Returns the final `Response`.
     *
     * The contract is the enforcer; `fetch` never bypasses it. The payment always
     * goes through `pay` -> `execute_payment`, so a revoked, expired, out-of-scope,
     * or over-budget request is rejected on-chain and `fetch` throws. The 402 body
     * is only a hint: the merchant independently verifies the on-chain payment
     * before serving the resource.
     */
    fetch(url: string, init?: RequestInit): Promise<Response>;
}
export declare const ackrate: {
    testnet: NetworkConfig;
    /** Build an AP2-style IntentMandate and its canonical id (no chain calls). */
    createIntentMandate(input: CreateIntentMandateInput, net?: NetworkConfig): IntentMandate;
    /** Register the mandate on-chain (user-signed). */
    registerMandate(mandate: IntentMandate, opts: SignerInput, net?: NetworkConfig): Promise<string>;
    /** Approve the contract for a SEP-41 allowance up to the mandate budget (user-signed). */
    approveBudget(mandate: IntentMandate, opts: SignerInput, net?: NetworkConfig): Promise<string>;
    /** Revoke the mandate (user-signed). After this, `pay` is rejected on-chain. */
    revokeMandate(mandate: IntentMandate, opts: SignerInput, net?: NetworkConfig): Promise<string>;
    /** Bind an agent to a registered mandate. */
    agent(opts: {
        mandate: IntentMandate;
        signer: Keypair | string;
        proofPolicy?: PaymentProofPolicy;
        receiptStore?: SettlementReceiptStore;
    }, net?: NetworkConfig): Agent;
};
/**
 * @deprecated Use `ackrate`. This alias remains only for compatibility with
 * callers using the frozen on-chain protocol profile.
 */
export declare const reapp: {
    testnet: NetworkConfig;
    /** Build an AP2-style IntentMandate and its canonical id (no chain calls). */
    createIntentMandate(input: CreateIntentMandateInput, net?: NetworkConfig): IntentMandate;
    /** Register the mandate on-chain (user-signed). */
    registerMandate(mandate: IntentMandate, opts: SignerInput, net?: NetworkConfig): Promise<string>;
    /** Approve the contract for a SEP-41 allowance up to the mandate budget (user-signed). */
    approveBudget(mandate: IntentMandate, opts: SignerInput, net?: NetworkConfig): Promise<string>;
    /** Revoke the mandate (user-signed). After this, `pay` is rejected on-chain. */
    revokeMandate(mandate: IntentMandate, opts: SignerInput, net?: NetworkConfig): Promise<string>;
    /** Bind an agent to a registered mandate. */
    agent(opts: {
        mandate: IntentMandate;
        signer: Keypair | string;
        proofPolicy?: PaymentProofPolicy;
        receiptStore?: SettlementReceiptStore;
    }, net?: NetworkConfig): Agent;
};
