import type { RequestHandler, Response } from "express";
import type { PaymentRequirement, ReappPaymentMiddlewareOptions, VerifiedPayment, X402Challenge } from "./types.js";
export declare const REAPP_PAYMENT_LOCALS_KEY: "reappPayment";
export declare function buildChallenge(requirement: PaymentRequirement): X402Challenge;
export declare function getVerifiedPayment(response: Response): VerifiedPayment | undefined;
export declare function createRedemptionKey(networkPassphrase: string, registryId: string, txHash: string): string;
export declare function createReappPaymentMiddleware(options: ReappPaymentMiddlewareOptions): RequestHandler;
