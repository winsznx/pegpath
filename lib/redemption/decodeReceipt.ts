import {
  decodeFunctionData,
  isAddressEqual,
  parseEventLogs,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  zeroAddress,
  type Address,
  type Hex,
  type Log,
  type PublicClient,
  type Transaction,
  type TransactionReceipt,
} from "viem";
import { MEZO_TESTNET_ID } from "@/lib/chain/mezoTestnet";
import { musdAbi, troveManagerAbi } from "@/lib/contracts/abi";
import { contracts } from "@/lib/contracts/addresses";
import { PEGPATH_REDEEMER, redeemerAbi } from "@/lib/contracts/redeemer";
import { toUserMessage } from "@/lib/errors/toUserMessage";
import type { DecodedRedemption, RedemptionReceipt } from "@/lib/types";

/** TroveManager.TroveManagerOperation: applyPendingRewards = 0, liquidate = 1, redeemCollateral = 2. */
export type ReceiptSource = Pick<TransactionReceipt, "status" | "blockNumber" | "gasUsed" | "effectiveGasPrice"> & {
  logs: Log[];
};

const TROVE_OPERATION_REDEEM = 2;

function emptyReceipt(hash: Hex, status: RedemptionReceipt["status"], notes: string[]): RedemptionReceipt {
  return {
    status,
    hash,
    chainId: MEZO_TESTNET_ID,
    from: null,
    to: null,
    blockNumber: null,
    blockTimestamp: null,
    gasUsed: null,
    effectiveGasPrice: null,
    gasCostBtcWei: null,
    requestedAmount: null,
    redemption: null,
    musdBurned: null,
    revertReason: null,
    verificationNotes: notes,
  };
}

/**
 * Pure part of receipt reconciliation: given the transaction and its receipt, verify target, chain,
 * calldata and the TroveManager Redemption event. Success requires all of them.
 */
