import Link from "next/link";

/** A peg line that bends from the MUSD level down to BTC. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      <circle cx="5" cy="8" r="3.25" fill="var(--musd)" />
      <path d="M8 8 H14 C18 8 18 20 22 20" fill="none" stroke="var(--ink)" strokeWidth="2.25" strokeLinecap="round" />
      <circle cx="23.5" cy="20" r="3.25" fill="var(--btc)" />
    </svg>
  );
}

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="PegPath home">
      <Mark />
      <span className="font-display text-xl font-bold tracking-tight max-[400px]:sr-only">PegPath</span>
    </Link>
  );
}

export function NetworkChip() {
  return (
    <span className="rounded-full bg-caution-wash px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-caution ring-1 ring-caution/30">
      Mezo Testnet
    </span>
  );
}

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/redeem", label: "Redeem" },
      { href: "/start", label: "Get started" },
      { href: "/receipts", label: "Receipts" },
      { href: "/how-it-works", label: "How it works" },
    ],
  },
  {
    title: "Mezo",
    links: [
      { href: "https://mezo.org/docs/developers/musd/musd-redemptions/", label: "Redemption docs" },
      { href: "https://faucet.test.mezo.org", label: "Testnet faucet" },
      { href: "https://testnet.mezo.org", label: "Testnet app" },
      { href: "https://explorer.test.mezo.org", label: "Testnet explorer" },
    ],
  },
  {
    title: "Source",
    links: [
      { href: "https://github.com/mezo-org/musd", label: "MUSD contracts" },
      { href: "https://www.npmjs.com/package/@mezo-org/passport", label: "Mezo Passport" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-rule/70">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pt-12 pb-28 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.6fr))] lg:pb-12">
        <div className="space-y-4">
          <Wordmark />
          <p className="max-w-sm text-sm text-ink-soft">
            A preflight for Mezo&apos;s MUSD redemption. Testnet assets only. PegPath reads Mezo contracts from your browser and
            never holds keys or funds. Quotes are estimated, not guaranteed.
          </p>
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="text-sm font-semibold">{col.title}</p>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              {col.links.map((l) => (
                <li key={l.href}>
                  {l.href.startsWith("/") ? (
                    <Link href={l.href} className="hover:text-ink">{l.label}</Link>
                  ) : (
                    <a href={l.href} target="_blank" rel="noreferrer" className="hover:text-ink">{l.label}</a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
