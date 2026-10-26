import type { Metadata } from "next";
import Link from "next/link";
import { explorerAddressUrl, receiptPath } from "@/lib/chain/mezoTestnet";
import { contracts, type ContractName } from "@/lib/contracts/addresses";
import { RunLogDownload } from "@/components/RunLogDownload";

export const metadata: Metadata = { title: "How PegPath works" };

const ROLES: Record<ContractName, string> = {
  TroveManager: "redeemCollateral, getTCR, trove debt and the Redemption event",
  HintHelpers: "getRedemptionHints and getApproxHint",
  SortedTroves: "trove order (lowest ratio last) and findInsertPosition",
  PriceFeed: "BTC/USD price; reverts when the oracle is stale",
  MUSD: "your balance; burned by TroveManager, no approval needed",
  BorrowerOperations: "redemption fee rate and the 1,800 MUSD minimum net debt",
  InterestRateManager: "system interest rate, which sets the partial-hint window",
};

const STEPS = [
  {
    title: "Verify the deployment",
    body: "On load, PegPath checks that the RPC is chain 31611, that every contract has code, that each proxy points at the implementation whose verified ABI is pinned in the app, and that TroveManager is wired to the same contracts. Any drift disables redemption.",
  },
  {
    title: "Read one block",
    body: "Price, system collateral ratio, fee rate, minimum debt, interest rate, and your MUSD and BTC balances are read at a single block number, shown on the page.",
  },
  {
    title: "Walk the troves",
    body: "PegPath replays TroveManager's own loop from the lowest-ratio trove upward. A trove is either repaid in full and closed, or partially redeemed down to the 1,800 MUSD minimum. That gives the amount the protocol will actually take.",
  },
  {
    title: "Build and check hints",
    body: "HintHelpers supplies the first trove and the partial NICR. PegPath recomputes the NICR locally and requires an exact match, then submits the middle of the window TroveManager accepts instead of its lower edge.",
  },
  {
    title: "Simulate twice",
    body: "The exact call is simulated from your address at the quote block, which proves the hints, and again at the latest block, which shows whether it would go through now. A failed simulation removes the sign button.",
  },
  {
    title: "Sign once, then verify",
    body: "Quotes expire after 30 seconds or 3 blocks. Review re-reads everything. After your wallet signs, PegPath waits for the receipt and only shows success if the Redemption event, calldata and MUSD burn agree.",
  },
];

