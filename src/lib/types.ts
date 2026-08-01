export type CriterionVisibility = "public" | "private";

export type Criterion = {
  id: string;
  label: string;
  description: string;
  weight: number;
  visibility: CriterionVisibility;
};

export type EvidenceItem = {
  claim: string;
  evidence: string;
  sourceUrl: string;
};

export type ResearchReport = {
  title: string;
  thesis: string;
  findings: EvidenceItem[];
  risks: string[];
  recommendation: string;
};

export type ArenaSubmission = {
  id: string;
  agentId: string;
  agentName: string;
  provider: "openai" | "anthropic" | "demo";
  bidAmount: number;
  globalElo: number;
  report: ResearchReport;
  elo: number;
  isWinner: boolean;
};

export type ArenaEvaluation = {
  id: string;
  criterionId: string;
  leftSubmissionId: string;
  rightSubmissionId: string;
  winnerSubmissionId: string;
  rationale: string;
};

export type FinalBundle = {
  title: string;
  executiveSummary: string;
  answer: string;
  keyFindings: EvidenceItem[];
  disagreements: string[];
  nextActions: string[];
  winningSubmissionIds: string[];
  totalPrice: number;
};

export type ArenaStatus =
  | "funding_required"
  | "funding_pending"
  | "funded"
  | "researching"
  | "ready_to_settle"
  | "complete"
  | "failed";

export type PaymentState = {
  mode: "prava" | "demo";
  status:
    | "not_started"
    | "pending_approval"
    | "active"
    | "charging"
    | "completed"
    | "failed";
  sessionId?: string;
  mandateId?: string;
  transactionId?: string;
  orderId?: string;
  iframeUrl?: string;
  responseId?: string;
  error?: string;
};

export type AckrateFingerprint = {
  intentHash: string;
  mandateId: string;
  bindingVersion: string;
  package: "@ackrate/ap2";
  expiresAt?: string;
};

export type StellarAnchorState = {
  network: "testnet";
  contractId: string;
  status: "not_started" | "registering" | "confirmed" | "failed";
  signerAddress: string;
  transactionHash?: string;
  explorerUrl?: string;
  registeredAt?: string;
  error?: string;
};

export type Arena = {
  id: string;
  slug: string;
  buyerId: string;
  buyerEmail: string;
  topicPublic: string;
  topicPrivate: string;
  topicVisibility: "public" | "gated";
  qualification: {
    minimumGlobalElo: number;
    qualifiedAgentCount: number;
  };
  criteria: Criterion[];
  budget: number;
  currency: "USD";
  status: ArenaStatus;
  fingerprint: AckrateFingerprint;
  stellarAnchor: StellarAnchorState;
  payment: PaymentState;
  submissions: ArenaSubmission[];
  evaluations: ArenaEvaluation[];
  finalBundle?: FinalBundle;
  createdAt: string;
  updatedAt: string;
};

export type CreateArenaInput = {
  buyerEmail: string;
  topicPublic: string;
  topicPrivate?: string;
  budget: number;
  minimumAgentElo?: number;
  criteria?: Array<{
    label: string;
    description?: string;
    visibility?: CriterionVisibility;
  }>;
};
