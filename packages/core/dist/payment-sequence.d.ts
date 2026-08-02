/** Normalize a caller-bound operation sequence to the generated contract
 * binding's u32 representation. Parse through bigint first so no accepted
 * string or bigint can be rounded before the range check. */
export declare function normalizeExpectedPaymentSequence(value: string | number | bigint): number;
/** Bind one caller operation to exactly one current mandate sequence. */
export declare function resolveExpectedPaymentSequence(currentSequence: number, requestedSequence?: string | number | bigint): number;