export default function HowItWorksPage() {
  return (
    <article className="max-w-3xl space-y-12 pt-8 lg:pt-12">
      <header>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">How PegPath works</h1>
        <p className="mt-4 text-lg text-ink-soft">
          Native MUSD redemption swaps MUSD for BTC at the oracle price, minus a fee, by repaying the debt of the riskiest
          troves. The contract call takes six parameters and fails in ways that are hard to see from a block explorer.
          PegPath does the reading, explains the result, and leaves signing to you.
        </p>
      </header>

      <section aria-labelledby="steps" className="space-y-5">
        <h2 id="steps" className="font-display text-2xl font-bold tracking-tight">
          What happens when you check
        </h2>
        <ol className="space-y-5">
          {STEPS.map((step, i) => (
            <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-3">
              <span className="font-display text-xl font-bold text-musd tabular-nums">{i + 1}</span>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-ink-soft">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="findings" className="space-y-4">
        <h2 id="findings" className="font-display text-2xl font-bold tracking-tight">
          Two things we found on testnet
        </h2>
        <div className="space-y-3 text-ink-soft">
          <p>
            <span className="font-semibold text-ink">HintHelpers can overstate what&apos;s redeemable.</span> On 21 October
            2026 the lowest-ratio troves each carried about 2,012 MUSD of net debt. For 1,000 MUSD, HintHelpers reported the
            full 1,000 as redeemable because it keeps walking after a capped partial. TroveManager tries to take all 1,000
            from the first trove, would leave it below the minimum, cancels, and reverts with &ldquo;Unable to redeem any
            amount&rdquo;. PegPath caps the amount at about 212 MUSD instead.
          </p>
          <p>
            <span className="font-semibold text-ink">Partial redemptions are sensitive to the BTC price.</span> TroveManager
            only accepts the partial hint if it sits inside a window about ten minutes of interest wide, and the window moves
            with the oracle. The testnet oracle moved 0.01 to 0.03% per block when we measured it. A 10 MUSD partial tolerates
            about ±0.0023%; 0.05 MUSD tolerates about ±0.47%. PegPath shows each quote&apos;s tolerance and suggests an
            amount that survives normal movement. Repaying whole troves has no such limit.
          </p>
        </div>
      </section>

      <section aria-labelledby="limits" className="space-y-3">
        <h2 id="limits" className="font-display text-2xl font-bold tracking-tight">
          Limitations
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-ink-soft">
          <li>Testnet only. Testnet transactions are not real-asset trades.</li>
          <li>A quoted BTC amount can change before confirmation. Some MUSD may remain unredeemed.</li>
          <li>Simulation catches obvious reverts but can&apos;t guarantee the transaction succeeds once it&apos;s mined.</li>
          <li>Testnet trove depth, prices and fees differ from mainnet.</li>
          <li>PegPath doesn&apos;t compare redemption with swapping on a pool. That&apos;s planned, and read-only, for Wave 2.</li>
        </ul>
      </section>

      <section aria-labelledby="contracts" className="space-y-3">
        <h2 id="contracts" className="font-display text-2xl font-bold tracking-tight">
          Contracts PegPath reads
        </h2>
        <p className="text-ink-soft">
          Addresses come from Mezo&apos;s{" "}
          <a className="text-musd underline" href="https://mezo.org/docs/developers/musd/musd-redemptions/" target="_blank" rel="noreferrer">
            redemption guide
          </a>
          . ABIs were copied from the verified implementations on the Mezo testnet explorer on 21 October 2026.
        </p>
        <dl className="divide-y divide-rule rounded-2xl bg-sheet px-4 ring-1 ring-rule">
          {(Object.keys(contracts) as ContractName[]).map((name) => (
            <div key={name} className="py-3">
              <dt className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{name}</span>
                <a className="break-all font-mono text-xs text-musd hover:underline" href={explorerAddressUrl(contracts[name].proxy)} target="_blank" rel="noreferrer">
                  {contracts[name].proxy}
                </a>
              </dt>
              <dd className="mt-0.5 text-sm text-ink-soft">{ROLES[name]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="examples" className="space-y-3">
        <h2 id="examples" className="font-display text-2xl font-bold tracking-tight">
          Real receipts from testnet
        </h2>
        <p className="text-ink-soft">
          These are other people&apos;s redemptions, decoded live from the chain. They show what a verified receipt and a
          reverted one look like.
        </p>
        <ul className="space-y-2">
          <li>
            <Link className="text-musd underline" href={receiptPath("0xa7362c536834267e4f7372dc9716afe833210237386fcff684ca040179c5fbc7")}>
              A successful 0.1346 MUSD redemption
            </Link>{" "}
            <span className="text-ink-soft">(block 15,566,831)</span>
          </li>
          <li>
            <Link className="text-musd underline" href={receiptPath("0xc97e93acae8a11c0dff3bc81046045a210569b0d04c51a983386d040e2d2866b")}>
              A reverted redemption: &ldquo;Unable to redeem any amount&rdquo;
            </Link>{" "}
            <span className="text-ink-soft">(block 15,531,035)</span>
          </li>
        </ul>
      </section>

      <section aria-labelledby="runlog" className="space-y-3">
        <h2 id="runlog" className="font-display text-2xl font-bold tracking-tight">
          Your run log
        </h2>
        <p className="text-ink-soft">
          PegPath keeps a log of your checks and transactions in this browser only: block numbers, amounts, hashes, timings
          and error categories. Nothing is sent anywhere.
        </p>
        <RunLogDownload />
      </section>

      <Link href="/" className="inline-block font-semibold text-musd hover:underline">
        Back to redemption
      </Link>
    </article>
  );
}
