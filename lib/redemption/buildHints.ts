import { isAddressEqual, zeroAddress, type Address, type PublicClient } from "viem";
import { hintHelpersAbi, sortedTrovesAbi, troveManagerAbi } from "@/lib/contracts/abi";
import { contracts } from "@/lib/contracts/addresses";
import { PegPathError } from "@/lib/errors/pegpathError";
import { partialWindow, type PartialWindow } from "@/lib/redemption/partialWindow";
import { planRedemption, type RedemptionPlan, type TroveSnapshot } from "@/lib/redemption/planRedemption";
import type { ProtocolSnapshot, RedemptionHints } from "@/lib/types";

/**
 * Upper bound on troves visited in one redemption. Each visit costs roughly 60-100k gas on testnet;
 * ten keeps the call well below block gas limits while covering amounts up to ~10 troves of debt.
 */
export const MAX_ITERATIONS = 10n;

async function readTrove(
  client: PublicClient,
  owner: Address,
  price: bigint,
  blockNumber: bigint,
): Promise<{ trove: TroveSnapshot; prev: Address }> {
  const tm = contracts.TroveManager.proxy;
  const [debtAndColl, icr, prev] = await client.multicall({
    allowFailure: false,
    blockNumber,
    contracts: [
      { address: tm, abi: troveManagerAbi, functionName: "getEntireDebtAndColl", args: [owner] },
      { address: tm, abi: troveManagerAbi, functionName: "getCurrentICR", args: [owner, price] },
      { address: contracts.SortedTroves.proxy, abi: sortedTrovesAbi, functionName: "getPrev", args: [owner] },
    ],
  });
  const [coll, principal, interest] = debtAndColl;
  return { trove: { owner, coll, principal, interest, icr }, prev };
}

/**
 * Walks SortedTroves from the tail (lowest ICR) at a fixed block, reading only as many troves as the
 * plan needs, and returns the executable plan for `requested`.
 */
export async function planAgainstChain(
  client: PublicClient,
  requested: bigint,
  snapshot: ProtocolSnapshot,
  maxIterations: bigint = MAX_ITERATIONS,
): Promise<{ plan: RedemptionPlan; troves: TroveSnapshot[] }> {
  const params = {
    price: snapshot.price,
    mcr: snapshot.mcr,
    minNetDebt: snapshot.minNetDebt,
    gasCompensation: snapshot.gasCompensation,
  };
  const troves: TroveSnapshot[] = [];
  let cursor = await client.readContract({
    address: contracts.SortedTroves.proxy,
    abi: sortedTrovesAbi,
    functionName: "getLast",
    blockNumber: snapshot.blockNumber,
  });

  let plan = planRedemption(requested, troves, params, maxIterations);
  while (plan.truncation === "no-more-troves" && !isAddressEqual(cursor, zeroAddress)) {
    const { trove, prev } = await readTrove(client, cursor, snapshot.price, snapshot.blockNumber);
    troves.push(trove);
    cursor = prev;
    plan = planRedemption(requested, troves, params, maxIterations);
  }
  return { plan, troves };
}

export type BuiltHints = { hints: RedemptionHints; window: PartialWindow | null };

/**
 * Gets the first-redemption hint from HintHelpers, then computes the partial-redemption NICR window
 * locally and submits its midpoint instead of HintHelpers' value (the window's lower edge, which any
 * upward BTC price tick invalidates). HintHelpers' NICR must equal our lower edge to the wei, which
 * proves the local replay of TroveManager's arithmetic. Reinsert hints come from getApproxHint +
 * findInsertPosition, the Liquity-derived algorithm the deployed contracts implement.
 */
export async function buildHints(
  client: PublicClient,
  plan: RedemptionPlan,
  troves: readonly TroveSnapshot[],
  snapshot: ProtocolSnapshot,
): Promise<BuiltHints> {
  const [firstRedemptionHint, helperNICR, truncatedAmount] = await client.readContract({
    address: contracts.HintHelpers.proxy,
    abi: hintHelpersAbi,
    functionName: "getRedemptionHints",
    args: [plan.amountToSubmit, snapshot.price, plan.iterations],
    blockNumber: snapshot.blockNumber,
  });

  const firstRedeemable = plan.steps.find((s) => s.kind !== "skip-undercollateralized");
  if (!firstRedeemable || !isAddressEqual(firstRedeemable.owner, firstRedemptionHint)) {
    throw new PegPathError(
      "hint-mismatch",
      "HintHelpers picked a different first trove than PegPath's walk of SortedTroves. The quote is not safe to sign.",
      { detail: `HintHelpers: ${firstRedemptionHint}, walk: ${firstRedeemable?.owner ?? "none"}` },
    );
  }
  if (truncatedAmount < plan.expectedRedeemed) {
    throw new PegPathError(
      "hint-mismatch",
      "HintHelpers reports less redeemable MUSD than the trove walk expects.",
      { detail: `truncatedAmount ${truncatedAmount}, expected ${plan.expectedRedeemed}` },
    );
  }

  const partialStep = plan.steps.find((s) => s.kind === "partial");
  if (!partialStep || partialStep.kind !== "partial") {
    return {
      hints: { firstRedemptionHint, upperPartialHint: zeroAddress, lowerPartialHint: zeroAddress, partialNICR: 0n },
      window: null,
    };
  }

  const trove = troves.find((t) => isAddressEqual(t.owner, partialStep.owner));
  if (!trove) throw new PegPathError("hint-mismatch", "Partial trove is missing from the walk snapshot.");
  const window = partialWindow(trove, partialStep.musd, snapshot.price, snapshot.interestRateBps);
  if (window.lower !== helperNICR) {
    throw new PegPathError(
      "hint-mismatch",
      "PegPath's replay of the partial-redemption NICR disagrees with HintHelpers. The quote is not safe to sign.",
      { detail: `HintHelpers NICR ${helperNICR}, local ${window.lower}` },
    );
  }

  const numTrials = BigInt(Math.ceil(Math.sqrt(Number(snapshot.troveCount)))) * 15n;
  const seed = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
  const [approxHint] = await client.readContract({
    address: contracts.HintHelpers.proxy,
    abi: hintHelpersAbi,
    functionName: "getApproxHint",
    args: [window.hint, numTrials, seed],
    blockNumber: snapshot.blockNumber,
  });
  const [upperPartialHint, lowerPartialHint] = await client.readContract({
    address: contracts.SortedTroves.proxy,
    abi: sortedTrovesAbi,
    functionName: "findInsertPosition",
    args: [window.hint, approxHint, approxHint],
    blockNumber: snapshot.blockNumber,
  });

  return {
    hints: { firstRedemptionHint, upperPartialHint, lowerPartialHint, partialNICR: window.hint },
    window,
  };
}
