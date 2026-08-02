import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, Result } from "@stellar/stellar-sdk/contract";
import type { u32, u64, i128, Option } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CCHQ5G4Y4YBMY6D3TYYJSVJVCKUM22Q6TMKCCHVAHY4X7K6QELQACZRM";
    };
};
export interface PendingUpgrade {
    execute_after: u64;
    wasm_hash: Buffer;
}
export declare const Errors: {
    1: {
        message: string;
    };
    2: {
        message: string;
    };
    4: {
        message: string;
    };
    5: {
        message: string;
    };
    6: {
        message: string;
    };
    7: {
        message: string;
    };
    8: {
        message: string;
    };
    9: {
        message: string;
    };
    10: {
        message: string;
    };
    11: {
        message: string;
    };
    12: {
        message: string;
    };
    13: {
        message: string;
    };
    14: {
        message: string;
    };
};
export type Status = {
    tag: "Active";
    values: void;
} | {
    tag: "Revoked";
    values: void;
} | {
    tag: "Exhausted";
    values: void;
};
export interface Mandate {
    /**
   * The ONLY principal permitted to call `execute_payment`.
   */
    agent: string;
    /**
   * SEP-41 / SAC contract id (USDC on testnet).
   */
    asset: string;
    /**
   * Ledger close timestamp (seconds) after which the mandate is dead.
   */
    expiry: u64;
    /**
   * Total budget authorized by the mandate.
   */
    max_amount: i128;
    /**
   * MVP: single allowed payee (scope). Future: `Vec<Address>` or scope-hash.
   */
    merchant: string;
    /**
   * Monotonic payment counter (mandate-level trace / replay guard).
   */
    seq: u32;
    /**
   * Cumulative consumed; invariant: `0 <= spent <= max_amount`.
   */
    spent: i128;
    status: Status;
    /**
   * Signer of the AP2 IntentMandate; grants the SEP-41 allowance.
   */
    user: string;
    /**
   * Hash binding to the off-chain AP2 IntentMandate VC; also the storage key.
   */
    vc_hash: Buffer;
}
export type DataKey = {
    tag: "Admin";
    values: void;
} | {
    tag: "Paused";
    values: void;
} | {
    tag: "PendingUpgrade";
    values: void;
} | {
    tag: "Mandate";
    values: readonly [Buffer];
};
export interface Client {
    /**
     * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Emergency stop for the sole money-moving path.
     */
    pause: (options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a unpause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Restore the money-moving path after an emergency stop.
     */
    unpause: (options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Current operational administrator.
     */
    get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;
    /**
     * Construct and simulate a is_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Read the emergency-stop state without authorization.
     */
    is_paused: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>;
    /**
     * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Rotate operational authority. Authorized by the current administrator.
     */
    set_admin: ({ new_admin }: {
        new_admin: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a get_mandate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Read-only accessor for the stored mandate (inspection / preflight).
     */
    get_mandate: ({ mandate_id }: {
        mandate_id: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<Mandate>>>;
    /**
     * Construct and simulate a cancel_upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Cancel the currently scheduled upgrade.
     */
    cancel_upgrade: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a revoke_mandate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * User withdraws consent; marks the mandate Revoked. Authorized by the user.
     */
    revoke_mandate: ({ mandate_id }: {
        mandate_id: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a execute_payment transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * The only money path. Atomic: require_auth(agent) → replay guard
     * (`expected_seq` == current `seq`, else `BadSequence`) → re-validate →
     * advance spent+seq → SEP-41 transfer_from(user → merchant). Reverts on any
     * failure. `expected_seq` is the mandate's current sequence (read from
     * `get_mandate`), preventing duplicate/out-of-order consumption.
     */
    execute_payment: ({ mandate_id, amount, expected_seq }: {
        mandate_id: Buffer;
        amount: i128;
        expected_seq: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a execute_upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Execute the scheduled upgrade after the delay while the contract is paused.
     */
    execute_upgrade: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a register_mandate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Store a user-signed mandate from its authorized parameters. The contract
     * sets `spent=0, seq=0, status=Active` itself. Authorized by `user`.
     * Returns the mandate id (= `vc_hash`, the storage key).
     */
    register_mandate: ({ user, agent, merchant, asset, max_amount, expiry, vc_hash }: {
        user: string;
        agent: string;
        merchant: string;
        asset: string;
        max_amount: i128;
        expiry: u64;
        vc_hash: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<Buffer>>>;
    /**
     * Construct and simulate a schedule_upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Schedule a same-address WASM upgrade after the fixed one-hour delay.
     */
    schedule_upgrade: ({ new_wasm_hash }: {
        new_wasm_hash: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>;
    /**
     * Construct and simulate a validate_mandate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Read-only preflight — would this spend be permitted right now? Mutates
     * nothing and requires no auth; the authoritative consume happens only in
     * `execute_payment`. (It is a dry-run; it consumes nothing.)
     */
    validate_mandate: ({ mandate_id, amount, merchant }: {
        mandate_id: Buffer;
        amount: i128;
        merchant: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a get_upgrade_delay transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Fixed timelock duration in seconds.
     */
    get_upgrade_delay: (options?: MethodOptions) => Promise<AssembledTransaction<u64>>;
    /**
     * Construct and simulate a get_pending_upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Read the pending upgrade, including hash and earliest execution time.
     */
    get_pending_upgrade: (options?: MethodOptions) => Promise<AssembledTransaction<Option<PendingUpgrade>>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { admin }: {
        admin: string;
    },
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions & Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
    }): Promise<AssembledTransaction<T>>;
    constructor(options: ContractClientOptions);
    readonly fromJSON: {
        pause: (json: string) => AssembledTransaction<null>;
        unpause: (json: string) => AssembledTransaction<null>;
        get_admin: (json: string) => AssembledTransaction<string>;
        is_paused: (json: string) => AssembledTransaction<boolean>;
        set_admin: (json: string) => AssembledTransaction<null>;
        get_mandate: (json: string) => AssembledTransaction<Result<Mandate, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        cancel_upgrade: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        revoke_mandate: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        execute_payment: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        execute_upgrade: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        register_mandate: (json: string) => AssembledTransaction<Result<Buffer<ArrayBufferLike>, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        schedule_upgrade: (json: string) => AssembledTransaction<Result<bigint, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        validate_mandate: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_upgrade_delay: (json: string) => AssembledTransaction<bigint>;
        get_pending_upgrade: (json: string) => AssembledTransaction<Option<PendingUpgrade>>;
    };
}
