/**
 * Isolated x402 wire adapter for REAPP.
 *
 * Legacy v1 remains decodable for one compatibility window. New public
 * fulfillment uses the bound-v2 scheme: the merchant authenticates a challenge
 * for one audience/request, and the on-chain mandate's agent signs that exact
 * challenge together with the settlement transaction. Public chain data alone
 * is therefore insufficient to unlock a resource.
 */
import { Buffer } from "buffer";
import { Keypair } from "@stellar/stellar-sdk";
export declare const X_PAYMENT_HEADER = "x-payment";
export declare const REAPP_PAYMENT_CAPABILITIES_HEADER = "reapp-payment-capabilities";
export declare const BOUND_PAYMENT_CAPABILITY = "reapp-bound-v2";
export declare const BOUND_PAYMENT_SCHEME = "reapp-soroban-bound";
export interface BoundPaymentChallengeV2 {
    proofVersion: 2;
    challengeId: string;
    audience: string;
    scheme: string;
    method: string;
    resource: string;
    bodySha256: string | null;
    network: string;
    networkId: string;
    registryId: string;
    merchant: string;
    asset: string;
    amountStroops: string;
    decimals: number;
    issuedAt: number;
    expiresAt: number;
    authorization: {
        algorithm: "hmac-sha256";
        mac: string;
    };
}
export type UnsignedBoundPaymentChallengeV2 = Omit<BoundPaymentChallengeV2, "authorization">;
export interface PaymentRequired {
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    resource: string;
    contract?: string;
    proofVersion?: 1 | 2;
    challenge?: BoundPaymentChallengeV2;
}
export interface LegacyPaymentProof {
    scheme: string;
    network: string;
    txHash: string;
    mandateId: string;
    amount: string;
}
export interface BoundPaymentProofV2 {
    proofVersion: 2;
    scheme: string;
    network: string;
    txHash: string;
    mandateId: string;
    challenge: BoundPaymentChallengeV2;
    authorization: {
        algorithm: "stellar-ed25519-sha256";
        signature: string;
    };
}
export type PaymentProof = LegacyPaymentProof | BoundPaymentProofV2;
/** Exact public origin used as the cryptographic service audience. */
export declare function canonicalPaymentOrigin(value: unknown, label?: string): string;
export declare function parseBoundPaymentChallenge(value: unknown): BoundPaymentChallengeV2;
export declare function boundChallengeAuthorizationBytes(challenge: UnsignedBoundPaymentChallengeV2 | BoundPaymentChallengeV2): Buffer;
export declare function hashBoundPaymentChallenge(challenge: BoundPaymentChallengeV2): string;
export declare function createBoundPaymentProof(input: {
    challenge: BoundPaymentChallengeV2;
    txHash: string;
    mandateId: string;
    signer: Keypair;
}): BoundPaymentProofV2;
export declare function verifyBoundPaymentProofSignature(proof: BoundPaymentProofV2, agent: string): boolean;
export declare function parse402(response: Response): Promise<PaymentRequired>;
export declare function encodePaymentProof(proof: PaymentProof): string;
export declare function decodePaymentProof(header: string): PaymentProof;
export declare function isBoundPaymentProof(proof: Readonly<PaymentProof>): proof is Readonly<BoundPaymentProofV2>;
