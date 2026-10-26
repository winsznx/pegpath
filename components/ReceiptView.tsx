"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { Hex } from "viem";
import { usePublicClient } from "wagmi";
import { MEZO_TESTNET_ID } from "@/lib/chain/mezoTestnet";
import { toUserMessage } from "@/lib/errors/toUserMessage";
import { fetchRedemptionReceipt } from "@/lib/redemption/decodeReceipt";
import { ReasonBlock } from "@/components/NativeQuoteCard";
import { RedemptionReceipt } from "@/components/RedemptionReceipt";
import { Button } from "@/components/ui";

/** Rebuilds the receipt from chain data on every load; nothing comes from local state. */
export function ReceiptView({ hash }: { hash: Hex }) {
  const client = usePublicClient({ chainId: MEZO_TESTNET_ID });
  const receipt = useQuery({
    queryKey: ["receipt", MEZO_TESTNET_ID, hash],
    queryFn: () => fetchRedemptionReceipt(client!, hash),
    enabled: Boolean(client),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "not-found" ? 5_000 : false;
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-8 lg:pt-12">
      <div>
        <h1 className="font-display text-4xl font-bold tracking-tight">Redemption receipt</h1>
        <p className="mt-2 text-ink-soft">
          Recomputed from Mezo Testnet on each load: the transaction, its receipt and the TroveManager Redemption event.
        </p>
      </div>
      {receipt.data ? (
        <RedemptionReceipt receipt={receipt.data} />
      ) : receipt.error ? (
        <div className="space-y-3">
          <ReasonBlock reason={toUserMessage(receipt.error)} />
          <Button variant="secondary" onClick={() => receipt.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <p className="rounded-2xl bg-sheet p-5 text-sm text-ink-soft ring-1 ring-rule" aria-live="polite">
          Reading transaction {hash.slice(0, 10)}… from Mezo Testnet
        </p>
      )}
      <Link href="/" className="inline-block font-medium text-musd hover:underline">
        Back to redemption
      </Link>
    </div>
  );
}
