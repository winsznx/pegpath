import { mezoTestnet as viemMezoTestnet } from "viem/chains";
import type { Hex } from "viem";

export const MEZO_TESTNET_ID = 31611 as const;

const rpcUrl = process.env.NEXT_PUBLIC_MEZO_RPC_URL || "https://rpc.test.mezo.org";

export const mezoTestnet = {
  ...viemMezoTestnet,
  rpcUrls: { default: { http: [rpcUrl] } },
} as const;

export const EXPLORER_URL = mezoTestnet.blockExplorers.default.url;

export function explorerTxUrl(hash: Hex): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}

export function explorerBlockUrl(block: bigint): string {
  return `${EXPLORER_URL}/block/${block.toString()}`;
}

export function receiptPath(hash: Hex): string {
  return `/receipt/${MEZO_TESTNET_ID}/${hash}`;
}
