# frontend handoff — ackrate research arena

Build one obvious journey. After arena creation, keep the consumer on one arena
page and change a single primary action from authorize → run → purchase → view.
The server state is truth; the frontend never invents payment or completion.

## the product in one sentence

> Set the question and budget. Research agents compete. Pay only for the winning evidence.

## frontend connection

Set exactly one public frontend variable:

```env
VITE_ARENA_API_URL=https://THE-VERIFIED-RAILWAY-API-DOMAIN
```

Do not put OpenAI, Anthropic, Prava, database, or npm credentials in the
frontend. Do not point the API client at `https://ackratearena.xyz`; that is the
frontend origin.

## screen 1 — create the marketplace arena

Keep the current hero and create form. Change every reference from four agents
to **three agents**.

Fields, in this order:

1. Public research question — required.
2. Private context — optional; label it “Only qualified agents receive this.”
3. Budget in USD — required.
4. Evaluation criteria — optional, zero to five. Each criterion has a label,
   optional description, and Public/Private switch. Explain: “Public criteria
   guide agents. Private criteria are visible only to the judge.”
5. Minimum global ELO — optional, 0–1200; label it “Only agents with this past-performance score may compete.”
6. Buyer email — required for the Prava authorization.

Primary button: **Create research arena**.

Call `POST /v1/arenas`, then route to `/arena/:id`. Clear the email and private
context from browser form state after success.

## the arena page — one page, one primary action

Always show:

- public question;
- authorized budget;
- public criteria plus a “private criterion” count;
- qualified agents, such as “2 of 3 qualified by global ELO”;
- five-step timeline: **Fund → Research → Judge → Purchase → Reveal**;
- the `@ackrate/ap2` fingerprint as a small trust detail.

Render the primary action entirely from the returned `status`:

### 1. `funding_required`

Message: **Arena ready. Protect the budget before agents begin.**

Button: **Authorize $[budget] with Prava** →
`POST /v1/arenas/:id/authorize`.

- If `payment.mode === "prava"`, open the returned `payment.iframeUrl` in a new
  tab. Keep that URL only in memory; never store or log it.
- If `payment.mode === "demo"`, show a prominent **Demo payment rail** badge and
  continue immediately from the returned `funded` state.

### 2. `funding_pending`

Message: **Approve the one-time mandate in the Prava tab.**

Button: **I approved the budget** →
`POST /v1/arenas/:id/payment/refresh`.

Remain here if the response is still `funding_pending`. Continue only when the
API returns `funded`. Do not poll faster than once every three seconds.

### 3. `funded`

Message: **Budget protected. Three qualified research agents are ready to compete.**

Button: **Run the research arena** → `POST /v1/arenas/:id/run`.

Allow at least 210 seconds. While waiting, show three lanes:

- Evidence Scout — finds primary, recent evidence.
- Skeptical Analyst — attacks assumptions and uncertainty.
- Decision Architect — turns evidence into an actionable answer.

Show the current stage as Researching → Validating bids → Blind judging →
Selecting within budget. Do not fake token streams or completion percentages.

### 4. `researching`

Disable all mutations. If the page is reloaded, refresh with
`GET /v1/arenas/:id` until the server returns the next state.

### 5. `ready_to_settle`

Heading: **The judge selected a winning portfolio within your budget.**

Show every valid participant row with:

- agent name;
- research provider;
- offer/bid amount;
- global ELO used for qualification;
- arena ELO earned by blind judging;
- Winner or Discarded label.

Show the number of pairwise evaluations and the winning total against the
authorized budget. Keep all report evidence locked. Private criteria remain
named only “private criterion,” with their text and rationales hidden.

Button: **Purchase winning evidence · $[finalBundle.totalPrice]** →
`POST /v1/arenas/:id/settle`.

### 6. `complete`

Heading: **Winning evidence purchased.**

Show:

- final answer and executive summary;
- source-linked key findings;
- disagreements and risks;
- next actions;
- full reports for winning agents only;
- losing-agent offer, ELO, and `discarded` status without losing report content;
- Prava transaction ID;
- Ackrate AP2 fingerprint.

Buttons: **Copy answer**, **Open sources**, **Export evidence bundle**, and
**Create another arena**.

### 7. `failed`

Show the API error `message` and a copyable `requestId`. Never advance the UI
optimistically. A settlement failure remains `ready_to_settle` and should show
**Retry purchase** without rerunning research.

## exact abstract-to-UI mapping

| Abstract promise | What the judge sees |
| --- | --- |
| Consumer places a monetary bid and topic | Create form shows question + bounded USD budget |
| Public/private research topic | Public question plus qualified-agent-only context |
| 0–5 public/private criteria | Criterion builder with visibility per criterion |
| Qualification by past performance | Minimum global ELO and “X of 3 qualified” |
| Participant agents research and bid | Three agent lanes, then priced submissions |
| Judgment agent runs criterion ELO | Pairwise evaluation count and arena ELO ranking |
| Winners fit the budget | Winning total displayed beside the authorized cap |
| Winners transmitted | Purchased reports and evidence unlock at `complete` |
| Losers discarded | Losing metadata remains; losing research never unlocks |
| Agent completes a transaction | Prava authorization, settlement, and transaction ID |

## frontend acceptance gate

- Exactly one primary CTA is enabled at a time.
- Every CTA is disabled while its request is pending.
- The API base is the verified Railway backend domain.
- The interface says three agents everywhere.
- Private context, buyer email, private criteria, and losing report content never leak.
- The bundle never unlocks before `status === "complete"`.
- `payment.mode === "demo"` is unmistakable.
- `payment.mode === "prava"` ends with a real returned Prava transaction ID.
- Refreshing the arena page reconstructs the UI from `GET /v1/arenas/:id`.
- API errors show their message and copyable request ID.

## 90-second judge script

1. Enter a public question, optional qualified-agent context, a $40 budget, one
   public criterion, one private criterion, and minimum global ELO 1200.
2. Create the arena and point out that two of three agents qualified.
3. Authorize the bounded budget with Prava.
4. Run the arena: qualified agents return priced, cited research; the blind
   judge compares every pair against both criteria and assigns arena ELO.
5. Show that the selected winner total is no more than $40, then purchase it.
6. Reveal only winning reports and sources, show the Prava transaction ID, and
   point out that losing research is marked discarded and remains unavailable.
