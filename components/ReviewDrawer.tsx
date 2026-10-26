"use client";

import { useEffect, useRef, useState } from "react";
import { formatBtc, formatMusd, formatUnitsExact } from "@/lib/amounts/units";
import { explorerAddressUrl, MEZO_TESTNET_ID } from "@/lib/chain/mezoTestnet";
import { contracts } from "@/lib/contracts/addresses";
import type { UserMessage } from "@/lib/errors/toUserMessage";
import { STALE_REASON_TEXT, type Freshness, type QuoteDiff } from "@/lib/redemption/quoteFreshness";
import type { ApprovalState, ReviewState } from "@/hooks/useRedemptionFlow";
import { FragileNotice, ReasonBlock } from "@/components/NativeQuoteCard";
import { Btc, Button, ExternalLink, Mono, Musd, Row } from "@/components/ui";

const DIFF_LABEL: Record<QuoteDiff["field"], string> = {
  submitAmount: "Amount you sign",
  redeemable: "Estimated redeemable MUSD",
  netBtc: "Indicative BTC you receive",
  fee: "Redemption fee",
};

function displayed(diff: QuoteDiff, value: bigint): string {
  return diff.field === "submitAmount" || diff.field === "redeemable" ? formatUnitsExact(value) : formatBtc(value);
}

function DiffValue({ diff, value }: { diff: QuoteDiff; value: bigint }) {
  return diff.field === "submitAmount" || diff.field === "redeemable" ? <Musd wei={value} exact /> : <Btc wei={value} />;
}

