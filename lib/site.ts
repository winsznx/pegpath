export const SITE_NAME = "PegPath";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const SITE_DESCRIPTION =
  "Check whether testnet MUSD can be redeemed for BTC on Mezo right now, see the outcome before you sign, and get a receipt rebuilt from chain data.";

export const MEZO_FAUCET_URL = "https://faucet.test.mezo.org";
export const MEZO_TESTNET_APP_URL = "https://testnet.mezo.org";

export const APP_NAV = [
  { href: "/redeem", label: "Redeem" },
  { href: "/receipts", label: "Receipts" },
  { href: "/start", label: "Get started" },
  { href: "/how-it-works", label: "How it works" },
] as const;
