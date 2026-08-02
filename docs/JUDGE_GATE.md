# judge readiness gate

This gate turns the Agentic Commerce Hackathon's published expectations into
repeatable evidence checks. It is an internal readiness score, not an official
Devfolio score and not a guarantee of placement.

The official event says judges will look for a product that works, solves a
clear problem, uses an agent for meaningful action, handles payments clearly,
and could become a real product:

- <https://agentic-commerce.devfolio.co/>
- <https://guide.devfolio.co/docs/guide/participating-in-hackathons/judging-1>

## Before deployment

Run the repository-only gate:

```bash
npm run judge:gate:static
```

It verifies the product story, architecture and API documentation, dual-model
agent workflow, server-side Prava integration, and hackathon disclosure.

## After the human UI run

Complete one arena through the public frontend, then run:

```bash
JUDGE_GATE_ARENA_ID=<completed-arena-id> npm run judge:gate
```

Optional overrides:

```bash
JUDGE_GATE_API_URL=https://your-api.example \
JUDGE_GATE_FRONTEND_URL=https://your-app.example \
JUDGE_GATE_ARENA_ID=<completed-arena-id> \
npm run judge:gate
```

The full gate is read-only. It performs GET requests and checks:

- public API health and dependency readiness;
- the public frontend and complete OpenAPI lifecycle;
- final arena status `complete`;
- Prava payment status `completed` with a transaction identifier;
- at least three submissions, recorded evaluations, and one winner;
- a confirmed 64-hex Stellar transaction with a Stellar Expert link; and
- a sourced winning portfolio whose total price stays within budget.

A judge-ready release must finish at `100/100` with no failed checks. Save the
successful output with the arena URL and Stellar Expert transaction as the
submission's technical proof.
