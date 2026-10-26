"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePublicClient } from "wagmi";
import { formatBtc, formatMusd, formatRatioPercent, formatTolerance, formatUsdPrice } from "@/lib/amounts/units";
import { MEZO_TESTNET_ID, receiptPath } from "@/lib/chain/mezoTestnet";
import { getQuote, toleranceOf } from "@/lib/redemption/quote";
import { shortAddress } from "@/components/WalletButton";

const DEMO_AMOUNT = 5n * 10n ** 16n; // 0.05 MUSD
const EXAMPLE_RECEIPT = "0xa7362c536834267e4f7372dc9716afe833210237386fcff684ca040179c5fbc7" as const;

/**
 * The hero's product scene: a real read-only quote for 0.05 MUSD, computed in the visitor's browser
 * from Mezo Testnet when the page loads. Nothing in it is typed in by hand.
 */
export function HeroScene() {
  const client = usePublicClient({ chainId: MEZO_TESTNET_ID });
  const quote = useQuery({
    queryKey: ["hero-quote"],
    queryFn: () => getQuote(client!, { amountWei: DEMO_AMOUNT, wallet: null }),
    enabled: Boolean(client),
    staleTime: 60_000,
  });
  const data = quote.data;
  const live = data && data.kind === "public" ? data : null;
  const snapshot = data && data.kind !== "ready" ? data.snapshot : null;
  const tolerance = live ? toleranceOf(live.reliability) : null;

  return (
    <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="rounded-3xl bg-sheet p-5 shadow-[0_16px_50px_rgb(26_34_48/0.12)] ring-1 ring-rule sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-lg font-bold">Quote</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-wash px-2.5 py-1 text-xs font-medium text-ok ring-1 ring-ok/30">
            <span aria-hidden className={`size-1.5 rounded-full bg-current ${live ? "" : "stage-pulse"}`} />
            {live ? `Live, block ${live.snapshot.blockNumber}` : quote.isError ? "Testnet unreachable" : "Reading Mezo…"}
          </span>
        </div>
        <dl className="mt-4 divide-y divide-rule text-sm">
          <SceneRow label="You redeem" value={`${formatMusd(DEMO_AMOUNT)} MUSD`} />
          <SceneRow label="Protocol takes" value={live ? `${formatMusd(live.plan.amountToSubmit)} MUSD` : null} />
          <SceneRow label="BTC you'd receive" value={live ? `${formatBtc(live.estimatedNetBtcWei)} BTC` : null} accent />
          <SceneRow label="Fee, read on-chain" value={live ? `${formatBtc(live.estimatedFeeBtcWei)} BTC` : null} />
          <SceneRow
            label="Price tolerance"
            value={live ? (tolerance === null ? "Not price-sensitive" : formatTolerance(tolerance)) : null}
          />
        </dl>
        <p className="mt-4 text-xs text-ink-faint">
          A read-only quote for 0.05 MUSD, computed in your browser. Connect a wallet to simulate your own.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-3xl bg-sheet p-5 ring-1 ring-rule sm:p-6">
          <p className="font-display text-lg font-bold">Redemption path</p>
          <ol className="mt-4 space-y-3 text-sm">
            {live
              ? live.plan.steps.slice(0, 4).map((step) => (
                  <li key={step.owner} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={`mt-1 size-3 shrink-0 rounded-full ${
                        step.kind === "skip-undercollateralized" ? "border-2 border-dashed border-ink-faint" : step.kind === "close" ? "bg-musd" : "border-2 border-musd bg-sheet"
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {step.kind === "skip-undercollateralized"
                          ? `Skipped, ratio ${formatRatioPercent(step.icr, 1)}`
                          : step.kind === "close"
                            ? "Trove repaid and closed"
                            : "Partial redemption"}
                      </span>
                      <span className="block font-mono text-xs text-ink-faint">{shortAddress(step.owner)}</span>
                    </span>
                  </li>
                ))
              : [0, 1, 2].map((i) => <li key={i} className="h-9 animate-pulse rounded-lg bg-rule/60" />)}
          </ol>
        </div>

        <div className="rounded-3xl bg-ink p-5 text-fog sm:p-6">
          <p className="text-xs text-fog/70">Oracle BTC/USD</p>
          <p className="mt-1 font-display text-3xl font-bold tabular-nums">{snapshot ? `$${formatUsdPrice(snapshot.price)}` : "…"}</p>
          <p className="mt-2 text-xs text-fog/70">
            {snapshot ? `System collateral ratio ${formatRatioPercent(snapshot.tcr, 1)}, ${snapshot.troveCount} troves open` : "Reading Mezo Testnet"}
          </p>
        </div>

        <Link
          href={receiptPath(EXAMPLE_RECEIPT)}
          className="flex items-center justify-between gap-3 rounded-2xl bg-sheet px-4 py-3 text-sm ring-1 ring-rule hover:ring-ink-faint"
        >
          <span className="flex items-center gap-2">
            <span aria-hidden className="grid size-6 place-items-center rounded-full bg-ok-wash text-ok">✓</span>
            See a verified testnet receipt
          </span>
          <span className="font-mono text-xs text-ink-faint">{shortAddress(EXAMPLE_RECEIPT)}</span>
        </Link>
      </div>
    </div>
  );
}

function SceneRow({ label, value, accent = false }: { label: string; value: string | null; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={`text-right font-semibold tabular-nums ${accent ? "text-base text-btc" : ""}`}>
        {value ?? <span className="inline-block h-4 w-20 animate-pulse rounded bg-rule/70 align-middle" />}
      </dd>
    </div>
  );
}
