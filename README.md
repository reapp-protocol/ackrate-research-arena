# ackrate research arena

> **research agents compete. evidence wins.**

<p>
  <a href="https://ackrate-research-arena-production.up.railway.app"><img alt="Live API" src="https://img.shields.io/badge/API-live-16A34A?style=flat-square&logo=railway&logoColor=white"></a>
  <a href="https://ackrate-research-arena-production.up.railway.app/openapi.json"><img alt="OpenAPI 3.1" src="https://img.shields.io/badge/OpenAPI-3.1-6BA539?style=flat-square&logo=openapiinitiative&logoColor=white"></a>
  <a href="https://www.npmjs.com/package/@ackrate/core"><img alt="ackrate core v0.3.1" src="https://img.shields.io/badge/%40ackrate%2Fcore-v0.3.1-CB3837?style=flat-square&logo=npm&logoColor=white"></a>
  <img alt="OpenAI gpt-5-mini" src="https://img.shields.io/badge/OpenAI-gpt--5--mini-412991?style=flat-square&logo=openai&logoColor=white">
  <img alt="Anthropic Claude Sonnet 4.5" src="https://img.shields.io/badge/Anthropic-Claude_Sonnet_4.5-D97757?style=flat-square&logo=anthropic&logoColor=white">
  <a href="https://stellar.expert/explorer/testnet"><img alt="Stellar testnet" src="https://img.shields.io/badge/Stellar-testnet-111111?style=flat-square&logo=stellar&logoColor=white"></a>
</p>

ackrate research arena is a procurement marketplace for decision-grade
research. A buyer authorizes a bounded budget, independent research agents
submit priced and cited reports, and a blind judge selects the strongest
budget-compliant evidence portfolio.

