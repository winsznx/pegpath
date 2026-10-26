import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** Optional deps of the Base/Coinbase connector bundled by wagmi. PegPath never loads that connector. */
const UNUSED_OPTIONAL_MODULES = ["@x402/core/client", "@x402/evm/exact/client", "@x402/evm/upto/client"];

/**
 * @mezo-org/orangekit@1.0.0-beta.40 (used by Mezo Passport) re-exports the Mezo chain definitions from
 * orangekit-smart-account's TypeScript source path, which bundlers can't load. Point it at the compiled file.
 */
const ORANGEKIT_CHAINS_SOURCE = "@mezo-org/orangekit-smart-account/src/lib/utils/chains";
const ORANGEKIT_CHAINS_DIST = "@mezo-org/orangekit-smart-account/dist/src/lib/utils/chains.js";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      ...Object.fromEntries(UNUSED_OPTIONAL_MODULES.map((m) => [m, "./lib/shims/empty.js"])),
      [ORANGEKIT_CHAINS_SOURCE]: ORANGEKIT_CHAINS_DIST,
    },
  },
  webpack(config) {
    for (const m of UNUSED_OPTIONAL_MODULES) config.resolve.alias[m] = false;
    config.resolve.alias[ORANGEKIT_CHAINS_SOURCE] = require.resolve(ORANGEKIT_CHAINS_DIST);
    return config;
  },
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
