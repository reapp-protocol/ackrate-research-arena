export type MandateCreateOptions = {
    budget?: string;
    expiry?: string;
    force?: boolean;
};
export declare function runMandateCreate(opts?: MandateCreateOptions): Promise<void>;
