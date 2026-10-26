import { getAddress, isAddressEqual, type Address, type PublicClient } from "viem";
import { MEZO_TESTNET_ID } from "@/lib/chain/mezoTestnet";
import { troveManagerAbi } from "@/lib/contracts/abi";
import { contracts, EIP1967_IMPLEMENTATION_SLOT, type ContractName } from "@/lib/contracts/addresses";
import { PegPathError } from "@/lib/errors/pegpathError";

export type DeploymentCheck = {
  chainId: number;
  checkedAtMs: number;
  contracts: Array<{ name: ContractName; proxy: Address; implementation: Address | null; ok: boolean }>;
};

function slotToAddress(slot: `0x${string}` | undefined): Address | null {
  if (!slot || BigInt(slot) === 0n) return null;
  return getAddress(`0x${slot.slice(-40)}`);
}

/**
 * Fails closed unless the RPC is chain 31611, every contract has bytecode, every proxy points at
 * the implementation whose verified ABI is pinned in abi.ts, and TroveManager is wired to the same
 * PriceFeed, SortedTroves, MUSD, BorrowerOperations and InterestRateManager that PegPath reads.
 */
export async function verifyDeployment(client: PublicClient): Promise<DeploymentCheck> {
  const chainId = await client.getChainId();
  if (chainId !== MEZO_TESTNET_ID) {
    throw new PegPathError("rpc-wrong-chain", `The configured RPC reports chain ${chainId}, not Mezo Testnet (31611).`);
  }

  const names = Object.keys(contracts) as ContractName[];
  const results = await Promise.all(
    names.map(async (name) => {
      const entry = contracts[name];
      const [code, slot] = await Promise.all([
        client.getCode({ address: entry.proxy }),
        entry.implementation
          ? client.getStorageAt({ address: entry.proxy, slot: EIP1967_IMPLEMENTATION_SLOT })
          : Promise.resolve(undefined),
      ]);
      const hasCode = Boolean(code && code !== "0x");
      const implementation = slotToAddress(slot);
      const implementationOk =
        entry.implementation === null ||
        (implementation !== null && isAddressEqual(implementation, entry.implementation));
      return { name, proxy: entry.proxy, implementation, ok: hasCode && implementationOk };
    }),
  );

  const broken = results.filter((r) => !r.ok);
  if (broken.length > 0) {
    throw new PegPathError(
      "deployment-mismatch",
      "One or more Mezo contracts are missing or were upgraded to an implementation PegPath hasn't verified. Redemption is disabled until the ABI is re-pinned.",
      { detail: broken.map((b) => `${b.name} ${b.proxy} -> ${b.implementation ?? "no implementation"}`).join("\n") },
    );
  }

  const tm = contracts.TroveManager.proxy;
  const [priceFeed, sortedTroves, musdToken, borrowerOperations, interestRateManager] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: tm, abi: troveManagerAbi, functionName: "priceFeed" },
      { address: tm, abi: troveManagerAbi, functionName: "sortedTroves" },
      { address: tm, abi: troveManagerAbi, functionName: "musdToken" },
      { address: tm, abi: troveManagerAbi, functionName: "borrowerOperations" },
      { address: tm, abi: troveManagerAbi, functionName: "interestRateManager" },
    ],
  });
  const wiring: Array<[ContractName, Address]> = [
    ["PriceFeed", priceFeed],
    ["SortedTroves", sortedTroves],
    ["MUSD", musdToken],
    ["BorrowerOperations", borrowerOperations],
    ["InterestRateManager", interestRateManager],
  ];
  const miswired = wiring.filter(([name, actual]) => !isAddressEqual(actual, contracts[name].proxy));
  if (miswired.length > 0) {
    throw new PegPathError(
      "deployment-mismatch",
      "TroveManager points at different contracts than PegPath's verified address map.",
      { detail: miswired.map(([name, actual]) => `${name}: TroveManager uses ${actual}`).join("\n") },
    );
  }

  return { chainId, checkedAtMs: Date.now(), contracts: results };
}
