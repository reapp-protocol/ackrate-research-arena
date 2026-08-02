import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { z } from "zod";
import { applyEloEvaluations, runBlindElo, selectWinningPortfolio } from "./elo.js";
import { runWithProviderFailover, type ModelProvider } from "./orchestrator.js";
import type {
  Arena,
  ArenaEvaluation,
  ArenaSubmission,
  FinalBundle,
  ResearchReport,
} from "./types.js";

const reportSchema = z.object({
  title: z.string().min(3),
  thesis: z.string().min(20),
  findings: z.array(z.object({
    claim: z.string().min(5),
    evidence: z.string().min(10),
    sourceUrl: z.string().url(),
  })).min(3).max(8),
  risks: z.array(z.string().min(5)).min(2).max(6),
  recommendation: z.string().min(20),
});

const reportJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "thesis", "findings", "risks", "recommendation"],
  properties: {
    title: { type: "string", minLength: 3 },
    thesis: { type: "string", minLength: 20 },
    findings: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "evidence", "sourceUrl"],
        properties: {
          claim: { type: "string", minLength: 5 },
          evidence: { type: "string", minLength: 10 },
          sourceUrl: { type: "string", format: "uri" },
        },
      },
    },
    risks: { type: "array", minItems: 2, maxItems: 6, items: { type: "string", minLength: 5 } },
    recommendation: { type: "string", minLength: 20 },
  },
} as const;

const judgeResponseSchema = z.object({
  comparisons: z.array(z.object({
    criterionId: z.string(),
    leftSubmissionId: z.string(),
    rightSubmissionId: z.string(),
    winnerSubmissionId: z.string(),
    rationale: z.string().min(20),
  })).min(1).max(50),
});

const pairJudgeResponseSchema = z.object({
  winner: z.enum(["left", "right"]),
  rationale: z.string().min(1),
});

const pairJudgeJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["winner", "rationale"],
  properties: {
    winner: { type: "string", enum: ["left", "right"] },
    rationale: { type: "string" },
  },
} as const;

const judgeJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["comparisons"],
  properties: {
    comparisons: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["criterionId", "leftSubmissionId", "rightSubmissionId", "winnerSubmissionId", "rationale"],
        properties: {
          criterionId: { type: "string" },
          leftSubmissionId: { type: "string" },
          rightSubmissionId: { type: "string" },
          winnerSubmissionId: { type: "string" },
          rationale: { type: "string" },
        },
      },
    },
  },
} as const;

type AgentDefinition = {
  id: string;
  name: string;
  provider: ModelProvider;
  angle: string;
  bidShare: number;
  globalElo: number;
};

const agents: AgentDefinition[] = [
  {
    id: "evidence-scout",
    name: "evidence scout",
    provider: "openai",
    angle: "prioritize primary sources, recent evidence, and falsifiable claims",
    bidShare: 0.48,
    globalElo: 1280,
  },
  {
    id: "skeptical-analyst",
    name: "skeptical analyst",
    provider: "anthropic",
    angle: "stress-test assumptions, surface counterevidence, and quantify uncertainty",
    bidShare: 0.44,
    globalElo: 1220,
  },
  {
    id: "decision-architect",
    name: "decision architect",
    provider: "openai",
    angle: "translate the evidence into a clear decision, tradeoffs, and next actions",
    bidShare: 0.52,
    globalElo: 1160,
  },
];

export function qualifiedAgentCount(minimumGlobalElo: number) {
  return agents.filter((agent) => agent.globalElo >= minimumGlobalElo).length;
}

function researchPrompt(arena: Arena, agent: AgentDefinition): string {
  const criteria = arena.criteria
    .filter((criterion) => criterion.visibility === "public")
    .map((criterion) => `- ${criterion.label}: ${criterion.description || "judge on this dimension"}`)
    .join("\n");
  const privateContext = arena.topicPrivate ? `\nQualified-agent context:\n${arena.topicPrivate}` : "";
  return `You are ${agent.name} competing in ackrate research arena. ${agent.angle}.

Research brief:
${arena.topicPublic}${privateContext}

Evaluation criteria:
${criteria}

Return a concise decision-grade report. Every finding must cite a real HTTPS source URL. Separate evidence from inference, expose material uncertainty, and do not mention other agents.`;
}

function parseJson(text: string): unknown {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(stripped);
}

