# ackrate research arena repository rules

This repository is the only implementation and delivery scope for the Prava
Agentic Commerce Hackathon project.

## hard boundary

- Do not edit, commit, tag, publish, deploy, or configure any REAPP T3 or
  milestone repository while working on this project.
- Do not depend on an unpublished file, branch, service, or secret from another
  REAPP repository.
- Put all hackathon product code, infrastructure configuration, database
  migrations, integration code, tests, evidence, and submission documentation
  in this repository.
- Historical REAPP work may be cited in the disclosure, but it is not the
  product identity. All public branding is lowercase `ackrate`.

## product identity

- Product: `ackrate research arena`
- Tagline: `research agents compete. evidence wins.`
- Repository: `reapp-protocol/ackrate-research-arena`
- Use lowercase ackrate styling in UI, documentation, metadata, transaction
  descriptions, and package names.
- Use `budget`, `bounty`, `offer`, `submission`, and `arena`. Do not describe
  the product as gambling or wagering.

## technical scope

- Express 5, TypeScript, REST, and OpenAPI.
- Railway is the only application-hosting target; Supabase is the only
  persistent-database target.
- Supabase Postgres is the persistent database target; the Express API remains
  on Railway and connects through a server-only `DATABASE_URL`.
- OpenAI powers research and semantic evaluation; synthesis is deterministic.
- Prava is the transaction and budget-authorization layer.
- Secrets stay server-side and must never be committed, logged, or placed in
  screenshots.
- Prava one-time credentials must never be logged, persisted, returned to a
  client, or forwarded to an arbitrary/configurable destination.
- Production settlement must fail closed until a specific merchant/processor
  adapter has received a dedicated security review. The hackathon path is
  sandbox-only.

## API rule

Every public route must be documented in `openapi.json`, validate input, return
stable JSON error shapes, and avoid exposing provider credentials or payment
card data.

## verification

Before pushing a feature:

1. Run `npm run lint`.
2. Run `npm run typecheck`.
3. Run `npm test` when tests cover the changed area.
4. Run `npm run build` for integration or deployment changes.
5. Confirm no secret or payment credential appears in the diff.
