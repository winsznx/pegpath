import type { Address, PublicClient } from "viem";
import { troveManagerAbi } from "@/lib/contracts/abi";
import { contracts } from "@/lib/contracts/addresses";
import type { RedemptionHints } from "@/lib/types";

export type RedeemArgs = readonly [
  amount: bigint,
  firstRedemptionHint: Address,
  upperPartialHint: Address,
  lowerPartialHint: Address,
  partialNICR: bigint,
  maxIterations: bigint,
];

export function toRedeemArgs(amount: bigint, hints: RedemptionHints, maxIterations: bigint): RedeemArgs {
  return [
    amount,
    hints.firstRedemptionHint,
    hints.upperPartialHint,
    hints.lowerPartialHint,
    hints.partialNICR,
    maxIterations,
  ] as const;
}

/** Gas headroom over eth_estimateGas: interest accrual and trove reinsertion vary per block. */
const GAS_BUFFER_BPS = 12_500n;

export type SimulationResult = {
  gasEstimate: bigint;
  gasLimit: bigint;
  gasPriceWei: bigint;
};

/**
 * eth_call (+ eth_estimateGas) of the exact redeemCollateral call from the connected account. Throws
 * viem's ContractFunctionExecutionError, carrying the revert reason, when the call would fail.
 * `blockNumber` pins the call to historical state, which is how PegPath proves its hints are correct
 * for the block they were computed at.
 */
export async function simulateRedemption(
  client: PublicClient,
  account: Address,
  args: RedeemArgs,
  options: { blockNumber?: bigint; estimateGas?: boolean } = {},
): Promise<SimulationResult> {
  const call = {
    account,
    address: contracts.TroveManager.proxy,
    abi: troveManagerAbi,
    functionName: "redeemCollateral",
    args,
  } as const;

  await client.simulateContract({ ...call, blockNumber: options.blockNumber });
  if (options.estimateGas === false) return { gasEstimate: 0n, gasLimit: 0n, gasPriceWei: 0n };

  const [gasEstimate, gasPriceWei] = await Promise.all([client.estimateContractGas(call), client.getGasPrice()]);
  return { gasEstimate, gasLimit: (gasEstimate * GAS_BUFFER_BPS) / 10_000n, gasPriceWei };
}