export function reconcileReceipt(
  tx: Pick<Transaction, "hash" | "from" | "to" | "input" | "chainId"> & { gasPrice?: bigint },
  receipt: ReceiptSource,
  blockTimestamp: bigint | null,
  redeemer: Address | null = PEGPATH_REDEEMER,
): RedemptionReceipt {
  const notes: string[] = [];
  const tm = contracts.TroveManager.proxy;
  // Mezo omits effectiveGasPrice on receipts of legacy (type 0) transactions; their gasPrice is what was paid.
  const gasPrice = receipt.effectiveGasPrice ?? tx.gasPrice ?? null;
  const base: RedemptionReceipt = {
    ...emptyReceipt(tx.hash, "confirmed-unverified", notes),
    from: tx.from,
    to: tx.to ?? null,
    blockNumber: receipt.blockNumber,
    blockTimestamp,
    gasUsed: receipt.gasUsed,
    effectiveGasPrice: gasPrice,
    gasCostBtcWei: gasPrice === null ? null : receipt.gasUsed * gasPrice,
  };

  if (tx.chainId !== undefined && tx.chainId !== MEZO_TESTNET_ID) {
    notes.push(`Transaction chain ID is ${tx.chainId}, not Mezo Testnet.`);
    return { ...base, status: "not-a-redemption" };
  }
  const viaRedeemer = Boolean(redeemer && tx.to && isAddressEqual(tx.to, redeemer));
  if (!tx.to || (!isAddressEqual(tx.to, tm) && !viaRedeemer)) {
    notes.push("Transaction was not sent to the verified TroveManager proxy or PegPathRedeemer.");
    return { ...base, status: "not-a-redemption" };
  }

  let requestedAmount: bigint | null = null;
  try {
    if (viaRedeemer) {
      const call = decodeFunctionData({ abi: redeemerAbi, data: tx.input });
      requestedAmount = call.args[0];
    } else {
      const call = decodeFunctionData({ abi: troveManagerAbi, data: tx.input });
      if (call.functionName !== "redeemCollateral") {
        notes.push(`Transaction called TroveManager.${call.functionName}, not redeemCollateral.`);
        return { ...base, status: "not-a-redemption" };
      }
      requestedAmount = call.args[0];
    }
  } catch {
    notes.push("Calldata does not decode as a redemption call.");
    return { ...base, status: "not-a-redemption" };
  }

  if (receipt.status === "reverted") {
    return { ...base, requestedAmount, status: "reverted" };
  }

  const tmLogs = receipt.logs.filter((l) => isAddressEqual(l.address, tm));
  const redemptionEvents = parseEventLogs({ abi: troveManagerAbi, eventName: "Redemption", logs: tmLogs });
  if (redemptionEvents.length !== 1) {
    notes.push(`Expected exactly one Redemption event from TroveManager, found ${redemptionEvents.length}.`);
    return { ...base, requestedAmount };
  }
  const event = redemptionEvents[0].args;

  const trovesTouched = parseEventLogs({ abi: troveManagerAbi, eventName: "TroveUpdated", logs: tmLogs }).filter(
    (l) => l.args._operation === TROVE_OPERATION_REDEEM,
  ).length;

  const musdLogs = receipt.logs.filter((l) => isAddressEqual(l.address, contracts.MUSD.proxy));
  const burns = parseEventLogs({ abi: musdAbi, eventName: "Transfer", logs: musdLogs }).filter(
    (l) => isAddressEqual(l.args.from, viaRedeemer ? tx.to! : tx.from) && isAddressEqual(l.args.to, zeroAddress),
  );
  const musdBurned = burns.reduce((sum, l) => sum + l.args.value, 0n);

  const redemption: DecodedRedemption = {
    attemptedAmount: event._attemptedAmount,
    actualAmount: event._actualAmount,
    collateralSent: event._collateralSent,
    collateralFee: event._collateralFee,
    netBtcToRedeemer: event._collateralSent - event._collateralFee,
    trovesTouched,
  };

  if (viaRedeemer) {
    // The redeemer may pass HintHelpers' truncated amount, so attempted can be below the calldata amount.
    const redeemed = parseEventLogs({
      abi: redeemerAbi,
      eventName: "Redeemed",
      logs: receipt.logs.filter((l) => isAddressEqual(l.address, tx.to!)),
    });
    const r = redeemed[0]?.args;
    if (
      redeemed.length !== 1 ||
      !r ||
      !isAddressEqual(r.redeemer, tx.from) ||
      r.redeemed !== event._actualAmount ||
      r.btcReceived !== redemption.netBtcToRedeemer ||
      event._attemptedAmount > requestedAmount!
    ) {
      notes.push("PegPathRedeemer's Redeemed event does not agree with TroveManager's Redemption event.");
      return { ...base, requestedAmount, redemption, musdBurned };
    }
    notes.push("Sent through PegPathRedeemer, which computed the partial-redemption hint in the same transaction.");
  } else if (requestedAmount !== event._attemptedAmount) {
    notes.push("Redemption event's attempted amount does not match the transaction calldata.");
    return { ...base, requestedAmount, redemption, musdBurned };
  }
  if (musdBurned !== event._actualAmount) {
    notes.push("MUSD burned from the sender does not match the Redemption event's actual amount.");
    return { ...base, requestedAmount, redemption, musdBurned };
  }

  return { ...base, status: "confirmed-verified", requestedAmount, redemption, musdBurned };
}

/** Best-effort revert reason: replays the call at the parent block. Labelled as a replay in the UI. */
async function replayRevertReason(
  client: PublicClient,
  tx: Pick<Transaction, "from" | "to" | "input" | "gas">,
  blockNumber: bigint,
): Promise<string | null> {
  if (!tx.to) return null;
  try {
    await client.call({ account: tx.from, to: tx.to, data: tx.input, gas: tx.gas, blockNumber: blockNumber - 1n });
    return null;
  } catch (error) {
    return toUserMessage(error).detail ?? null;
  }
}