export function ReviewDrawer({
  review,
  freshness,
  walletError,
  awaitingWallet,
  confirmDisabledReason,
  onConfirm,
  onAccept,
  onRecheck,
  onClose,
  onUseAmount,
  approval,
  onApprove,
}: {
  approval: ApprovalState;
  onApprove: () => void;
  review: ReviewState;
  freshness: Freshness | null;
  walletError: UserMessage | null;
  awaitingWallet: boolean;
  confirmDisabledReason: string | null;
  onConfirm: () => void;
  onAccept: () => void;
  onRecheck: () => void;
  onClose: () => void;
  onUseAmount: (wei: bigint) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = review.status !== "closed";
  const quoteId = review.status === "ready" ? review.quote.id : null;
  const [ackedQuoteId, setAckedQuoteId] = useState<string | null>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const quote = review.status === "closed" ? null : review.quote;
  const fragile = review.status === "ready" && review.quote.reliability.kind === "fragile";
  const acknowledged = !fragile || ackedQuoteId === quoteId;
  const stale = freshness !== null && !freshness.fresh;
  const visibleDiffs =
    review.status === "ready"
      ? review.diffs.filter((d) => review.needsAccept || displayed(d, d.before) !== displayed(d, d.after))
      : [];

  const needsApproval = review.status === "ready" && Boolean(review.quote.protected?.needsApproval);
  const confirmBlocker =
    review.status !== "ready"
      ? "Waiting for a fresh check"
      : needsApproval
        ? "Approve the MUSD amount first"
        : review.needsAccept
        ? "Accept the updated quote first"
        : stale
          ? "Quote expired"
          : !acknowledged
            ? "Confirm you understand the price sensitivity"
            : confirmDisabledReason;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="review-title"
      onCancel={(e) => {
        if (awaitingWallet) e.preventDefault();
        else onClose();
      }}
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-lg overflow-y-auto bg-fog p-0 text-ink shadow-2xl sm:rounded-l-3xl"
    >
      {quote && (
        <div className="flex min-h-full flex-col gap-5 p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="review-title" className="font-display text-2xl font-bold tracking-tight">
                Review redemption
              </h2>
              <p className="mt-1 text-sm text-ink-soft">Your wallet will ask you to approve one testnet transaction.</p>
            </div>
            <Button variant="quiet" onClick={onClose} disabled={awaitingWallet} aria-label="Close review">
              Close
            </Button>
          </div>

          <div aria-live="polite" className="space-y-4">
            {review.status === "rechecking" && (
              <p className="rounded-xl bg-sheet p-4 text-sm ring-1 ring-rule">
                <span className="stage-pulse mr-2 inline-block size-2 rounded-full bg-musd align-middle" aria-hidden />
                Re-reading price, balance and hints, then simulating the exact call from your wallet…
              </p>
            )}

            {review.status === "blocked" && (
              <>
                <ReasonBlock reason={review.reason} tone={review.reason.code === "price-sensitive" ? "caution" : "stop"} />
                <div className="flex flex-wrap gap-2">
                  {review.suggestedAmountWei !== null && (
                    <Button onClick={() => onUseAmount(review.suggestedAmountWei!)}>
                      Use {formatMusd(review.suggestedAmountWei)} MUSD
                    </Button>
                  )}
                  <Button variant="secondary" onClick={onRecheck}>
                    Check again
                  </Button>
                </div>
              </>
            )}

            {review.status === "ready" && visibleDiffs.length > 0 && (
              <div className={`rounded-xl p-4 text-sm ${review.needsAccept ? "bg-caution-wash" : "bg-sheet ring-1 ring-rule"}`}>
                <p className={`font-semibold ${review.needsAccept ? "text-caution" : ""}`}>
                  {review.needsAccept ? "The quote changed since you checked it" : "Small changes since your check"}
                </p>
                <ul className="mt-2 space-y-1">
                  {visibleDiffs.map((d) => (
                    <li key={d.field} className="flex flex-wrap justify-between gap-2">
                      <span className="text-ink-soft">{DIFF_LABEL[d.field]}</span>
                      <span className="tabular-nums">
                        <DiffValue diff={d} value={d.before} /> <span className="text-ink-faint">to</span>{" "}
                        <DiffValue diff={d} value={d.after} />
                      </span>
                    </li>
                  ))}
                </ul>
                {review.needsAccept && (
                  <Button variant="secondary" className="mt-3" onClick={onAccept}>
                    Accept updated quote
                  </Button>
                )}
              </div>
            )}
          </div>

          {review.status === "ready" && (
            <>
              {review.quote.protected && (
                <div className="space-y-3 rounded-xl bg-ok-wash p-4 text-sm">
                  <p className="font-semibold text-ok">Protected redemption</p>
                  <p>
                    PegPathRedeemer computes the partial-redemption hint inside the transaction, at the price the redemption
                    uses, so BTC price movement can&apos;t cancel it. You get at least{" "}
                    <Btc wei={review.quote.protected.minBtcOut} /> or nothing happens, and any unredeemed MUSD comes back in the
                    same transaction.
                  </p>
                  {needsApproval && (
                    <div className="space-y-2 border-t border-ok/20 pt-3">
                      <p>
                        Step 1 of 2: allow the redeemer to use exactly <Musd wei={review.quote.amountToSubmitWei} exact />. PegPath
                        never asks for an unlimited allowance.
                      </p>
                      <Button
                        variant="secondary"
                        onClick={onApprove}
                        disabled={approval.status === "awaiting-wallet" || approval.status === "pending" || stale}
                      >
                        {approval.status === "awaiting-wallet"
                          ? "Waiting for your wallet…"
                          : approval.status === "pending"
                            ? "Confirming approval…"
                            : "Approve MUSD"}
                      </Button>
                      {approval.status === "failed" && <ReasonBlock reason={approval.error} />}
                    </div>
                  )}
                </div>
              )}

              <dl className="divide-y divide-rule rounded-2xl bg-sheet px-4 ring-1 ring-rule">
                <Row label="Network">Mezo Testnet ({MEZO_TESTNET_ID})</Row>
                <Row label="Contract">
                  {review.quote.protected ? (
                    <ExternalLink href={explorerAddressUrl(review.quote.protected.redeemer)}>PegPathRedeemer</ExternalLink>
                  ) : (
                    <ExternalLink href={explorerAddressUrl(contracts.TroveManager.proxy)}>TroveManager</ExternalLink>
                  )}
                </Row>
                <Row label="You sign exactly" hint="Burned from your wallet, up to this amount">
                  <Musd wei={review.quote.amountToSubmitWei} exact />
                </Row>
                <Row label="Indicative BTC you receive" hint="Estimated, not guaranteed">
                  <Btc wei={review.quote.estimatedNetBtcWei} />
                </Row>
                <Row label="Redemption fee" hint="Deducted from BTC drawn">
                  <Btc wei={review.quote.estimatedCollateralFeeBtcWei} />
                </Row>
                <Row label="Max gas cost" hint={`${review.quote.gasLimit.toString()} gas limit at ${review.quote.gasPriceWei.toString()} wei`}>
                  <Btc wei={review.quote.estimatedGasBtcWei} />
                </Row>
              </dl>

              <p className="text-sm text-ink-soft">
                Some MUSD may remain unredeemed: the protocol burns only what it can take from troves when your
                transaction is mined, and the rest stays in your wallet.
              </p>

              {review.quote.reliability.kind === "fragile" && (
                <>
                  <FragileNotice reliability={review.quote.reliability} oracleMovement={review.quote.oracleMovement} onUseAmount={onUseAmount} />
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-[var(--musd)]"
                      checked={acknowledged}
                      onChange={(e) => setAckedQuoteId(e.target.checked ? quoteId : null)}
                    />
                    I understand this transaction will likely revert if the BTC price moves first.
                  </label>
                </>
              )}

              <details className="rounded-xl bg-sheet p-4 text-sm ring-1 ring-rule">
                <summary className="cursor-pointer select-none font-medium">Call preview</summary>
                <p className="mt-2 font-mono text-xs">TroveManager.redeemCollateral(</p>
                <dl className="mt-1 space-y-1 pl-3 text-xs">
                  <CallArg name="_amount" value={`${review.quote.amountToSubmitWei} (${formatUnitsExact(review.quote.amountToSubmitWei)} MUSD)`} />
                  <CallArg name="_firstRedemptionHint" value={review.quote.hints.firstRedemptionHint} />
                  <CallArg name="_upperPartialRedemptionHint" value={review.quote.hints.upperPartialHint} />
                  <CallArg name="_lowerPartialRedemptionHint" value={review.quote.hints.lowerPartialHint} />
                  <CallArg name="_partialRedemptionHintNICR" value={review.quote.hints.partialNICR.toString()} />
                  <CallArg name="_maxIterations" value={review.quote.maxIterations.toString()} />
                </dl>
                <p className="mt-1 font-mono text-xs">)</p>
                <p className="mt-2 text-xs text-ink-faint">
                  Target {contracts.TroveManager.proxy}. No token approval is needed: TroveManager burns MUSD directly.
                </p>
              </details>
            </>
          )}

          {walletError && <ReasonBlock reason={walletError} tone={walletError.code === "wallet-rejected" ? "caution" : "stop"} />}

          <div className="mt-auto space-y-2 border-t border-rule pt-4">
            {stale && review.status === "ready" ? (
              <>
                <p className="text-sm text-caution" role="status">
                  {freshness && !freshness.fresh ? STALE_REASON_TEXT[freshness.reason] : null} Nothing will be sent until you
                  review a fresh quote.
                </p>
                <Button className="w-full" onClick={onRecheck}>
                  Refresh quote
                </Button>
              </>
            ) : (
              <Button className="w-full" onClick={onConfirm} disabled={awaitingWallet || confirmBlocker !== null}>
                {awaitingWallet ? "Waiting for your wallet…" : needsApproval ? "Step 2: confirm redemption" : "Confirm in wallet"}
              </Button>
            )}
            {confirmBlocker && !stale && review.status === "ready" && (
              <p className="text-center text-sm text-ink-soft">{confirmBlocker}</p>
            )}
            {review.status === "ready" && freshness?.fresh && (
              <p className="text-center text-xs text-ink-faint">
                Quote valid for {Math.ceil(freshness.msRemaining / 1000)} more seconds or until 3 new blocks.
              </p>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}

function CallArg({ name, value }: { name: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-faint">{name}</dt>
      <dd>
        <Mono>{value}</Mono>
      </dd>
    </div>
  );
}