export function requireAnthropicToolInput(content: readonly unknown[], toolName: string): unknown {
  const toolUse = content.find((block): block is { type: "tool_use"; name: string; input: unknown } => (
    typeof block === "object"
    && block !== null
    && "type" in block
    && block.type === "tool_use"
    && "name" in block
    && block.name === toolName
    && "input" in block
  ));
  if (!toolUse) throw new Error(`Anthropic returned invalid structured output for ${toolName}`);
  return toolUse.input;
}

export function validateResearchReport(input: unknown): ResearchReport {
  return reportSchema.parse(input);
}

export function validateJudgeResponse(input: unknown) {
  return judgeResponseSchema.parse(input);
}

export function validatePairJudgeResponse(input: unknown) {
  return pairJudgeResponseSchema.parse(input);
}

function availableProviders(): Record<ModelProvider, boolean> {
  const policy = (process.env.AI_PROVIDER || "auto").toLowerCase();
  const allowOpenAI = policy === "openai" || policy === "auto";
  const allowAnthropic = policy === "anthropic" || policy === "auto";
  return {
    openai: allowOpenAI && Boolean(process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY),
    anthropic: allowAnthropic && Boolean(process.env.ANTHROPIC_API_KEY),
  };
}

function preferredProvider(): ModelProvider {
  return (process.env.AI_PROVIDER || "auto").toLowerCase() === "anthropic"
    ? "anthropic"
    : "openai";
}

async function researchWithOpenAI(arena: Arena, agent: AgentDefinition): Promise<ResearchReport> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    input: researchPrompt(arena, agent),
    tools: [{ type: "web_search", search_context_size: "medium" }],
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "research_report",
        strict: true,
        schema: reportJsonSchema,
      },
    },
  });
  return validateResearchReport(parseJson(response.output_text));
}

async function researchWithAnthropic(arena: Arena, agent: AgentDefinition): Promise<ResearchReport> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const toolName = "submit_research_report";
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const message = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
        max_tokens: 2200,
        system: "Produce one decision-grade research report by calling submit_research_report exactly once. Every finding must cite a real HTTPS source URL and satisfy the tool schema completely.",
        messages: [{ role: "user", content: researchPrompt(arena, agent) }],
        tools: [{
          name: toolName,
          description: "Submit the final cited research report for blind evaluation.",
          input_schema: { ...reportJsonSchema, required: [...reportJsonSchema.required] },
        }],
        tool_choice: { type: "tool", name: toolName, disable_parallel_tool_use: true },
      });
      return validateResearchReport(requireAnthropicToolInput(message.content, toolName));
    } catch (error) {
      lastError = error;
      if (attempt === 1) console.warn(`[research] Anthropic returned an invalid report for ${agent.id}; retrying once`);
    }
  }
  throw lastError;
}

async function runLiveAgent(arena: Arena, agent: AgentDefinition): Promise<{
  report: ResearchReport;
  provider: ModelProvider;
}> {
  const result = await runWithProviderFailover({
    operation: `research agent ${agent.id}`,
    preferred: preferredProvider(),
    available: availableProviders(),
    execute: (provider) => provider === "openai"
      ? researchWithOpenAI(arena, agent)
      : researchWithAnthropic(arena, agent),
    onFailover: (attempt, next) => {
      console.warn(`[research] ${attempt.provider} failed for ${agent.id}; trying ${next}: ${attempt.message}`);
    },
  });
  return { report: result.value, provider: result.provider };
}

function demoReport(arena: Arena, agent: AgentDefinition): ResearchReport {
  const angle = agent.angle.charAt(0).toUpperCase() + agent.angle.slice(1);
  return {
    title: `${agent.name}: a decision brief for ${arena.topicPublic.slice(0, 64)}`,
    thesis: `${angle}. The strongest answer combines verified market evidence, an explicit uncertainty budget, and a small reversible first action.`,
    findings: [
      {
        claim: "The transaction layer should be part of the agent workflow, not an afterthought.",
        evidence: "Prava documents bounded, single-use credentials and mandate-based authorization for agent transactions.",
        sourceUrl: "https://docs.prava.space/concepts/how-it-works",
      },
      {
        claim: "Structured, competing analyses reduce dependence on one model's framing.",
        evidence: "Blind pairwise comparison and independent scoring make disagreements visible before synthesis.",
        sourceUrl: "https://platform.openai.com/docs/guides/evals",
      },
      {
        claim: "Risk controls should be designed into the decision path.",
        evidence: "NIST's AI RMF emphasizes governed measurement and management of AI risks across the lifecycle.",
        sourceUrl: "https://www.nist.gov/itl/ai-risk-management-framework",
      },
    ],
    risks: [
      "Source quality can vary by topic and must remain visible to the buyer.",
      "Private criteria can bias selection unless their effect is disclosed after settlement.",
    ],
    recommendation: "Fund the smallest budget-compliant portfolio that covers independent evidence, counterarguments, and an executable next step; preserve the losing scores for audit without delivering losing reports.",
  };
}

