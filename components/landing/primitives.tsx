import type { ReactNode } from "react";

/** Wayfinding pill above a section heading. It names the section in the header nav's words. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-sheet px-4 text-sm text-ink-soft shadow-[0_1px_2px_rgb(26_34_48/0.05)] ring-1 ring-rule">
      <svg viewBox="0 0 12 12" className="size-3 text-musd" aria-hidden>
        <circle cx="3" cy="3" r="2" fill="currentColor" />
        <path d="M5 3h1.5c2 0 2 6 4 6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      {children}
    </span>
  );
}

export function Section({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-24 pt-20 sm:pt-28 ${className}`}>
      {children}
    </section>
  );
}

/** Heading on the left, supporting paragraph on the right, sharing a baseline. */
export function SplitHeading({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children: ReactNode }) {
  return (
    <>
      <Eyebrow>{eyebrow}</Eyebrow>
      <div className="mt-6 mb-10 grid gap-5 sm:mb-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.85fr)] lg:items-end lg:gap-10">
        <h2 className="font-display text-[2rem] leading-[1.06] font-bold tracking-tight text-balance sm:text-5xl">{title}</h2>
        <div className="space-y-3 text-[1.0625rem] leading-relaxed text-ink-soft lg:pb-1.5">{children}</div>
      </div>
    </>
  );
}

export function CenteredHeading({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mx-auto mb-12 flex max-w-3xl flex-col items-center gap-5 text-center sm:mb-14">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="font-display text-[2rem] leading-[1.06] font-bold tracking-tight text-balance sm:text-5xl">{title}</h2>
      {children && <div className="text-[1.0625rem] leading-relaxed text-ink-soft">{children}</div>}
    </div>
  );
}

/** Grey panel: separates from the page by fill, not border. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-sheet ring-1 ring-rule ${className}`}>{children}</div>;
}

/** Small dated source line under a figure, so every number on the page says where it came from. */
export function Source({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-xs leading-relaxed text-ink-faint">{children}</p>;
}
