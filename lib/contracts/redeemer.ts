import { getAddress, isAddress, type Address } from "viem";

/** PegPathRedeemer (contracts/src/PegPathRedeemer.sol). Unset until it is deployed to Mezo Testnet. */
const configured = process.env.NEXT_PUBLIC_PEGPATH_REDEEMER;
export const PEGPATH_REDEEMER: Address | null = configured && isAddress(configured) ? getAddress(configured) : null;

export const redeemerAbi = [
  {
    type: "function",
    name: "redeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "upperPartialHint", type: "address" },
      { name: "lowerPartialHint", type: "address" },
      { name: "maxIterations", type: "uint256" },
      { name: "minBtcOut", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [
      { name: "redeemed", type: "uint256" },
      { name: "btcReceived", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "Redeemed",
    anonymous: false,
    inputs: [
      { name: "redeemer", type: "address", indexed: true },
      { name: "requested", type: "uint256", indexed: false },
      { name: "redeemed", type: "uint256", indexed: false },
      { name: "btcReceived", type: "uint256", indexed: false },
      { name: "musdReturned", type: "uint256", indexed: false },
    ],
  },
  { type: "error", name: "NothingRedeemable", inputs: [] },
  {
    type: "error",
    name: "InsufficientBtc",
    inputs: [
      { name: "received", type: "uint256" },
      { name: "minimum", type: "uint256" },
    ],
  },
  { type: "error", name: "Expired", inputs: [] },
] as const;

export const erc20AllowanceAbi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;
