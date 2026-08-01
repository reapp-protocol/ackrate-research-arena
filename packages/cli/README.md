# @ackrate/cli

The ackrate command line for creating testnet identities, registering a capped
agent mandate, making a payment, and reconciling durable settlement state.

```bash
npm install --global @ackrate/cli
ackrate --help
```

Quick start:

```bash
ackrate init
ackrate setup
ackrate mandate create
ackrate pay
```

`ackrate init` writes `ackrate.config.json`. Private testnet credentials and
payment journals live under `~/.ackrate`; set `ACKRATE_HOME` to relocate that
directory.

License: Apache-2.0.
