import assert from "node:assert/strict";
import test from "node:test";
import { findActiveMandate } from "./prava.js";
import type { Arena } from "./types.js";

const arena = {
  buyerId: "buyer_test",
  budget: 40,
  currency: "USD",
} as Arena;

test("mandate recovery remains bound to the arena's original mandate", async (context) => {
  const previousFetch = globalThis.fetch;
  const previousSecret = process.env.PRAVA_SECRET_KEY;
  process.env.PRAVA_SECRET_KEY = "test-secret";
  context.after(() => {
    globalThis.fetch = previousFetch;
    if (previousSecret === undefined) delete process.env.PRAVA_SECRET_KEY;
    else process.env.PRAVA_SECRET_KEY = previousSecret;
  });

  globalThis.fetch = async () => new Response(JSON.stringify({
    mandates: [
      {
        id: "mandate-newer-other-arena",
        status: "active",
        state: "available",
        approvedAmount: "100.00",
        remaining: "100.00",
        currency: "USD",
        createdAt: "2026-08-02T02:00:00.000Z",
      },
      {
        id: "mandate-original",
        status: "active",
        state: "available",
        approvedAmount: "40.00",
        remaining: "40.00",
        currency: "USD",
        createdAt: "2026-08-02T01:00:00.000Z",
      },
    ],
  }), { status: 200, headers: { "content-type": "application/json" } });

  const recovered = await findActiveMandate(arena, "mandate-original");
  assert.equal(recovered?.id, "mandate-original");
});

test("mandate recovery fails closed when the original mandate is unavailable", async (context) => {
  const previousFetch = globalThis.fetch;
  const previousSecret = process.env.PRAVA_SECRET_KEY;
  process.env.PRAVA_SECRET_KEY = "test-secret";
  context.after(() => {
    globalThis.fetch = previousFetch;
    if (previousSecret === undefined) delete process.env.PRAVA_SECRET_KEY;
    else process.env.PRAVA_SECRET_KEY = previousSecret;
  });

  globalThis.fetch = async () => new Response(JSON.stringify({
    mandates: [{
      id: "mandate-other-arena",
      status: "active",
      state: "available",
      approvedAmount: "100.00",
      remaining: "100.00",
      currency: "USD",
      createdAt: "2026-08-02T02:00:00.000Z",
    }],
  }), { status: 200, headers: { "content-type": "application/json" } });

  const recovered = await findActiveMandate(arena, "mandate-original");
  assert.equal(recovered, null);
});
