import type { Request, RequestHandler } from "express";
import { type BoundReappPaymentMiddlewareOptions } from "./bound.js";
import type { BoundDeliveryRecord, BoundRedemptionStore } from "./bound-store.js";
import type { VerifiedPayment } from "./types.js";
export interface BoundJsonResult {
    /** Successful paid responses only. Defaults to 200. */
    status?: number;
    body: unknown;
}
export interface BoundJsonFulfillmentContext {
    request: Request;
    payment: Readonly<VerifiedPayment>;
}
export type BoundJsonFulfillment = (context: BoundJsonFulfillmentContext) => BoundJsonResult | Promise<BoundJsonResult>;
export interface BoundReappPaidJsonRouteOptions extends BoundReappPaymentMiddlewareOptions {
    /** Maximum stored UTF-8 JSON response size. Defaults to 1 MiB. */
    maxResponseBytes?: number;
}
/**
 * Resolve an orphaned at-most-once execution without invoking fulfillment
 * again. Call this only from trusted operator/outbox code after confirming the
 * original execution owner is dead. The exact terminal bytes become immutable
 * and subsequent receipt recovery replays them.
 */
export declare function resolveBoundReappInterruptedDelivery(options: {
    redemptionStore: BoundRedemptionStore;
    record: Readonly<BoundDeliveryRecord>;
    maxResponseBytes?: number;
}): Promise<Readonly<BoundDeliveryRecord>>;
/**
 * Safe paid JSON route. Fulfillment executes once after an atomic claim; its
 * exact bytes are stored before they are sent. Recovery replays those bytes and
 * never invokes the fulfillment callback again.
 */
export declare function createBoundReappPaidJsonRoute(options: BoundReappPaidJsonRouteOptions, fulfill: BoundJsonFulfillment): RequestHandler;
