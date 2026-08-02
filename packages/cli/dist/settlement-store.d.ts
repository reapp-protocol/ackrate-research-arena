import type { PendingSettlement } from "@ackrate/core";
export type SettlementSource = "pay" | "demo";
interface StoredSettlementBase {
    version: 2;
    source: SettlementSource;
    network: "testnet";
    contractId: string;
    pending: Readonly<PendingSettlement>;
}
export interface StoredPendingSettlement extends StoredSettlementBase {
    state: "pending";
}
export interface StoredCompletedSettlement extends StoredSettlementBase {
    state: "completed";
    completedAt: number;
}
export type StoredSettlement = StoredPendingSettlement | StoredCompletedSettlement;
export type LoadedSettlement = {
    kind: "none";
} | {
    kind: "empty";
} | {
    kind: "pending";
    record: Readonly<StoredPendingSettlement>;
} | {
    kind: "completed";
    record: Readonly<StoredCompletedSettlement>;
};
export declare function settlementDirectory(): string;
export declare function assertNoPendingSettlement(): Promise<void>;
/** Atomic cross-process claim. It resolves only after the exact signed hash is fsynced. */
export declare function claimPendingSettlement(source: SettlementSource, contractId: string, pending: Readonly<PendingSettlement>): Promise<void>;
export declare function loadPendingSettlement(): Promise<LoadedSettlement>;
export declare function clearPendingSettlement(expectedTxHash?: string): Promise<void>;
/** Persist final success before any success is reported to the caller. */
export declare function markSettlementCompleted(expectedTxHash: string): Promise<void>;
/** Remove completed evidence only after the human/application accepts that exact success. */
export declare function acknowledgeCompletedSettlement(expectedTxHash: string): Promise<void>;
export type MissingSettlementDecision = "pending" | "expired" | "history-pruned";
export declare function classifyMissingSettlement(pending: Readonly<PendingSettlement>, evidence: {
    latestLedgerCloseTime: number;
    oldestLedgerCloseTime: number;
}): MissingSettlementDecision;
export {};
