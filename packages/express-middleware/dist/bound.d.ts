import { BOUND_PAYMENT_SCHEME, type BoundPaymentChallengeV2 } from "@ackrate/core";
import { type NetworkConfig } from "@ackrate/stellar";
import type { RequestHandler, Response } from "express";
import type { BoundDeliveryRecord, BoundRedemptionStore } from "./bound-store.js";
import type { PaymentVerifier, RequestValue } from "./types.js";
export interface BoundReappPaymentMiddlewareOptions {
    /** Merchant address that must receive the contract-authorized transfer. */
    merchant: string;
    /** Price as a human decimal string, or a request-specific resolver. */
    amount: RequestValue;
    /** Exact public HTTP(S) origin configured by the merchant; never Host-derived. */
    audience: RequestValue;
    /** At least 32 bytes. Keep stable across restarts and never expose it to clients. */
    challengeSecret: string | Uint8Array;
    /** Atomic transaction-to-proof binding. Must be durable and shared in production. */
    redemptionStore: BoundRedemptionStore;
    /** Exact path + query resolver. Defaults to request.originalUrl. */
    resource?: RequestValue;
    /** SEP-41 asset contract. Defaults to networkConfig.nativeSac. */
    asset?: string;
    /** Contract/RPC configuration. Defaults to REAPP testnet. */
    networkConfig?: NetworkConfig;
    /** x402 network label. Defaults to stellar-testnet. */
    network?: string;
    /** Asset decimals. Defaults to 7. */
    decimals?: number;
    /** Funded G-address used only for read-only contract simulations. */
    sourceAccount?: string;
    /** Optional verifier injection for tests or alternate trusted RPC infrastructure. */
    verifier?: PaymentVerifier;
    pollAttempts?: number;
    pollIntervalMs?: number;
    maxProofAgeLedgers?: number;
    maxHeaderBytes?: number;
    allowHttpRpc?: boolean;
    /** Bound challenge lifetime in seconds. Defaults to 900. */
    challengeTtlSeconds?: number;
    /** Deterministic test hook. Must return safe whole Unix seconds. */
    now?: () => number;
    /** Deterministic test hook. Production uses node:crypto randomBytes. */
    randomBytes?: (size: number) => Uint8Array;
}
export interface BoundX402Challenge {
    x402Version: 1;
    accepts: Array<{
        scheme: typeof BOUND_PAYMENT_SCHEME;
        network: string;
        maxAmountRequired: string;
        asset: string;
        payTo: string;
        resource: string;
        extra: {
            contract: string;
            reappProofVersion: 2;
            challenge: BoundPaymentChallengeV2;
        };
    }>;
}
export declare const REAPP_BOUND_DELIVERY_LOCALS_KEY = "reappBoundDelivery";
export interface BoundDeliveryContext {
    kind: "claimed" | "completed";
    record: Readonly<BoundDeliveryRecord>;
}
export declare function getBoundDeliveryContext(response: Response): BoundDeliveryContext | undefined;
export declare function createBoundReappPaymentMiddleware(options: BoundReappPaymentMiddlewareOptions): RequestHandler;
