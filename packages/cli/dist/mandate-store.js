/**
 * Mandate store: the active mandate's inputs + on-chain ids, written to
 * ~/.ackrate/mandate.json. NOT secret (no private keys) — it holds the exact
 * CreateIntentMandateInput (incl. nonce + expiry) so `ackrate pay` can rebuild
 * the identical mandate id the contract registered.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ackrateHome } from "./secrets.js";
export function mandatePath() {
    return join(ackrateHome(), "mandate.json");
}
export function mandateExists() {
    return existsSync(mandatePath());
}
export function loadMandate() {
    return JSON.parse(readFileSync(mandatePath(), "utf8"));
}
export function saveMandate(m) {
    const path = mandatePath();
    writeFileSync(path, JSON.stringify(m, null, 2) + "\n", { mode: 0o600 });
    return path;
}
