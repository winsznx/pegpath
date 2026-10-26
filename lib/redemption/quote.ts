import { isAddressEqual, type Address, type PublicClient } from "viem";
import { MEZO_TESTNET_ID } from "@/lib/chain/mezoTestnet";
import { borrowerOperationsAbi } from "@/lib/contracts/abi";
import { contracts } from "@/lib/contracts/addresses";
import { PegPathError } from "@/lib/errors/pegpathError";
import { toUserMessage, type UserMessage } from "@/lib/errors/toUserMessage";
import { buildHints, planAgainstChain } from "@/lib/redemption/buildHints";
import {
  largestReliableLot,
  partialWindow,
  RELIABLE_TOLERANCE_PPM,
  tolerancePpm,
  type PartialWindow,
} from "@/lib/redemption/partialWindow";
import type { RedemptionPlan, TroveSnapshot } from "@/lib/redemption/planRedemption";
import { QUOTE_MAX_AGE_MS } from "@/lib/redemption/quoteFreshness";
import { readOracleMovement, readProtocolSnapshot, readWalletSnapshot } from "@/lib/redemption/readPreflight";
import { erc20AllowanceAbi } from "@/lib/contracts/redeemer";
import { DEADLINE_SECONDS, minBtcOut, PEGPATH_REDEEMER, readAllowance, simulateProtected } from "@/lib/redemption/protected";
import { simulateRedemption, toRedeemArgs } from "@/lib/redemption/simulate";
import type {
  NativeQuote,
  OracleMovement,
  ProtectedRoute,
  ProtocolSnapshot,
  QuoteWarning,
  Reliability,
  WalletSnapshot,
} from "@/lib/types";

export type QuoteTimings = { preflightMs: number; planMs: number; simulateMs: number };

type QuoteContext = {
  snapshot: ProtocolSnapshot | null;
  wallet: WalletSnapshot | null;
  plan: RedemptionPlan | null;
  reliability: Reliability | null;
  oracleMovement: OracleMovement | null;
  timings: Partial<QuoteTimings>;
};

/** Everything needed to explain a blocked check: what was read, and which condition failed. */
export type BlockedQuote = QuoteContext & {
  kind: "blocked";
  reason: UserMessage;
  /** A smaller amount that would execute (or execute reliably). Offered, never auto-applied. */
  suggestedAmountWei: bigint | null;
};

export type ReadyQuote = {
  kind: "ready";
  quote: NativeQuote;
  snapshot: ProtocolSnapshot;
  wallet: WalletSnapshot;
  plan: RedemptionPlan;
  timings: QuoteTimings;
};

/** Returned when no wallet is connected: protocol state and the plan, but nothing account-specific. */
export type PublicQuote = {
  kind: "public";
  snapshot: ProtocolSnapshot;
  plan: RedemptionPlan;
  reliability: Reliability;
  oracleMovement: OracleMovement | null;
  estimatedNetBtcWei: bigint;
  estimatedFeeBtcWei: bigint;
};

export type QuoteResult = ReadyQuote | BlockedQuote | PublicQuote;

function randomId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const elapsed = (start: number) => Math.round(performance.now() - start);

async function readFee(client: PublicClient, collateralDrawn: bigint, blockNumber: bigint): Promise<bigint> {
  try {
    return await client.readContract({
      address: contracts.BorrowerOperations.proxy,
      abi: borrowerOperationsAbi,
      functionName: "getRedemptionRate",
      args: [collateralDrawn],
      blockNumber,
    });
  } catch (error) {
    const message = toUserMessage(error);
    throw new PegPathError("fee-unavailable", message.body, { detail: message.detail, cause: error });
  }
}

function localWindow(plan: RedemptionPlan, troves: readonly TroveSnapshot[], snapshot: ProtocolSnapshot) {
  const step = plan.steps.find((s) => s.kind === "partial");
  if (!step || step.kind !== "partial") return null;
  const trove = troves.find((t) => isAddressEqual(t.owner, step.owner));
  if (!trove) return null;
  return { step, trove, window: partialWindow(trove, step.musd, snapshot.price, snapshot.interestRateBps) };
}

/** Price tolerance of the quote's partial step, or null when nothing in it is price-sensitive. */
export function toleranceOf(reliability: Reliability): bigint | null {
  if (reliability.kind === "fragile") return reliability.tolerancePpm;
  if (reliability.reason === "in-transaction-hints") return null;
  return reliability.reason === "within-tolerance" ? reliability.tolerancePpm : null;
}

