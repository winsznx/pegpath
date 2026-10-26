import type { Hex, PublicClient, TransactionReceipt, WalletClient } from "viem";
import { MEZO_TESTNET_ID, mezoTestnet } from "@/lib/chain/mezoTestnet";
import { troveManagerAbi } from "@/lib/contracts/abi";
import { contracts } from "@/lib/contracts/addresses";
import { PegPathError } from "@/lib/errors/pegpathError";
import { toRedeemArgs } from "@/lib/redemption/simulate";
import type { NativeQuote } from "@/lib/types";

/** Mezo testnet blocks land every few seconds; two minutes covers congestion before UNKNOWN_PENDING. */
export const RECEIPT_TIMEOUT_MS = 120_000;

/**
 * Asks the wallet to sign exactly the quoted call. The quote's freshness and re-simulation are the
 * caller's responsibility; this function only refuses obviously unsafe states.
 */
export async function sendRedemption(walletClient: WalletClient, quote: NativeQuote): Promise<Hex> {
  const account = walletClient.account;
  if (!account) throw new PegPathError("wallet-unavailable", "Connect a wallet before signing.");
  if (account.address.toLowerCase() !== quote.wallet.toLowerCase()) {
    throw new PegPathError("wallet-unavailable", "The connected wallet is not the one this quote was made for.");
  }
  const chainId = await walletClient.getChainId();
  if (chainId !== MEZO_TESTNET_ID) {
    throw new PegPathError("wallet-wrong-chain", "Switch your wallet to Mezo Testnet (chain 31611) before signing.");
  }

  return walletClient.writeContract({
    account,
    chain: mezoTestnet,
    address: contracts.TroveManager.proxy,
    abi: troveManagerAbi,
    functionName: "redeemCollateral",
    args: toRedeemArgs(quote.amountToSubmitWei, quote.hints, quote.maxIterations),
    gas: quote.gasLimit,
  });
}

export async function waitForRedemption(
  publicClient: PublicClient,
  hash: Hex,
  onReplaced?: (replacement: Hex) => void,
): Promise<TransactionReceipt> {
  return publicClient.waitForTransactionReceipt({
    hash,
    timeout: RECEIPT_TIMEOUT_MS,
    onReplaced: (r) => onReplaced?.(r.transaction.hash),
  });
}
