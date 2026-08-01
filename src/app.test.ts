import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { createApp } from "./app.js";

test("demo arena completes create, authorize, research, ELO, and settlement", async (context) => {
  process.env.DEMO_MODE = "true";
  delete process.env.PRAVA_SECRET_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPEN_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.DATABASE_URL;

  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  const createdResponse = await fetch(`${base}/v1/arenas`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      buyerEmail: "buyer@example.com",
      topicPublic: "Which agentic research procurement model should a small fund adopt?",
      topicPrivate: "Prefer a reversible pilot under $50.",
      budget: 40,
      minimumAgentElo: 0,
      criteria: [
        { label: "evidence quality", visibility: "public" },
        { label: "implementation risk", visibility: "private" },
      ],
    }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json() as {
    data: {
      id: string;
      status: string;
      topicPrivate?: string;
      buyerEmail?: string;
      criteria: Array<{ label: string; description: string; visibility: string }>;
      qualification: { qualifiedAgentCount: number };
    };
  };
  assert.equal(created.data.status, "funding_required");
  assert.equal(created.data.topicPrivate, undefined);
  assert.equal(created.data.buyerEmail, undefined);
  assert.equal(created.data.criteria[1]!.label, "private criterion");
  assert.equal(created.data.criteria[1]!.description, "");
  assert.equal(created.data.qualification.qualifiedAgentCount, 3);

  const authorizedResponse = await fetch(`${base}/v1/arenas/${created.data.id}/authorize`, { method: "POST" });
  const authorized = await authorizedResponse.json() as { data: { status: string; payment: { status: string } } };
  assert.equal(authorized.data.status, "funded");
  assert.equal(authorized.data.payment.status, "active");

  const runResponse = await fetch(`${base}/v1/arenas/${created.data.id}/run`, { method: "POST" });
  assert.equal(runResponse.status, 200);
  const judged = await runResponse.json() as {
    data: {
      status: string;
      submissions: Array<{ elo: number; globalElo: number; isWinner: boolean; report: { locked: boolean } }>;
      evaluations: unknown[];
      finalBundle: { locked: boolean; totalPrice: number };
      budget: number;
    };
  };
  assert.equal(judged.data.status, "ready_to_settle");
  assert.equal(judged.data.submissions.length, 3);
  assert.equal(judged.data.submissions.every((submission) => submission.report.locked), true);
  assert.equal(judged.data.submissions.some((submission) => submission.isWinner), true);
  assert.equal(judged.data.evaluations.length, 6);
  assert.ok(judged.data.finalBundle.totalPrice <= judged.data.budget);

  const settledResponse = await fetch(`${base}/v1/arenas/${created.data.id}/settle`, { method: "POST" });
  assert.equal(settledResponse.status, 200);
  const settled = await settledResponse.json() as {
    data: {
      status: string;
      payment: { status: string; transactionId: string };
      submissions: Array<{ isWinner: boolean; report: { findings?: unknown[]; discarded?: boolean } }>;
      finalBundle: { keyFindings: unknown[] };
    };
  };
  assert.equal(settled.data.status, "complete");
  assert.equal(settled.data.payment.status, "completed");
  assert.match(settled.data.payment.transactionId, /^demo_txn_/);
  const winner = settled.data.submissions.find((submission) => submission.isWinner);
  const loser = settled.data.submissions.find((submission) => !submission.isWinner);
  assert.ok((winner?.report.findings?.length || 0) >= 3);
  assert.equal(loser?.report.discarded, true);
  assert.ok(settled.data.finalBundle.keyFindings.length >= 3);

  const gatedResponse = await fetch(`${base}/v1/arenas`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      buyerEmail: "gated@example.com",
      topicPublic: "Which private research workflow should a regulated team adopt?",
      topicPrivate: "Confidential qualification context.",
      budget: 25,
      minimumAgentElo: 1200,
    }),
  });
  const gated = await gatedResponse.json() as {
    data: { qualification: { qualifiedAgentCount: number }; criteria: unknown[] };
  };
  assert.equal(gatedResponse.status, 201);
  assert.equal(gated.data.qualification.qualifiedAgentCount, 2);
  assert.equal(gated.data.criteria.length, 3);
});
