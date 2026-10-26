import Link from "next/link";
import type { MezoAccount } from "@/hooks/useMezoAccount";

/** One line pointing at the next missing setup step, only when something is missing. */
export function OnboardingNudge({
  account,
  musdBalance,
  btcBalance,
}: {
  account: MezoAccount;
  musdBalance: bigint | null;
  btcBalance: bigint | null;
}) {
  const message = !account.connected
    ? "New here? Connect a Bitcoin or EVM wallet, get testnet BTC and MUSD, then come back."
    : !account.onMezo
      ? "Your wallet is on another network. Switch to Mezo Testnet to check your balance."
      : btcBalance === 0n
        ? "This account has no testnet BTC for gas yet."
        : musdBalance === 0n
          ? "This account holds no MUSD yet. Borrow some on Mezo's testnet app first."
          : null;
  if (!message) return null;
  return (
    <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-musd-wash px-4 py-3 text-sm">
      <span>{message}</span>
      <Link href="/start" className="font-semibold text-musd underline-offset-2 hover:underline">
        Get started
      </Link>
    </p>
  );
}
