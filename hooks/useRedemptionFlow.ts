"use client";

import { useCallback, useReducer, useRef } from "react";
import { WaitForTransactionReceiptTimeoutError, type Address, type Hex, type PublicClient, type WalletClient } from "viem";
import { formatUnitsExact } from "@/lib/amounts/units";
import { toUserMessage, type UserMessage } from "@/lib/errors/toUserMessage";
import { fetchRedemptionReceipt } from "@/lib/redemption/decodeReceipt";
import { sendRedemption, waitForRedemption } from "@/lib/redemption/execute";
import { sendApproval, sendProtectedRedemption } from "@/lib/redemption/protected";
import { getQuote, type QuoteResult } from "@/lib/redemption/quote";
import { diffQuotes, requiresReReview, type QuoteDiff } from "@/lib/redemption/quoteFreshness";
import { recordRun } from "@/lib/telemetry/events";
import type { NativeQuote, RedemptionReceipt } from "@/lib/types";

export type CheckState =
  | { status: "idle" }
  | { status: "checking"; amountWei: bigint; wallet: Address | null }
  | { status: "done"; amountWei: bigint; wallet: Address | null; result: QuoteResult };

export type ReviewState =
  | { status: "closed" }
  | { status: "rechecking"; quote: NativeQuote }
  | { status: "ready"; quote: NativeQuote; diffs: QuoteDiff[]; needsAccept: boolean; notice: UserMessage | null }
  | { status: "blocked"; quote: NativeQuote; reason: UserMessage; suggestedAmountWei: bigint | null };

export type TxState =
  | { status: "none" }
  | { status: "awaiting-wallet"; quote: NativeQuote }
  | { status: "submitted"; quote: NativeQuote; hash: Hex; submittedAtMs: number }
  | { status: "unknown-pending"; quote: NativeQuote; hash: Hex }
  | { status: "settled"; quote: NativeQuote; hash: Hex; receipt: RedemptionReceipt }
  | { status: "failed"; quote: NativeQuote; hash: Hex | null; error: UserMessage };

export type ApprovalState =
  | { status: "idle" }
  | { status: "awaiting-wallet" }
  | { status: "pending"; hash: Hex }
  | { status: "failed"; error: UserMessage };

type State = { check: CheckState; review: ReviewState; tx: TxState; approval: ApprovalState; walletError: UserMessage | null };

type Action =
  | { type: "check-start"; amountWei: bigint; wallet: Address | null }
  | { type: "check-done"; amountWei: bigint; wallet: Address | null; result: QuoteResult }
  | { type: "review-open"; quote: NativeQuote }
  | { type: "review-result"; previous: NativeQuote; result: QuoteResult }
  | { type: "review-accept" }
  | { type: "review-close" }
  | { type: "wallet-prompt"; quote: NativeQuote }
  | { type: "wallet-rejected"; error: UserMessage }
  | { type: "submitted"; hash: Hex }
  | { type: "replaced"; hash: Hex }
  | { type: "settled"; receipt: RedemptionReceipt }
  | { type: "unknown-pending" }
  | { type: "failed"; error: UserMessage }
  | { type: "reset-tx" }
  | { type: "approval"; approval: ApprovalState };

