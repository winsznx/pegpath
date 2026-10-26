import type { Metadata } from "next";
import Link from "next/link";
import { CenteredHeading, Eyebrow, Panel, Section, Source, SplitHeading } from "@/components/landing/primitives";
import { HeroScene } from "@/components/landing/HeroScene";
import { explorerAddressUrl, receiptPath } from "@/lib/chain/mezoTestnet";
import { contracts } from "@/lib/contracts/addresses";
import { MEZO_FAUCET_URL, SITE_DESCRIPTION } from "@/lib/site";
import { LANDING_ANCHORS } from "@/components/landing/anchors";

export const metadata: Metadata = { description: SITE_DESCRIPTION };

const REVERTED_EXAMPLE = "0xc97e93acae8a11c0dff3bc81046045a210569b0d04c51a983386d040e2d2866b" as const;

const PROBLEMS = [
  {
    figure: "24 of 35",
    label: "recent redemption attempts on Mezo Testnet had reverted",
    body: "Each one still cost gas, and the explorer only says the call failed. It doesn't say which of the six parameters was wrong, or whether any value would have worked.",
    source: "redeemCollateral calls to TroveManager in the testnet explorer, sampled 21 October 2026.",
  },
  {
    figure: "1,000 → 212",
    label: "MUSD Mezo's hint helper approves, versus what TroveManager takes",
    body: "HintHelpers keeps walking past a capped partial and reports the full amount as redeemable. TroveManager tries the first trove, would leave it under the 1,800 MUSD minimum, and redeems nothing.",
    source: "Live reads of HintHelpers and TroveManager on 21 October 2026, tail troves at ~2,012 MUSD net debt.",
  },
  {
    figure: "±0.0023%",
    label: "BTC price move a 10 MUSD partial redemption can survive",
    body: "The partial hint has to sit in a window about ten minutes of interest wide, and the window moves with the oracle. Testnet's oracle moved 0.06 to 0.13% every 20 blocks when we measured it.",
    source: "Window computed from the deployed TroveManager source; oracle sampled block by block, October 2026.",
  },
];

const STEPS = [
  {
    title: "Read one block",
    body: "Price, system collateral ratio, fee, minimum debt, interest rate and your MUSD and BTC balances, all at one block number shown on screen. Every contract is checked against the implementation PegPath was built for.",
  },
  {
    title: "Walk the troves",
    body: "PegPath replays TroveManager's own loop from the riskiest trove upward: which troves get repaid in full, which one is partially redeemed, and where the walk stops and why.",
  },
  {
    title: "Simulate your exact call",
    body: "The transaction is run from your address at the quote block, which proves the hints, and again at the latest block. If either fails, you see the contract's reason and there's no sign button.",
  },
  {
    title: "Sign once, then verify",
    body: "Quotes expire after 30 seconds or 3 blocks. After your wallet signs, the receipt is rebuilt from the Redemption event, the calldata and the MUSD burn, and only called a success when all three agree.",
  },
];

const FEATURES = [
  {
    title: "Requested, redeemable, received",
    body: "Three numbers that are usually blurred together stay separate: what you asked for, what the protocol will take right now, and what actually happened on-chain.",
  },
  {
    title: "The redemption path",
    body: "See every trove your MUSD touches, which ones are skipped for sitting under 110%, and the exact reason the walk stops.",
  },
  {
    title: "A price tolerance on every quote",
    body: "A gauge compares how far BTC can move against how far it just moved. When a quote is fragile, PegPath offers the largest amount that isn't.",
  },
  {
    title: "A review that re-reads everything",
    body: "Opening the review refreshes price, balance and hints and simulates again. If the amount you'd sign changed, you accept it before the wallet opens.",
  },
  {
    title: "Receipts anyone can check",
    body: "Every receipt is a link. Reloading it rebuilds the numbers from chain data, for your redemption or anyone else's.",
  },
  {
    title: "Honest failure states",
    body: "Wallet rejected, wrong network, not enough gas, oracle stale, transaction reverted and still pending are separate states with separate next steps.",
  },
];

