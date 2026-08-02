import { DEPLOYMENTS } from "./deployments.js";
/** Stellar testnet — the live, gatechecked MandateRegistry deployment. */
export const TESTNET = {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    mandateRegistryId: DEPLOYMENTS.testnet.mandateRegistryId,
    nativeSac: DEPLOYMENTS.testnet.nativeSac,
};
