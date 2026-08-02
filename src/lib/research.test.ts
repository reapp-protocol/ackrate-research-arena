import assert from "node:assert/strict";
import test from "node:test";
import {
  requireAnthropicToolInput,
  validateJudgeResponse,
  validatePairJudgeResponse,
  validateResearchReport,
} from "./research.js";

const validReport = {
  title: "A decision-grade research report",
  thesis: "The evidence supports a bounded, reversible first action.",
  findings: [
    {
      claim: "Primary evidence supports the central recommendation.",
      evidence: "The published source documents the relevant operating constraint.",
      sourceUrl: "https://example.com/source-one",
    },
    {
      claim: "Independent evidence identifies the main implementation risk.",
      evidence: "A second source provides a separate account of the failure mode.",
      sourceUrl: "https://example.org/source-two",
    },
    {
      claim: "The proposed action can be evaluated with a clear threshold.",
      evidence: "A third source defines a measurable outcome and comparison baseline.",
      sourceUrl: "https://example.net/source-three",
    },
  ],
  risks: [
    "The evidence may not generalize to every market.",
    "The implementation needs a clearly defined rollback condition.",
  ],
  recommendation: "Run the smallest reversible test and verify the result against the cited evidence.",
};

test("extracts the named Anthropic structured tool result", () => {
  const input = requireAnthropicToolInput([
    { type: "text", text: "working" },
    { type: "tool_use", name: "submit_research_report", input: validReport },
  ], "submit_research_report");

  assert.deepEqual(input, validReport);
});

test("rejects Anthropic responses without the required structured tool result", () => {
  assert.throws(
    () => requireAnthropicToolInput([{ type: "text", text: "plain JSON" }], "submit_research_report"),
    /invalid structured output/,
  );
});

test("validates Anthropic report tool input against the delivery contract", () => {
  assert.deepEqual(validateResearchReport(validReport), validReport);
  assert.throws(
    () => validateResearchReport({
      ...validReport,
      findings: validReport.findings.map((finding, index) => index === 0
        ? { ...finding, sourceUrl: "not-a-url" }
        : finding),
    }),
  );
});

test("validates Anthropic judgment tool input against the evaluation contract", () => {
  const judgment = {
    comparisons: [{
      criterionId: "criterion-1",
      leftSubmissionId: "submission-left",
      rightSubmissionId: "submission-right",
      winnerSubmissionId: "submission-left",
      rationale: "The winning report provides stronger evidence and a more actionable recommendation.",
    }],
  };

  assert.deepEqual(validateJudgeResponse(judgment), judgment);
  assert.throws(() => validateJudgeResponse({
    comparisons: [{ ...judgment.comparisons[0], rationale: "too short" }],
  }));
});

test("validates one pairwise Anthropic judgment", () => {
  const judgment = {
    winnerSubmissionId: "submission-left",
    rationale: "The left report provides stronger cited evidence for the supplied criterion.",
  };

  assert.deepEqual(validatePairJudgeResponse(judgment), judgment);
  assert.throws(() => validatePairJudgeResponse({ ...judgment, rationale: "too short" }));
});
