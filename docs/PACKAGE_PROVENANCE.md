# npm package provenance

The published `@ackrate/*` packages are a new npm distribution and public brand
created for the hackathon. This application consumes the release artifacts from
npm; their source is intentionally not a Railway workspace or deployable
service.

Their starting implementation was imported read-only from frozen REAPP T2
`main` at commit `3dc050a32fb86e9e6ef6e4e223cfbb45e07cb6f5`. The source repository was
not edited, committed, tagged, published, or deployed during this migration.

## new package identities

- `@ackrate/core@0.3.1`
- `@ackrate/stellar@0.2.2`
- `@ackrate/ap2@0.3.0`
- `@ackrate/express-middleware@0.2.2`
- `@ackrate/cli@0.1.7`, installed as `ackrate`

The versions mirror the frozen source releases so the new package scope keeps
the same release fingerprints while making the rebrand explicit.

All application branding, npm names, documentation, configuration filenames,
CLI commands, and CLI state paths use lowercase `ackrate`.

## compatibility boundary

The deployed contract ABI, signing domains, canonical hashes, settlement
schemes, AP2 binding versions, and protocol headers are frozen interoperability
values. Existing `reapp-*` wire literals are intentionally unchanged. Renaming
those values would invalidate signatures or break existing contract and client
compatibility.
