import { describe, expect, it } from "vitest";
import { zeroAddress, type Address } from "viem";
import { checkFreshness, diffQuotes, requiresReReview } from "@/lib/redemption/quoteFreshness";
import type { NativeQuote } from "@/lib/types";

const wallet = "0x401d68969c9afAdeEc0e9fE6B67221247CFa642F" as Address;

function quote(overrides: Partial<NativeQuote> = {}): NativeQuote {
  return {
    id: "q",
    chainId: 31611,
    blockNumber: 100n,
    blockTimestamp: 0n,
    fetchedAtMs: 1_000,
    expiresAtMs: 31_000,
    wallet,
    amountRequestedWei: 10n ** 19n,
    amountToSubmitWei: 10n ** 19n,
    amountRedeemableWei: 10n ** 19n,
    oraclePriceRaw: 1n,
    tcr: 1n,
    redemptionRate: 1n,
    estimatedCollateralDrawnWei: 1_000_000n,
    estimatedCollateralFeeBtcWei: 7_500n,
    estimatedNetBtcWei: 992_500n,
    gasLimit: 1n,
    gasPriceWei: 1n,
    estimatedGasBtcWei: 1n,
    maxIterations: 1n,
    hints: { firstRedemptionHint: zeroAddress, upperPartialHint: zeroAddress, lowerPartialHint: zeroAddress, partialNICR: 0n },
    steps: [],
    truncation: "none",
    reliability: { kind: "robust", reason: "no-partial" },
    oracleMovement: null,
    protected: null,
    simulation: "passed",
    warningCodes: [],
    ...overrides,
  };
}

const ctx = { nowMs: 2_000, latestBlock: 101n, chainId: 31611, wallet, amountWei: 10n ** 19n };

describe("checkFreshness", () => {
  it("is fresh inside 30 s and fewer than 3 new blocks", () => {
    expect(checkFreshness(quote(), ctx)).toEqual({ fresh: true, msRemaining: 29_000 });
  });

  it("expires at 30 s (mocked clock)", () => {
    expect(checkFreshness(quote(), { ...ctx, nowMs: 31_000 })).toEqual({ fresh: false, reason: "expired" });
  });

  it("expires after 3 new blocks even within 30 s", () => {
    expect(checkFreshness(quote(), { ...ctx, latestBlock: 103n })).toEqual({ fresh: false, reason: "new-blocks" });
    expect(checkFreshness(quote(), { ...ctx, latestBlock: 102n }).fresh).toBe(true);
  });

  it("invalidates immediately on chain, wallet or amount change", () => {
    expect(checkFreshness(quote(), { ...ctx, chainId: 31612 })).toEqual({ fresh: false, reason: "chain-changed" });
    expect(checkFreshness(quote(), { ...ctx, wallet: zeroAddress })).toEqual({ fresh: false, reason: "wallet-changed" });
    expect(checkFreshness(quote(), { ...ctx, wallet: null })).toEqual({ fresh: false, reason: "wallet-changed" });
    expect(checkFreshness(quote(), { ...ctx, amountWei: 1n })).toEqual({ fresh: false, reason: "amount-changed" });
  });

  it("accepts checksum differences in the wallet address", () => {
    expect(checkFreshness(quote(), { ...ctx, wallet: wallet.toLowerCase() as Address }).fresh).toBe(true);
  });
});

describe("re-review rules", () => {
  it("forces a re-review when the signed amount changes by any amount", () => {
    const diffs = diffQuotes(quote(), quote({ amountToSubmitWei: 10n ** 19n - 1n }));
    expect(requiresReReview(diffs)).toBe(true);
  });

  it("tolerates sub-0.5% BTC drift but not more", () => {
    expect(requiresReReview(diffQuotes(quote(), quote({ estimatedNetBtcWei: 990_000n })))).toBe(false);
    expect(requiresReReview(diffQuotes(quote(), quote({ estimatedNetBtcWei: 980_000n })))).toBe(true);
  });

  it("reports no diffs for identical quotes", () => {
    expect(diffQuotes(quote(), quote())).toEqual([]);
  });
});
