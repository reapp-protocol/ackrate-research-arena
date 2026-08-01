import assert from "node:assert/strict";
import test from "node:test";
import {
  ProviderOrchestrationError,
  runWithProviderFailover,
  type ModelProvider,
} from "./orchestrator.js";

const bothProviders = { openai: true, anthropic: true };

test("falls back from OpenAI quota exhaustion to Anthropic", async () => {
  const calls: ModelProvider[] = [];
  const result = await runWithProviderFailover({
    operation: "research",
    preferred: "openai",
    available: bothProviders,
    execute: async (provider) => {
      calls.push(provider);
      if (provider === "openai") throw new Error("429 quota exceeded");
      return "claude report";
    },
  });

  assert.deepEqual(calls, ["openai", "anthropic"]);
  assert.equal(result.provider, "anthropic");
  assert.equal(result.value, "claude report");
  assert.equal(result.attempts[0]?.message, "429 quota exceeded");
});

test("falls back from Anthropic to OpenAI", async () => {
  const calls: ModelProvider[] = [];
  const result = await runWithProviderFailover({
    operation: "research",
    preferred: "anthropic",
    available: bothProviders,
    execute: async (provider) => {
      calls.push(provider);
      if (provider === "anthropic") throw new Error("provider unavailable");
      return "openai report";
    },
  });

  assert.deepEqual(calls, ["anthropic", "openai"]);
  assert.equal(result.provider, "openai");
});

test("does not call the alternate provider after a successful first attempt", async () => {
  const calls: ModelProvider[] = [];
  const result = await runWithProviderFailover({
    operation: "judge",
    preferred: "anthropic",
    available: bothProviders,
    execute: async (provider) => {
      calls.push(provider);
      return "judged";
    },
  });

  assert.deepEqual(calls, ["anthropic"]);
  assert.equal(result.attempts.length, 0);
});

test("fails clearly and stops after each available provider is attempted once", async () => {
  const calls: ModelProvider[] = [];

  await assert.rejects(
    runWithProviderFailover({
      operation: "semantic judge",
      preferred: "openai",
      available: bothProviders,
      execute: async (provider) => {
        calls.push(provider);
        throw new Error(`${provider} failed`);
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof ProviderOrchestrationError);
      assert.equal(error.attempts.length, 2);
      assert.match(error.message, /openai failed/);
      assert.match(error.message, /anthropic failed/);
      return true;
    },
  );

  assert.deepEqual(calls, ["openai", "anthropic"]);
});

test("fails closed when no model provider is configured", async () => {
  await assert.rejects(
    runWithProviderFailover({
      operation: "research",
      preferred: "openai",
      available: { openai: false, anthropic: false },
      execute: async () => "unreachable",
    }),
    /not configured/,
  );
});
