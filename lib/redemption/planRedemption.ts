import type { Address } from "viem";

export const DECIMAL_PRECISION = 10n ** 18n;

/**
 * A trove that is closed in full must have its debt covered with this much headroom. Interest keeps
 * accruing between the quote and inclusion; without the margin a "full close" turns into a partial
 * redemption below the minimum net debt, which TroveManager cancels.
 */
export const FULL_CLOSE_MARGIN_WEI = 10n ** 16n;

/**
 * Amounts capped by the protocol are snapped to 0.01 MUSD. Debt grows every block, so an unsnapped
 * cap would change the signed amount on every recheck and force a re-review for dust.
 */
export const AMOUNT_GRID_WEI = 10n ** 16n;

function floorToGrid(value: bigint): bigint {
  return value >= AMOUNT_GRID_WEI ? value - (value % AMOUNT_GRID_WEI) : value;
}

function ceilToGrid(value: bigint): bigint {
  const rest = value % AMOUNT_GRID_WEI;
  return rest === 0n ? value : value + AMOUNT_GRID_WEI - rest;
}

export type TroveSnapshot = {
  owner: Address;
  coll: bigint;
  /** principal + pendingPrincipal, as returned by getEntireDebtAndColl */
  principal: bigint;
  /** interest + pendingInterest, as returned by getEntireDebtAndColl */
  interest: bigint;
  icr: bigint;
};

export type ProtocolParams = {
  price: bigint;
  mcr: bigint;
  minNetDebt: bigint;
  gasCompensation: bigint;
};

export type PlanStep =
  | { kind: "skip-undercollateralized"; owner: Address; icr: bigint }
  | { kind: "close"; owner: Address; musd: bigint; collateral: bigint }
  | { kind: "partial"; owner: Address; musd: bigint; collateral: bigint; netDebtAfter: bigint };

export type TruncationReason =
  | "none"
  | "min-net-debt"
  | "max-iterations"
  | "no-more-troves";

export type RedemptionPlan = {
  requested: bigint;
  /** Amount PegPath will pass as `_amount`. Includes FULL_CLOSE_MARGIN_WEI when the plan ends on a close. */
  amountToSubmit: bigint;
  /** MUSD the protocol is expected to burn, based on trove state at the quote block. */
  expectedRedeemed: bigint;
  expectedCollateralDrawn: bigint;
  /** Troves TroveManager will visit, which is what `_maxIterations` must cover. */
  iterations: bigint;
  truncation: TruncationReason;
  /** Owner of the trove that is partially redeemed, if any. Its NICR hint must be valid. */
  partialTrove: Address | null;
  steps: PlanStep[];
};

/**
 * Replays TroveManager.redeemCollateral against a snapshot of the redemption order (lowest ICR
 * first) to find the largest amount that will actually execute.
 *
 * HintHelpers.getRedemptionHints on the deployed testnet keeps walking after a capped partial, so
 * its `truncatedAmount` can exceed what TroveManager accepts: TroveManager takes min(remaining,
 * netDebt) from each trove and cancels the whole partial when the trove's remaining net debt would
 * fall below minNetDebt. If nothing has been redeemed by then, the transaction reverts with
 * "Unable to redeem any amount". This planner mirrors TroveManager instead.
 */
export function planRedemption(
  requested: bigint,
  troves: readonly TroveSnapshot[],
  params: ProtocolParams,
  maxIterations: bigint,
): RedemptionPlan {
  const steps: PlanStep[] = [];
  let remaining = requested;
  let expectedRedeemed = 0n;
  let expectedCollateralDrawn = 0n;
  let iterations = 0n;
  let truncation: TruncationReason = "none";
  let partialTrove: Address | null = null;

  for (const trove of troves) {
    if (remaining === 0n) break;
    if (iterations === maxIterations) {
      truncation = "max-iterations";
      break;
    }
    iterations += 1n;

    if (trove.icr < params.mcr) {
      steps.push({ kind: "skip-undercollateralized", owner: trove.owner, icr: trove.icr });
      continue;
    }

    const totalDebt = trove.principal + trove.interest;
    const netDebt = totalDebt > params.gasCompensation ? totalDebt - params.gasCompensation : 0n;

    if (remaining >= netDebt + FULL_CLOSE_MARGIN_WEI) {
      const collateral = (netDebt * DECIMAL_PRECISION) / params.price;
      steps.push({ kind: "close", owner: trove.owner, musd: netDebt, collateral });
      expectedRedeemed += netDebt;
      expectedCollateralDrawn += collateral;
      remaining -= netDebt;
      continue;
    }

    const partialCapacity = netDebt > params.minNetDebt ? netDebt - params.minNetDebt : 0n;
    const lot = remaining < partialCapacity ? remaining : floorToGrid(partialCapacity);
    if (lot > 0n) {
      const collateral = (lot * DECIMAL_PRECISION) / params.price;
      steps.push({
        kind: "partial",
        owner: trove.owner,
        musd: lot,
        collateral,
        netDebtAfter: netDebt - lot,
      });
      expectedRedeemed += lot;
      expectedCollateralDrawn += collateral;
      partialTrove = trove.owner;
    }
    remaining -= lot;
    if (remaining > 0n) truncation = "min-net-debt";
    break;
  }

  if (remaining > 0n && truncation === "none") {
    truncation = iterations === maxIterations ? "max-iterations" : "no-more-troves";
  }

  // A plan that ends on a full close submits the margin on top, so interest accrued before inclusion
  // is still covered. Every close leaves at least the margin unspent, so this never exceeds
  // `requested`; the snapped result is clamped to it anyway. Leftover MUSD is cancelled on the next
  // trove (or never reached) and stays in the wallet.
  const endsOnClose = partialTrove === null && expectedRedeemed > 0n;
  const withMargin = ceilToGrid(expectedRedeemed + FULL_CLOSE_MARGIN_WEI);
  const amountToSubmit = endsOnClose ? (withMargin < requested ? withMargin : requested) : expectedRedeemed;

  return {
    requested,
    amountToSubmit,
    expectedRedeemed,
    expectedCollateralDrawn,
    iterations,
    truncation,
    partialTrove,
    steps,
  };
}

/** Mirrors BorrowerOperations.getRedemptionRate: fee = rate * collateralDrawn / 1e18. */
export function collateralFee(collateralDrawn: bigint, redemptionRate: bigint): bigint {
  return (redemptionRate * collateralDrawn) / DECIMAL_PRECISION;
}
