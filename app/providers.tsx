"use client";

import { darkTheme, lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { mezoTestnet } from "@/lib/chain/mezoTestnet";
import { wagmiConfig } from "@/lib/wagmi";

const accent = { accentColor: "#2d6f8f", borderRadius: "medium" } as const;

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } }),
  );
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={mezoTestnet}
          theme={{ lightMode: lightTheme(accent), darkMode: darkTheme({ ...accent, accentColor: "#6fb3d2" }) }}
          appInfo={{ appName: "PegPath", learnMoreUrl: "/how-it-works" }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
