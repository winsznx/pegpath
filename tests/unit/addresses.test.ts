import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import { contracts, type ContractName } from "@/lib/contracts/addresses";

// Mezo's own deployment artifacts (@mezo-org/musd-contracts, deployments/matsnet = Mezo Testnet).
const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("@mezo-org/musd-contracts/package.json"));
const deployed = (name: ContractName) =>
  JSON.parse(readFileSync(join(pkgDir, "deployments", "matsnet", `${name}.json`), "utf8")) as { address: string };

describe("contract addresses", () => {
  it.each(Object.keys(contracts) as ContractName[])("%s matches @mezo-org/musd-contracts matsnet", (name) => {
    expect(getAddress(contracts[name].proxy)).toBe(getAddress(deployed(name).address));
  });
});
