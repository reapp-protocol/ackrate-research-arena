import { Buffer } from "buffer";
import { Keypair } from "@stellar/stellar-sdk";
import type { Ap2MandateBinding, BindIntentMandateInput, NormalizedAp2IntentMandate } from "./index.js";
export declare const REAPP_AP2_CREDENTIAL_VERSION: "reapp-ap2-credential/1";
export declare const REAPP_AP2_SIGNATURE_ALGORITHM: "stellar-ed25519-sha256";
export interface ReappAp2CredentialPayload {
    ap2SpecVersion: "0.1.0";
    ap2DataKey: "ap2.mandates.IntentMandate";
    bindingVersion: "reapp-ap2/1";
    intent: NormalizedAp2IntentMandate;
    stellar: {
        user: string;
        agent: string;
        asset: string;
        maxAmount: string;
        decimals: number;
        nonce: string;
    };
}
export interface SignedAp2Mandate {
    credentialVersion: typeof REAPP_AP2_CREDENTIAL_VERSION;
    payload: ReappAp2CredentialPayload;
    mandateHash: string;
    signature: {
        algorithm: typeof REAPP_AP2_SIGNATURE_ALGORITHM;
        value: string;
    };
}
export declare function ap2CredentialSigningDigest(credentialVersion: string, payload: Pick<ReappAp2CredentialPayload, "ap2SpecVersion" | "ap2DataKey" | "bindingVersion">, mandateHash: string): Buffer;
/** @internal Used by the public signAp2Mandate wrapper after binding succeeds. */
export declare function createSignedAp2Credential(binding: Ap2MandateBinding, input: BindIntentMandateInput, signer: Keypair): Readonly<SignedAp2Mandate>;
export declare function parseSignedAp2Mandate(value: unknown): SignedAp2Mandate;
export declare function decodeCanonicalSignature(value: string): Buffer;
export declare function rebuildCredentialBinding(payload: ReappAp2CredentialPayload): Ap2MandateBinding;
