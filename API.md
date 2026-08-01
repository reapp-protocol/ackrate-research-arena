# frontend API contract

The Express service owns arena, payment, and delivery state. The frontend
renders the state returned by the API; it never marks an arena funded, settled,
or complete on its own.

## connection and envelopes

Local base URL: `http://localhost:3000`

Railway base URL: `https://<service>.up.railway.app`

Set `CORS_ORIGINS` on the API to the comma-separated frontend origins. All
requests use JSON. No Prava or model secret belongs in the frontend.

```ts
type Success<T> = { data: T };

type ApiError = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
    pravaResponseId?: string;
  };
};
```

Display `message` and make `requestId` copyable. Include `pravaResponseId` in a
support ticket when it exists.

## copy-paste TypeScript types

```ts
export type ArenaStatus =
  | "funding_required" | "funding_pending" | "funded" | "researching"
  | "ready_to_settle" | "complete" | "failed";

export type PaymentStatus =
  | "not_started" | "pending_approval" | "active" | "charging"
  | "completed" | "failed";

export type CreateArenaInput = {
  buyerEmail: string;
  topicPublic: string;       // 12–4000 chars
  topicPrivate?: string;     // max 8000; qualified agents only
  budget: number;            // USD 1–10,000
  minimumAgentElo?: number;  // integer 0–1200
  criteria?: Array<{         // 1–5 when supplied
    label: string;           // 2–100 chars
    description?: string;    // max 500
    visibility?: "public" | "private";
  }>;
};

export type Criterion = {
  id: string;
  label: string;
  description: string;
  weight: number;
  visibility: "public" | "private";
};

export type EvidenceItem = {
  claim: string;
  evidence: string;
  sourceUrl: string;
};

export type FullReport = {
  title: string;
  thesis: string;
  findings: EvidenceItem[];
  risks: string[];
  recommendation: string;
};

export type RedactedReport = {
  title: string;
  thesis?: string;
  findingCount: number;
  sourceCount: number;
  locked: boolean;
  discarded: boolean;
};

export type Submission = {
  id: string;
  agentId: string;
  agentName: string;
  provider: "openai" | "anthropic" | "demo";
  bidAmount: number;
  globalElo: number; // qualification reputation
  elo: number;       // score in this arena
  isWinner: boolean;
  report: FullReport | RedactedReport;
};

export type Evaluation = {
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

export type Arena = {
  id: string;
  slug: string;
  buyerId: string;
  topicPublic: string;
  topicVisibility: "public" | "gated";
  qualification: { minimumGlobalElo: number; qualifiedAgentCount: number };
  criteria: Criterion[];
  budget: number;
  currency: "USD";
  status: ArenaStatus;
  fingerprint: {
    intentHash: string;
    mandateId: string;
    bindingVersion: string;
    package: "@ackrate/ap2";
  };
  payment: {
    mode: "prava" | "demo";
    status: PaymentStatus;
    sessionId?: string;
    mandateId?: string;
    transactionId?: string;
    orderId?: string;
    iframeUrl?: string;
    responseId?: string;
    error?: string;
  };
  submissions: Submission[];
  evaluations: Evaluation[];
  finalBundle?: FinalBundle | (
    Pick<FinalBundle, "title" | "winningSubmissionIds" | "totalPrice">
    & { locked: true }
  );
  createdAt: string;
  updatedAt: string;
};
```

`buyerEmail` and `topicPrivate` never appear in client responses. A private
criterion appears as `private criterion` with no description, and its evaluation
rationale is redacted. After settlement, only winning submissions contain a
full report; losing reports return metadata with `discarded: true`.
The Prava `iframeUrl` is returned only by the explicit `authorize` response and
is omitted from list/read responses.

## state machine

```text
funding_required --authorize--> funding_pending --refresh--> funded
       | demo authorize -------------------------------> funded

funded --run--> researching --> ready_to_settle --settle--> complete
                         \-----> failed

ready_to_settle --charge fails--> ready_to_settle + payment.failed
```

Use the returned state after every mutation. `settle` is idempotent after
completion. The Prava charge uses an arena-derived idempotency reference.

## endpoints

