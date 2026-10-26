"use client";

import { useWalletAccount } from "@/lib/passport";
import type { Address } from "viem";
import { MEZO_TESTNET_ID } from "@/lib/chain/mezoTestnet";

export type MezoAccount = {
  /** The Mezo account that holds MUSD, signs redeemCollateral and receives BTC. */
  address: Address | null;
  /** For Bitcoin wallets, the original bc1/tb1 address that authorises the Mezo smart account. */
  bitcoinAddress: string | null;
  family: "bitcoin" | "evm";
  chainId: number | null;
  connected: boolean;
  onMezo: boolean;
};

export function useMezoAccount(): MezoAccount {
  const account = useWalletAccount();
  const connected = account.status === "connected" && Boolean(account.accountAddress);
  return {
    address: connected ? (account.accountAddress ?? null) : null,
    bitcoinAddress: account.networkFamily === "bitcoin" ? (account.walletAddress ?? null) : null,
    family: account.networkFamily,
    chainId: account.chainId ?? null,
    connected,
    onMezo: connected && account.chainId === MEZO_TESTNET_ID,
  };
}
