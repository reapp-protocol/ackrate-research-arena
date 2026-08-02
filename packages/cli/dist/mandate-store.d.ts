import type { CreateIntentMandateInput } from "@ackrate/core";
export type StoredMandate = {
    inputs: CreateIntentMandateInput;
    id: string;
    registerTx: string;
    approveTx: string;
};
export declare function mandatePath(): string;
export declare function mandateExists(): boolean;
export declare function loadMandate(): StoredMandate;
export declare function saveMandate(m: StoredMandate): string;
