import { type SignedAp2Mandate } from "./credential.js";
import type { Ap2MandateBinding } from "./index.js";
import type { Ap2ReplayStore } from "./replay-store.js";
export type Ap2ValidationErrorCode = "INVALID_CREDENTIAL" | "UNSUPPORTED_VERSION" | "INVALID_SIGNATURE" | "SIGNER_MISMATCH" | "BINDING_MISMATCH" | "MERCHANT_MISMATCH" | "INVALID_AMOUNT" | "AMOUNT_EXCEEDS_MANDATE" | "EXPIRED" | "REPLAYED" | "REPLAY_STORE_UNAVAILABLE";
export declare class Ap2ValidationError extends Error {
    readonly code: Ap2ValidationErrorCode;
    constructor(code: Ap2ValidationErrorCode, message: string, options?: ErrorOptions);
}
export interface CreateAp2ComplianceValidatorOptions {
    replayStore: Ap2ReplayStore;
    replayNamespace: string;
    now?: () => number;
}
export interface ValidateAp2MandateInput {
    credential: unknown;
    expectedUser: string;
    merchant: string;
    amount: string;
}
export interface ValidatedAp2Mandate {
    credential: Readonly<SignedAp2Mandate>;
    binding: Ap2MandateBinding;
    mandateHash: string;
    amountStroops: bigint;
    acceptedAt: number;
}
/**
 * Validate and consume a signed AP2 mandate at admission/registration time.
 * This is intentionally independent of HTTP/x402. Repeated payment enforcement
 * remains on-chain through MandateRegistry sequence and cumulative spent state.
 */
export declare function createAp2ComplianceValidator(options: CreateAp2ComplianceValidatorOptions): {
    validateAndConsume(input: ValidateAp2MandateInput): Promise<Readonly<ValidatedAp2Mandate>>;
};
