import type { Address, PublicClient } from "viem";
import {
  borrowerOperationsAbi,
  interestRateManagerAbi,
  musdAbi,
  priceFeedAbi,
  sortedTrovesAbi,
  troveManagerAbi,
} from "@/lib/contracts/abi";
import { contracts } from "@/lib/contracts/addresses";
import { PegPathError } from "@/lib/errors/pegpathError";
import { toUserMessage } from "@/lib/errors/toUserMessage";
import type { ProtocolSnapshot, WalletSnapshot } from "@/lib/types";

export const ORACLE_LOOKBACK_BLOCKS = 20n;

const multicall3Abi = [
  {
    type: "function",
    name: "getEthBalance",
    stateMutability: "view",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

/**
 * Reads every protocol value the quote depends on from one block. PriceFeed.fetchPrice reverts on a
 * stale oracle, so its failure is surfaced as its own error instead of a generic RPC failure.
 */
export async function readProtocolSnapshot(client: PublicClient): Promise<ProtocolSnapshot> {
  const block = await client.getBlock({ blockTag: "latest" });
  const blockNumber = block.number;
  const tm = contracts.TroveManager.proxy;
  const bo = contracts.BorrowerOperations.proxy;

  const [price, [mcr, gasCompensation, minNetDebt, redemptionRate, troveCount, interestRateBps]] = await Promise.all([
    readOraclePrice(client, blockNumber),
    client.multicall({
      allowFailure: false,
      blockNumber,
      contracts: [
        { address: tm, abi: troveManagerAbi, functionName: "MCR" },
        { address: tm, abi: troveManagerAbi, functionName: "MUSD_GAS_COMPENSATION" },
        { address: bo, abi: borrowerOperationsAbi, functionName: "minNetDebt" },
        { address: bo, abi: borrowerOperationsAbi, functionName: "redemptionRate" },
        { address: contracts.SortedTroves.proxy, abi: sortedTrovesAbi, functionName: "getSize" },
        { address: contracts.InterestRateManager.proxy, abi: interestRateManagerAbi, functionName: "interestRate" },
      ],
    }),
  ]);

  const tcr = await client.readContract({
    address: tm,
    abi: troveManagerAbi,
    functionName: "getTCR",
    args: [price],
    blockNumber,
  });

  return {
    blockNumber,
    blockTimestamp: block.timestamp,
    price,
    tcr,
    mcr,
    gasCompensation,
    minNetDebt,
    redemptionRate,
    troveCount,
    interestRateBps: BigInt(interestRateBps),
  };
}

/** Oracle movement over the last `blocks` blocks, in parts per million. Context for price tolerance. */
export async function readOracleMovement(
  client: PublicClient,
  snapshot: ProtocolSnapshot,
  blocks = ORACLE_LOOKBACK_BLOCKS,
): Promise<{ blocks: bigint; seconds: bigint; movePpm: bigint } | null> {
  const fromBlock = snapshot.blockNumber - blocks;
  try {
    const [pastPrice, pastBlock] = await Promise.all([
      client.readContract({
        address: contracts.PriceFeed.proxy,
        abi: priceFeedAbi,
        functionName: "fetchPrice",
        blockNumber: fromBlock,
      }),
      client.getBlock({ blockNumber: fromBlock }),
    ]);
    const delta = snapshot.price > pastPrice ? snapshot.price - pastPrice : pastPrice - snapshot.price;
    return {
      blocks,
      seconds: snapshot.blockTimestamp - pastBlock.timestamp,
      movePpm: (delta * 1_000_000n) / pastPrice,
    };
  } catch {
    // Historical state is optional context; a node without it shouldn't block the quote.
    return null;
  }
}

async function readOraclePrice(client: PublicClient, blockNumber: bigint): Promise<bigint> {
  let price: bigint;
  try {
    price = await client.readContract({
      address: contracts.PriceFeed.proxy,
      abi: priceFeedAbi,
      functionName: "fetchPrice",
      blockNumber,
    });
  } catch (error) {
    const message = toUserMessage(error);
    if (message.code === "oracle-stale" || message.code === "rpc-unavailable") {
      throw new PegPathError(message.code, message.body, { detail: message.detail, cause: error });
    }
    throw new PegPathError("oracle-invalid", "Mezo's PriceFeed did not return a usable BTC price.", {
      detail: message.detail ?? message.body,
      cause: error,
    });
  }
  if (price === 0n) {
    throw new PegPathError("oracle-invalid", "Mezo's PriceFeed returned a BTC price of zero.");
  }
  return price;
}

export async function readWalletSnapshot(
  client: PublicClient,
  address: Address,
  blockNumber?: bigint,
): Promise<WalletSnapshot> {
  const multicall3 = client.chain?.contracts?.multicall3?.address;
  if (!multicall3) throw new PegPathError("rpc-unavailable", "Multicall3 is not configured for this chain.");

  const [musdBalance, btcBalance] = await client.multicall({
    allowFailure: false,
    blockNumber,
    contracts: [
      { address: contracts.MUSD.proxy, abi: musdAbi, functionName: "balanceOf", args: [address] },
      { address: multicall3, abi: multicall3Abi, functionName: "getEthBalance", args: [address] },
    ],
  });
  return { address, musdBalance, btcBalance };
}