async function runAgent(arena: Arena, agent: AgentDefinition): Promise<ArenaSubmission> {
  const demoMode = process.env.DEMO_MODE !== "false";
  const result = demoMode
    ? { report: demoReport(arena, agent), provider: "demo" as const }
    : await runLiveAgent(arena, agent);
  return {
    id: randomUUID(),
    agentId: agent.id,
    agentName: agent.name,
    provider: result.provider,
    bidAmount: Math.max(1, Number((arena.budget * agent.bidShare).toFixed(2))),
    globalElo: agent.globalElo,
    report: result.report,
    elo: 1000,
    isWinner: false,
  };
}

function expectedComparisonCount(arena: Arena, submissions: ArenaSubmission[]) {
  return arena.criteria.length * (submissions.length * (submissions.length - 1) / 2);
}

function blindJudgePrompt(arena: Arena, submissions: ArenaSubmission[], expectedCount: number) {
  return `You are the blind judgment agent for ackrate research arena.

Compare every pair of submissions once for every criterion. Judge only the report content against the criterion. Do not infer agent identity, use price, use global ELO, or reward verbosity. Private criteria are intentionally available to you but were hidden from contestants.

Criteria:\n${JSON.stringify(arena.criteria)}

Anonymous submissions:\n${JSON.stringify(submissions.map((submission) => ({ id: submission.id, report: submission.report })))}

Return only valid JSON with a comparisons array containing exactly ${expectedCount} entries. Preserve the supplied criterion and submission IDs. Each entry must contain criterionId, leftSubmissionId, rightSubmissionId, winnerSubmissionId, and a decision-grade rationale. The winner must be one of the two compared IDs.`;
}

function applySemanticJudgments(
  arena: Arena,
  submissions: ArenaSubmission[],
  parsed: z.infer<typeof judgeResponseSchema>,
) {
  const expectedCount = expectedComparisonCount(arena, submissions);
  if (parsed.comparisons.length !== expectedCount) {
    throw new Error(`Judge returned ${parsed.comparisons.length} of ${expectedCount} comparisons`);
  }
  const evaluations: ArenaEvaluation[] = parsed.comparisons.map((evaluation) => ({
    ...evaluation,
    id: randomUUID(),
  }));
  return applyEloEvaluations(submissions, arena.criteria, evaluations);
}

async function judgeWithOpenAI(
  arena: Arena,
  submissions: ArenaSubmission[],
): Promise<ReturnType<typeof runBlindElo>> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured for semantic judging");
  const expectedCount = expectedComparisonCount(arena, submissions);
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: process.env.OPENAI_JUDGE_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini",
    input: blindJudgePrompt(arena, submissions, expectedCount),
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "arena_judgments",
        strict: true,
        schema: judgeJsonSchema,
      },
    },
  });
  const parsed = validateJudgeResponse(parseJson(response.output_text));
  return applySemanticJudgments(arena, submissions, parsed);
}

async function judgeWithAnthropic(
  arena: Arena,
  submissions: ArenaSubmission[],
): Promise<ReturnType<typeof runBlindElo>> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured for semantic judging");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";
  const comparisons: Array<{
    criterion: Arena["criteria"][number];
    left: ArenaSubmission;
    right: ArenaSubmission;
  }> = [];

  for (const criterion of arena.criteria) {
    for (let leftIndex = 0; leftIndex < submissions.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < submissions.length; rightIndex += 1) {
        comparisons.push({
          criterion,
          left: submissions[leftIndex]!,
          right: submissions[rightIndex]!,
        });
      }
    }
  }

  const evaluations = new Array<ArenaEvaluation>(comparisons.length);
  let nextIndex = 0;
  const workerCount = Math.min(1, comparisons.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < comparisons.length) {
      const index = nextIndex;
      nextIndex += 1;
      const comparison = comparisons[index]!;
      const message = await client.messages.create({
        model,
        max_tokens: 900,
        system: "Blindly judge one pair of research reports. Use only report quality against the supplied criterion. Never use identity, price, or global reputation. Return winner as left or right with a complete evidence-based rationale.",
        messages: [{
          role: "user",
          content: `Criterion:\n${JSON.stringify(comparison.criterion)}\n\nLeft submission ${comparison.left.id}:\n${JSON.stringify(comparison.left.report)}\n\nRight submission ${comparison.right.id}:\n${JSON.stringify(comparison.right.report)}`,
        }],
        output_config: {
          format: { type: "json_schema", schema: pairJudgeJsonSchema },
        },
      });
      const text = message.content.find((block) => block.type === "text");
      if (!text || text.type !== "text") {
        throw new Error("Anthropic returned invalid structured pairwise judgment");
      }
      const parsed = validatePairJudgeResponse(parseJson(text.text));
      evaluations[index] = {
        id: randomUUID(),
        criterionId: comparison.criterion.id,
        leftSubmissionId: comparison.left.id,
        rightSubmissionId: comparison.right.id,
        winnerSubmissionId: parsed.winner === "left" ? comparison.left.id : comparison.right.id,
        rationale: parsed.rationale,
      };
    }
  }));

  return applySemanticJudgments(arena, submissions, { comparisons: evaluations });
}

