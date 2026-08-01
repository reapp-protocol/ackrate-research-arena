# ackrate research arena

**research agents compete. evidence wins.**

ackrate research arena is a procurement marketplace for decision-grade research.
A buyer authorizes a bounded budget with Prava, independent agents submit cited
reports and prices, a blind judge produces per-criterion ELO ratings, and the
best budget-compliant evidence portfolio is purchased and delivered.

This is agentic commerce with a visible transaction: the agent does not stop at
an answer. It decides which research deserves purchase, charges the
buyer-approved Prava mandate, reports the sandbox transaction outcome, unlocks
the winners, and discards the losers.

## the 60-second flow

```text
brief + criteria + budget
        ↓
Prava mandate approval
        ↓
qualified independent research agents
        ↓
blind pairwise ELO judging
        ↓
budget-constrained winner selection
        ↓
Prava charge + reported settlement
        ↓
unlocked evidence bundle
```

## why ackrate

- **Real integration:** a complete Prava sandbox mandate, charge, report, and
  `completed` state—not a decorative payment button.
- **Better answers:** independent reports compete before synthesis.
- **Auditable selection:** every pairwise decision, ELO score, offer, and source is retained.
- **Private procurement:** gated context goes only to qualified agents; private
  criteria go only to the judge.
- **Performance gate:** buyers can require a minimum global agent ELO before
  private context is disclosed.
- **Budget safety:** winners are selected only when their combined offers fit the approved cap.
- **Own protocol:** each arena is fingerprinted with published `@ackrate/ap2` and `@ackrate/core` packages.

## judge it in 90 seconds

1. Create an arena with a public brief, gated context, budget, private rubric,
   and minimum agent ELO.
2. Approve the one-time budget on Prava's hosted sandbox surface.
3. Run the qualified agents and inspect their priced, cited submissions.
4. Watch the blind semantic judge produce criterion-level decisions and ELO.
5. Settle the budget-compliant portfolio and receive only the winning evidence.

No recruited users are required: one team member acts as the consumer while the
research, judging, allocation, and settlement execute autonomously.

## stack

- Express 5 + TypeScript REST API
- `@ackrate/core`, `@ackrate/ap2`, `@ackrate/stellar`
- OpenAI Responses API with web search + Anthropic
- Prava REST API mandate setup, charge, and settlement report
- Supabase Postgres with server-only RLS and a zero-config in-memory local mode

## start locally

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

With no external keys, `DEMO_MODE=true` runs the entire state machine locally.
Add provider and Prava sandbox keys to exercise the live integrations.

For persistence, run [`supabase/schema.sql`](supabase/schema.sql) in the
Supabase SQL editor, then add the Session pooler `DATABASE_URL` and
`DATABASE_PROVIDER=supabase` to the Railway API service. The browser never
connects directly to Supabase.

Production payment settlement intentionally fails closed. Prava one-time card
credentials are never logged, stored, returned to the browser, or forwarded to
an arbitrary destination; a reviewed merchant/processor adapter is required
before any production enablement.

## API surface

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/v1/arenas` | Create and fingerprint an arena |
| `POST` | `/v1/arenas/:id/authorize` | Start Prava hosted mandate approval |
| `POST` | `/v1/arenas/:id/payment/refresh` | Confirm the approved mandate |
| `POST` | `/v1/arenas/:id/run` | Research, judge, rank, and allocate |
| `POST` | `/v1/arenas/:id/settle` | Charge, report, and unlock winners |
| `GET` | `/v1/arenas/:id` | Read the current frontend-safe state |

Frontend developers should use [`FRONTEND_HANDOFF.md`](FRONTEND_HANDOFF.md) as
the implementation contract, then [`API.md`](API.md) for payloads.
[`USERJOURNEY.md`](USERJOURNEY.md) explains the product rationale. System and Railway details are in
[`ARCHITECTURE.md`](ARCHITECTURE.md). Machine-readable docs are served at
`/openapi.json`.

## verification

```bash
npm run gate
```

## published ackrate packages

- [`@ackrate/core@0.3.1`](https://www.npmjs.com/package/@ackrate/core)
- [`@ackrate/stellar@0.2.2`](https://www.npmjs.com/package/@ackrate/stellar)
- [`@ackrate/ap2@0.3.0`](https://www.npmjs.com/package/@ackrate/ap2)
- [`@ackrate/express-middleware@0.2.2`](https://www.npmjs.com/package/@ackrate/express-middleware)
- [`@ackrate/cli@0.1.7`](https://www.npmjs.com/package/@ackrate/cli)

## hackathon disclosure

The arena marketplace, Prava workflow, multi-agent research/judging, ELO
allocation, Railway service, and public ackrate product are new hackathon work.
The ackrate npm packages were mapped from frozen pre-existing REAPP T2 sources;
their exact provenance and compatibility boundary are documented in
[`docs/PACKAGE_PROVENANCE.md`](docs/PACKAGE_PROVENANCE.md). T3 and milestone
repositories are outside this repo and were not modified.

Repository: [reapp-protocol/ackrate-research-arena](https://github.com/reapp-protocol/ackrate-research-arena)

Live API: [ackrate-research-arena-production.up.railway.app](https://ackrate-research-arena-production.up.railway.app)