const BUILT_WITH = [
  ["Mezo MUSD protocol", "TroveManager, HintHelpers, SortedTroves, PriceFeed, BorrowerOperations and InterestRateManager, read directly"],
  ["@mezo-org/musd-contracts", "Mezo's deployment artifacts; a test fails if any address drifts"],
  ["Mezo Passport", "Bitcoin and EVM wallet connection through RainbowKit"],
  ["Next.js 15, React 19, TypeScript", "Static pages, all chain reads from your browser, no backend"],
  ["wagmi and viem", "Typed contract reads, simulation, gas estimation and receipt decoding"],
  ["Foundry", "PegPathRedeemer and fork tests against Mezo Testnet"],
] as const;

const EVIDENCE = [
  ["69", "unit tests", "planner, hint window, units, quote expiry, receipt decoding against real testnet transactions"],
  ["9", "live integration tests", "deployment checks, hints and simulation from a real MUSD holder on Mezo Testnet"],
  ["24", "browser tests", "desktop and 360 px, including against the production site"],
  ["6", "contract fork tests", "PegPathRedeemer on a pinned Mezo Testnet fork"],
] as const;

const QUESTIONS = [
  {
    q: "What is MUSD redemption?",
    a: "MUSD is Mezo's Bitcoin-backed stablecoin. Anyone holding MUSD can hand it to the protocol and receive BTC worth the same amount at the oracle price, minus a 0.75% fee. The protocol takes that BTC from the riskiest troves and cancels the same amount of their debt. It's the mechanism that pulls MUSD back toward one dollar.",
  },
  {
    q: "Is this real money?",
    a: "No. PegPath runs on Mezo Testnet (chain 31611) only, with test BTC and test MUSD that have no value. Testnet conditions such as trove depth and oracle behaviour differ from mainnet.",
  },
  {
    q: "Does PegPath hold my funds or keys?",
    a: "No. It reads public contract data from your browser and asks your wallet to sign. It never sees a private key or seed phrase, has no backend that could sign, and never sends a transaction on its own or retries one.",
  },
  {
    q: "Why might I get less MUSD redeemed than I asked for?",
    a: "Each trove can only be partially redeemed down to 1,800 MUSD of debt. If your amount would push the lowest trove below that, the protocol takes less or nothing. PegPath shows the amount it will actually take before you sign, and anything unredeemed stays in your wallet.",
  },
  {
    q: "What does the price tolerance mean?",
    a: "For a partial redemption, the contract checks a hint that depends on the BTC price at the moment your transaction is mined. If the oracle moves more than the tolerance in between, that partial is cancelled. Small amounts tolerate more movement; the protected route removes the limit.",
  },
  {
    q: "What is the protected route?",
    a: "PegPathRedeemer is a small contract that computes the hint inside the same transaction, at the exact price the redemption uses. It also enforces a minimum BTC amount and returns any MUSD it couldn't redeem. It needs a one-time exact-amount approval. It's open source in this repository.",
  },
  {
    q: "Can I use a Bitcoin wallet?",
    a: "Yes. Through Mezo Passport, Unisat, OKX and Xverse wallets control a Mezo account that holds your MUSD and receives the BTC. EVM wallets connect directly.",
  },
  {
    q: "Where do I get testnet BTC and MUSD?",
    a: "Testnet BTC comes from Mezo's faucet. MUSD is borrowed against BTC on Mezo's testnet app; a new trove carries at least 2,000 MUSD of debt. The Get started page checks both balances for you.",
  },
];

