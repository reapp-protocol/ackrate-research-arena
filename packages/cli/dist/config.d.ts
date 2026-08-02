import { type NetworkConfig } from "@ackrate/stellar";
export declare const CONFIG_FILE = "ackrate.config.json";
export type AckrateConfig = {
    network: "testnet";
    contractId: string;
    explorer: string;
    /** XLM per content unlock, mirrors the demo's UNLOCK_PRICE. */
    unlockPrice: string;
    /** Mandate cap in XLM, mirrors the demo's BUDGET. */
    budget: string;
};
export declare function defaultConfig(): AckrateConfig;
export declare function networkConfig(config: AckrateConfig): NetworkConfig;
export declare function configPath(cwd?: string): string;
export declare function configExists(cwd?: string): boolean;
export declare function loadConfig(cwd?: string): AckrateConfig;
export declare function saveConfig(config: AckrateConfig, cwd?: string): string;
