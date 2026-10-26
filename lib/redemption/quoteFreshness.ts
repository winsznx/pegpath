import { isAddressEqual, type Address } from "viem";
import type { NativeQuote } from "@/lib/types";

export const QUOTE_MAX_AGE_MS = 30_000;
export const QUOTE_MAX_NEW_BLOCKS = 3n;

export type FreshnessContext = {
  nowMs: number;
  latestBlock: bigint | null;
  chainId: number | null;
  wallet: Address | null;
  amountWei: bigint | null;
};

export type StaleReason = "expired" | "new-blocks" | "chain-changed" | "wallet-changed" | "amount-changed";

export type Freshness = { fresh: true; msRemaining: number } | { fresh: false; reason: StaleReason };

/** A quote is valid for at most 30 s or 3 newer blocks; any change of chain, wallet or amount kills it. */
export function checkFreshness(quote: NativeQuote, ctx: FreshnessContext): Freshness {
  if (ctx.chainId !== quote.chainId) return { fresh: false, reason: "chain-changed" };
  if (!ctx.wallet || !isAddressEqual(ctx.wallet, quote.wallet)) return { fresh: false, reason: "wallet-changed" };
  if (ctx.amountWei !== quote.amountRequestedWei) return { fresh: false, reason: "amount-changed" };
  if (ctx.nowMs >= quote.expiresAtMs) return { fresh: false, reason: "expired" };
  if (ctx.latestBlock !== null && ctx.latestBlock - quote.blockNumber >= QUOTE_MAX_NEW_BLOCKS) {
    return { fresh: false, reason: "new-blocks" };
  }
  return { fresh: true, msRemaining: quote.expiresAtMs - ctx.nowMs };
}

export const STALE_REASON_TEXT: Record<StaleReason, string> = {
  expired: "This quote is more than 30 seconds old.",
  "new-blocks": "Three or more new blocks arrived since this quote.",
  "chain-changed": "Your wallet's network changed.",
  "wallet-changed": "The connected wallet changed.",
  "amount-changed": "The amount changed.",
};

export type QuoteDiff = { field: "redeemable" | "netBtc" | "fee" | "submitAmount"; before: bigint; after: bigint };

/** Fields whose change must be shown to the user before a fresh quote can be signed. */
export function diffQuotes(before: NativeQuote, after: NativeQuote): QuoteDiff[] {
  const pairs: Array<[QuoteDiff["field"], bigint, bigint]> = [
    ["submitAmount", before.amountToSubmitWei, after.amountToSubmitWei],
    ["redeemable", before.amountRedeemableWei, after.amountRedeemableWei],
    ["netBtc", before.estimatedNetBtcWei, after.estimatedNetBtcWei],
    ["fee", before.estimatedCollateralFeeBtcWei, after.estimatedCollateralFeeBtcWei],
  ];
  return pairs.filter(([, a, b]) => a !== b).map(([field, a, b]) => ({ field, before: a, after: b }));
}

/**
 * Any change to the signed amount forces a re-review. Estimates (redeemable MUSD, BTC, fee) move with
 * interest accrual and the oracle every block; under 0.5% they are shown but don't block.
 */
export function requiresReReview(diffs: QuoteDiff[]): boolean {
  return diffs.some((d) => {
    if (d.field === "submitAmount") return true;
    if (d.before === 0n) return d.after !== 0n;
    const delta = d.after > d.before ? d.after - d.before : d.before - d.after;
    return delta * 1000n > d.before * 5n;
  });
}
