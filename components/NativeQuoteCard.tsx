"use client";

import { formatMusd, formatPpmPercent, formatRatioPercent, formatTolerance } from "@/lib/amounts/units";
import type { UserMessage } from "@/lib/errors/toUserMessage";
import { toleranceOf, type QuoteResult } from "@/lib/redemption/quote";
import { STALE_REASON_TEXT, type Freshness } from "@/lib/redemption/quoteFreshness";
import type { OracleMovement, Reliability } from "@/lib/types";
import { Btc, Button, Musd, Row, StatusTag } from "@/components/ui";

export function ReasonBlock({ reason, tone = "stop" }: { reason: UserMessage; tone?: "stop" | "caution" }) {
  return (
    <div className={`rounded-xl p-4 ${tone === "stop" ? "bg-stop-wash" : "bg-caution-wash"}`} role="status">
      <p className={`font-semibold ${tone === "stop" ? "text-stop" : "text-caution"}`}>{reason.title}</p>
      <p className="mt-1 text-sm text-ink">{reason.body}</p>
      {reason.detail && (
        <details className="mt-2 text-xs text-ink-soft">
          <summary className="cursor-pointer select-none">On-chain detail</summary>
          <pre className="mt-1 whitespace-pre-wrap break-all font-mono">{reason.detail}</pre>
        </details>
      )}
    </div>
  );
}

export function FragileNotice({
  reliability,
  oracleMovement,
  onUseAmount,
  primary = false,
}: {
  reliability: Extract<Reliability, { kind: "fragile" }>;
  oracleMovement: OracleMovement | null;
  onUseAmount?: (wei: bigint) => void;
  primary?: boolean;
}) {
  return (
    <div className="rounded-xl bg-caution-wash p-4 text-sm">
      <p className="font-semibold text-caution">Sensitive to the BTC price</p>
      <p className="mt-1">
        This redemption only goes through if Mezo&apos;s BTC/USD price stays within{" "}
        {formatTolerance(reliability.tolerancePpm)} until it&apos;s mined.
        {oracleMovement && (
          <>
            {" "}
            The oracle moved {formatPpmPercent(oracleMovement.movePpm)} in the last {oracleMovement.seconds.toString()}{" "}
            seconds.
          </>
        )}{" "}
        {reliability.consequence === "revert"
          ? "If it moves more, the transaction reverts and you only pay gas."
          : "If it moves more, only the fully repaid troves are redeemed and the rest stays in your wallet."}
      </p>
      {reliability.reliableAmountWei !== null && onUseAmount && (
        <Button variant={primary ? "primary" : "secondary"} className="mt-3" onClick={() => onUseAmount(reliability.reliableAmountWei!)}>
          Use {formatMusd(reliability.reliableAmountWei)} MUSD, which tolerates normal movement
        </Button>
      )}
    </div>
  );
}

