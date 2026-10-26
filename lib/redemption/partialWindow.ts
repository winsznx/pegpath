import { DECIMAL_PRECISION, type TroveSnapshot } from "@/lib/redemption/planRedemption";

/** LiquityMath.NICR_PRECISION */
const NICR_PRECISION = 10n ** 20n;
/** InterestRateMath.SECONDS_IN_A_YEAR and BPS */
const SECONDS_IN_A_YEAR = 31_556_952n;
const BPS = 10_000n;
/** TroveManager widens the accepted NICR by 10 minutes of interest at the system rate. */
const HINT_INTEREST_WINDOW_SECONDS = 600n;
export const PPM = 1_000_000n;

/**
 * Price tolerance a partial redemption needs to be "reliable". The testnet oracle moved ~0.01-0.03%
 * per block when measured on 2026-10-21, so 0.25% covers a slow wallet confirmation.
 */
export const RELIABLE_TOLERANCE_PPM = 2_500n;

export type PartialWindow = {
  /** NICR TroveManager computes for the trove after redemption, at the quote price. HintHelpers returns this. */
  lower: bigint;
  /** Largest NICR TroveManager accepts (`upperBoundNICR`). */
  upper: bigint;
  /** Midpoint, which tolerates the widest symmetric price move. */
  hint: bigint;
  /** How far BTC/USD may rise or fall, in parts per million, before the partial is cancelled. */
  toleranceUpPpm: bigint;
  toleranceDownPpm: bigint;
};

function nicr(coll: bigint, debt: bigint): bigint {
  return debt > 0n ? (coll * NICR_PRECISION) / debt : (1n << 256n) - 1n;
}

function newPrincipalAfter(trove: TroveSnapshot, lot: bigint): bigint {
  return lot > trove.interest ? trove.principal - (lot - trove.interest) : trove.principal;
}

/**
 * Replays the hint check in TroveManager._redeemCollateralFromTrove:
 *
 *   cancel if hintNICR < newNICR || hintNICR > upperBoundNICR
 *
 * newNICR depends on the collateral lot, which is lot / price at inclusion time, so any oracle move
 * between quoting and inclusion shifts the window. Returns the window at the quote price and how
 * much the price may move before a hint at the midpoint falls outside it.
 */
export function partialWindow(
  trove: TroveSnapshot,
  lot: bigint,
  price: bigint,
  systemInterestRateBps: bigint,
): PartialWindow {
  const newPrincipal = newPrincipalAfter(trove, lot);
  const allowance =
    (trove.principal * systemInterestRateBps * HINT_INTEREST_WINDOW_SECONDS) / (BPS * SECONDS_IN_A_YEAR);
  const newColl = trove.coll - (lot * DECIMAL_PRECISION) / price;

  const lower = nicr(newColl, newPrincipal);
  const upper = nicr(newColl, newPrincipal - allowance);
  const hint = (lower + upper) / 2n;

  // newNICR(p') <= hint  <=>  p' <= lot*1e18 / (coll - hint*newPrincipal/1e20)
  // upper(p')  >= hint  <=>  p' >= lot*1e18 / (coll - hint*(newPrincipal-allowance)/1e20)
  const collAtHint = (hint * newPrincipal) / NICR_PRECISION;
  const collAtUpper = (hint * (newPrincipal - allowance)) / NICR_PRECISION;
  const scaledLot = lot * DECIMAL_PRECISION;

  const maxPrice = trove.coll > collAtHint ? scaledLot / (trove.coll - collAtHint) : null;
  const minPrice = trove.coll > collAtUpper ? scaledLot / (trove.coll - collAtUpper) : 0n;

  const toleranceUpPpm = maxPrice === null ? PPM : maxPrice > price ? ((maxPrice - price) * PPM) / price : 0n;
  const toleranceDownPpm = minPrice < price ? ((price - minPrice) * PPM) / price : 0n;

  return { lower, upper, hint, toleranceUpPpm, toleranceDownPpm };
}

export function tolerancePpm(window: PartialWindow): bigint {
  return window.toleranceUpPpm < window.toleranceDownPpm ? window.toleranceUpPpm : window.toleranceDownPpm;
}

/** Snap reliable amounts to 0.0001 MUSD so they're readable and stable across rechecks. */
const RELIABLE_GRID_WEI = 10n ** 14n;

/**
 * Largest partial lot (≤ maxLot) whose midpoint hint tolerates `targetPpm` of price movement.
 * Tolerance falls monotonically as the lot grows, so a binary search is exact.
 */
export function largestReliableLot(
  trove: TroveSnapshot,
  maxLot: bigint,
  price: bigint,
  systemInterestRateBps: bigint,
  targetPpm: bigint = RELIABLE_TOLERANCE_PPM,
): bigint {
  const ok = (lot: bigint) => tolerancePpm(partialWindow(trove, lot, price, systemInterestRateBps)) >= targetPpm;
  if (maxLot <= 0n) return 0n;
  if (ok(maxLot)) return maxLot;

  let lo = 0n;
  let hi = maxLot;
  while (hi - lo > 1n) {
    const mid = (lo + hi) / 2n;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  const snapped = lo - (lo % RELIABLE_GRID_WEI);
  return snapped > 0n ? snapped : lo;
}
