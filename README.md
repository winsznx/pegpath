# PegPath

PegPath checks live Mezo MUSD redemption conditions, previews a testnet BTC outcome, and produces a receipt verified from chain data.

**Live:** https://pegpath.vercel.app · Mezo Testnet only (chain 31611). Testnet assets only.

## What uses Mezo, and how

| Mezo piece | How PegPath depends on it |
|---|---|
| MUSD protocol (TroveManager, HintHelpers, SortedTroves, PriceFeed, BorrowerOperations, InterestRateManager) | Every quote, hint, fee, simulation and receipt is read from these contracts. Nothing is estimated off-chain without a contract read behind it. |
| `@mezo-org/musd-contracts` | Mezo's own deployment artifacts. A unit test fails if any address PegPath uses drifts from `deployments/matsnet`. |
| Mezo Passport (`@mezo-org/passport`) | The wallet layer. Bitcoin wallets (Unisat, OKX, Xverse) sign for a Mezo smart account that holds MUSD and receives BTC; EVM wallets connect directly through the same RainbowKit modal. |
| Mezo testnet faucet and app | Onboarding (`/start`) checks your real BTC and MUSD balances and links to the faucet and to the testnet app for borrowing MUSD. |
| PegPathRedeemer ([`0x1260…4164`](https://explorer.test.mezo.org/address/0x126088EaE43E0c0d4c4AE5D6111d4B0223284164)) | The on-chain router that computes the partial-redemption hint inside the transaction. See [contracts/](contracts/). |

## On-chain evidence (Mezo Testnet, 26 October 2026)

Every row is a real transaction from the deployer `0x06546dA2415b091791e343668C42e07904f33B82`. The receipts are re-derived by PegPath's decoder in `tests/integration/live-testnet.test.ts`.

| # | Action | Tx | Result |
|---|---|---|---|
| 1 | Deploy PegPathRedeemer | [`0x16543b08…5d73`](https://explorer.test.mezo.org/tx/0x16543b08d32baad46de6a8933db548a01487eacb5916e818480c58557ae55d73) | Contract `0x126088EaE43E0c0d4c4AE5D6111d4B0223284164` |
| 2 | Open trove: 0.045 BTC collateral, 1,800 MUSD borrowed | [`0xaa57d0fb…2cd3`](https://explorer.test.mezo.org/tx/0xaa57d0fb991c34f7d3e87bf1cb3277b354c5068c4c752690e58aeb9a48f62cd3) | 1,800 MUSD minted to the deployer |
| 3 | Approve 0.05 MUSD for the redeemer | [`0x72d0f7c1…5fa1`](https://explorer.test.mezo.org/tx/0x72d0f7c134a8f8a6701dede8611d99f76a55edfc6d8106d46cc7d68cec2b5fa1) | Exact amount, not unlimited |
| 4 | Redeem 0.05 MUSD through PegPathRedeemer | [`0x3127f828…c4ed`](https://explorer.test.mezo.org/tx/0x3127f8288a249eb89b7b03b55573128d23469531f7654f38f0b410171cb2c4ed) | **confirmed-verified**: 0.05 MUSD burned, 0.000000624025 BTC drawn, 0.000000004680 fee, **0.000000619345 BTC** to the redeemer (min was 0.000000616186) |
| 5 | Approve 0.1 MUSD | [`0x7e44daf0…024d`](https://explorer.test.mezo.org/tx/0x7e44daf0a2edb26756a9424d91ea210d6bc646fef9447610ea1c0ba5d608024d) | |
| 6 | Redeem 0.1 MUSD, raw CLI amount, no PegPath planner | [`0x87974f4d…ec62`](https://explorer.test.mezo.org/tx/0x87974f4d9a9e3aa9ac38c39cc60483c415881305c1e24208828df0b28ef62aec) | **Reverted**: `Unable to redeem any amount`. The tail trove had ~0.022 MUSD of headroom above the 1,800 floor, but HintHelpers still reported 0.1 as redeemable (finding 1). Nothing burned; the MUSD stayed in the wallet. |
| 7 | Redeem 0.01 MUSD through PegPathRedeemer (within the trove's capacity) | [`0x8f2b3d8d…bb78`](https://explorer.test.mezo.org/tx/0x8f2b3d8d97c1ddd7d7b5dc172f7c1abf3d1bec7205edaa49eaee80ea45afbb78) | **confirmed-verified**: 0.01 MUSD burned, **0.000000123708 BTC** to the redeemer |

What row 6 shows: the router removes the price race (finding 2), but it does not fix HintHelpers' overstatement (finding 1). That is what PegPath's planner is for: the app caps the amount to what TroveManager will execute before it builds the call, so this revert only happens when the amount is chosen outside the app.

## PegPathRedeemer on Mezo Testnet

Deployed at [`0x126088EaE43E0c0d4c4AE5D6111d4B0223284164`](https://explorer.test.mezo.org/address/0x126088EaE43E0c0d4c4AE5D6111d4B0223284164) (deploy tx [`0x16543b08…5d73`](https://explorer.test.mezo.org/tx/0x16543b08d32baad46de6a8933db548a01487eacb5916e818480c58557ae55d73)). Production sets `NEXT_PUBLIC_PEGPATH_REDEEMER` to it, so every redemption from the app goes through the router:

1. **Connect** a Bitcoin wallet (Unisat, OKX, Xverse via Mezo Passport) or an EVM wallet. `/start` checks the account's testnet BTC and MUSD and links the faucet and Mezo's testnet app.
2. **Check** an amount on `/redeem`. PegPath replays TroveManager's walk, reads the fee and simulates.
3. **Approve** exactly the MUSD amount for the redeemer (first time per amount; never unlimited). The review drawer waits for the approval to confirm, then re-quotes.
4. **Redeem.** The router computes the first hint and partial NICR in the same transaction at the oracle price TroveManager uses, reverts unless you receive at least `minBtcOut` (quote − 0.5%), returns unredeemed MUSD, and forwards all BTC to you.
5. **Receipt.** `/receipt/31611/<hash>` decodes TroveManager's `Redemption` event and the router's `Redeemed` event and requires them to agree with the MUSD burn.

## Screens

| Route | Purpose |
|---|---|
| `/` | Landing with live protocol readings |
| `/start` | Onboarding checklist: wallet, network, testnet BTC, MUSD, first check |
| `/redeem` | Quote, redemption path, review drawer, transaction status |
| `/receipts` | Hash lookup, redemptions sent from this browser, real examples |
| `/receipt/31611/<hash>` | Receipt rebuilt from chain data on every load |
| `/how-it-works` | The method, the findings, limitations, contract list, run log download |

## The moment it's for

You hold testnet MUSD and want BTC back through native redemption. On the explorer that means a six-argument `TroveManager.redeemCollateral` call with hints you compute yourself. Of the 35 `redeemCollateral` calls in the testnet explorer's recent TroveManager history (checked 2026-10-21), 24 reverted. PegPath tells you, before you sign, whether your amount will go through, what you should get, and why it might not.

## Run it

```bash
pnpm install
pnpm dev                  # http://localhost:3000
pnpm test                 # unit tests (62)
pnpm test:integration     # live reads + simulations against Mezo testnet (9)
pnpm test:e2e             # Playwright, desktop + 360px, after `pnpm build` (16)
```

`pnpm typecheck`, `pnpm lint` and `pnpm build` are also wired up. With pnpm 10+, approve build scripts once if prompted (`pnpm approve-builds`).

Optional: copy `.env.example` to `.env` to point at a different Mezo testnet RPC. There are no secrets. Everything runs in the browser against public RPC.

### Deploy

Production is a prebuilt Vercel deploy from this folder (no Git needed):

```bash
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

There is no backend: every read goes from the browser to the public Mezo RPC, and the explorer API is only used to locate old transactions. The `Dockerfile` (`output: "standalone"`) is there for self-hosting:

```bash
docker build -t pegpath . && docker run -p 3000:3000 pegpath
```

## How it talks to Mezo

| Step | Contract call | File |
|---|---|---|
| Fail closed on drift | `eth_chainId`, `eth_getCode`, EIP-1967 implementation slot for every proxy, TroveManager wiring (`priceFeed()`, `sortedTroves()`, `musdToken()`, `borrowerOperations()`, `interestRateManager()`) | [lib/redemption/verifyDeployment.ts](lib/redemption/verifyDeployment.ts) |
| One-block snapshot | `PriceFeed.fetchPrice`, `TroveManager.getTCR/MCR/MUSD_GAS_COMPENSATION`, `BorrowerOperations.minNetDebt/redemptionRate`, `InterestRateManager.interestRate`, `SortedTroves.getSize`, MUSD `balanceOf`, native balance | [lib/redemption/readPreflight.ts](lib/redemption/readPreflight.ts) |
| Executable amount | Walks `SortedTroves.getLast/getPrev` with `TroveManager.getEntireDebtAndColl/getCurrentICR`, replaying TroveManager's loop | [lib/redemption/planRedemption.ts](lib/redemption/planRedemption.ts), [buildHints.ts](lib/redemption/buildHints.ts) |
| Hints | `HintHelpers.getRedemptionHints`, `HintHelpers.getApproxHint`, `SortedTroves.findInsertPosition` | [lib/redemption/buildHints.ts](lib/redemption/buildHints.ts), [partialWindow.ts](lib/redemption/partialWindow.ts) |
| Fee | `BorrowerOperations.getRedemptionRate(collateralDrawn)` | [lib/redemption/quote.ts](lib/redemption/quote.ts) |
| Simulation | `eth_call` of `redeemCollateral` from your address at the quote block and at `latest`, then `eth_estimateGas` | [lib/redemption/simulate.ts](lib/redemption/simulate.ts) |
| Send | One `redeemCollateral` via your wallet. No approval: TroveManager burns MUSD directly | [lib/redemption/execute.ts](lib/redemption/execute.ts) |
| Receipt | Decodes `Redemption(_attemptedAmount,_actualAmount,_collateralSent,_collateralFee)`, cross-checks calldata and the MUSD burn `Transfer` | [lib/redemption/decodeReceipt.ts](lib/redemption/decodeReceipt.ts) |

Addresses come from Mezo's [redemption guide](https://mezo.org/docs/developers/musd/musd-redemptions/). ABIs in [lib/contracts/abi.ts](lib/contracts/abi.ts) are copied from the **verified implementations** on the Mezo testnet Blockscout explorer, fetched 2026-10-21:

| Contract | Proxy | Implementation |
|---|---|---|
| TroveManager | `0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0` | `0x9aab567966983e95536fc460c12266fb0cc10b07` |
| HintHelpers | `0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6` | `0x8adf3f35dbe4026112bcfc078872bcb967732ea8` |
| SortedTroves | `0x722E4D24FD6Ff8b0AC679450F3D91294607268fA` | `0x9177df58a9614b84c8c2f68df27506ab9a5d0323` |
| PriceFeed | `0x86bCF0841622a5dAC14A313a15f96A95421b9366` | `0xec42b37c12b8d73d320f4075a1bcd58b306629c1` |
| MUSD | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` | not a proxy |
| BorrowerOperations | `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5` | `0xc05bf344bd5b58825784326dd3112fb6cc160dcc` |
| InterestRateManager | `0xD4D6c36A592A2c5e86035A6bca1d57747a567f37` | `0xaa13b1d9cffa3f44ab3a8be0dc8774fb7841459c` |

If any implementation slot changes, PegPath disables redemption until the ABI is re-pinned.

## What we found by reading the deployed code

These came from the verified source and live testnet state. They shaped the product more than anything in the PRD.

**1. `HintHelpers.truncatedAmount` overstates what TroveManager will execute.** HintHelpers caps a partial at `netDebt − minNetDebt` and keeps walking. TroveManager takes `min(remaining, netDebt)` from a trove and cancels the partial when the remainder would fall below 1,800 MUSD. With the tail troves at ~2,012 MUSD net debt, HintHelpers reports 1,000 MUSD as fully redeemable, but the call reverts. PegPath replays TroveManager's loop instead ([planRedemption.ts](lib/redemption/planRedemption.ts)) and caps 1,000 MUSD to ~212 MUSD. It shows that as "Estimated redeemable: X of Y" and never substitutes it silently.

**2. Partial redemptions are price-sensitive, and the window is tiny.** TroveManager accepts the partial hint only if `newNICR ≤ hint ≤ upperBoundNICR`, where the window is 10 minutes of interest at the system rate (1%). `newNICR` depends on `lot / price` at inclusion, and the testnet oracle updated almost every block (0.06 to 0.13% over 20 blocks / ~95 s in our samples). PegPath computes the window locally ([partialWindow.ts](lib/redemption/partialWindow.ts)) and requires HintHelpers' NICR to equal its lower edge to the wei, which it did on every live run. It then submits the window's midpoint and reports the tolerance:

| Partial lot | Price tolerance (midpoint hint) |
|---|---|
| 10 MUSD | ±0.0023% (23 ppm) |
| 0.05 MUSD | ±0.47% |

Quotes under ±0.25% are flagged as price-sensitive, with a suggested amount that survives normal movement (for 10 MUSD on the tail trove, ~0.094 MUSD). Full trove closes need no hint and are not price-sensitive.

**3. `_collateralSent` is gross.** In real tx [`0xa7362c…fbc7`](https://explorer.test.mezo.org/tx/0xa7362c536834267e4f7372dc9716afe833210237386fcff684ca040179c5fbc7), the redeemer's BTC balance rose by exactly `_collateralSent − _collateralFee − gasUsed × effectiveGasPrice` (1,759,542,334,684 wei). The fee is 0.75% of BTC drawn for every redeemer. There is no borrower exemption in the deployed `getRedemptionRate`.

**4. The public RPC drops older transactions by hash.** `eth_getTransactionByHash` and `eth_getTransactionReceipt` return `null` intermittently for older hashes. The receipt page retries, then uses the explorer API only to locate the block and index, and re-reads the transaction and logs from the RPC. The receipt says when that fallback was used.

**5. Mezo Passport 0.17.2 needs two workarounds under Next 15 / React 19.** Its package root pulls in `@mezo-org/mezo-clay`, which inlines React 18's JSX runtime and crashes under React 19, so PegPath imports Passport's config, wallets and account hook per module ([lib/passport.ts](lib/passport.ts)). Its orangekit dependency re-exports the Mezo chains from a TypeScript source path; [next.config.ts](next.config.ts) aliases it to the compiled file. The Bitcoin connectors read `window` while the config is built, so the server renders with a plain wagmi config ([lib/wagmi.ts](lib/wagmi.ts)).

**6. The router fixes the price race, and it showed up in the fork tests.** With an off-chain hint, a +0.01% oracle tick makes `redeemCollateral` revert with `Unable to redeem any amount`. Against the same state, PegPathRedeemer succeeds because the NICR is computed at the price the redemption uses ([fork test](contracts/test/PegPathRedeemer.fork.t.sol)).

**7. `eth_estimateGas` returns ~6.0M for `redeemCollateral`.** `eth_call` with any lower gas cap reverts with empty data. The confirmed historical redemption used 397k gas of a 550k limit. PegPath keeps the conservative estimate × 1.25 (~7.5M, under the 10M block limit). At 146 wei/gas that costs less than 0.00000001 BTC.

## Verification status (2026-10-21)

Everything below was run against the live Mezo testnet. Nothing here is a fixture unless labelled.

| Check | Status | Evidence |
|---|---|---|
| Chain 31611, bytecode, implementations, wiring | Verified | `pnpm test:integration` |
| Price, TCR, fee rate, min debt read at one block | Verified | integration test; TCR ~297%, price ~$82.8k, 275 troves |
| Planner + HintHelpers NICR match to the wei | Verified | integration, every run |
| Exact `redeemCollateral` simulated from a real MUSD holder at the quote block | Verified | integration + E2E (`eth_call` with `from`; the holder's key is never involved) |
| 1,000 MUSD capped to executable amount | Verified | integration + E2E |
| 10 MUSD flagged price-sensitive, reliable amount offered | Verified | integration |
| Wrong chain, malformed input, insufficient MUSD, wallet rejection (no tx sent) | Verified | E2E with a test EIP-1193 provider that reads the real RPC and rejects every signing request |
| Receipt reconstruction: real successful and real reverted testnet redemptions | Verified | unit (captured real tx in `tests/fixtures`, labelled) + integration + E2E |
| Quote expiry at 30 s / 3 blocks, re-review on changed amount | Verified | unit (mocked clock and blocks) |
| PegPathRedeemer: atomic hints, min-BTC guard, MUSD refund, deadline, stray-BTC rejection | Verified on a fork | `cd contracts && forge test` (6/6) against a pinned Mezo Testnet fork, oracle precompile stubbed with the live price |
| Mezo Passport wallet modal, network switch, onboarding balances | Verified | E2E (24/24, desktop and 360px), also against production |
| PegPathRedeemer deployed to testnet | Done | [`0x126088EaE43E0c0d4c4AE5D6111d4B0223284164`](https://explorer.test.mezo.org/address/0x126088EaE43E0c0d4c4AE5D6111d4B0223284164), deploy tx `0x16543b08d32baad46de6a8933db548a01487eacb5916e818480c58557ae55d73`; the app routes redemptions through it |
| Real redemptions through PegPathRedeemer | Done | Two confirmed-verified redemptions and one recorded revert, see "On-chain evidence" |
| A redemption signed in a browser wallet through the web UI | Not yet recorded | The on-chain rows above were sent from the CLI with the same contract and calldata shape; the UI path is covered by E2E up to the wallet prompt |
| Screen recording / GIF | Not done | Must be recorded with a real wallet run |
| Public deployment | Done | https://pegpath.vercel.app, E2E suite passes against it |

The PRD's Wave 1 shipping gate (≥1 real confirmed redemption through the app) stays open until someone with testnet MUSD runs the flow. To close it, connect a wallet holding testnet MUSD and a little testnet BTC, check an amount marked **Not price-sensitive** or within tolerance, confirm, and keep the receipt URL. The run log (How it works, then Download run log) records the attempt with block, hash, timings and outcome.

## Limitations

- Testnet only. A quoted BTC amount can change before confirmation. Some MUSD may remain unredeemed.
- Simulation can't guarantee inclusion succeeds, especially for price-sensitive partial redemptions.
- `_maxIterations` is capped at 10 troves.
- No pool or swap comparison yet (Wave 2, read-only, gated on verifying a live MUSD/BTC route).
- The run log lives in your browser's localStorage and is never sent anywhere.

## Layout

```
app/            page.tsx (redeem), receipt/[chainId]/[hash], how-it-works
components/     AmountInput, NativeQuoteCard, RedemptionPath, ReviewDrawer, TransactionStatus, RedemptionReceipt
hooks/          useRedemptionFlow (state machine: check → review/recheck → wallet → submitted → settled)
lib/            chain, contracts (addresses + pinned ABIs), redemption engine, amounts, errors, telemetry
tests/          unit, integration (live), e2e (Playwright), fixtures (real testnet txs)
```

## Sources

- [Mezo: How to Redeem MUSD](https://mezo.org/docs/developers/musd/musd-redemptions/)
- [Mezo: Configure environment](https://mezo.org/docs/developers/getting-started/configure-environment/)
- [mezo-org/musd](https://github.com/mezo-org/musd) and verified sources on [explorer.test.mezo.org](https://explorer.test.mezo.org)
- PRD: `internal/PegPath_Full_PRD_v1_2026-10-20.md`