const initial: State = {
  check: { status: "idle" },
  review: { status: "closed" },
  tx: { status: "none" },
  approval: { status: "idle" },
  walletError: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "check-start":
      return { ...state, check: { status: "checking", amountWei: action.amountWei, wallet: action.wallet } };
    case "check-done":
      if (state.check.status !== "checking" || state.check.amountWei !== action.amountWei) return state;
      return { ...state, check: { status: "done", ...action } };
    case "review-open":
      return { ...state, walletError: null, review: { status: "rechecking", quote: action.quote } };
    case "review-result": {
      if (state.review.status === "closed") return state;
      const { result, previous } = action;
      if (result.kind === "ready") {
        const diffs = diffQuotes(previous, result.quote);
        return {
          ...state,
          check: state.check.status === "done" ? { ...state.check, result } : state.check,
          review: { status: "ready", quote: result.quote, diffs, needsAccept: requiresReReview(diffs), notice: null },
        };
      }
      if (result.kind === "blocked") {
        return {
          ...state,
          review: { status: "blocked", quote: previous, reason: result.reason, suggestedAmountWei: result.suggestedAmountWei },
        };
      }
      return state;
    }
    case "review-accept":
      if (state.review.status !== "ready") return state;
      return { ...state, review: { ...state.review, needsAccept: false, diffs: [] } };
    case "review-close":
      return { ...state, review: { status: "closed" }, walletError: null, approval: { status: "idle" } };
    case "wallet-prompt":
      return { ...state, walletError: null, tx: { status: "awaiting-wallet", quote: action.quote } };
    case "wallet-rejected":
      return { ...state, tx: { status: "none" }, walletError: action.error };
    case "submitted":
      if (state.tx.status !== "awaiting-wallet") return state;
      return {
        ...state,
        review: { status: "closed" },
        tx: { status: "submitted", quote: state.tx.quote, hash: action.hash, submittedAtMs: Date.now() },
      };
    case "replaced":
      if (state.tx.status !== "submitted") return state;
      return { ...state, tx: { ...state.tx, hash: action.hash } };
    case "settled":
      if (state.tx.status !== "submitted" && state.tx.status !== "unknown-pending") return state;
      return { ...state, tx: { status: "settled", quote: state.tx.quote, hash: state.tx.hash, receipt: action.receipt } };
    case "unknown-pending":
      if (state.tx.status !== "submitted") return state;
      return { ...state, tx: { status: "unknown-pending", quote: state.tx.quote, hash: state.tx.hash } };
    case "failed": {
      if (state.tx.status === "none" || state.tx.status === "failed" || state.tx.status === "settled") return state;
      const hash = state.tx.status === "awaiting-wallet" ? null : state.tx.hash;
      return { ...state, tx: { status: "failed", quote: state.tx.quote, hash, error: action.error } };
    }
    case "approval":
      return { ...state, approval: action.approval };
    case "reset-tx":
      return { ...state, tx: { status: "none" }, check: { status: "idle" } };
  }
}

const musd = (wei: bigint | undefined | null) => (wei == null ? "" : formatUnitsExact(wei));

function logQuote(amountWei: bigint, result: QuoteResult): void {
  if (result.kind === "public") return;
  const plan = result.plan;
  recordRun({
    runId: result.kind === "ready" ? result.quote.id : `blocked-${Date.now().toString(36)}`,
    result: result.kind === "ready" ? "quote-ready" : "quote-blocked",
    block: result.snapshot?.blockNumber.toString() ?? "",
    requestedMusd: musd(amountWei),
    estimatedRedeemableMusd: musd(plan?.expectedRedeemed),
    preflightMs: String(result.timings.preflightMs ?? ""),
    simulateMs: String(result.timings.simulateMs ?? ""),
    errorCategory: result.kind === "blocked" ? result.reason.code : "",
  });
}

