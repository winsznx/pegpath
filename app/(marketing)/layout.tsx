import Link from "next/link";
import { NetworkChip, SiteFooter, Wordmark } from "@/components/Brand";
import { LANDING_NAV } from "@/components/landing/anchors";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-rule/70 bg-fog/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Wordmark />
            <NetworkChip />
          </div>
          <nav aria-label="Sections" className="hidden items-center gap-6 text-sm lg:flex">
            {LANDING_NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-ink-soft hover:text-ink">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <details className="relative lg:hidden">
              <summary className="grid size-10 cursor-pointer list-none place-items-center rounded-full ring-1 ring-rule [&::-webkit-details-marker]:hidden">
                <span className="sr-only">Menu</span>
                <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                  <path d="M4 6h12M4 10h12M4 14h12" />
                </svg>
              </summary>
              <nav aria-label="Sections" className="absolute right-0 mt-2 w-52 rounded-2xl bg-sheet p-2 shadow-[0_16px_50px_rgb(26_34_48/0.16)] ring-1 ring-rule">
                {LANDING_NAV.map((item) => (
                  <Link key={item.href} href={item.href} className="block rounded-xl px-3 py-2.5 text-sm hover:bg-fog">
                    {item.label}
                  </Link>
                ))}
              </nav>
            </details>
            <Link href="/redeem" className="inline-flex min-h-10 items-center rounded-full bg-ink px-4 text-sm font-medium whitespace-nowrap text-fog hover:bg-ink/85">
              Open app
            </Link>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