const EXPLORER_API = "https://api.explorer.test.mezo.org/api/v2";
const RPC_ATTEMPTS = 3;

/**
 * The public testnet RPC is load-balanced and some backends don't index older transactions by
 * hash, so each lookup is retried a few times before falling back.
 */
async function retryNullable<T>(fn: () => Promise<T>, isMissing: (e: unknown) => boolean): Promise<T | null> {
  for (let attempt = 0; attempt < RPC_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }
  return null;
}

type ExplorerLocation = { blockNumber: bigint; index: number; status: "success" | "reverted"; gasUsed: bigint; gasPrice: bigint };

/** Uses the Blockscout index only to find where a transaction lives; the data itself is re-read from the RPC. */
async function locateViaExplorer(hash: Hex): Promise<ExplorerLocation | null> {
  const response = await fetch(`${EXPLORER_API}/transactions/${hash}`, { headers: { accept: "application/json" } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Explorer lookup failed with HTTP ${response.status}`);
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  if (record.block_number == null || record.position == null) return null;
  return {
    blockNumber: BigInt(String(record.block_number)),
    index: Number(record.position),
    status: record.status === "ok" ? "success" : "reverted",
    gasUsed: BigInt(String(record.gas_used ?? 0)),
    gasPrice: BigInt(String(record.gas_price ?? 0)),
  };
}

/** Re-derives a receipt from chain data. Safe to call on page reload for any hash. */
export async function fetchRedemptionReceipt(client: PublicClient, hash: Hex): Promise<RedemptionReceipt> {
  const notes: string[] = [];
  let receipt: (ReceiptSource & { transactionIndex?: number }) | null = await retryNullable(
    () => client.getTransactionReceipt({ hash }),
    (e) => e instanceof TransactionReceiptNotFoundError,
  );
  let tx: Transaction | null = await retryNullable(
    () => client.getTransaction({ hash }),
    (e) => e instanceof TransactionNotFoundError,
  );

  if (receipt && !tx && receipt.transactionIndex !== undefined) {
    tx = await client.getTransaction({ blockNumber: receipt.blockNumber, index: receipt.transactionIndex });
  }

  if (!receipt) {
    const location = await locateViaExplorer(hash);
    if (!location) {
      if (tx) return { ...emptyReceipt(hash, "pending", ["Transaction is known but not yet mined."]), from: tx.from, to: tx.to };
      return emptyReceipt(hash, "not-found", ["No transaction with this hash is known to the Mezo testnet RPC or explorer."]);
    }
    tx = tx ?? (await client.getTransaction({ blockNumber: location.blockNumber, index: location.index }));
    if (tx.hash.toLowerCase() !== hash.toLowerCase()) {
      return emptyReceipt(hash, "not-found", ["Explorer location did not match this hash on the RPC."]);
    }
    const logs = (await client.getLogs({ fromBlock: location.blockNumber, toBlock: location.blockNumber })).filter(
      (l) => l.transactionHash?.toLowerCase() === hash.toLowerCase(),
    );
    receipt = {
      status: location.status,
      blockNumber: location.blockNumber,
      gasUsed: location.gasUsed,
      effectiveGasPrice: location.gasPrice,
      logs,
    };
    notes.push(
      "The RPC did not return a receipt for this hash, so the block was located via the Mezo explorer. Transaction and event logs were re-read from the RPC; status and gas come from the explorer index.",
    );
  }

  if (!tx) return emptyReceipt(hash, "not-found", ["Receipt found but the transaction body could not be read."]);

  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  const reconciled = reconcileReceipt(tx, receipt, block.timestamp);
  const withNotes = { ...reconciled, verificationNotes: [...notes, ...reconciled.verificationNotes] };
  if (reconciled.status === "reverted") {
    return { ...withNotes, revertReason: await replayRevertReason(client, tx, receipt.blockNumber) };
  }
  return withNotes;
}
