import type { Address } from "viem";
import { MEZO_TESTNET_ID } from "@/lib/chain/mezoTestnet";

export type ContractName =
  | "TroveManager"
  | "HintHelpers"
  | "SortedTroves"
  | "PriceFeed"
  | "MUSD"
  | "BorrowerOperations"
  | "InterestRateManager";

export type ContractEntry = {
  proxy: Address;
  /** EIP-1967 implementation verified on the explorer. null for non-proxy contracts. */
  implementation: Address | null;
};

/**
 * Proxies from https://mezo.org/docs/developers/musd/musd-redemptions/ (TroveManager, HintHelpers,
 * SortedTroves, PriceFeed, MUSD). BorrowerOperations and InterestRateManager are read from TroveManager.
 * Implementations were read from the EIP-1967 slot on 2026-10-21 and match verified source on
 * explorer.test.mezo.org. verifyDeployment() re-reads both at runtime and fails closed on drift.
 */
export const CONTRACTS = {
  [MEZO_TESTNET_ID]: {
    TroveManager: {
      proxy: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
      implementation: "0x9aab567966983e95536fc460c12266fb0cc10b07",
    },
    HintHelpers: {
      proxy: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6",
      implementation: "0x8adf3f35dbe4026112bcfc078872bcb967732ea8",
    },
    SortedTroves: {
      proxy: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA",
      implementation: "0x9177df58a9614b84c8c2f68df27506ab9a5d0323",
    },
    PriceFeed: {
      proxy: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
      implementation: "0xec42b37c12b8d73d320f4075a1bcd58b306629c1",
    },
    MUSD: {
      proxy: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
      implementation: null,
    },
    BorrowerOperations: {
      proxy: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
      implementation: "0xc05bf344bd5b58825784326dd3112fb6cc160dcc",
    },
    InterestRateManager: {
      proxy: "0xD4D6c36A592A2c5e86035A6bca1d57747a567f37",
      implementation: "0xaa13b1d9cffa3f44ab3a8be0dc8774fb7841459c",
    },
  },
} as const satisfies Record<typeof MEZO_TESTNET_ID, Record<ContractName, ContractEntry>>;

export const contracts = CONTRACTS[MEZO_TESTNET_ID];

export const EIP1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const;
