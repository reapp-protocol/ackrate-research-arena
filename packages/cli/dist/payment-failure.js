import { PaymentRejectedError } from "@ackrate/core";
/** Only the SDK's typed, finalized contract rejection proves no payment landed. */
export function isFinalPaymentRejection(error) {
    return error instanceof PaymentRejectedError;
}
