import type { Address, Hex, PublicClient, WalletClient } from "viem";
import { MEZO_TESTNET_ID, mezoTestnet } from "@/lib/chain/mezoTestnet";
import { contracts } from "@/lib/contracts/addresses";
import { erc20AllowanceAbi, PEGPATH_REDEEMER, redeemerAbi } from "@/lib/contracts/redeemer";
import { PegPathError } from "@/lib/errors/pegpathError";
import type { NativeQuote } from "@/lib/types";

/** Largest BTC shortfall the protected route accepts versus the quote, in basis points. */
export const MIN_BTC_SLIPPAGE_BPS = 50n;
/** How long a signed protected redemption stays valid on-chain. */
export const DEADLINE_SECONDS = 600n;

export type ProtectedPlan = {
  redeemer: Address;
  allowance: bigint;
  needsApproval: boolean;
  minBtcOut: bigint;
};

export function minBtcOut(estimatedNetBtc: bigint): bigint {
  return (estimatedNetBtc * (10_000n - MIN_BTC_SLIPPAGE_BPS)) / 10_000n;
}

export async function readAllowance(client: PublicClient, owner: Address, spender: Address): Promise<bigint> {
  return client.readContract({
    address: contracts.MUSD.proxy,
    abi: erc20AllowanceAbi,
    functionName: "allowance",
    args: [owner, spender],
  });
}

function redeemArgs(quote: NativeQuote, deadline: bigint) {
  if (!quote.protected) throw new PegPathError("unknown", "This quote is not a protected redemption.");
  return [
    quote.amountToSubmitWei,
    quote.hints.upperPartialHint,
    quote.hints.lowerPartialHint,
    quote.maxIterations,
    quote.protected.minBtcOut,
    deadline,
  ] as const;
}

/** Simulates PegPathRedeemer.redeem from the account; requires the MUSD allowance to be in place. */
export async function simulateProtected(
  client: PublicClient,
  account: Address,
  redeemer: Address,
  args: readonly [bigint, Address, Address, bigint, bigint, bigint],
): Promise<bigint> {
  const call = { account, address: redeemer, abi: redeemerAbi, functionName: "redeem", args } as const;
  await client.simulateContract(call);
  return client.estimateContractGas(call);
}

async function assertMezo(walletClient: WalletClient, quote: NativeQuote) {
  const account = walletClient.account;
  if (!account || account.address.toLowerCase() !== quote.wallet.toLowerCase()) {
    throw new PegPathError("wallet-unavailable", "The connected wallet is not the one this quote was made for.");
  }
  if ((await walletClient.getChainId()) !== MEZO_TESTNET_ID) {
    throw new PegPathError("wallet-wrong-chain", "Switch your wallet to Mezo Testnet (chain 31611) before signing.");
  }
  return account;
}

/** Exact-amount approval. PegPath never requests an unlimited allowance. */
export async function sendApproval(walletClient: WalletClient, quote: NativeQuote): Promise<Hex> {
  const account = await assertMezo(walletClient, quote);
  if (!PEGPATH_REDEEMER) throw new PegPathError("unknown", "PegPathRedeemer is not configured.");
  return walletClient.writeContract({
    account,
    chain: mezoTestnet,
    address: contracts.MUSD.proxy,
    abi: erc20AllowanceAbi,
    functionName: "approve",
    args: [PEGPATH_REDEEMER, quote.amountToSubmitWei],
  });
}

export async function sendProtectedRedemption(walletClient: WalletClient, quote: NativeQuote): Promise<Hex> {
  const account = await assertMezo(walletClient, quote);
  if (!quote.protected) throw new PegPathError("unknown", "This quote is not a protected redemption.");
  const deadline = BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_SECONDS;
  return walletClient.writeContract({
    account,
    chain: mezoTestnet,
    address: quote.protected.redeemer,
    abi: redeemerAbi,
    functionName: "redeem",
    args: redeemArgs(quote, deadline),
    gas: quote.gasLimit,
  });
}

export function protectedArgsForSimulation(quote: NativeQuote) {
  return redeemArgs(quote, BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_SECONDS);
}

export { PEGPATH_REDEEMER };