export function useRedemptionFlow(publicClient: PublicClient | undefined) {
  const [state, dispatch] = useReducer(reducer, initial);
  const sending = useRef(false);

  const check = useCallback(
    async (amountWei: bigint, wallet: Address | null) => {
      if (!publicClient) return;
      dispatch({ type: "check-start", amountWei, wallet });
      const result = await getQuote(publicClient, { amountWei, wallet });
      logQuote(amountWei, result);
      dispatch({ type: "check-done", amountWei, wallet, result });
    },
    [publicClient],
  );

  const recheck = useCallback(
    async (previous: NativeQuote) => {
      if (!publicClient) return;
      dispatch({ type: "review-open", quote: previous });
      const result = await getQuote(publicClient, { amountWei: previous.amountRequestedWei, wallet: previous.wallet });
      logQuote(previous.amountRequestedWei, result);
      dispatch({ type: "review-result", previous, result });
    },
    [publicClient],
  );

  const confirm = useCallback(
    async (walletClient: WalletClient, quote: NativeQuote) => {
      if (!publicClient || sending.current) return;
      sending.current = true;
      dispatch({ type: "wallet-prompt", quote });

      let hash: Hex;
      try {
        hash = quote.protected
          ? await sendProtectedRedemption(walletClient, quote)
          : await sendRedemption(walletClient, quote);
      } catch (error) {
        sending.current = false;
        const message = toUserMessage(error);
        if (message.code === "wallet-rejected") {
          recordRun({ runId: quote.id, result: "user-rejected", block: quote.blockNumber.toString(), requestedMusd: musd(quote.amountRequestedWei) });
        }
        dispatch({ type: "wallet-rejected", error: message });
        return;
      }

      const submittedAt = performance.now();
      dispatch({ type: "submitted", hash });
      recordRun({ runId: quote.id, result: "submitted", txHash: hash, block: quote.blockNumber.toString(), requestedMusd: musd(quote.amountRequestedWei) });

      try {
        let finalHash = hash;
        const mined = await waitForRedemption(publicClient, hash, (replacement) => {
          finalHash = replacement;
          dispatch({ type: "replaced", hash: replacement });
        });
        const receipt = await fetchRedemptionReceipt(publicClient, mined.transactionHash ?? finalHash);
        recordRun({
          runId: quote.id,
          result: receipt.status === "confirmed-verified" ? "confirmed-verified" : receipt.status === "reverted" ? "reverted" : "confirmed-unverified",
          txHash: receipt.hash,
          block: receipt.blockNumber?.toString() ?? "",
          requestedMusd: musd(quote.amountRequestedWei),
          estimatedRedeemableMusd: musd(quote.amountRedeemableWei),
          actualRedeemedMusd: musd(receipt.redemption?.actualAmount),
          actualBtcReceived: musd(receipt.redemption?.netBtcToRedeemer),
          btcFee: musd(receipt.redemption?.collateralFee),
          confirmMs: String(Math.round(performance.now() - submittedAt)),
          errorCategory: receipt.revertReason ?? "",
        });
        dispatch({ type: "settled", receipt });
      } catch (error) {
        if (error instanceof WaitForTransactionReceiptTimeoutError) {
          recordRun({ runId: quote.id, result: "unknown-pending", txHash: hash });
          dispatch({ type: "unknown-pending" });
        } else {
          dispatch({ type: "failed", error: toUserMessage(error) });
        }
      } finally {
        sending.current = false;
      }
    },
    [publicClient],
  );

  /** Exact-amount MUSD approval for PegPathRedeemer, then a fresh quote so the redeem call is simulated. */
  const approve = useCallback(
    async (walletClient: WalletClient, quote: NativeQuote) => {
      if (!publicClient || sending.current) return;
      sending.current = true;
      dispatch({ type: "approval", approval: { status: "awaiting-wallet" } });
      try {
        const hash = await sendApproval(walletClient, quote);
        dispatch({ type: "approval", approval: { status: "pending", hash } });
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
        if (receipt.status !== "success") throw new Error("The approval transaction reverted.");
        dispatch({ type: "approval", approval: { status: "idle" } });
        sending.current = false;
        await recheck(quote);
      } catch (error) {
        dispatch({ type: "approval", approval: { status: "failed", error: toUserMessage(error) } });
      } finally {
        sending.current = false;
      }
    },
    [publicClient, recheck],
  );

  return {
    state,
    approve,
    check,
    recheck,
    confirm,
    acceptChanges: useCallback(() => dispatch({ type: "review-accept" }), []),
    closeReview: useCallback(() => dispatch({ type: "review-close" }), []),
    resetTx: useCallback(() => dispatch({ type: "reset-tx" }), []),
  };
}
