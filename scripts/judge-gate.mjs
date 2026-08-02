#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticOnly = process.argv.includes("--static");
const apiBase = (process.env.JUDGE_GATE_API_URL
  || "https://ackrate-research-arena-production.up.railway.app").replace(/\/$/, "");
const frontendBase = (process.env.JUDGE_GATE_FRONTEND_URL
  || "https://ackratearena.xyz").replace(/\/$/, "");
const arenaId = process.env.JUDGE_GATE_ARENA_ID?.trim();
const checks = [];

function record(category, label, points, passed, evidence) {
  checks.push({ category, label, points, passed: Boolean(passed), evidence });
}

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function fetchResult(url, json = true) {
  try {
    const response = await fetch(url, {
      headers: { accept: json ? "application/json" : "text/html" },
      signal: AbortSignal.timeout(15_000),
    });
    const body = json ? await response.json() : await response.text();
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: undefined,
      error: error instanceof Error ? error.message : "request failed",
    };
  }
}

const [readme, hackathon, architecture, apiDocs, openapiSource, researchSource, pravaSource] = await Promise.all([
  read("README.md"),
  read("HACKATHON.md"),
  read("ARCHITECTURE.md"),
  read("API.md"),
  read("src/openapi.ts"),
  read("src/lib/research.ts"),
  read("src/lib/prava.ts"),
]);

record(
  "Problem and practicality",
  "The buyer problem and product outcome are explicit",
  10,
  readme.includes("research agents compete. evidence wins.")
    && readme.includes("budget")
    && readme.includes("budget-compliant evidence portfolio"),
  "README states the user, bounded budget, competition, and purchased outcome.",
);
record(
  "Technical execution",
  "Architecture and public API are documented",
  10,
  architecture.includes("Railway")
    && architecture.includes("Supabase")
    && apiDocs.includes("/v1/arenas/:id/settle")
    && openapiSource.includes("/v1/arenas/{id}/anchor"),
  "Architecture, API contract, settlement, and Stellar anchoring are documented.",
);
record(
  "Meaningful agent action",
  "Multiple model providers, blind judging, and allocation are implemented",
  10,
  researchSource.includes("judgeWithOpenAI")
    && researchSource.includes("judgeWithAnthropic")
    && researchSource.includes("applySemanticJudgments"),
  "OpenAI and Anthropic research are evaluated by a blind semantic judge.",
);
record(
  "Payment clarity",
  "Prava is a real server-side transaction dependency",
  10,
  pravaSource.includes("sandbox.api.prava.space")
    && pravaSource.includes("PRAVA_SECRET_KEY")
    && pravaSource.includes("chargeAndReportMandate"),
  "Prava creates the bounded authorization and reports sandbox settlement.",
);
record(
  "Trust and startup readiness",
  "Hackathon scope and pre-existing work are disclosed",
  5,
  hackathon.includes("project built during the hackathon")
    && hackathon.includes("pre-existing work")
    && readme.includes("Hackathon disclosure"),
  "Submission provenance is explicit and auditable.",
);