export default function LandingPage() {
  return (
    <div className="pb-8">
      {/* Hero */}
      <section className="pt-12 sm:pt-20">
        <Eyebrow>A preflight for Mezo&apos;s MUSD redemption</Eyebrow>
        <h1 className="mt-7 max-w-4xl font-display text-[2.6rem] leading-[1.02] font-bold tracking-tight text-balance sm:text-7xl">
          Turn testnet MUSD into BTC. See the outcome before you sign.
        </h1>
        <p className="mt-6 max-w-2xl text-[1.0625rem] leading-relaxed text-ink-soft sm:text-lg">
          PegPath reads Mezo&apos;s redemption contracts live, works out what the protocol will actually do with your MUSD,
          simulates your exact transaction, and gives you a receipt rebuilt from chain data. When a redemption can&apos;t go
          through, it tells you why before it costs you gas.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/redeem" className="inline-flex min-h-12 items-center rounded-full bg-ink px-7 font-semibold text-fog hover:bg-ink/85">
            Check a redemption
          </Link>
          <Link href="/start" className="inline-flex min-h-12 items-center rounded-full bg-sheet px-7 font-semibold ring-1 ring-rule hover:ring-ink-faint">
            Get set up
          </Link>
        </div>
        <div className="mt-14 sm:mt-16">
          <HeroScene />
        </div>
        <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-faint">
          <span>Mezo Testnet, chain 31611</span>
          <span>Bitcoin wallets through Mezo Passport</span>
          <span>No keys, no backend, no auto-send</span>
        </p>
      </section>

      {/* Problem */}
      <Section id={LANDING_ANCHORS.problem}>
        <SplitHeading eyebrow="The problem" title="Redeeming MUSD is a six-argument call that fails quietly">
          <p>
            Native redemption is the cleanest way from MUSD to BTC, and the mechanism that keeps MUSD near a dollar. Doing it
            by hand means computing hints across three contracts, guessing an iteration count, and sending a call that can
            revert for reasons the explorer doesn&apos;t show.
          </p>
        </SplitHeading>
        <div className="grid gap-4 lg:grid-cols-3">
          {PROBLEMS.map((p) => (
            <Panel key={p.figure} className="flex flex-col p-6 sm:p-7">
              <p className="font-display text-4xl font-bold tracking-tight text-musd tabular-nums">{p.figure}</p>
              <p className="mt-2 font-semibold">{p.label}</p>
              <p className="mt-3 text-ink-soft">{p.body}</p>
              <div className="mt-auto pt-2">
                <Source>{p.source}</Source>
              </div>
            </Panel>
          ))}
        </div>
        <Panel className="mt-4 overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="p-6 sm:p-7">
              <p className="font-semibold">What you&apos;d type into the explorer</p>
              <p className="mt-2 text-ink-soft">
                Six values, three of them derived from other contracts, all valid only for the block they were read at.
              </p>
              <Link href={receiptPath(REVERTED_EXAMPLE)} className="mt-4 inline-block text-sm font-semibold text-musd hover:underline">
                See a real reverted attempt, decoded
              </Link>
            </div>
            <pre className="overflow-x-auto bg-ink p-6 font-mono text-[0.8125rem] leading-relaxed text-fog sm:p-7">
{`TroveManager.redeemCollateral(
  _amount,                       // ≤ what troves can give
  _firstRedemptionHint,          // HintHelpers
  _upperPartialRedemptionHint,   // SortedTroves
  _lowerPartialRedemptionHint,   // SortedTroves
  _partialRedemptionHintNICR,    // moves with BTC price
  _maxIterations
)`}
            </pre>
          </div>
        </Panel>
      </Section>

      {/* How it works */}
      <Section id={LANDING_ANCHORS.how}>
        <SplitHeading eyebrow="How it works" title="Four checks between your amount and your wallet">
          <p>
            PegPath never estimates what the contracts can tell it. It reads them, replays them, simulates them, and only then
            hands your wallet one transaction to approve.
          </p>
        </SplitHeading>
        <ol className="grid gap-4 md:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <Panel className="h-full p-6 sm:p-7">
                <span className="grid size-10 place-items-center rounded-xl bg-musd-wash font-display text-lg font-bold text-musd">
                  {i + 1}
                </span>
                <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-ink-soft">{s.body}</p>
              </Panel>
            </li>
          ))}
        </ol>
      </Section>

      {/* Product */}
      <Section id={LANDING_ANCHORS.product}>
        <CenteredHeading eyebrow="The product" title="Everything a redemption needs, on one screen">
          <p>Built for someone holding testnet MUSD who wants to know, quickly and for sure, whether it can become BTC now.</p>
        </CenteredHeading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Panel key={f.title} className="p-6">
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-ink-soft">{f.body}</p>
            </Panel>
          ))}
        </div>
      </Section>

      {/* Wallets and contract */}
      <Section id={LANDING_ANCHORS.mezo}>
        <SplitHeading eyebrow="Built on Mezo" title="Bitcoin wallets in, BTC out, with the race taken out of the middle">
          <p>
            PegPath leans on the parts of Mezo that make this work: the MUSD protocol itself, Mezo Passport for Bitcoin wallets,
            and Mezo&apos;s published deployment artifacts as the source of truth for every address.
          </p>
        </SplitHeading>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="p-6 sm:p-8">
            <h3 className="text-2xl font-semibold tracking-tight">Bring a Bitcoin wallet</h3>
            <p className="mt-3 text-ink-soft">
              With Mezo Passport, a Unisat, OKX or Xverse wallet controls a Mezo smart account. That account holds your MUSD,
              signs the redemption, and receives the BTC. EVM wallets connect through the same dialog.
            </p>
            <ul className="mt-6 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {["Unisat", "OKX", "Xverse", "EVM wallets"].map((w) => (
                <li key={w} className="rounded-xl bg-fog px-3 py-2.5 text-center font-medium ring-1 ring-rule">
                  {w}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel className="p-6 sm:p-8">
            <h3 className="text-2xl font-semibold tracking-tight">Protected redemption</h3>
            <p className="mt-3 text-ink-soft">
              PegPathRedeemer computes the partial-redemption hint inside the transaction, at the price the redemption uses, so
              oracle movement can&apos;t cancel it. It enforces a minimum BTC amount, returns unredeemed MUSD, and holds nothing
              between calls.
            </p>
            <p className="mt-4 rounded-xl bg-ok-wash p-4 text-sm">
              On a fork of Mezo Testnet, a direct call with an off-chain hint reverted after a 0.01% price tick. The same
              redemption through PegPathRedeemer succeeded.
            </p>
            <Source>Deployed on Mezo Testnet at 0x126088EaE43E0c0d4c4AE5D6111d4B0223284164. Fork tests: 6 of 6 passing.</Source>
          </Panel>
        </div>
      </Section>

      {/* How it was built */}
      <Section id={LANDING_ANCHORS.built}>
        <SplitHeading eyebrow="How it was built" title="Pinned to the contracts that are actually deployed">
          <p>
            Every ABI was copied from the verified implementations on Mezo&apos;s testnet explorer. On every load, PegPath checks
            that each proxy still points at those implementations and stops if one has changed.
          </p>
        </SplitHeading>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Panel className="p-6 sm:p-7">
            <h3 className="font-semibold">Stack</h3>
            <dl className="mt-4 divide-y divide-rule">
              {BUILT_WITH.map(([name, role]) => (
                <div key={name} className="grid gap-1 py-3 sm:grid-cols-[13rem_1fr] sm:gap-4">
                  <dt className="font-medium">{name}</dt>
                  <dd className="text-ink-soft">{role}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <div className="grid gap-4">
            <Panel className="p-6 sm:p-7">
              <h3 className="font-semibold">Evidence</h3>
              <ul className="mt-4 space-y-4">
                {EVIDENCE.map(([n, what, detail]) => (
                  <li key={what} className="grid grid-cols-[3.5rem_1fr] gap-3">
                    <span className="font-display text-3xl font-bold text-musd tabular-nums">{n}</span>
                    <span>
                      <span className="block font-medium">{what}</span>
                      <span className="block text-sm text-ink-soft">{detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <Source>Counts as of 26 October 2026.</Source>
            </Panel>
            <Panel className="p-6 sm:p-7">
              <h3 className="font-semibold">Contracts read</h3>
              <ul className="mt-3 space-y-1.5 text-sm">
                {(["TroveManager", "HintHelpers", "SortedTroves", "PriceFeed", "MUSD"] as const).map((name) => (
                  <li key={name} className="flex flex-wrap justify-between gap-x-4">
                    <span>{name}</span>
                    <a className="font-mono text-xs text-musd hover:underline" href={explorerAddressUrl(contracts[name].proxy)} target="_blank" rel="noreferrer">
                      {contracts[name].proxy.slice(0, 10)}…{contracts[name].proxy.slice(-6)}
                    </a>
                  </li>
                ))}
              </ul>
              <Link href="/how-it-works" className="mt-4 inline-block text-sm font-semibold text-musd hover:underline">
                Full method and findings
              </Link>
            </Panel>
          </div>
        </div>
      </Section>

      {/* Who it's for */}
      <Section>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="p-6 sm:p-8">
            <Eyebrow>Who it&apos;s for</Eyebrow>
            <ul className="mt-5 space-y-3 text-ink-soft">
              <li>People holding testnet MUSD who want BTC back and want to know first whether that will work.</li>
              <li>Mezo builders checking how native redemption behaves on testnet, with traces they can share.</li>
              <li>Anyone curious how Liquity-style redemption actually walks the troves.</li>
            </ul>
          </Panel>
          <Panel className="p-6 sm:p-8">
            <Eyebrow>What it isn&apos;t</Eyebrow>
            <ul className="mt-5 space-y-3 text-ink-soft">
              <li>Not a trading bot. It never sends or retries a transaction on its own.</li>
              <li>Not a promise. Quotes are estimates and some MUSD may remain unredeemed.</li>
              <li>Not for mainnet or real assets. Testnet only, by design.</li>
            </ul>
          </Panel>
        </div>
      </Section>

      {/* FAQ */}
      <Section id={LANDING_ANCHORS.faq}>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <Eyebrow>Questions</Eyebrow>
            <h2 className="mt-6 font-display text-[2rem] leading-[1.08] font-bold tracking-tight sm:text-[2.75rem]">
              Asked before the first redemption
            </h2>
            <p className="mt-4 text-ink-soft">
              Still unsure? <Link href="/how-it-works" className="font-semibold text-musd hover:underline">Read the full method</Link>{" "}
              or <Link href="/start" className="font-semibold text-musd hover:underline">walk through setup</Link>.
            </p>
          </div>
          <div className="space-y-3">
            {QUESTIONS.map(({ q, a }) => (
              <details key={q} className="group rounded-2xl bg-sheet px-5 ring-1 ring-rule open:pb-5">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  {q}
                  <span aria-hidden className="text-xl text-ink-faint transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="leading-relaxed text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </Section>

      {/* CTA band */}
      <Section>
        <div className="rounded-[2rem] bg-ink px-6 py-14 text-center text-fog sm:px-12 sm:py-20">
          <h2 className="mx-auto max-w-3xl font-display text-[2rem] leading-[1.06] font-bold tracking-tight text-balance sm:text-5xl">
            Know whether your MUSD can become BTC before you sign.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-fog/75">
            Connect a Bitcoin or EVM wallet, grab testnet BTC from the{" "}
            <a href={MEZO_FAUCET_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              Mezo faucet
            </a>
            , and run your first check.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/redeem" className="inline-flex min-h-12 items-center rounded-full bg-fog px-7 font-semibold text-ink hover:bg-fog/85">
              Check a redemption
            </Link>
            <Link href="/start" className="inline-flex min-h-12 items-center rounded-full px-7 font-semibold text-fog ring-1 ring-fog/30 hover:ring-fog/60">
              Get set up
            </Link>
          </div>
        </div>
      </Section>
    </div>
  );
}
