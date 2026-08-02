import type { VerifiedPayment } from "./types.js";
export interface BoundRedemptionRecord {
    /** Network-passphrase hash, registry id, and normalized transaction hash. */
    key: string;
    /** SHA-256 of the strict decoded bound proof. */
    proofDigest: string;
    /** Chain-derived evidence captured when this exact proof was first accepted. */
    payment: Readonly<VerifiedPayment>;
}
export interface StoredBoundJsonResponse {
    status: number;
    contentType: "application/json; charset=utf-8";
    bodyBase64: string;
    bodySha256: string;
}
export type BoundDeliveryRecord = Readonly<BoundRedemptionRecord> & Readonly<{
    executionId: string;
    startedAt: number;
}> & ({
    state: "executing";
    response?: never;
} | {
    state: "completed";
    response: Readonly<StoredBoundJsonResponse>;
});
export type BoundRedemptionLookup = {
    kind: "missing";
} | {
    kind: "executing";
    record: Readonly<BoundDeliveryRecord>;
} | {
    kind: "completed";
    record: Readonly<BoundDeliveryRecord>;
} | {
    kind: "conflict";
};
export type BoundRedemptionClaim = {
    kind: "claimed";
    record: Readonly<BoundDeliveryRecord>;
} | {
    kind: "executing";
    record: Readonly<BoundDeliveryRecord>;
} | {
    kind: "completed";
    record: Readonly<BoundDeliveryRecord>;
} | {
    kind: "conflict";
};
export interface BoundRedemptionCompletion {
    key: string;
    proofDigest: string;
    executionId: string;
    response: Readonly<StoredBoundJsonResponse>;
}
export type BoundRedemptionComplete = {
    kind: "completed";
    record: Readonly<BoundDeliveryRecord>;
} | {
    kind: "conflict";
};
/**
 * One linearizable store owns both settlement binding and immutable delivery
 * bytes. A proof is claimed at most once; recovery either waits for that claim
 * or replays its completed result without re-running fulfillment.
 */
export interface BoundRedemptionStore {
    lookup(key: string, proofDigest: string): BoundRedemptionLookup | Promise<BoundRedemptionLookup>;
    claim(record: Readonly<BoundRedemptionRecord>, executionId: string, startedAt: number): BoundRedemptionClaim | Promise<BoundRedemptionClaim>;
    complete(completion: Readonly<BoundRedemptionCompletion>): BoundRedemptionComplete | Promise<BoundRedemptionComplete>;
}
/** Process-local reference store. Production and restart drills need a durable shared store. */
export declare class InMemoryBoundRedemptionStore implements BoundRedemptionStore {
    private readonly records;
    lookup(key: string, proofDigest: string): BoundRedemptionLookup;
    claim(record: Readonly<BoundRedemptionRecord>, executionId: string, startedAt: number): BoundRedemptionClaim;
    complete(completion: Readonly<BoundRedemptionCompletion>): BoundRedemptionComplete;
    get(key: string): Readonly<BoundDeliveryRecord> | undefined;
}