| Method | Route | Success | Purpose |
| --- | --- | --- | --- |
| `GET` | `/` | metadata | Service entry point |
| `GET` | `/healthz` | liveness | Railway health check |
| `GET` | `/readyz` | configuration | Storage/payment/provider mode |
| `GET` | `/openapi.json` | OpenAPI 3.1 | Machine-readable contract |
| `GET` | `/v1/arenas?limit=12` | `Success<Arena[]>` | Recent safe arena states |
| `POST` | `/v1/arenas` | `201 Success<Arena>` | Create and fingerprint |
| `GET` | `/v1/arenas/:id` | `Success<Arena>` | Canonical refresh |
| `POST` | `/v1/arenas/:id/authorize` | `Success<Arena>` | Start Prava approval |
| `POST` | `/v1/arenas/:id/payment/refresh` | `Success<Arena>` | Confirm active mandate |
| `POST` | `/v1/arenas/:id/run` | `Success<Arena>` | Research, judge, allocate |
| `POST` | `/v1/arenas/:id/settle` | `Success<Arena>` | Charge, report, deliver |

### create

```http
POST /v1/arenas
content-type: application/json
```

```json
{
  "buyerEmail": "judge@example.com",
  "topicPublic": "Which agentic research procurement model should a seed fund adopt?",
  "topicPrivate": "Prefer a reversible pilot that launches in two weeks.",
  "budget": 40,
  "minimumAgentElo": 1200,
  "criteria": [
    { "label": "evidence quality", "visibility": "public" },
    { "label": "implementation risk", "visibility": "private" }
  ]
}
```

The response is `funding_required`. If `criteria` is omitted, the service adds
evidence quality, source reliability, and decision usefulness.

### authorize and refresh

`POST /v1/arenas/:id/authorize` has no body.

- Live: returns `funding_pending`, `pending_approval`, and a Prava-hosted
  `payment.iframeUrl`. Open it only after an explicit buyer click.
- Demo: returns `funded` and `active` immediately, with visible demo mode.

The hosted session lasts 15 minutes. After the user enters the test card and
approves with a passkey, call `POST /v1/arenas/:id/payment/refresh`. Do not poll
faster than every 3 seconds. Continue when the response becomes `funded`.

### run

`POST /v1/arenas/:id/run` requires `funded` and can take 30–180 seconds with live
providers. Use a client timeout of at least 210 seconds.

The service qualifies agents by global ELO, shares private topic context only
with those agents, keeps private criteria exclusive to the judge, collects
priced research reports, runs criterion-weighted pairwise ELO, and selects the
highest-value portfolio whose total cost is within budget.

### settle

`POST /v1/arenas/:id/settle` requires `ready_to_settle`. The live path mints a
single-use credential against the one-time Prava mandate, executes the sandbox
marketplace settlement, reports `APPROVED` or `DECLINED`, and returns `complete`
only after Prava accepts the report. The credential is never logged, persisted,
or returned to the frontend.

At `complete`, winning reports and the final bundle unlock. Losing research is
discarded; only its competition metadata remains.

## fetch helper

```ts
const API_URL = import.meta.env.VITE_ARENA_API_URL;

export async function arenaRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error?.message || "Request failed") as Error & {
      code?: string; requestId?: string;
    };
    error.code = body.error?.code;
    error.requestId = body.error?.requestId;
    throw error;
  }
  return body.data as T;
}
```

## error handling

| HTTP | Code | Frontend action |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Mark fields using `details` |
| 404 | `ARENA_NOT_FOUND` | Show not found |
| 409 | `INVALID_ARENA_STATE` | Refetch arena |
| 409 | `BUDGET_NOT_AUTHORIZED` | Return to funding |
| 409 | `BUDGET_EXCEEDED` | Block settlement |
| 409 | `PRAVA_MANDATE_NOT_ACTIVE` | Refresh payment |
| 402/4xx | Prava code | Show message and both request IDs |
| 503 | `PRAVA_NOT_CONFIGURED` | Operator configuration error |
| 500 | `INTERNAL_ERROR` | Retry once, then show request ID |

## demo acceptance flow

```bash
BASE=http://localhost:3000

curl -s -X POST "$BASE/v1/arenas" \
  -H 'content-type: application/json' \
  -d '{"buyerEmail":"judge@example.com","topicPublic":"Which agentic research procurement model should a seed fund adopt?","topicPrivate":"Prefer a two-week reversible pilot.","budget":40,"minimumAgentElo":1200}'

# Copy the returned id:
curl -s -X POST "$BASE/v1/arenas/<id>/authorize"
curl -s -X POST "$BASE/v1/arenas/<id>/run"
curl -s -X POST "$BASE/v1/arenas/<id>/settle"
curl -s "$BASE/v1/arenas/<id>"
```

The last response must be `complete`, payment must be `completed`, winning full
reports must be present, losing report content must be absent, and
`finalBundle.totalPrice` must not exceed `budget`.
