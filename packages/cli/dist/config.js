/**
 * Project config: a committable `ackrate.config.json` written by `ackrate init` into
 * the current directory. It holds NO secrets — the network, the on-chain contract
 * id (the source of truth), the explorer base, and the demo price/budget defaults.
 * Keys live elsewhere (`ackrate setup`) and are never written here.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { TESTNET } from "@ackrate/stellar";
export const CONFIG_FILE = "ackrate.config.json";
export function defaultConfig() {
    return {
        network: "testnet",
        contractId: TESTNET.mandateRegistryId,
        explorer: "https://stellar.expert/explorer/testnet",
        unlockPrice: "1.00",
        budget: "3.00",
    };
}
export function networkConfig(config) {
    return { ...TESTNET, mandateRegistryId: config.contractId };
}
export function configPath(cwd = process.cwd()) {
    return resolve(cwd, CONFIG_FILE);
}
export function configExists(cwd) {
    return existsSync(configPath(cwd));
}
export function loadConfig(cwd) {
    return JSON.parse(readFileSync(configPath(cwd), "utf8"));
}
export function saveConfig(config, cwd) {
    const path = configPath(cwd);
    writeFileSync(path, JSON.stringify(config, null, 2) + "\n", "utf8");
    return path;
}
