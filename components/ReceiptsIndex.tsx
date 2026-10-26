"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { isHash } from "viem";
import { receiptPath } from "@/lib/chain/mezoTestnet";
import { readRunLog, type RunLogEntry } from "@/lib/telemetry/events";
import { RunLogDownload } from "@/components/RunLogDownload";
import { Button, StatusTag } from "@/components/ui";

const EXAMPLES = [
  { hash: "0xa7362c536834267e4f7372dc9716afe833210237386fcff684ca040179c5fbc7", label: "Confirmed 0.1346 MUSD redemption" },
  { hash: "0xc97e93acae8a11c0dff3bc81046045a210569b0d04c51a983386d040e2d2866b", label: "Reverted: Unable to redeem any amount" },
] as const;

const RESULT_TONE: Partial<Record<RunLogEntry["result"], "ok" | "stop" | "caution" | "neutral">> = {
  "confirmed-verified": "ok",
  "confirmed-unverified": "caution",
  reverted: "stop",
  submitted: "neutral",
  "unknown-pending": "caution",
};

const RESULT_TEXT: Partial<Record<RunLogEntry["result"], string>> = {
  "confirmed-verified": "Confirmed",
  "confirmed-unverified": "Needs verification",
  reverted: "Reverted",
  submitted: "Submitted",
  "unknown-pending": "Pending",
};

const subscribe = (fn: () => void) => {
  window.addEventListener("storage", fn);
  return () => window.removeEventListener("storage", fn);
};

function useTransactions(): RunLogEntry[] {
  const raw = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(readRunLog().filter((e) => e.txHash)),
    () => "[]",
  );
  const entries = JSON.parse(raw) as RunLogEntry[];
  const latest = new Map<string, RunLogEntry>();
  for (const e of entries) latest.set(e.txHash, e);
  return [...latest.values()].reverse();
}

export function ReceiptsIndex() {
  const router = useRouter();
  const transactions = useTransactions();
  const [hash, setHash] = useState("");
  const valid = isHash(hash.trim());

  return (
    <div className="max-w-3xl space-y-10 pt-6 lg:pt-10">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Receipts</h1>
        <p className="mt-2 text-ink-soft">
          Every receipt is rebuilt from Mezo Testnet when you open it. Paste any redemption hash, or pick one you sent from
          this browser.
        </p>
      </div>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) router.push(receiptPath(hash.trim() as `0x${string}`));
        }}
      >
        <label htmlFor="hash" className="text-sm font-medium text-ink-soft">
          Transaction hash
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="hash"
            value={hash}
            onChange={(e) => setHash(e.target.value)}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl bg-sheet px-4 py-3 font-mono text-sm ring-1 ring-rule outline-none focus:ring-2 focus:ring-musd"
          />
          <Button type="submit" disabled={!valid}>
            Open receipt
          </Button>
        </div>
        {hash.trim() !== "" && !valid && <p className="text-sm text-stop">A hash is 0x followed by 64 hex characters.</p>}
      </form>

      <section aria-labelledby="yours" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="yours" className="font-display text-xl font-bold tracking-tight">
            Sent from this browser
          </h2>
          <RunLogDownload />
        </div>
        {transactions.length === 0 ? (
          <div className="rounded-2xl bg-sheet p-6 text-sm text-ink-soft ring-1 ring-rule">
            No redemptions sent from this browser yet.{" "}
            <Link href="/redeem" className="font-semibold text-musd hover:underline">
              Check an amount
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-rule rounded-2xl bg-sheet ring-1 ring-rule">
            {transactions.map((t) => (
              <li key={t.txHash}>
                <Link href={receiptPath(t.txHash as `0x${string}`)} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-fog/60">
                  <span className="min-w-0">
                    <span className="block font-medium tabular-nums">{t.requestedMusd || "?"} MUSD</span>
                    <span className="block truncate font-mono text-xs text-ink-faint">{t.txHash}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-ink-faint">{new Date(t.dateUtc).toLocaleString()}</span>
                    <StatusTag tone={RESULT_TONE[t.result] ?? "neutral"}>{RESULT_TEXT[t.result] ?? t.result}</StatusTag>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="examples" className="space-y-3">
        <h2 id="examples" className="font-display text-xl font-bold tracking-tight">
          Examples from testnet
        </h2>
        <p className="text-sm text-ink-soft">Other people&apos;s redemptions, decoded live.</p>
        <ul className="space-y-2">
          {EXAMPLES.map((e) => (
            <li key={e.hash}>
              <Link href={receiptPath(e.hash)} className="text-musd underline underline-offset-2">
                {e.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
