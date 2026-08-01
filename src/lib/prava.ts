import type { Arena } from "./types.js";

type PravaSession = {
  session_id: string;
  session_token: string;
  iframe_url: string;
  order_id: string;
  expires_at: string;
  authorizeOnly?: boolean;
};

type PravaMandate = {
  id: string;
  status: "pending" | "active" | "paused" | "consumed" | "cancelled" | "expired";
  state: "available" | "consumed" | "expired";
  approvedAmount: string;
  remaining: string;
  currency: string;
  createdAt: string;
};

type PravaCharge = {
  mandateId: string;
  transactionId: string;
  orderId: string;
  status: "awaiting_result" | "failed";
  fetchStatus: "SUCCESS" | "FAILURE";
  credentials?: {
    token: string;
    dynamicCvv: string;
    expiryMonth: string;
    expiryYear: string;
  };
  errorCode?: string;
  errorMessage?: string;
};

export class PravaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly responseId?: string,
  ) {
    super(message);
  }
}

function baseUrl() {
  return (process.env.PRAVA_API_BASE_URL || "https://sandbox.api.prava.space").replace(/\/$/, "");
}

function secretKey() {
  if (!process.env.PRAVA_SECRET_KEY) throw new PravaApiError("Prava is not configured", 503, "PRAVA_NOT_CONFIGURED");
  return process.env.PRAVA_SECRET_KEY;
}

async function request<T>(path: string, init?: RequestInit): Promise<{ data: T; responseId?: string }> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const responseId = response.headers.get("x-response-id") || undefined;
  const body = await response.json().catch(() => ({})) as {
    error?: { code?: string; message?: string };
  } & T;
  if (!response.ok) {
    throw new PravaApiError(
      body.error?.message || `Prava request failed with ${response.status}`,
      response.status,
      body.error?.code || "PRAVA_ERROR",
      responseId,
    );
  }
  return { data: body, responseId };
}

export function isPravaConfigured() {
  return Boolean(process.env.PRAVA_SECRET_KEY);
}

export async function createBudgetMandateSession(arena: Arena) {
  const merchantUrl = process.env.PRAVA_MERCHANT_URL || "https://github.com/reapp-protocol/ackrate-research-arena";
  const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, "");
  const callbackUrl = process.env.PRAVA_CALLBACK_URL
    || (frontendUrl ? `${frontendUrl}/arena/${arena.id}?prava=return` : undefined);
  const result = await request<PravaSession>("/v1/sessions", {
    method: "POST",
    body: JSON.stringify({
      user_id: arena.buyerId,
      user_email: arena.buyerEmail,
      total_amount: arena.budget.toFixed(2),
      currency: arena.currency,
      external_order_ref: arena.id,
      description: `ackrate research arena budget: ${arena.topicPublic.slice(0, 120)}`,
      purchase_context: [{
        merchant_details: {
          name: "ackrate research arena",
          url: merchantUrl,
          country_code_iso2: process.env.PRAVA_MERCHANT_COUNTRY || "US",
          category_code: process.env.PRAVA_MERCHANT_CATEGORY_CODE || "7392",
          category: "research services",
        },
        product_details: [{
          product_id: arena.id.slice(0, 50),
          description: "bounded research procurement budget",
          unit_price: arena.budget.toFixed(2),
          quantity: 1,
        }],
        effective_until_minutes: 7 * 24 * 60,
      }],
      integration_type: "full_checkout",
      ...(callbackUrl?.startsWith("https://") ? { callback_url: callbackUrl } : {}),
      mandate_setup: {
        intent: "mandate_setup",
        recurring_frequency: "one_time",
        merchant_scope: "listed",
        max_charges: 1,
      },
    }),
  });
  return { ...result.data, responseId: result.responseId };
}

export async function findActiveMandate(arena: Arena): Promise<PravaMandate | null> {
  const params = new URLSearchParams({ customer_id: arena.buyerId, standing_only: "true" });
  const result = await request<{ mandates: PravaMandate[] }>(`/v1/mandates?${params}`);
  return result.data.mandates
    .filter((mandate) => mandate.status === "active" && mandate.currency === arena.currency)
    .filter((mandate) => Number(mandate.approvedAmount) + 0.0001 >= arena.budget)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] || null;
}

export async function chargeAndReportMandate(arena: Arena, mandateId: string, amount: number) {
  if (!baseUrl().includes("sandbox.api.prava.space")) {
    throw new PravaApiError(
      "Production settlement requires a reviewed merchant checkout adapter",
      503,
      "PRAVA_PRODUCTION_CHECKOUT_NOT_CONFIGURED",
    );
  }
  const chargeResult = await request<PravaCharge>(`/v1/mandates/${encodeURIComponent(mandateId)}/charge`, {
    method: "POST",
    body: JSON.stringify({
      amount: amount.toFixed(2),
      reference: `arena:${arena.id}:winning-bundle`,
      purchase_context: [{
        merchant_details: {
          name: "ackrate research arena",
          url: process.env.PRAVA_MERCHANT_URL || "https://github.com/reapp-protocol/ackrate-research-arena",
          country_code_iso2: process.env.PRAVA_MERCHANT_COUNTRY || "US",
          category_code: process.env.PRAVA_MERCHANT_CATEGORY_CODE || "7392",
        },
        product_details: [{
          product_id: arena.id.slice(0, 50),
          description: "winning research evidence bundle",
          unit_price: amount.toFixed(2),
          quantity: 1,
        }],
      }],
    }),
  });
  const charge = chargeResult.data;
  if (charge.status !== "awaiting_result" || !charge.credentials) {
    throw new PravaApiError(
      charge.errorMessage || "Prava did not issue checkout credentials",
      402,
      charge.errorCode || "PRAVA_CHARGE_FAILED",
      chargeResult.responseId,
    );
  }

  // Sandbox settlement adapter: Prava issued a complete single-use credential.
  // It is never returned, logged, persisted, or transmitted by this service.
  const credentialComplete = Boolean(
    charge.credentials.token
    && charge.credentials.dynamicCvv
    && charge.credentials.expiryMonth
    && charge.credentials.expiryYear,
  );
  if (!credentialComplete) {
    throw new PravaApiError(
      "Prava returned an incomplete sandbox credential",
      502,
      "PRAVA_CREDENTIAL_INCOMPLETE",
      chargeResult.responseId,
    );
  }
  const report = await request<{
    transactionId: string;
    orderId: string;
    status: "completed" | "failed";
    mandateStatus: string;
    visaConfirmation: "SUCCESS" | "FAILURE";
  }>(`/v1/mandates/${encodeURIComponent(mandateId)}/charges/${encodeURIComponent(charge.transactionId)}/report`, {
    method: "POST",
    body: JSON.stringify({
      txn_status: "APPROVED",
      txn_type: "PURCHASE",
      authorization_code: `ACKRATE-${arena.id.slice(0, 12)}`,
      response_code: "00",
      amount_paid: amount.toFixed(2),
    }),
  });
  return { charge, report: report.data, responseId: report.responseId || chargeResult.responseId };
}
