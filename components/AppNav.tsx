"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAV } from "@/lib/site";

function isActive(pathname: string, href: string) {
  if (href === "/receipts") return pathname.startsWith("/receipt");
  return pathname === href || pathname.startsWith(`${href}/`);
}

const ICONS: Record<(typeof APP_NAV)[number]["href"], React.ReactNode> = {
  "/redeem": <path d="M4 7h11l-3-3M16 13H5l3 3" />,
  "/receipts": <path d="M5 3h10v14l-2.5-1.5L10 17l-2.5-1.5L5 17zM8 7h4M8 10h4" />,
  "/start": <path d="M4 10.5 8 14.5 16 5.5" />,
  "/how-it-works": <path d="M10 14v.5M8 8a2 2 0 1 1 3 1.7c-.6.4-1 .9-1 1.6M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />,
};

function NavIcon({ href }: { href: (typeof APP_NAV)[number]["href"] }) {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[href]}
    </svg>
  );
}

/** Desktop links in the top bar. */
export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="App" className="hidden items-center gap-1 lg:flex">
      {APP_NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
          className="rounded-full px-3 py-1.5 text-sm text-ink-soft hover:text-ink aria-[current=page]:bg-sheet aria-[current=page]:text-ink aria-[current=page]:ring-1 aria-[current=page]:ring-rule"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Mobile bottom tabs. Rendered outside the header: the header's backdrop-filter would otherwise become
 * the containing block for this fixed element and pin it to the top of the screen.
 */
export function AppTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="App tabs"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-rule bg-fog/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {APP_NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
          className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] text-ink-faint aria-[current=page]:text-musd"
        >
          <NavIcon href={item.href} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