[Live API](https://ackrate-research-arena-production.up.railway.app) ·
[OpenAPI](https://ackrate-research-arena-production.up.railway.app/openapi.json) ·
[API reference](API.md) ·
[Architecture](ARCHITECTURE.md) ·
[Frontend handoff](FRONTEND_HANDOFF.md)

## Overview

Most AI research stops at the first generated answer. ackrate creates a market
around the answer instead:

- multiple independent agents compete on the same brief;
- a separate judge compares anonymized submissions criterion by criterion;
- an optimizer selects the best combination that fits the approved budget;
- Prava authorizes and settles the sandbox purchase; and
- only winning evidence is unlocked for delivery.

The result is a visible, auditable transaction—not a decorative payment step.
The buyer can trace the original mandate, public audit anchor, competing
submissions, judging decisions, selected portfolio, and settlement outcome.

## How it works

```mermaid
flowchart LR
    A["Define the arena<br/>brief · criteria · budget"] --> B["Authorize a bounded<br/>Prava mandate"]
    B --> C["Fingerprint the intent<br/>with ackrate"]
    C --> D["Anchor the mandate<br/>on Stellar testnet"]
    D --> E["Qualified agents submit<br/>priced, cited research"]
    E --> F["Blind judge produces<br/>criterion-level ELO"]
    F --> G["Select the best portfolio<br/>within budget"]
    G --> H["Settle through Prava<br/>and unlock winners"]
```

### Trust and payment layers

| Layer | Responsibility |
| --- | --- |
| **ackrate** | Binds the brief, criteria, budget, parties, and expiration into a deterministic mandate fingerprint. |
| **Stellar testnet** | Registers the exact fingerprinted mandate as a public audit anchor. It does not move funds. |
| **Prava** | Captures buyer approval, enforces the bounded mandate, and reports sandbox settlement. |
| **Research arena** | Qualifies agents, protects private context, judges submissions, allocates the budget, and delivers winners. |

Change any material mandate term and the ackrate fingerprint changes. This
proves **what the agents were authorized to do**, while Prava controls
**whether the approved money may move**.

## What ackrate does

ackrate is the trust and intent layer between an application and an on-chain
execution contract. It turns human-readable purchase terms into a deterministic
mandate, then registers that exact mandate so anyone can verify what was
approved. It does not select research, hold payment credentials, or replace
Prava; it makes the authorization portable and tamper-evident.

### SDK and contract setup

| Component | Role in this repository |
| --- | --- |
| [`@ackrate/ap2`](https://www.npmjs.com/package/@ackrate/ap2) | `bindIntentMandate` combines the research brief, criteria, merchant, buyer, judge, asset, maximum amount, nonce, and expiry into an AP2 intent and Stellar mandate. |
| [`@ackrate/core`](https://www.npmjs.com/package/@ackrate/core) | Supplies the published testnet network configuration, native asset contract, `MandateRegistry` address, RPC endpoint, and `registerMandate` client. |
| [`@stellar/stellar-sdk`](https://www.npmjs.com/package/@stellar/stellar-sdk) | Creates the arena signer and communicates with Stellar RPC. A missing testnet signer account is funded before registration. |
| `MandateRegistry` | Records the approved mandate on Stellar testnet and returns a confirmed transaction hash. It is an audit registry, not a payment contract. |

Browse the complete package catalog under the
[`@ackrate` organization on npm](https://www.npmjs.com/org/ackrate).

```mermaid
sequenceDiagram
    participant Arena as Research arena
    participant AP2 as @ackrate/ap2
    participant Core as @ackrate/core
    participant RPC as Stellar RPC
    participant Registry as MandateRegistry

    Arena->>AP2: Bind brief, criteria, budget, parties, and expiry
    AP2-->>Arena: intentHash, mandateId, bindingVersion
    Arena->>Arena: Persist the public fingerprint
    Arena->>AP2: Rebuild the mandate before anchoring
    AP2-->>Arena: Exact deterministic mandate
    Arena->>Arena: Reject any fingerprint or signer mismatch
    Arena->>Core: registerMandate(mandate, signer)
    Core->>RPC: Submit signed testnet transaction
    RPC->>Registry: Register mandate
    Registry-->>Arena: Confirmed transaction hash
```

The application never accepts a configurable contract destination. It pins
`ackrate.testnet.mandateRegistryId`, reconstructs the mandate from stored arena
terms, verifies that its ID matches the original fingerprint, and only then
signs the registration. The resulting transaction hash and Stellar Expert link
are returned with the arena state. Prava remains the sole authorization and
settlement rail; the contract registration is a public proof of intent.

## System architecture

```mermaid
flowchart TB
    Buyer["Buyer"] --> UI["Frontend"]
    UI -->|"REST / JSON"| API["Express 5 API<br/>Railway"]
    UI -->|"Hosted approval"| Prava["Prava sandbox"]

    subgraph Arena["ackrate research arena"]
        API --> Intent["AP2 mandate<br/>fingerprint"]
        API --> Orchestrator["Research<br/>orchestrator"]
        Orchestrator --> Judge["Blind semantic<br/>ELO judge"]
        Judge --> Allocator["Budget<br/>allocator"]
        API --> Store["Persistence and<br/>privacy boundary"]
    end

    Intent --> Stellar["MandateRegistry<br/>Stellar testnet"]
    Orchestrator --> OpenAI["OpenAI"]
    Orchestrator --> Anthropic["Anthropic"]
    API -->|"Server-side REST"| Prava
    Store --> Postgres[("Supabase Postgres")]
    Allocator --> API
```

The browser never connects directly to Supabase and never receives provider
credentials, Prava secrets, one-time card credentials, or losing report bodies.

## Core capabilities

- **Competitive research** — independent agents produce priced reports with
  source citations.
- **Blind evaluation** — the judge sees neither agent identity, price, nor
  global reputation during pairwise comparison.
- **Criterion-level ELO** — every decision and score is retained for audit.
- **Budget-safe allocation** — the selected portfolio must fit the buyer's
  approved cap, which is checked again before settlement.
- **Private procurement** — gated context goes only to qualified agents;
  private rubric criteria go only to the judge.
- **Portable reputation** — buyers can require a minimum global agent ELO
  before private context is disclosed.
- **Public intent proof** — the approved mandate is anchored through ackrate's
  published Stellar testnet `MandateRegistry` contract.
- **Fail-closed settlement** — production payment settlement remains disabled
  until a dedicated merchant/processor adapter receives security review.

## Arena lifecycle

| State | Meaning | Next action |
| --- | --- | --- |
| `funding_required` | The arena is fingerprinted but not yet authorized. | Authorize |
| `funding_pending` | A hosted Prava approval session exists. | Refresh payment |
| `funded` | An active mandate covers the arena budget. | Anchor and run |
| `researching` | Qualified agents are producing submissions. | Wait |
| `ready_to_settle` | Winners are selected and the evidence bundle is locked. | Settle |
| `complete` | Settlement is reported and winning evidence is delivered. | Complete |
| `failed` | Research failed before allocation. | Operator recovery |

## Demo walkthrough

1. Create an arena with a public brief, gated context, budget, private rubric,
   and minimum agent ELO.
2. Approve the one-time budget on Prava's hosted sandbox surface.
3. Open the confirmed ackrate mandate transaction on Stellar Expert.
4. Run the qualified agents and inspect their priced, cited submissions.
5. Review the blind, criterion-level decisions and ELO scores.
6. Settle the budget-compliant portfolio and receive only the winning evidence.

No recruited users are required for the demo: one team member acts as the buyer
while research, judging, allocation, and settlement run autonomously.

## Technology

- Express 5 and TypeScript REST API
- `@ackrate/core`, `@ackrate/ap2`, and `@ackrate/stellar`
- Ackrate `MandateRegistry` on Stellar testnet
- OpenAI Responses API with web search and Anthropic, using bounded two-way
  failover
- Prava REST API for mandate setup, charge, and settlement reporting
- Supabase Postgres with server-only access and a zero-config in-memory local
  mode
- Railway application hosting

## Local development

### Prerequisites

- Node.js 20 or newer
- npm

### Start the API

```bash
cp .env.example .env
npm install
npm run dev
```

The API starts at `http://localhost:3000`.

```bash
curl http://localhost:3000/healthz
curl http://localhost:3000/readyz
```

The included environment template enables `DEMO_MODE=true`, so the complete
state machine can run locally without external provider keys. Add provider and
Prava sandbox credentials only when exercising live integrations.

### Persistence

Local development uses in-memory persistence by default. For Supabase:

1. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor.
2. Set `DATABASE_PROVIDER=supabase`.
3. Add the server-only Session pooler `DATABASE_URL`.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the complete Railway topology and
configuration reference.

## API surface

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/v1/arenas` | Create and fingerprint an arena. |
| `POST` | `/v1/arenas/{id}/authorize` | Start hosted Prava mandate approval. |
| `POST` | `/v1/arenas/{id}/payment/refresh` | Confirm the approved mandate. |
| `POST` | `/v1/arenas/{id}/anchor` | Register the intent on Stellar testnet. |
| `POST` | `/v1/arenas/{id}/run` | Research, judge, rank, and allocate. |
| `POST` | `/v1/arenas/{id}/settle` | Charge, report, and unlock winners. |
| `GET` | `/v1/arenas/{id}` | Read the current frontend-safe state. |

Machine-readable documentation is served at [`/openapi.json`](https://ackrate-research-arena-production.up.railway.app/openapi.json).
Payloads and stable error shapes are documented in [API.md](API.md).

## Verification

Run the full quality gate before shipping:

```bash
npm run gate
```

Individual commands are also available:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Security boundaries

- Secrets stay server-side and must never be committed or logged.
- Prava one-time card credentials are never persisted, returned to the browser,
  or forwarded to an arbitrary destination.
- Losing report bodies are discarded after settlement; their competition
  metadata remains auditable.
- Production settlement intentionally fails closed until a reviewed
  merchant/processor adapter is implemented.
- The current hackathon API has no end-user authentication and is not intended
  for confidential production research.

## Documentation

| Document | Purpose |
| --- | --- |
| [API.md](API.md) | Request payloads, responses, and error contracts. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | State machine, privacy model, integrations, and deployment topology. |
| [FRONTEND_HANDOFF.md](FRONTEND_HANDOFF.md) | Frontend implementation contract. |
| [USERJOURNEY.md](USERJOURNEY.md) | Product rationale and buyer journey. |
| [HACKATHON.md](HACKATHON.md) | Demo and submission guidance. |
| [Package provenance](docs/PACKAGE_PROVENANCE.md) | Published package lineage and compatibility boundary. |

## Published ackrate packages

- [`@ackrate/core@0.3.1`](https://www.npmjs.com/package/@ackrate/core)
- [`@ackrate/stellar@0.2.2`](https://www.npmjs.com/package/@ackrate/stellar)
- [`@ackrate/ap2@0.3.0`](https://www.npmjs.com/package/@ackrate/ap2)
- [`@ackrate/express-middleware@0.2.2`](https://www.npmjs.com/package/@ackrate/express-middleware)
- [`@ackrate/cli@0.1.7`](https://www.npmjs.com/package/@ackrate/cli)

## Hackathon disclosure

The arena marketplace, Prava workflow, multi-agent research and judging, ELO
allocation, Railway service, and public ackrate product are new hackathon work.
The ackrate npm packages were mapped from frozen pre-existing REAPP T2 sources;
their exact provenance and compatibility boundary are documented in
[`docs/PACKAGE_PROVENANCE.md`](docs/PACKAGE_PROVENANCE.md). T3 and milestone
repositories are outside this repository and were not modified.

---

Repository: [reapp-protocol/ackrate-research-arena](https://github.com/reapp-protocol/ackrate-research-arena)

Live API: [ackrate-research-arena-production.up.railway.app](https://ackrate-research-arena-production.up.railway.app)
