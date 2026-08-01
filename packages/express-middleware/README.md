# @ackrate/express-middleware

Fail-closed Express middleware for ackrate agent-payment routes, including
independent verification of on-chain settlement.

```bash
npm install @ackrate/express-middleware express
```

The middleware preserves the frozen settlement schemes used by existing
clients. Branding and package imports are ackrate; wire identifiers remain
compatible.

License: Apache-2.0.
