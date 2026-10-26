"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useMezoAccount } from "@/hooks/useMezoAccount";

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const buttonBase =
  "inline-flex min-h-10 shrink-0 whitespace-nowrap items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";

/** Mezo Passport's connect flow (Bitcoin or EVM wallets) in PegPath's own button styles. */
export function WalletButton() {
  const account = useMezoAccount();
  return (
    <ConnectButton.Custom>
      {({ mounted, openConnectModal, openAccountModal, openChainModal, chain, account: rk }) => {
        if (!mounted) return <span className={`${buttonBase} invisible`}>Connect wallet</span>;
        if (!rk) {
          return (
            <button type="button" className={`${buttonBase} bg-ink text-fog hover:bg-ink/85`} onClick={openConnectModal}>
              Connect wallet
            </button>
          );
        }
        if (chain?.unsupported || !account.onMezo) {
          return (
            <button
              type="button"
              className={`${buttonBase} bg-caution-wash text-caution ring-1 ring-caution/40 hover:bg-caution/15`}
              onClick={openChainModal}
              aria-label="Switch to Mezo Testnet"
            >
              <span className="sm:hidden">Switch network</span>
              <span className="hidden sm:inline">Switch to Mezo Testnet</span>
            </button>
          );
        }
        return (
          <button
            type="button"
            className={`${buttonBase} bg-sheet text-ink ring-1 ring-rule hover:ring-ink-faint`}
            onClick={openAccountModal}
          >
            <span aria-hidden className={`size-2 rounded-full ${account.family === "bitcoin" ? "bg-btc" : "bg-ok"}`} />
            <span className="font-mono text-[0.8125rem]">
              {account.bitcoinAddress ? shortAddress(account.bitcoinAddress) : rk.displayName}
            </span>
            <span className="sr-only">Connected. Open account menu.</span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