export function assessReliability(
  plan: RedemptionPlan,
  troves: readonly TroveSnapshot[],
  snapshot: ProtocolSnapshot,
  window: PartialWindow | null,
): Reliability {
  const partial = localWindow(plan, troves, snapshot);
  if (!partial) return { kind: "robust", reason: "no-partial" };

  const tolerance = tolerancePpm(window ?? partial.window);
  if (tolerance >= RELIABLE_TOLERANCE_PPM) {
    return { kind: "robust", reason: "within-tolerance", tolerancePpm: tolerance };
  }

  const closedMusd = plan.expectedRedeemed - partial.step.musd;
  const reliableLot = largestReliableLot(
    partial.trove,
    partial.step.musd,
    snapshot.price,
    snapshot.interestRateBps,
  );
  const reliableAmount = closedMusd + reliableLot;
  return {
    kind: "fragile",
    tolerancePpm: tolerance,
    consequence: closedMusd > 0n ? "smaller-fill" : "revert",
    reliableAmountWei: reliableAmount > 0n && reliableAmount < plan.amountToSubmit ? reliableAmount : null,
  };
}

/**
 * The full preflight: protocol reads, wallet reads, trove walk, hints, on-chain fee, two simulations
 * (at the quote block, proving the hints, and at the latest block) and a gas estimate. Protocol and
 * wallet conditions come back as `blocked` with a reason; this function does not throw.
 */