if (!staticOnly) {
  const [health, readiness, openapi, frontend] = await Promise.all([
    fetchResult(`${apiBase}/healthz`),
    fetchResult(`${apiBase}/readyz`),
    fetchResult(`${apiBase}/openapi.json`),
    fetchResult(`${frontendBase}/app`, false),
  ]);

  record(
    "Technical execution",
    "Live API health check passes",
    10,
    health.ok && health.body?.status === "ok",
    `GET /healthz returned HTTP ${health.status}.`,
  );
  record(
    "Technical execution",
    "All live dependencies are ready",
    10,
    readiness.ok && readiness.body?.status === "ready",
    `GET /readyz returned HTTP ${readiness.status}.`,
  );
  record(
    "Usability",
    "Public frontend is reachable",
    5,
    frontend.ok && /ackrate/i.test(frontend.body || ""),
    `GET ${frontendBase}/app returned HTTP ${frontend.status}.`,
  );

  const requiredOperations = [
    ["/v1/arenas", "post"],
    ["/v1/arenas/{id}/authorize", "post"],
    ["/v1/arenas/{id}/payment/refresh", "post"],
    ["/v1/arenas/{id}/anchor", "post"],
    ["/v1/arenas/{id}/run", "post"],
    ["/v1/arenas/{id}/settle", "post"],
    ["/v1/arenas/{id}", "get"],
  ];
  record(
    "Technical execution",
    "Live OpenAPI exposes the complete arena lifecycle",
    5,
    openapi.ok && requiredOperations.every(([route, method]) => openapi.body?.paths?.[route]?.[method]),
    `GET /openapi.json returned HTTP ${openapi.status} with the required lifecycle routes.`,
  );

  if (!arenaId) {
    record(
      "End-to-end proof",
      "A completed public-safe arena is supplied as judge evidence",
      25,
      false,
      "Set JUDGE_GATE_ARENA_ID to the arena completed through the human UI.",
    );
  } else {
    const arenaResponse = await fetchResult(`${apiBase}/v1/arenas/${encodeURIComponent(arenaId)}`);
    const arena = arenaResponse.body?.data;
    const submissions = Array.isArray(arena?.submissions) ? arena.submissions : [];
    const winners = submissions.filter((submission) => submission?.isWinner);
    const transactionHash = arena?.stellarAnchor?.transactionHash;

    record(
      "End-to-end proof",
      "The arena completed successfully",
      5,
      arenaResponse.ok && arena?.status === "complete",
      `Arena lookup returned HTTP ${arenaResponse.status}; status is ${arena?.status || "unavailable"}.`,
    );
    record(
      "Payment clarity",
      "Prava completed the bounded sandbox transaction",
      8,
      arena?.payment?.mode === "prava"
        && arena?.payment?.status === "completed"
        && typeof arena?.payment?.transactionId === "string",
      `Payment mode is ${arena?.payment?.mode || "unavailable"}; status is ${arena?.payment?.status || "unavailable"}.`,
    );
    record(
      "Meaningful agent action",
      "Three agents competed and at least one winner was purchased",
      5,
      submissions.length >= 3
        && winners.length >= 1
        && Array.isArray(arena?.evaluations)
        && arena.evaluations.length >= 1,
      `${submissions.length} submissions, ${winners.length} winners, ${arena?.evaluations?.length || 0} evaluations.`,
    );
    record(
      "Trust and wow factor",
      "The mandate is confirmed on Stellar testnet",
      5,
      arena?.stellarAnchor?.status === "confirmed"
        && typeof transactionHash === "string"
        && /^[0-9a-f]{64}$/i.test(transactionHash)
        && /^https:\/\/stellar\.expert\/explorer\/testnet\/tx\//.test(arena?.stellarAnchor?.explorerUrl || ""),
      `Stellar anchor status is ${arena?.stellarAnchor?.status || "unavailable"}.`,
    );
    record(
      "Practicality",
      "The purchased portfolio stays within budget and reveals sourced evidence",
      2,
      typeof arena?.finalBundle?.totalPrice === "number"
        && arena.finalBundle.totalPrice <= arena.budget
        && Array.isArray(arena?.finalBundle?.keyFindings)
        && arena.finalBundle.keyFindings.length >= 3,
      `Winning total is ${arena?.finalBundle?.totalPrice ?? "unavailable"} of ${arena?.budget ?? "unavailable"}.`,
    );
  }
}

for (const check of checks) {
  const marker = check.passed ? "PASS" : "FAIL";
  console.log(`${marker.padEnd(4)}  ${check.points.toString().padStart(2)}  ${check.category}: ${check.label}`);
  console.log(`      ${check.evidence}`);
}

const earned = checks.filter((check) => check.passed).reduce((sum, check) => sum + check.points, 0);
const available = checks.reduce((sum, check) => sum + check.points, 0);
const failures = checks.filter((check) => !check.passed);
console.log(`\nJudge readiness: ${earned}/${available}`);
console.log(staticOnly ? "Mode: static repository gate" : "Mode: full live submission gate");

if (failures.length > 0) {
  console.error(`Judge gate failed: ${failures.length} required check${failures.length === 1 ? "" : "s"} did not pass.`);
  process.exitCode = 1;
} else {
  console.log("Judge gate passed.");
}
