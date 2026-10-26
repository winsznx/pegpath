"use client";

import { useState } from "react";
import { formatUnitsExact } from "@/lib/amounts/units";
import { explorerAddressUrl, explorerTxUrl, receiptPath } from "@/lib/chain/mezoTestnet";
import type { RedemptionReceipt as Receipt } from "@/lib/types";
import { Btc, Button, ExternalLink, Mono, Musd, Row, StatusTag } from "@/components/ui";

const STATUS: Record<Receipt["status"], { tone: "ok" | "stop" | "caution" | "neutral"; label: string; body: string }> = {
  "confirmed-verified": {
    tone: "ok",
    label: "Redemption confirmed",
    body: "The transaction succeeded and its Redemption event, calldata and MUSD burn all agree.",
  },
  "confirmed-unverified": {
    tone: "caution",
    label: "Transaction confirmed; redemption result requires verification",
    body: "The transaction succeeded, but PegPath couldn't verify the Redemption event against the call. No amounts are shown as fact.",
  },
  reverted: {
    tone: "stop",
    label: "Transaction reverted",
    body: "The transaction was mined but TroveManager rejected it. No MUSD was burned; only gas was spent.",
  },
  pending: { tone: "neutral", label: "Pending", body: "The transaction is known to the network but not yet mined." },
  "not-found": { tone: "neutral", label: "Not found", body: "Mezo Testnet has no transaction with this hash yet." },
  "not-a-redemption": {
    tone: "stop",
    label: "Not a PegPath redemption",
    body: "This transaction is not a redeemCollateral call to the verified TroveManager on Mezo Testnet.",
  },
};

function toJson(receipt: Receipt): string {
  return JSON.stringify(receipt, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
}

export function RedemptionReceipt({ receipt, requestedWei }: { receipt: Receipt; requestedWei?: bigint }) {
  const status = STATUS[receipt.status];
  const [copied, setCopied] = useState(false);
  const r = receipt.redemption;
  const verified = receipt.status === "confirmed-verified" && r !== null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${receiptPath(receipt.hash)}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch (error) {
      console.warn("Clipboard unavailable", error);
    }
  };

  const download = () => {
    const blob = new Blob([toJson(receipt)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `pegpath-receipt-${receipt.hash.slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <article aria-labelledby="receipt-heading" className="space-y-5 rounded-2xl bg-sheet p-5 ring-1 ring-rule sm:p-7">
      <div className="space-y-2">
        <StatusTag tone={status.tone}>{status.label}</StatusTag>
        <h2 id="receipt-heading" className="sr-only">
          Redemption receipt
        </h2>
        <p className="text-sm text-ink-soft">{status.body}</p>
      </div>

      {verified && (
        <div className="grid gap-px overflow-hidden rounded-xl bg-rule ring-1 ring-rule sm:grid-cols-3">
          <Figure label="Requested">
            <Musd wei={requestedWei ?? r.attemptedAmount} />
          </Figure>
          <Figure label="Actually redeemed">
            <Musd wei={r.actualAmount} />
          </Figure>
          <Figure label="BTC received">
            <span className="font-display text-2xl">
              <Btc wei={r.netBtcToRedeemer} />
            </span>
          </Figure>
        </div>
      )}

      <dl className="divide-y divide-rule">
        {verified && (
          <>
            <Row label="Unredeemed MUSD" hint="Stays in the wallet">
              <Musd wei={r.attemptedAmount - r.actualAmount} />
            </Row>
            <Row label="BTC drawn from troves" hint="Redemption event _collateralSent">
              <Btc wei={r.collateralSent} />
            </Row>
            <Row label="Redemption fee" hint="Redemption event _collateralFee">
              <Btc wei={r.collateralFee} />
            </Row>
            <Row label="Troves touched">{r.trovesTouched}</Row>
          </>
        )}
        {!verified && receipt.requestedAmount !== null && (
          <Row label="Amount in calldata">
            <Musd wei={receipt.requestedAmount} />
          </Row>
        )}
        {receipt.gasCostBtcWei !== null && (
          <Row label="Gas paid" hint={receipt.gasUsed !== null ? `${receipt.gasUsed} gas × ${receipt.effectiveGasPrice} wei` : undefined}>
            <Btc wei={receipt.gasCostBtcWei} />
          </Row>
        )}
        {receipt.revertReason && (
          <Row label="Revert reason" hint="Replayed against the parent block">
            <span className="text-stop">{receipt.revertReason.replace(/^.*execution reverted: /, "")}</span>
          </Row>
        )}
        <Row label="Network">Mezo Testnet ({receipt.chainId})</Row>
        {receipt.from && (
          <Row label="Redeemer">
            <ExternalLink href={explorerAddressUrl(receipt.from)}>
              <Mono>{receipt.from}</Mono>
            </ExternalLink>
          </Row>
        )}
        {receipt.blockNumber !== null && (
          <Row label="Block">
            {receipt.blockNumber.toString()}
            {receipt.blockTimestamp !== null && (
              <span className="block text-xs font-normal text-ink-faint">
                {new Date(Number(receipt.blockTimestamp) * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC")}
              </span>
            )}
          </Row>
        )}
        <Row label="Transaction">
          <ExternalLink href={explorerTxUrl(receipt.hash)}>
            <Mono>{receipt.hash}</Mono>
          </ExternalLink>
        </Row>
      </dl>

      {receipt.verificationNotes.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-fog p-4 text-sm text-ink-soft">
          {receipt.verificationNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      {verified && (
        <details className="text-sm text-ink-soft">
          <summary className="cursor-pointer select-none">Raw amounts</summary>
          <dl className="mt-2 space-y-1 font-mono text-xs">
            <div>_attemptedAmount {formatUnitsExact(r.attemptedAmount)}</div>
            <div>_actualAmount {formatUnitsExact(r.actualAmount)}</div>
            <div>_collateralSent {formatUnitsExact(r.collateralSent)}</div>
            <div>_collateralFee {formatUnitsExact(r.collateralFee)}</div>
          </dl>
        </details>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={copyLink}>{copied ? "Link copied" : "Copy receipt link"}</Button>
        <Button variant="secondary" onClick={download}>
          Download JSON
        </Button>
        <a
          href={explorerTxUrl(receipt.hash)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center rounded-xl px-5 text-[0.9375rem] font-semibold text-musd hover:bg-musd-wash"
        >
          View testnet transaction
        </a>
      </div>
      <p className="sr-only" aria-live="polite">
        {copied ? "Receipt link copied" : ""}
      </p>
    </article>
  );
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-sheet p-4">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{children}</p>
    </div>
  );
}
