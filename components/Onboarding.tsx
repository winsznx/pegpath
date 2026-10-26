"use client";

import { useConnectModal, useChainModal } from "@rainbow-me/rainbowkit";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { usePublicClient } from "wagmi";
import { formatBtc, formatMusd } from "@/lib/amounts/units";
import { explorerAddressUrl, MEZO_TESTNET_ID } from "@/lib/chain/mezoTestnet";
import { PEGPATH_REDEEMER } from "@/lib/contracts/redeemer";
import { readWalletSnapshot } from "@/lib/redemption/readPreflight";
import { MEZO_FAUCET_URL, MEZO_TESTNET_APP_URL } from "@/lib/site";
import { useMezoAccount } from "@/hooks/useMezoAccount";
import { Button, ExternalLink, StatusTag } from "@/components/ui";

type StepState = "done" | "current" | "todo";

function Step({
  index,
  title,
  state,
  children,
}: {
  index: number;
  title: string;
  state: StepState;
  children: React.ReactNode;
}) {
  return (
    <li className={`grid grid-cols-[2.25rem_1fr] gap-3 rounded-2xl p-5 ring-1 ${state === "current" ? "bg-sheet ring-musd/40" : "bg-sheet/60 ring-rule"}`}>
      <span
        aria-hidden
        className={`grid size-8 place-items-center rounded-full font-display text-sm font-bold ${
          state === "done" ? "bg-ok text-fog" : state === "current" ? "bg-musd text-fog" : "bg-rule text-ink-soft"
        }`}
      >
        {state === "done" ? "✓" : index}
      </span>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{title}</h2>
          {state === "done" && <StatusTag tone="ok">Done</StatusTag>}
        </div>
        <div className="space-y-3 text-sm text-ink-soft">{children}</div>
      </div>
    </li>
  );
}

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex max-w-full items-center gap-2 rounded-lg bg-fog px-3 py-2 font-mono text-xs text-ink ring-1 ring-rule hover:ring-ink-faint"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(address);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch (error) {
          console.warn("Clipboard unavailable", error);
        }
      }}
    >
      <span className="truncate">{address}</span>
      <span className="shrink-0 font-sans text-musd">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

/** Setup checklist that reads the connected account's real balances. */
export function Onboarding() {
  const account = useMezoAccount();
  const client = usePublicClient({ chainId: MEZO_TESTNET_ID });
  const { openConnectModal } = useConnectModal();
  const { openChainModal } = useChainModal();

  const balances = useQuery({
    queryKey: ["onboarding-balances", account.address],
    queryFn: () => readWalletSnapshot(client!, account.address!),
    enabled: Boolean(client && account.address),
  });

  const connected = account.connected;
  const onMezo = account.onMezo;
  const hasBtc = (balances.data?.btcBalance ?? 0n) > 0n;
  const hasMusd = (balances.data?.musdBalance ?? 0n) > 0n;
  const states: StepState[] = (() => {
    const done = [connected, onMezo, hasBtc, hasMusd];
    const firstOpen = done.indexOf(false);
    return [...done.map((d, i) => (d ? "done" : i === firstOpen ? "current" : "todo")), firstOpen === -1 ? "current" : "todo"] as StepState[];
  })();

  return (
    <div className="max-w-2xl space-y-8 pt-6 lg:pt-10">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Get started</h1>
        <p className="mt-2 text-ink-soft">
          Four things to have before your first redemption. PegPath checks each one against Mezo Testnet as you go.
        </p>
      </div>

      <ol className="space-y-3">
        <Step index={1} title="Connect a wallet" state={states[0]}>
          <p>
            Use a Bitcoin wallet (Unisat, OKX or Xverse) through Mezo Passport, or any EVM wallet. A Bitcoin wallet signs
            for a Mezo account that holds your MUSD and receives the BTC.
          </p>
          {connected ? (
            account.bitcoinAddress ? (
              <p>
                Bitcoin wallet <span className="font-mono text-ink">{account.bitcoinAddress}</span> controls Mezo account{" "}
                <span className="font-mono break-all text-ink">{account.address}</span>.
              </p>
            ) : (
              <p>
                Connected as <span className="font-mono break-all text-ink">{account.address}</span>.
              </p>
            )
          ) : (
            <Button onClick={openConnectModal}>Connect wallet</Button>
          )}
        </Step>

        <Step index={2} title="Switch to Mezo Testnet" state={states[1]}>
          <p>Chain 31611. PegPath never sends anything on another network.</p>
          {connected && !onMezo && <Button onClick={openChainModal}>Switch network</Button>}
        </Step>

        <Step index={3} title="Get testnet BTC for gas" state={states[2]}>
          <p>
            BTC is Mezo&apos;s gas token. Request some from the <ExternalLink href={MEZO_FAUCET_URL}>Mezo testnet faucet</ExternalLink>{" "}
            using this address:
          </p>
          {account.address && <CopyAddress address={account.address} />}
          {balances.data && <p>Balance: <span className="font-medium text-ink">{formatBtc(balances.data.btcBalance)} BTC</span></p>}
        </Step>

        <Step index={4} title="Hold some MUSD" state={states[3]}>
          <p>
            Borrow MUSD against testnet BTC on <ExternalLink href={MEZO_TESTNET_APP_URL}>Mezo&apos;s testnet app</ExternalLink>, or
            receive it from someone who has some. A new trove carries at least 2,000 MUSD of debt (1,800 minimum plus a 200
            MUSD reserve), so plan your BTC collateral for that.
          </p>
          {balances.data && <p>Balance: <span className="font-medium text-ink">{formatMusd(balances.data.musdBalance)} MUSD</span></p>}
        </Step>

        <Step index={5} title="Run your first check" state={states[4]}>
          {PEGPATH_REDEEMER ? (
            <p>
              Redemptions go through{" "}
              <ExternalLink href={explorerAddressUrl(PEGPATH_REDEEMER)}>PegPathRedeemer</ExternalLink>, PegPath&apos;s contract on
              Mezo Testnet. It works out the redemption hint inside the transaction, so BTC price moves can&apos;t break it. The
              first time, your wallet asks you to approve exactly the MUSD amount you&apos;re redeeming, then to confirm the
              redemption.
            </p>
          ) : (
            <p>Start small. Amounts under about 0.1 MUSD tolerate normal BTC price movement on testnet.</p>
          )}
          <Link href="/redeem" className="inline-flex min-h-11 items-center rounded-xl bg-ink px-5 font-semibold text-fog hover:bg-ink/85">
            Open redemption
          </Link>
        </Step>
      </ol>

      {connected && (
        <Button variant="secondary" onClick={() => balances.refetch()} disabled={balances.isFetching}>
          {balances.isFetching ? "Checking balances…" : "Check balances again"}
        </Button>
      )}
    </div>
  );
}
