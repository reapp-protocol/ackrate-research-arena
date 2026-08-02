export interface Ap2ReplayRecord {
    key: string;
    namespace: string;
    mandateHash: string;
    user: string;
    acceptedAt: number;
}
export type Ap2ReplayResult = "consumed" | "duplicate";
export interface Ap2ReplayStore {
    consumeOnce(record: Readonly<Ap2ReplayRecord>): Ap2ReplayResult | Promise<Ap2ReplayResult>;
}
/** Single-process test/development store. Production must use durable atomic storage. */
export declare class InMemoryAp2ReplayStore implements Ap2ReplayStore {
    #private;
    consumeOnce(record: Readonly<Ap2ReplayRecord>): Ap2ReplayResult;
    get size(): number;
}
