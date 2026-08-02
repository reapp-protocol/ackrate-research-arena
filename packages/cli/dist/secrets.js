/**
 * Secrets store: testnet burner keys written to ~/.ackrate/credentials.json,
 * OUTSIDE any repo, with tight permissions (dir 0700, file 0600). These are
 * throwaway testnet keys — never mainnet, never committed. Set ACKRATE_HOME to
 * relocate the store (handy for tests and CI).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
export function ackrateHome() {
    return process.env.ACKRATE_HOME ?? join(homedir(), ".ackrate");
}
export function credentialsPath() {
    return join(ackrateHome(), "credentials.json");
}
export function credentialsExist() {
    return existsSync(credentialsPath());
}
export function loadCredentials() {
    return JSON.parse(readFileSync(credentialsPath(), "utf8"));
}
export function saveCredentials(creds) {
    const home = ackrateHome();
    mkdirSync(home, { recursive: true, mode: 0o700 });
    const path = credentialsPath();
    writeFileSync(path, JSON.stringify(creds, null, 2) + "\n", { mode: 0o600 });
    return path;
}
