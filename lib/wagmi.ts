import type { WalletList } from "@rainbow-me/rainbowkit";
import { injectedWallet, metaMaskWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http, type Config } from "wagmi";
import { mezoTestnet } from "@/lib/chain/mezoTestnet";
import { getConfig, okxWalletMezoTestnet, unisatWalletMezoTestnet, xverseWalletMezoTestnet } from "@/lib/passport";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

/**
 * Mezo Passport: Bitcoin wallets (Unisat, OKX, Xverse) sign for a Mezo smart account that holds MUSD
 * and receives the redeemed BTC; EVM wallets connect directly. WalletConnect and MetaMask's SDK are
 * listed only when a WalletConnect project ID is configured.
 */
const wallets: WalletList = [
  { groupName: "Bitcoin wallets", wallets: [unisatWalletMezoTestnet, okxWalletMezoTestnet, xverseWalletMezoTestnet] },
  {
    groupName: "EVM wallets",
    wallets: walletConnectProjectId ? [injectedWallet, metaMaskWallet, walletConnectWallet] : [injectedWallet],
  },
];

function browserConfig() {
  return getConfig({
    appName: "PegPath",
    appDescription: "Redeem testnet MUSD for BTC with the outcome checked before you sign.",
    mezoNetwork: "testnet",
    walletConnectProjectId,
    wallets,
    ssr: true,
  });
}

/**
 * Passport's Bitcoin connectors read `window` while the config is built, so the server renders with a
 * plain config for the same chain. Nothing account-specific is rendered on the server.
 */
function serverConfig() {
  return createConfig({ chains: [mezoTestnet], transports: { [mezoTestnet.id]: http() }, ssr: true });
}

export const wagmiConfig: Config = typeof window === "undefined" ? serverConfig() : browserConfig();
