import { AppNav, AppTabBar } from "@/components/AppNav";
import { NetworkChip, SiteFooter, Wordmark } from "@/components/Brand";
import { WalletButton } from "@/components/WalletButton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-transparent bg-fog/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Wordmark href="/redeem" />
            <NetworkChip />
          </div>
          <AppNav />
          <WalletButton />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {children}
      </main>
      <SiteFooter />
      <AppTabBar />
    </>
  );
}
