import { Keypair } from "@stellar/stellar-sdk";
import { type IntentMandate } from "@ackrate/core";
import { type SignedAp2Mandate } from "./credential.js";
export { REAPP_AP2_CREDENTIAL_VERSION, REAPP_AP2_SIGNATURE_ALGORITHM, type ReappAp2CredentialPayload, type SignedAp2Mandate, } from "./credential.js";
export * from "./replay-store.js";
export * from "./validator.js";
export declare const AP2_SPEC_VERSION: "0.1.0";
export declare const AP2_INTENT_DATA_KEY: "ap2.mandates.IntentMandate";
export declare const REAPP_AP2_BINDING_VERSION: "reapp-ap2/1";
/** AP2 v0.1.0 sample IntentMandate data shape (wire names preserved). */
export interface Ap2IntentMandate {
    user_cart_confirmation_required: boolean;
    natural_language_description: string;
    merchants?: readonly string[];
    skus?: readonly string[];
    requires_refundability?: boolean;
    intent_expiry: string;
}
/** The exact, fail-closed AP2 subset that REAPP can enforce today. */
export interface NormalizedAp2IntentMandate {
    user_cart_confirmation_required: false;
    natural_language_description: string;
    merchants: [string];
    skus: [];
    requires_refundability: false;
    intent_expiry: string;
}
/** Stellar-specific authorization that AP2's commerce intent does not carry. */
export interface StellarMandateAuthorization {
    user: string;
    agent: string;
    asset: string;
    /** Human amount, such as "5.00". */
    maxAmount: string;
    /** Token decimals; defaults to Stellar's 7. */
    decimals?: number;
    /** Optional reproducibility nonce; secure random bytes are used by default. */
    nonce?: string;
}
export interface BindIntentMandateInput {
    intent: Ap2IntentMandate;
    stellar: StellarMandateAuthorization;
}
export interface Ap2MandateBinding {
    ap2SpecVersion: typeof AP2_SPEC_VERSION;
    ap2DataKey: typeof AP2_INTENT_DATA_KEY;
    bindingVersion: typeof REAPP_AP2_BINDING_VERSION;
    normalizedIntent: NormalizedAp2IntentMandate;
    canonicalIntent: string;
    /** SHA-256 of canonicalIntent, as lowercase hex. */
    intentHash: string;
    /** Random by default; supply one only for reproducible vectors. */
    bindingNonce: string;
    /** REAPP's contract-facing mandate; mandate.id is the on-chain vc_hash. */
    mandate: IntentMandate;
}
export type CanonicalJsonValue = null | boolean | number | string | readonly CanonicalJsonValue[] | {
    readonly [key: string]: CanonicalJsonValue;
};
/** Deterministic JSON with recursively sorted object keys. */
export declare function canonicalizeJson(value: unknown): string;
/**
 * Normalize and validate the AP2 subset REAPP can enforce without inventing
 * application-only policy. Unsupported constraints fail closed.
 */
export declare function normalizeAp2Intent(intent: Ap2IntentMandate): {
    intent: NormalizedAp2IntentMandate;
    unixExpiry: number;
};
/**
 * Bind a supported AP2 IntentMandate to REAPP's existing core mandate.
 *
 * The AP2 hash is embedded in core's existing nonce field. Core's canonical
 * field order is unchanged, so existing non-AP2 mandate ids remain stable.
 */
export declare function bindIntentMandate(input: BindIntentMandateInput): Ap2MandateBinding;
/** Sign a supported AP2 intent using the Stellar user key after fail-closed binding. */
export declare function signAp2Mandate(input: BindIntentMandateInput, signer: Keypair): Readonly<SignedAp2Mandate>;
