import { PaymentRejectedError } from "@ackrate/core";
/** Only the SDK's typed, finalized contract rejection proves no payment landed. */
export declare function isFinalPaymentRejection(error: unknown): error is PaymentRejectedError;
