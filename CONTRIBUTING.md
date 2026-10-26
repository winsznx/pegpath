# Contributing

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm test   # must pass before a change lands
pnpm test:integration                      # live Mezo Testnet reads
pnpm build && pnpm test:e2e                # browser flows, desktop and 360px
cd contracts && forge test                 # fork tests (see contracts/README.md)
```

Rules that keep PegPath honest:

- Never show a success state without a verified on-chain receipt.
- Never fake chain data. Fixtures must be real transactions and say where they came from.
- Contract ABIs come from verified implementations. When Mezo upgrades a proxy, re-pin the ABI and the implementation address together.
- UI copy: sentence case, plain verbs, no em dashes, no "guaranteed" or "risk-free".
