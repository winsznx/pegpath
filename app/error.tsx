"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-5 px-4">
      <h1 className="font-display text-3xl font-bold tracking-tight">PegPath hit an error</h1>
      <p className="text-ink-soft">
        Nothing was sent from your wallet. Reload the page to read Mezo Testnet again.
        {error.digest && <span className="mt-2 block font-mono text-xs text-ink-faint">Reference {error.digest}</span>}
      </p>
      <button type="button" onClick={reset} className="inline-flex min-h-11 w-fit items-center rounded-xl bg-ink px-5 font-semibold text-fog">
        Try again
      </button>
    </main>
  );
}
