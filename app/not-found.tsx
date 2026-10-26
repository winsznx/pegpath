import Link from "next/link";
import { Wordmark } from "@/components/Brand";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-4">
      <Wordmark />
      <h1 className="font-display text-4xl font-bold tracking-tight">This page isn&apos;t here</h1>
      <p className="text-ink-soft">The link may be mistyped. Receipts live at /receipt/31611/ followed by a transaction hash.</p>
      <div className="flex gap-3">
        <Link href="/redeem" className="inline-flex min-h-11 items-center rounded-xl bg-ink px-5 font-semibold text-fog">Open redemption</Link>
        <Link href="/receipts" className="inline-flex min-h-11 items-center rounded-xl bg-sheet px-5 font-semibold ring-1 ring-rule">Find a receipt</Link>
      </div>
    </main>
  );
}
