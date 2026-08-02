/**
 * Terminal output: dependency-free ANSI colors + a tagged logger. Ported from
 * ackrate-protocol-demo/lib/log.ts so the CLI and the hosted demo speak the same
 * visual language. Keep this dependency-free — it ships in the published bin.
 */
const E = "\x1b[";
const wrap = (open, s, close = "39") => `${E}${open}m${s}${E}${close}m`;
export const c = {
    reset: `${E}0m`,
    bold: (s) => `${E}1m${s}${E}22m`,
    dim: (s) => `${E}2m${s}${E}22m`,
    mint: (s) => wrap("38;5;121", s),
    emerald: (s) => wrap("38;5;48", s),
    green: (s) => wrap("38;5;42", s),
    teal: (s) => wrap("38;5;43", s),
    cyan: (s) => wrap("38;5;51", s),
    deep: (s) => wrap("38;5;30", s),
    gray: (s) => wrap("38;5;245", s),
    white: (s) => wrap("38;5;231", s),
    amber: (s) => wrap("38;5;215", s),
    red: (s) => wrap("38;5;203", s),
};
/**
 * OSC 8 hyperlink: clickable in terminals that support it (iTerm2, VS Code,
 * modern xterm), and shows just `label` everywhere else — so it degrades cleanly.
 */
export const link = (url, label) => `\x1b]8;;${url}\x07${label}\x1b]8;;\x07`;
/** stellar.expert testnet explorer links. */
export const explorer = {
    tx: (hash) => `https://stellar.expert/explorer/testnet/tx/${hash}`,
    account: (addr) => `https://stellar.expert/explorer/testnet/account/${addr}`,
};
const TAGS = {
    INFO: c.cyan,
    OK: c.green,
    CHAIN: c.emerald,
    WARN: c.amber,
    ERR: c.red,
    STEP: c.gray,
};
function line(tag, msg, extra) {
    const tail = extra
        ? " " +
            Object.entries(extra)
                .map(([k, v]) => c.gray(k + "=") + c.white(String(v)))
                .join(" ")
        : "";
    console.log(`${c.emerald("⬢")} ${c.bold(TAGS[tag](tag.padEnd(5)))} ${msg}${tail}`);
}
export const log = {
    info: (m, x) => line("INFO", m, x),
    ok: (m, x) => line("OK", m, x),
    chain: (m, x) => line("CHAIN", m, x),
    warn: (m, x) => line("WARN", m, x),
    err: (m, x) => line("ERR", m, x),
    step: (m, x) => line("STEP", m, x),
};
export function banner() {
    const art = "  " + c.bold(c.emerald("ackrate"));
    const tag = "  " +
        c.dim("agent payments") + c.emerald(" · ") +
        c.dim("enforced on-chain") + c.emerald(" · ") +
        c.dim("stellar testnet");
    return art + "\n" + tag;
}