export function NativeQuoteCard({
  result,
  freshness,
  reviewBlockedReason,
  onReview,
  onRefresh,
  onUseAmount,
}: {
  result: QuoteResult;
  freshness: Freshness | null;
  reviewBlockedReason: string | null;
  onReview: () => void;
  onRefresh: () => void;
  onUseAmount: (wei: bigint) => void;
}) {
  if (result.kind === "blocked") {
    const { plan, suggestedAmountWei, reason } = result;
    return (
      <section aria-labelledby="quote-heading" className="space-y-4 rounded-2xl bg-sheet p-5 ring-1 ring-rule sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="quote-heading" className="font-display text-lg font-bold tracking-tight">
            Quote
          </h2>
          <StatusTag tone="stop">Can&apos;t redeem this amount</StatusTag>
        </div>
        <ReasonBlock reason={reason} tone={reason.code === "price-sensitive" ? "caution" : "stop"} />
        {plan && plan.expectedRedeemed > 0n && (
          <dl className="divide-y divide-rule">
            <Row label="Requested">
              <Musd wei={plan.requested} />
            </Row>
            <Row label="Estimated redeemable now">
              <Musd wei={plan.amountToSubmit} />
            </Row>
          </dl>
        )}
        <div className="flex flex-wrap gap-2">
          {suggestedAmountWei !== null && (
            <Button onClick={() => onUseAmount(suggestedAmountWei)}>
              {reason.code === "insufficient-musd" ? "Use wallet balance" : "Use estimated redeemable amount"}:{" "}
              {formatMusd(suggestedAmountWei)} MUSD
            </Button>
          )}
          <Button variant="secondary" onClick={onRefresh}>
            Check again
          </Button>
        </div>
      </section>
    );
  }

  if (result.kind === "public") {
    return (
      <section aria-labelledby="quote-heading" className="space-y-4 rounded-2xl bg-sheet p-5 ring-1 ring-rule sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="quote-heading" className="font-display text-lg font-bold tracking-tight">
            Quote
          </h2>
          <StatusTag tone="neutral">Read-only, no wallet</StatusTag>
        </div>
        <dl className="divide-y divide-rule">
          <Row label="Requested">
            <Musd wei={result.plan.requested} />
          </Row>
          <Row label="Estimated redeemable" hint={result.plan.amountToSubmit < result.plan.requested ? "Some MUSD may remain unredeemed" : undefined}>
            <Musd wei={result.plan.amountToSubmit} />
          </Row>
          <Row label="Indicative BTC after fee" hint="Estimated, not guaranteed">
            <Btc wei={result.estimatedNetBtcWei} />
          </Row>
          <Row label="Redemption fee">
            <Btc wei={result.estimatedFeeBtcWei} />
          </Row>
        </dl>
        {result.reliability.kind === "fragile" && (
          <FragileNotice reliability={result.reliability} oracleMovement={result.oracleMovement} onUseAmount={onUseAmount} />
        )}
        <p className="text-sm text-ink-soft">
          Connect a testnet wallet to check your balance and simulate the exact transaction.
        </p>
      </section>
    );
  }

  const { quote } = result;
  const partial = quote.amountToSubmitWei < quote.amountRequestedWei;
  const fresh = freshness?.fresh ?? false;

  return (
    <section aria-labelledby="quote-heading" className="space-y-4 rounded-2xl bg-sheet p-5 ring-1 ring-rule sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="quote-heading" className="font-display text-lg font-bold tracking-tight">
          Quote
        </h2>
        {fresh || reviewBlockedReason ? (
          <StatusTag tone={quote.reliability.kind === "fragile" ? "caution" : "ok"}>
            {freshness?.fresh ? `Simulation passed, ${Math.ceil(freshness.msRemaining / 1000)} s left` : "Simulation passed"}
          </StatusTag>
        ) : (
          <StatusTag tone="caution">Stale</StatusTag>
        )}
      </div>

      <dl className="divide-y divide-rule">
        <Row label="Requested">
          <Musd wei={quote.amountRequestedWei} />
        </Row>
        <Row label="Estimated redeemable" hint={partial ? "Some MUSD may remain unredeemed" : undefined}>
          {partial ? (
            <>
              <Musd wei={quote.amountRedeemableWei} /> <span className="text-ink-faint">of {formatMusd(quote.amountRequestedWei)}</span>
            </>
          ) : (
            <Musd wei={quote.amountRedeemableWei} />
          )}
        </Row>
        <Row label="Indicative BTC you receive" hint="Estimated, not guaranteed">
          <span className="text-lg">
            <Btc wei={quote.estimatedNetBtcWei} />
          </span>
        </Row>
        <Row label="Redemption fee" hint={`${formatRatioPercent(quote.redemptionRate)} of BTC drawn, kept by the protocol`}>
          <Btc wei={quote.estimatedCollateralFeeBtcWei} />
        </Row>
        <Row label="Estimated gas" hint="Paid in testnet BTC, separately">
          <Btc wei={quote.estimatedGasBtcWei} />
        </Row>
        <Row label="Price tolerance" hint="BTC/USD move before the call stops working">
          {toleranceOf(quote.reliability) === null
            ? "Not price-sensitive"
            : formatTolerance(toleranceOf(quote.reliability)!)}
        </Row>
      </dl>

      {quote.reliability.kind === "fragile" && (
        <FragileNotice
          reliability={quote.reliability}
          oracleMovement={quote.oracleMovement}
          onUseAmount={onUseAmount}
          primary={quote.reliability.consequence === "revert" && quote.reliability.reliableAmountWei !== null}
        />
      )}

      {reviewBlockedReason ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled aria-describedby="review-blocked">
            Review redemption
          </Button>
          <span id="review-blocked" className="text-sm text-caution">
            {reviewBlockedReason}
          </span>
        </div>
      ) : fresh ? (
        <Button variant={quote.reliability.kind === "fragile" && quote.reliability.consequence === "revert" ? "secondary" : "primary"} onClick={onReview}>
          {quote.reliability.kind === "fragile" ? "Review anyway" : "Review redemption"}
        </Button>
      ) : (
        <div className="space-y-2">
          {freshness && !freshness.fresh && (
            <p className="text-sm text-caution" role="status">
              {STALE_REASON_TEXT[freshness.reason]} Refresh before reviewing.
            </p>
          )}
          <Button onClick={onRefresh}>Refresh quote</Button>
        </div>
      )}
    </section>
  );
}
