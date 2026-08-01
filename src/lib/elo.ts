import { createHash, randomUUID } from "node:crypto";
import type { ArenaEvaluation, ArenaSubmission, Criterion } from "./types.js";

const K_FACTOR = 32;

function seededFraction(value: string): number {
  const bytes = createHash("sha256").update(value).digest();
  return bytes.readUInt32BE(0) / 0xffffffff;
}

function reportSignal(submission: ArenaSubmission, criterion: Criterion): number {
  const report = submission.report;
  const evidence = report.findings.length * 9;
  const sourceQuality = report.findings.filter((item) => /^https:\/\//.test(item.sourceUrl)).length * 7;
  const specificity = Math.min(report.recommendation.length / 18, 14);
  const riskAwareness = Math.min(report.risks.length * 4, 16);
  const deterministicTieBreak = seededFraction(`${submission.id}:${criterion.id}`) * 8;
  return evidence + sourceQuality + specificity + riskAwareness + deterministicTieBreak;
}

function expectedScore(left: number, right: number): number {
  return 1 / (1 + 10 ** ((right - left) / 400));
}

export function applyEloEvaluations(
  submissions: ArenaSubmission[],
  criteria: Criterion[],
  evaluations: ArenaEvaluation[],
): { submissions: ArenaSubmission[]; evaluations: ArenaEvaluation[] } {
  const ratings = new Map(submissions.map((submission) => [submission.id, 1000]));
  const byMatch = new Map(evaluations.map((evaluation) => [
    `${evaluation.criterionId}:${[evaluation.leftSubmissionId, evaluation.rightSubmissionId].sort().join(":")}`,
    evaluation,
  ]));

  for (const criterion of criteria) {
    for (let leftIndex = 0; leftIndex < submissions.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < submissions.length; rightIndex += 1) {
        const left = submissions[leftIndex]!;
        const right = submissions[rightIndex]!;
        const evaluation = byMatch.get(`${criterion.id}:${[left.id, right.id].sort().join(":")}`);
        if (!evaluation) throw new Error(`Missing judge evaluation for ${criterion.id}`);
        if (![left.id, right.id].includes(evaluation.winnerSubmissionId)) {
          throw new Error("Judge selected a submission outside the comparison");
        }
        const leftWins = evaluation.winnerSubmissionId === left.id;
        const leftRating = ratings.get(left.id)!;
        const rightRating = ratings.get(right.id)!;
        const expectedLeft = expectedScore(leftRating, rightRating);
        const weight = Math.max(0.25, criterion.weight);
        ratings.set(left.id, leftRating + K_FACTOR * weight * ((leftWins ? 1 : 0) - expectedLeft));
        ratings.set(right.id, rightRating + K_FACTOR * weight * ((leftWins ? 0 : 1) - (1 - expectedLeft)));
      }
    }
  }

  return {
    submissions: submissions
      .map((submission) => ({ ...submission, elo: Math.round(ratings.get(submission.id)!) }))
      .sort((left, right) => right.elo - left.elo),
    evaluations,
  };
}

export function runBlindElo(
  submissions: ArenaSubmission[],
  criteria: Criterion[],
): { submissions: ArenaSubmission[]; evaluations: ArenaEvaluation[] } {
  const ratings = new Map(submissions.map((submission) => [submission.id, 1000]));
  const evaluations: ArenaEvaluation[] = [];

  for (const criterion of criteria) {
    for (let leftIndex = 0; leftIndex < submissions.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < submissions.length; rightIndex += 1) {
        const left = submissions[leftIndex]!;
        const right = submissions[rightIndex]!;
        const leftSignal = reportSignal(left, criterion);
        const rightSignal = reportSignal(right, criterion);
        const leftWins = leftSignal >= rightSignal;
        const leftRating = ratings.get(left.id)!;
        const rightRating = ratings.get(right.id)!;
        const expectedLeft = expectedScore(leftRating, rightRating);
        const weight = Math.max(0.25, criterion.weight);
        ratings.set(left.id, leftRating + K_FACTOR * weight * ((leftWins ? 1 : 0) - expectedLeft));
        ratings.set(right.id, rightRating + K_FACTOR * weight * ((leftWins ? 0 : 1) - (1 - expectedLeft)));
        evaluations.push({
          id: randomUUID(),
          criterionId: criterion.id,
          leftSubmissionId: left.id,
          rightSubmissionId: right.id,
          winnerSubmissionId: leftWins ? left.id : right.id,
          rationale: `${criterion.label}: ${leftWins ? left.agentName : right.agentName} showed stronger cited evidence, specificity, and risk coverage.`,
        });
      }
    }
  }

  return {
    submissions: submissions
      .map((submission) => ({ ...submission, elo: Math.round(ratings.get(submission.id)!) }))
      .sort((left, right) => right.elo - left.elo),
    evaluations,
  };
}

export function selectWinningPortfolio(
  submissions: ArenaSubmission[],
  budget: number,
): ArenaSubmission[] {
  let best: ArenaSubmission[] = [];
  let bestScore = Number.NEGATIVE_INFINITY;
  const combinations = 1 << submissions.length;

  for (let mask = 1; mask < combinations; mask += 1) {
    const selected = submissions.filter((_, index) => (mask & (1 << index)) !== 0);
    const cost = selected.reduce((total, submission) => total + submission.bidAmount, 0);
    if (cost > budget + 0.0001) continue;
    const score = selected.reduce((total, submission) => total + submission.elo, 0) + selected.length * 30;
    if (score > bestScore) {
      best = selected;
      bestScore = score;
    }
  }

  if (best.length === 0) {
    throw new Error("No valid research portfolio fits the authorized budget");
  }
  return best;
}
