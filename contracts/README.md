# PegPathRedeemer

Redeems MUSD for BTC through Mezo's `TroveManager`, with the first-redemption hint and the partial-redemption NICR computed in the same transaction at the oracle price the redemption itself uses.

Why: TroveManager only accepts a partial hint inside a window about ten minutes of interest wide, and the window moves with the BTC price. On Mezo Testnet the oracle ticks almost every block, so a hint computed off-chain for more than ~0.1 MUSD is usually stale by the time it lands. Computing it in-transaction removes the race.

What it guarantees, per call:

- pulls exactly `amount` MUSD (exact approval or EIP-2612 permit), never more;
- redeems `min(amount, HintHelpers.truncatedAmount)`;
- reverts unless the caller receives at least `minBtcOut` BTC, or if `deadline` passed;
- returns unredeemed MUSD and all BTC to the caller in the same call, and holds nothing afterwards;
- rejects BTC sent outside a redemption.

## Test

The fork tests run against Mezo Testnet. Mezo's BTC/USD oracle is a chain precompile (`0x7b7c…0015`) that anvil can't execute, so the tests etch a stub there that reports the live price.

```bash
export MEZO_FORK_BLOCK=$(cast block-number --rpc-url https://rpc.test.mezo.org)
export MEZO_PRICE=$(cast call 0x86bCF0841622a5dAC14A313a15f96A95421b9366 'fetchPrice()(uint256)' --block $MEZO_FORK_BLOCK --rpc-url https://rpc.test.mezo.org | awk '{print $1}')
forge test -vv
```

The public RPC is slow for forks; a first run takes ~10 minutes and later runs at the same block are cached.

## Deploy

```bash
source .env   # DEPLOYER_PRIVATE_KEY, testnet only
forge script script/Deploy.s.sol --rpc-url mezo_testnet --broadcast --private-key $DEPLOYER_PRIVATE_KEY
```

Then set `NEXT_PUBLIC_PEGPATH_REDEEMER` in Vercel and redeploy the app. Redemptions route through the contract from then on.
