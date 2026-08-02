import assert from "node:assert/strict";
import test from "node:test";
import { settlementPaymentAction } from "./arena-service.js";
import type { PaymentState } from "./types.js";

function payment(status: PaymentState["status"], mandateId?: string): PaymentState {
  return { mode: "prava", status, mandateId };
}

test("settlement retries refresh a failed mandate before charging", () => {
  assert.equal(settlementPaymentAction(payment("failed", "mandate-original")), "refresh");
  assert.equal(settlementPaymentAction(payment("active")), "refresh");
  assert.equal(settlementPaymentAction(payment("active", "mandate-original")), "charge");
});

test("settlement blocks duplicate charges while one is in progress", () => {
  assert.equal(settlementPaymentAction(payment("charging", "mandate-original")), "block");
});
