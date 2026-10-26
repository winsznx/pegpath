import type { ReactNode } from "react";
import { formatBtc, formatMusd, formatUnitsExact } from "@/lib/amounts/units";

type Tone = "ok" | "stop" | "caution" | "neutral" | "musd";

const toneClass: Record<Tone, string> = {
  ok: "bg-ok-wash text-ok ring-ok/30",
  stop: "bg-stop-wash text-stop ring-stop/30",
  caution: "bg-caution-wash text-caution ring-caution/30",
  neutral: "bg-sheet text-ink-soft ring-rule",
  musd: "bg-musd-wash text-musd ring-musd/30",
};

const toneIcon: Record<Tone, ReactNode> = {
  ok: <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />,
  stop: <path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5" />,
  caution: <path d="M8 3.5V9M8 11.75V12" />,
  neutral: <circle cx="8" cy="8" r="2" />,
  musd: <circle cx="8" cy="8" r="2" />,
};

/** Status shown as icon + text, never colour alone. */
export function StatusTag({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ring-1 ${toneClass[tone]}`}>
      <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        {toneIcon[tone]}
      </svg>
      {children}
    </span>
  );
}

export function Musd({ wei, exact = false }: { wei: bigint; exact?: boolean }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-ink">{exact ? formatUnitsExact(wei) : formatMusd(wei)}</span>{" "}
      <span className="text-[0.8em] font-medium text-musd">MUSD</span>
    </span>
  );
}

export function Btc({ wei, exact = false }: { wei: bigint; exact?: boolean }) {
  return (
    <span className="whitespace-nowrap" title={`${formatUnitsExact(wei)} BTC`}>
      <span className="text-ink">{exact ? formatUnitsExact(wei) : formatBtc(wei)}</span>{" "}
      <span className="text-[0.8em] font-medium text-btc">BTC</span>
    </span>
  );
}

export function Row({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 py-2.5">
      <dt className="text-ink-soft">
        {label}
        {hint && <span className="block text-xs text-ink-faint">{hint}</span>}
      </dt>
      <dd className="text-right font-medium tabular-nums">{children}</dd>
    </div>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="break-all font-mono text-[0.8125rem]">{children}</span>;
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-musd underline decoration-musd/40 underline-offset-2 hover:decoration-musd">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" }) {
  const variants = {
    primary: "bg-ink text-fog hover:bg-ink/85 disabled:bg-ink/30 disabled:text-fog/80",
    secondary: "bg-sheet text-ink ring-1 ring-rule hover:ring-ink-faint disabled:text-ink-faint",
    quiet: "text-musd hover:bg-musd-wash disabled:text-ink-faint",
  };
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-[0.9375rem] font-semibold transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
