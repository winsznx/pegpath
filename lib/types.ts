import type { Address, Hex } from "viem";
import type { MEZO_TESTNET_ID } from "@/lib/chain/mezoTestnet";
import type { PlanStep, TruncationReason } from "@/lib/redemption/planRedemption";

export type RedemptionHints = {
  firstRedemptionHint: Address;
  upperPartialHint: Address;
  lowerPartialHint: Address;
  partialNICR: bigint;
};

export type NativeQuote = {
  /** Local opaque identifier, never an auth token. */
  id: string;
  chainId: typeof MEZO_TESTNET_ID;
  blockNumber: bigint;
  blockTimestamp: bigint;
  fetchedAtMs: number;
  expiresAtMs: number;
  wallet: Address;
  amountRequestedWei: bigint;
  /** Exact `_amount` that will be signed. */
  amountToSubmitWei: bigint;
  /** MUSD the protocol is expected to burn at the quote block. */
  amountRedeemableWei: bigint;
  oraclePriceRaw: bigint;
  tcr: bigint;
  redemptionRate: bigint;
  estimatedCollateralDrawnWei: bigint;
  estimatedCollateralFeeBtcWei: bigint;
  estimatedNetBtcWei: bigint;
  gasLimit: bigint;
  gasPriceWei: bigint;
  estimatedGasBtcWei: bigint;
  maxIterations: bigint;
  hints: RedemptionHints;
  steps: PlanStep[];
  truncation: TruncationReason;
  reliability: Reliability;
  oracleMovement: OracleMovement | null;
  /** Set when the quote routes through PegPathRedeemer, which computes the partial hint in-transaction. */
  protected: ProtectedRoute | null;
  simulation: "passed";
  warningCodes: QuoteWarning[];
};

export type QuoteWarning = "partial-fill" | "plan-ends-on-close" | "price-sensitive";

/**
 * Whether the quote survives normal oracle movement before inclusion. Full trove closes need no
 * NICR hint; a partial is cancelled once BTC/USD leaves its hint window.
 */
export type Reliability =
  | { kind: "robust"; reason: "no-partial" }
  | { kind: "robust"; reason: "within-tolerance"; tolerancePpm: bigint }
  /** PegPathRedeemer computes the partial hint at inclusion time, so oracle movement can't invalidate it. */
  | { kind: "robust"; reason: "in-transaction-hints" }
  | {
      kind: "fragile";
      tolerancePpm: bigint;
      /** No full closes in the plan means a cancelled partial reverts the whole transaction. */
      consequence: "revert" | "smaller-fill";
      reliableAmountWei: bigint | null;
    };

export type ProtectedRoute = {
  redeemer: Address;
  allowance: bigint;
  /** True until an exact-amount MUSD approval for the redeemer is mined; the redeem call is simulated after it. */
  needsApproval: boolean;
  minBtcOut: bigint;
};

export type OracleMovement = { blocks: bigint; seconds: bigint; movePpm: bigint };

export type ProtocolSnapshot = {
  blockNumber: bigint;
  blockTimestamp: bigint;
  price: bigint;
  tcr: bigint;
  mcr: bigint;
  minNetDebt: bigint;
  gasCompensation: bigint;
  redemptionRate: bigint;
  troveCount: bigint;
  /** InterestRateManager.interestRate(), in basis points. Sets the width of the partial-hint window. */
  interestRateBps: bigint;
};

export type WalletSnapshot = {
  address: Address;
  musdBalance: bigint;
  btcBalance: bigint;
};

export type ReceiptStatus =
  | "confirmed-verified"
  | "confirmed-unverified"
  | "reverted"
  | "pending"
  | "not-found"
  | "not-a-redemption";

export type DecodedRedemption = {
  attemptedAmount: bigint;
  actualAmount: bigint;
  /** Gross collateral drawn from troves, before the fee. Verified against wallet deltas on testnet. */
  collateralSent: bigint;
  collateralFee: bigint;
  netBtcToRedeemer: bigint;
  trovesTouched: number;
};

export type RedemptionReceipt = {
  status: ReceiptStatus;
  hash: Hex;
  chainId: number;
  from: Address | null;
  to: Address | null;
  blockNumber: bigint | null;
  blockTimestamp: bigint | null;
  gasUsed: bigint | null;
  effectiveGasPrice: bigint | null;
  gasCostBtcWei: bigint | null;
  requestedAmount: bigint | null;
  redemption: DecodedRedemption | null;
  /** MUSD burned from the redeemer per the token's Transfer log; cross-checks actualAmount. */
  musdBurned: bigint | null;
  revertReason: string | null;
  verificationNotes: string[];
};
