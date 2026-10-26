# Security

PegPath is a testnet application. It never asks for, stores or transmits private keys or seed phrases, and it has no backend that can sign.

## What PegPath enforces

- Every call targets Mezo Testnet (chain 31611). Contract addresses are pinned, checked against `@mezo-org/musd-contracts`, and the EIP-1967 implementation of every proxy is re-read at runtime. Any drift disables redemption.
- Every transaction is simulated from the signer's account before the sign button is enabled, and a quote expires after 30 seconds or 3 blocks.
- The optional PegPathRedeemer route asks for an exact-amount MUSD approval, never an unlimited one. The contract holds no funds between transactions, rejects stray BTC, and reverts unless the caller receives at least the quoted minimum.

## Reporting

Open a private security advisory on the repository, or email the maintainers. Please include the transaction hash or page where you saw the issue.
