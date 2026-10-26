import type { Metadata } from "next";
import { isHash, type Hex } from "viem";
import { MEZO_TESTNET_ID } from "@/lib/chain/mezoTestnet";
import { ReceiptView } from "@/components/ReceiptView";

type Params = { chainId: string; hash: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { hash } = await params;
  return { title: `PegPath receipt ${hash.slice(0, 10)}…` };
}

export default async function ReceiptPage({ params }: { params: Promise<Params> }) {
  const { chainId, hash } = await params;
  if (Number(chainId) !== MEZO_TESTNET_ID) {
    return (
      <Notice title="Unsupported network">
        PegPath only reads Mezo Testnet (chain {MEZO_TESTNET_ID}). This link points at chain {chainId}.
      </Notice>
    );
  }
  if (!isHash(hash)) {
    return <Notice title="Not a transaction hash">A receipt link needs a 32-byte transaction hash.</Notice>;
  }
  return <ReceiptView hash={hash as Hex} />;
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl pt-12">
      <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-ink-soft">{children}</p>
    </div>
  );
}