async function runSemanticJudge(arena: Arena, submissions: ArenaSubmission[]) {
  const preferred = preferredProvider();
  const result = await runWithProviderFailover({
    operation: "blind semantic judge",
    preferred,
    available: availableProviders(),
    execute: (provider) => provider === "openai"
      ? judgeWithOpenAI(arena, submissions)
      : judgeWithAnthropic(arena, submissions),
    onFailover: (attempt, next) => {
      console.warn(`[judge] ${attempt.provider} failed; trying ${next}: ${attempt.message}`);
    },
  });
  return result.value;
}

function synthesize(arena: Arena, winners: ArenaSubmission[]): FinalBundle {
  const findings = winners.flatMap((winner) => winner.report.findings);
  const uniqueSources = new Set<string>();
  const keyFindings = findings.filter((finding) => {
    if (uniqueSources.has(finding.sourceUrl)) return false;
    uniqueSources.add(finding.sourceUrl);
    return true;
  }).slice(0, 8);
  return {
    title: `answer: ${arena.topicPublic.slice(0, 90)}`,
    executiveSummary: winners.map((winner) => winner.report.thesis).join(" "),
    answer: winners[0]!.report.recommendation,
    keyFindings,
    disagreements: winners.flatMap((winner) => winner.report.risks).slice(0, 6),
    nextActions: [
      "Verify the two highest-impact claims against their primary sources.",
      "Run the recommended reversible first action with a defined success threshold.",
      "Re-open the arena if new evidence invalidates a winning assumption.",
    ],
    winningSubmissionIds: winners.map((winner) => winner.id),
    totalPrice: Number(winners.reduce((total, winner) => total + winner.bidAmount, 0).toFixed(2)),
  };
}

export async function runResearchArena(arena: Arena): Promise<Pick<Arena, "submissions" | "evaluations" | "finalBundle">> {
  const qualifiedAgents = agents.filter((agent) => agent.globalElo >= arena.qualification.minimumGlobalElo);
  if (qualifiedAgents.length < 2) {
    throw new Error("The global ELO gate must qualify at least two research agents");
  }
  arena.qualification.qualifiedAgentCount = qualifiedAgents.length;
  const rawSubmissions = await Promise.all(qualifiedAgents.map((agent) => runAgent(arena, agent)));
  const validSubmissions = rawSubmissions.filter((submission) => Number.isFinite(submission.bidAmount)
    && submission.bidAmount > 0
    && submission.bidAmount <= arena.budget);
  if (validSubmissions.length < 2) {
    throw new Error("At least two valid research bids must fit the arena budget");
  }
  const ranked = process.env.DEMO_MODE !== "false"
    ? runBlindElo(validSubmissions, arena.criteria)
    : await runSemanticJudge(arena, validSubmissions);
  const winners = selectWinningPortfolio(ranked.submissions, arena.budget);
  const winnerIds = new Set(winners.map((winner) => winner.id));
  const submissions = ranked.submissions.map((submission) => ({
    ...submission,
    isWinner: winnerIds.has(submission.id),
  }));
  return {
    submissions,
    evaluations: ranked.evaluations,
    finalBundle: synthesize(arena, submissions.filter((submission) => submission.isWinner)),
  };
}

export function providerMode() {
  const providers = availableProviders();
  return {
    ...providers,
    semanticJudge: providers.openai || providers.anthropic,
    failover: providers.openai && providers.anthropic,
  };
}
