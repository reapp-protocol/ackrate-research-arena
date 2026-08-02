/** Network configuration for REAPP's Soroban layer. */
export interface NetworkConfig {
    rpcUrl: string;
    networkPassphrase: string;
    /** Deployed MandateRegistry contract id for this network. */
    mandateRegistryId: string;
    /** Native XLM Stellar Asset Contract (a real SEP-41 token) for this network. */
    nativeSac: string;
}
/** Stellar testnet — the live, gatechecked MandateRegistry deployment. */
export declare const TESTNET: NetworkConfig;