export async function getQuote(
  client: PublicClient,
  input: { amountWei: bigint; wallet: Address | null },
): Promise<QuoteResult> {
  const ctx: QuoteContext = {
    snapshot: null,
    wallet: null,
    plan: null,
    reliability: null,
    oracleMovement: null,
    timings: {},
  };
  const block = (reason: UserMessage, suggestedAmountWei: bigint | null = null): BlockedQuote => ({
    kind: "blocked",
    reason,
    suggestedAmountWei,
    ...ctx,
  });

  try {
    const preflightStart = performance.now();
    const [snapshot, wallet] = await Promise.all([
      readProtocolSnapshot(client),
      input.wallet ? readWalletSnapshot(client, input.wallet) : Promise.resolve(null),
    ]);
    ctx.snapshot = snapshot;
    ctx.wallet = wallet;
    ctx.timings.preflightMs = elapsed(preflightStart);

    if (snapshot.tcr < snapshot.mcr) {
      return block(
        toUserMessage(
          new PegPathError("tcr-below-mcr", "Mezo blocks redemptions while the system collateral ratio is below 110%."),
        ),
      );
    }

    const planStart = performance.now();
    const [{ plan, troves }, oracleMovement] = await Promise.all([
      planAgainstChain(client, input.amountWei, snapshot),
      readOracleMovement(client, snapshot),
    ]);
    ctx.plan = plan;
    ctx.oracleMovement = oracleMovement;
    ctx.timings.planMs = elapsed(planStart);

    if (plan.expectedRedeemed === 0n) {
      return block(
        toUserMessage(
          new PegPathError(
            "no-redeemable-troves",
            'Every trove PegPath can reach would fall below Mezo\'s 1,800 MUSD minimum debt at this amount, so TroveManager would revert with "Unable to redeem any amount".',
          ),
        ),
      );
    }

    const fee = await readFee(client, plan.expectedCollateralDrawn, snapshot.blockNumber);
    const netBtc = plan.expectedCollateralDrawn - fee;

    if (!wallet) {
      const reliability = assessReliability(plan, troves, snapshot, null);
      return { kind: "public", snapshot, plan, reliability, oracleMovement, estimatedNetBtcWei: netBtc, estimatedFeeBtcWei: fee };
    }

    if (wallet.musdBalance < input.amountWei) {
      return block(
        toUserMessage(new PegPathError("insufficient-musd", "This wallet holds less MUSD than the amount entered.")),
        wallet.musdBalance > 0n ? wallet.musdBalance : null,
      );
    }

    if (plan.amountToSubmit !== input.amountWei) {
      ctx.reliability = assessReliability(plan, troves, snapshot, null);
      return block(
        {
          code: "no-redeemable-troves",
          title: "Only part of this amount can be redeemed right now",
          body: "Some MUSD may remain unredeemed. Review the smaller amount; PegPath never changes what you sign without asking.",
        },
        plan.amountToSubmit,
      );
    }

    const { hints, window } = await buildHints(client, plan, troves, snapshot);
    const reliability = assessReliability(plan, troves, snapshot, window);
    ctx.reliability = reliability;
    const args = toRedeemArgs(plan.amountToSubmit, hints, plan.iterations);

    const simulateStart = performance.now();
    try {
      await simulateRedemption(client, wallet.address, args, { blockNumber: snapshot.blockNumber, estimateGas: false });
    } catch (error) {
      const message = toUserMessage(error);
      throw new PegPathError(
        "hint-mismatch",
        "The redemption failed in simulation at the same block its hints were computed from, so PegPath's hints are wrong. Nothing will be sent.",
        { detail: message.detail ?? message.body, cause: error },
      );
    }

    let simulation: { gasLimit: bigint; gasPriceWei: bigint };
    let protectedRoute: ProtectedRoute | null = null;
    if (PEGPATH_REDEEMER) {
      const allowance = await readAllowance(client, wallet.address, PEGPATH_REDEEMER);
      protectedRoute = {
        redeemer: PEGPATH_REDEEMER,
        allowance,
        needsApproval: allowance < plan.amountToSubmit,
        minBtcOut: minBtcOut(netBtc),
      };
      try {
        const gasPriceWei = await client.getGasPrice();
        const gas = protectedRoute.needsApproval
          ? await client.estimateContractGas({
              account: wallet.address,
              address: contracts.MUSD.proxy,
              abi: erc20AllowanceAbi,
              functionName: "approve",
              args: [PEGPATH_REDEEMER, plan.amountToSubmit],
            })
          : await simulateProtected(client, wallet.address, PEGPATH_REDEEMER, [
              plan.amountToSubmit,
              hints.upperPartialHint,
              hints.lowerPartialHint,
              plan.iterations,
              protectedRoute.minBtcOut,
              BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_SECONDS,
            ]);
        simulation = { gasLimit: (gas * 125n) / 100n, gasPriceWei };
      } catch (error) {
        ctx.timings.simulateMs = elapsed(simulateStart);
        return block(toUserMessage(error));
      }
    } else {
      try {
        simulation = await simulateRedemption(client, wallet.address, args);
      } catch (error) {
        const message = toUserMessage(error);
        ctx.timings.simulateMs = elapsed(simulateStart);
        if (reliability.kind === "fragile" && message.detail?.includes("Unable to redeem any amount")) {
          return block(
            {
              code: "price-sensitive",
              title: "BTC price moved since the hints were computed",
              body: "This partial redemption only executes if the oracle price barely moves before it's mined, and it already moved. A smaller amount tolerates normal price movement.",
              detail: message.detail,
            },
            reliability.reliableAmountWei,
          );
        }
        return block(message);
      }
    }
    ctx.timings.simulateMs = elapsed(simulateStart);

    const gasCost = simulation.gasLimit * simulation.gasPriceWei;
    if (wallet.btcBalance < gasCost) {
      return block(
        toUserMessage(
          new PegPathError(
            "insufficient-gas",
            "BTC is Mezo's gas asset. This wallet doesn't hold enough testnet BTC to cover the estimated gas.",
          ),
        ),
      );
    }

    const warningCodes: QuoteWarning[] = [];
    if (plan.truncation !== "none") warningCodes.push("partial-fill");
    if (plan.partialTrove === null) warningCodes.push("plan-ends-on-close");
    if (reliability.kind === "fragile" && !protectedRoute) warningCodes.push("price-sensitive");

    const fetchedAtMs = Date.now();
    const quote: NativeQuote = {
      id: randomId(),
      chainId: MEZO_TESTNET_ID,
      blockNumber: snapshot.blockNumber,
      blockTimestamp: snapshot.blockTimestamp,
      fetchedAtMs,
      expiresAtMs: fetchedAtMs + QUOTE_MAX_AGE_MS,
      wallet: wallet.address,
      amountRequestedWei: input.amountWei,
      amountToSubmitWei: plan.amountToSubmit,
      amountRedeemableWei: plan.expectedRedeemed,
      oraclePriceRaw: snapshot.price,
      tcr: snapshot.tcr,
      redemptionRate: snapshot.redemptionRate,
      estimatedCollateralDrawnWei: plan.expectedCollateralDrawn,
      estimatedCollateralFeeBtcWei: fee,
      estimatedNetBtcWei: netBtc,
      gasLimit: simulation.gasLimit,
      gasPriceWei: simulation.gasPriceWei,
      estimatedGasBtcWei: gasCost,
      maxIterations: plan.iterations,
      hints,
      steps: plan.steps,
      truncation: plan.truncation,
      reliability: protectedRoute ? { kind: "robust", reason: "in-transaction-hints" } : reliability,
      oracleMovement,
      protected: protectedRoute,
      simulation: "passed",
      warningCodes,
    };

    return {
      kind: "ready",
      quote,
      snapshot,
      wallet,
      plan,
      timings: {
        preflightMs: ctx.timings.preflightMs ?? 0,
        planMs: ctx.timings.planMs ?? 0,
        simulateMs: ctx.timings.simulateMs ?? 0,
      },
    };
  } catch (error) {
    return block(toUserMessage(error));
  }
}
