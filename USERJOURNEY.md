# frontend user journey

This document is the product/UX contract for the ackrate research arena frontend.
The backend is a state machine. The UI should render the server's `status` and
`payment.status`; it should not invent its own payment truth.

## canonical judgeable journey

The complete MVP is autonomous and does not require recruited users. A consumer
creates a paid research arena, qualified agents submit priced reports, the judge
runs criterion-weighted ELO, the highest-value budget-compliant portfolio wins,
losing reports are discarded, and Prava completes a real sandbox transaction.
The consumer receives only the purchased winning evidence bundle.

For the final demo, one team member acts as the consumer. The research agents,
judgment, allocation, and settlement run autonomously. A real Prava sandbox
authorization, charge, and reported settlement—not external user adoption—is the
acceptance condition.

After Prava approval and before research, the backend registers the exact
fingerprinted Ackrate mandate on Stellar testnet. This produces a public audit
transaction without moving the research budget; Prava remains the payment rail.

## product promise

The buyer should understand this sentence within five seconds:

> Set the question and budget. Research agents compete. Pay only for the winning evidence.

The tone should be calm, credible, and procurement-oriented. Use `budget`,
`offer`, `arena`, `submission`, and `winning evidence bundle`. Do not use
`wager`, `bet`, `stake`, or casino language.

## screen 1 — landing / create arena

Required fields:

1. Buyer email.
2. Public research brief.
3. Optional private context, labeled “Only qualified research agents receive this.”
4. Budget in USD.
5. Zero to five evaluation criteria. If omitted, the API supplies evidence quality,
   source reliability, and decision usefulness.
6. Public/private visibility for each criterion.
7. Optional minimum global agent ELO. The UI must prevent values above 1200 so
   at least two marketplace agents remain qualified in the hackathon roster.

Primary action: **Create arena** → `POST /v1/arenas`.

After success, route to `/arena/:id`. Display the short arena fingerprint as a
trust detail, not as the main CTA.

## screen 2 — arena / authorize

Server state: `funding_required`.

Show:

- public brief;
- budget and criteria;
- “Powered by @ackrate/ap2” fingerprint;
- a four-stage timeline: authorize → compete → judge → settle.

Primary action: **Authorize budget with Prava** →
`POST /v1/arenas/:id/authorize`.

If `payment.mode === "prava"`, open `payment.iframeUrl` in a new tab. Explain
that Prava collects the test card and passkey outside the app; raw card data
never reaches ackrate. The hosted session expires in 15 minutes, so authorization
must start only when the buyer is ready.

The approval URL is returned only by this authorize response. Keep it in memory
for the current tab; do not place it in analytics, persistent browser storage,
or a shareable arena URL.

If `payment.mode === "demo"`, authorization completes immediately and the UI
must show a visible “demo payment rail” label.

## screen 3 — approval pending

Server state: `funding_pending`; payment state: `pending_approval`.

Show the Prava approval link and a **I approved the mandate** button. That button
calls `POST /v1/arenas/:id/payment/refresh`.

- If the response is still `funding_pending`, keep the user here.
- When the response is `funded`, move to the competition state.
- Never poll faster than every three seconds.

## screen 4 — run arena

Server state: `funded`.

Primary action: **Run research arena** → `POST /v1/arenas/:id/run`.

The backend first anchors the approved intent on Stellar testnet. Show
**Registering Ackrate mandate** before the research stages. When the response
returns, display `stellarAnchor.explorerUrl` as **View public mandate proof**.

This call can take 30–180 seconds with live providers. While it runs, show three
named agent lanes:

- evidence scout;
- skeptical analyst;
- decision architect.

Do not fake token streams. A precise “researching sources / comparing evidence /
computing ELO” progress treatment is better.

## screen 5 — judged, locked bundle

Server state: `ready_to_settle`.

Show:

- each agent's name, provider, offer, ELO, and winner state;
- locked report metadata and source count only;
- evaluation count and public criteria;
- the winning portfolio total versus budget;
- the confirmed Stellar mandate transaction link;
- a locked final-bundle panel.

The API intentionally redacts findings and private context until settlement.

Primary action: **Purchase winning evidence** →
`POST /v1/arenas/:id/settle`.

Button copy should include the exact amount: “Purchase winning evidence · $18.40”.

## screen 6 — completed research

Server state: `complete`; payment state: `completed`.

Unlock:

- final answer and executive summary;
- evidence-linked key findings;
- disagreements/risks;
- next actions;
- full winning reports only;
- losing-agent offer, ELO, and disposition metadata, with the report marked
  `discarded` and its research content withheld;
- Prava transaction identifier;
- arena/AP2 fingerprint.
- Stellar testnet mandate transaction link.

Primary actions:

- **Copy answer**
- **Open sources**
- **Export evidence bundle**
- **Open another arena**

## state-to-UI table

| Arena status | Payment status | UI state | Enabled action |
| --- | --- | --- | --- |
| `funding_required` | `not_started` | Brief ready | Authorize |
| `funding_pending` | `pending_approval` | Prava tab open | Refresh approval |
| `funded` | `active` | Budget protected | Run arena |
| `researching` | `active` | Agents working | None |
| `ready_to_settle` | `active` | Winners locked | Settle |
| `ready_to_settle` | `failed` | Charge recoverable | Retry settle |
| `complete` | `completed` | Evidence unlocked | Export/share |
| `failed` | any | Research failed | Show request ID; retry later |

## visual direction

- Mostly monochrome; one strong accent.
- Clear editorial typography and generous space.
- Thin borders and compact state labels.
- Avoid gradients, glass cards, fake trading terminals, and excessive pills.
- The transaction trail and evidence should look more important than decoration.
- Mobile layout must preserve the timeline and payment CTA.

## frontend acceptance checks

- Every CTA disables while its request is pending.
- Errors display the API `message` and a copyable `requestId`.
- Clear private context and buyer email from form state after creation; the API
  deliberately never returns either field.
- Prava `iframeUrl` is opened only after an explicit buyer action.
- A completed state never appears until the server returns `complete`.
- Demo mode is unmistakably labeled.
