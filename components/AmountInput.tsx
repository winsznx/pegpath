"use client";

import { formatMusd, formatUnitsExact, PARSE_ERROR_TEXT, type ParseAmountResult } from "@/lib/amounts/units";

export function AmountInput({
  value,
  onChange,
  parsed,
  balanceWei,
  showError,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  parsed: ParseAmountResult;
  balanceWei: bigint | null;
  showError: boolean;
  onSubmit: () => void;
}) {
  const error = !parsed.ok && showError ? PARSE_ERROR_TEXT[parsed.reason] : null;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="amount" className="text-sm font-medium text-ink-soft">
        MUSD to redeem
      </label>
      <div
        className={`mt-2 flex items-center gap-3 rounded-2xl bg-sheet px-4 py-3 ring-1 transition-shadow focus-within:ring-2 ${
          error ? "ring-stop" : "ring-rule focus-within:ring-musd"
        }`}
      >
        <input
          id="amount"
          name="amount"
          inputMode="decimal"
          size={1}
          autoComplete="off"
          spellCheck={false}
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(",", "."))}
          aria-invalid={Boolean(error)}
          aria-describedby="amount-help"
          className="min-w-0 flex-1 bg-transparent font-display text-4xl font-medium tracking-tight tabular-nums outline-none placeholder:text-ink-faint/60 sm:text-5xl"
        />
        <span className="font-display text-xl font-bold text-musd">MUSD</span>
      </div>
      <div id="amount-help" className="mt-2 flex min-h-6 flex-wrap items-center justify-between gap-2 text-sm">
        {error ? (
          <span className="text-stop" role="alert">
            {error}
          </span>
        ) : balanceWei !== null ? (
          <span className="text-ink-soft">
            Wallet balance <span className="font-medium text-ink tabular-nums">{formatMusd(balanceWei)} MUSD</span>
          </span>
        ) : (
          <span className="text-ink-faint">Connect a testnet wallet to check your balance.</span>
        )}
        {balanceWei !== null && balanceWei > 0n && (
          <button
            type="button"
            className="rounded-md px-2 py-0.5 font-medium text-musd hover:bg-musd-wash"
            onClick={() => onChange(formatUnitsExact(balanceWei))}
          >
            Max MUSD
          </button>
        )}
      </div>
    </form>
  );
}
