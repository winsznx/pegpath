"use client";

import Link from "next/link";
import { explorerTxUrl, receiptPath } from "@/lib/chain/mezoTestnet";
import type { TxState } from "@/hooks/useRedemptionFlow";
import { ReasonBlock } from "@/components/NativeQuoteCard";
import { RedemptionReceipt } from "@/components/RedemptionReceipt";
import { Button, ExternalLink, Mono } from "@/components/ui";

type StageState = "done" | "active" | "todo" | "failed";

const STAGES = ["Waiting for wallet", "Submitted", "Confirming", "Confirmed"] as const;

function stageStates(tx: TxState): StageState[] {
  switch (tx.status) {
    case "awaiting-wallet":
      return ["active", "todo", "todo", "todo"];
    case "submitted":
    case "unknown-pending":
      return ["done", "done", "active", "todo"];
    case "settled":
      return tx.receipt.status === "reverted" || tx.receipt.status === "not-a-redemption"
        ? ["done", "done", "done", "failed"]
        : ["done", "done", "done", "done"];
    case "failed":
      return tx.hash ? ["done", "done", "failed", "todo"] : ["failed", "todo", "todo", "todo"];
    case "none":
      return ["todo", "todo", "todo", "todo"];
  }
}

function announcement(tx: TxState): string {
  switch (tx.status) {
    case "awaiting-wallet":
      return "Waiting for your wallet to approve the transaction.";
    case "submitted":
      return "Transaction submitted. Waiting for confirmation.";
    case "unknown-pending":
      return "Still waiting for confirmation. The transaction may still confirm.";
    case "settled":
      return tx.receipt.status === "confirmed-verified"
        ? "Redemption confirmed."
        : tx.receipt.status === "reverted"
          ? "Transaction reverted."
          : "Transaction confirmed. The redemption result requires verification.";
    case "failed":
      return tx.error.title;
    case "none":
      return "";
  }
}

export function TransactionStatus({ tx, onStartOver }: { tx: TxState; onStartOver: () => void }) {
  if (tx.status === "none" || tx.status === "awaiting-wallet") {
    return <p className="sr-only" aria-live="polite">{announcement(tx)}</p>;
  }
  const states = stageStates(tx);
  const hash = tx.hash;

  return (
    <section aria-labelledby="tx-heading" className="space-y-5">
      <h2 id="tx-heading" className="font-display text-2xl font-bold tracking-tight">
        {tx.status === "settled" ? "Receipt" : "Transaction"}
      </h2>
      <p className="sr-only" aria-live="polite">
        {announcement(tx)}
      </p>

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Transaction progress">
        {STAGES.map((label, i) => (
          <li
            key={label}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 ${
              states[i] === "done"
                ? "bg-ok-wash text-ok ring-ok/30"
                : states[i] === "active"
                  ? "bg-musd-wash text-musd ring-musd/30"
                  : states[i] === "failed"
                    ? "bg-stop-wash text-stop ring-stop/30"
                    : "bg-sheet text-ink-faint ring-rule"
            }`}
          >
            <span aria-hidden className={`size-2 rounded-full bg-current ${states[i] === "active" ? "stage-pulse" : ""}`} />
            {label}
            <span className="sr-only">: {states[i]}</span>
          </li>
        ))}
      </ol>

      {hash && tx.status !== "settled" && (
        <p className="text-sm text-ink-soft">
          Hash{" "}
          <ExternalLink href={explorerTxUrl(hash)}>
            <Mono>{hash}</Mono>
          </ExternalLink>
        </p>
      )}

      {tx.status === "unknown-pending" && (
        <div className="rounded-xl bg-caution-wash p-4 text-sm">
          <p className="font-semibold text-caution">Still waiting for confirmation</p>
          <p className="mt-1">
            No receipt arrived within two minutes. That doesn&apos;t mean it failed. The receipt page keeps checking the
            chain for this hash.
          </p>
          <Link href={receiptPath(tx.hash)} className="mt-2 inline-block font-medium text-musd underline">
            Open receipt page
          </Link>
        </div>
      )}

      {tx.status === "failed" && <ReasonBlock reason={tx.error} />}

      {tx.status === "settled" && (
        <>
          <RedemptionReceipt receipt={tx.receipt} requestedWei={tx.quote.amountRequestedWei} />
          {tx.receipt.status === "reverted" && (
            <p className="text-sm text-ink-soft">
              PegPath won&apos;t resend automatically. Start a fresh check to see whether the redemption can go through now.
            </p>
          )}
        </>
      )}

      {(tx.status === "settled" || tx.status === "failed" || tx.status === "unknown-pending") && (
        <Button variant="secondary" onClick={onStartOver}>
          Start a new check
        </Button>
      )}
    </section>
  );
}
