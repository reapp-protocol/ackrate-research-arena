# @ackrate/core

The primary TypeScript client for ackrate agent-payment mandates on Stellar.

```bash
npm install @ackrate/core
```

```ts
import { ackrate } from "@ackrate/core";

const mandate = ackrate.createIntentMandate({
  user,
  agent,
  merchant,
  asset: ackrate.testnet.nativeSac,
  maxAmount: "3.00",
  expiry,
});
```

The on-chain contract remains the source of truth. The deprecated `reapp`
export is retained only so existing callers can migrate without changing frozen
wire behavior.

License: Apache-2.0.
