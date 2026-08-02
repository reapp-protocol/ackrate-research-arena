/**
 * Terminal output: dependency-free ANSI colors + a tagged logger. Ported from
 * ackrate-protocol-demo/lib/log.ts so the CLI and the hosted demo speak the same
 * visual language. Keep this dependency-free — it ships in the published bin.
 */
export declare const c: {
    reset: string;
    bold: (s: string) => string;
    dim: (s: string) => string;
    mint: (s: string) => string;
    emerald: (s: string) => string;
    green: (s: string) => string;
    teal: (s: string) => string;
    cyan: (s: string) => string;
    deep: (s: string) => string;
    gray: (s: string) => string;
    white: (s: string) => string;
    amber: (s: string) => string;
    red: (s: string) => string;
};
/**
 * OSC 8 hyperlink: clickable in terminals that support it (iTerm2, VS Code,
 * modern xterm), and shows just `label` everywhere else — so it degrades cleanly.
 */
export declare const link: (url: string, label: string) => string;
/** stellar.expert testnet explorer links. */
export declare const explorer: {
    tx: (hash: string) => string;
    account: (addr: string) => string;
};
export declare const log: {
    info: (m: string, x?: Record<string, unknown>) => void;
    ok: (m: string, x?: Record<string, unknown>) => void;
    chain: (m: string, x?: Record<string, unknown>) => void;
    warn: (m: string, x?: Record<string, unknown>) => void;
    err: (m: string, x?: Record<string, unknown>) => void;
    step: (m: string, x?: Record<string, unknown>) => void;
};
export declare function banner(): string;
