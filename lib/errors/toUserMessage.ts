import {
  BaseError,
  ChainMismatchError,
  ContractFunctionRevertedError,
  HttpRequestError,
  InsufficientFundsError,
  TimeoutError,
  UserRejectedRequestError,
  WaitForTransactionReceiptTimeoutError,
} from "viem";
import { PegPathError, type PegPathErrorCode } from "@/lib/errors/pegpathError";

export type UserMessage = {
  code: PegPathErrorCode;
  title: string;
  body: string;
  /** Raw revert reason or RPC message, shown in an expandable detail. */
  detail?: string;
};

/** Revert strings from the verified TroveManager / PriceFeed / BorrowerOperations source. */
const REVERT_REASONS: ReadonlyArray<{ match: string; code: PegPathErrorCode; title: string; body: string }> = [
  {
    match: "Unable to redeem any amount",
    code: "simulation-reverted",
    title: "Nothing redeemable at this amount",
    body: "TroveManager would not redeem any MUSD with these parameters. The lowest-ratio trove can't take this amount without falling below the 1,800 MUSD minimum debt, or the hints are out of date. Refresh the quote.",
  },
  {
    match: "Cannot redeem when TCR < MCR",
    code: "tcr-below-mcr",
    title: "Redemptions are paused by the protocol",
    body: "The system collateral ratio is below 110%, and Mezo blocks redemptions in that state.",
  },
  {
    match: "Requested redemption amount must be <= user's mUSD token balance",
    code: "insufficient-musd",
    title: "Not enough MUSD",
    body: "The amount is larger than this wallet's MUSD balance.",
  },
  {
    match: "Amount must be greater than zero",
    code: "simulation-reverted",
    title: "Amount must be greater than zero",
    body: "Enter a positive MUSD amount.",
  },
  {
    match: "Oracle is stale",
    code: "oracle-stale",
    title: "Price oracle is stale",
    body: "Mezo's BTC price feed hasn't updated recently enough, so the protocol rejects redemptions until it does.",
  },
  {
    match: "Fee would eat up all returned collateral",
    code: "fee-unavailable",
    title: "Amount too small",
    body: "The redemption fee would consume all of the BTC returned. Try a larger amount.",
  },
];

function revertReasonOf(error: BaseError): string | undefined {
  const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError);
  if (reverted instanceof ContractFunctionRevertedError) {
    return reverted.reason ?? reverted.shortMessage;
  }
  return undefined;
}

export function fromRevertReason(reason: string): UserMessage | undefined {
  const known = REVERT_REASONS.find((r) => reason.includes(r.match));
  return known ? { code: known.code, title: known.title, body: known.body, detail: reason } : undefined;
}

export function toUserMessage(error: unknown): UserMessage {
  if (error instanceof PegPathError) {
    return { code: error.code, title: titleFor(error.code), body: error.message, detail: error.detail };
  }

  if (error instanceof BaseError) {
    if (error.walk((e) => e instanceof UserRejectedRequestError)) {
      return {
        code: "wallet-rejected",
        title: "You rejected the request in your wallet",
        body: "No transaction was sent. You can review the redemption again whenever you're ready.",
      };
    }
    if (error.walk((e) => e instanceof ChainMismatchError)) {
      return {
        code: "wallet-wrong-chain",
        title: "Wallet is on a different network",
        body: "Switch your wallet to Mezo Testnet (chain 31611) and check again.",
        detail: error.shortMessage,
      };
    }
    if (error.walk((e) => e instanceof InsufficientFundsError)) {
      return {
        code: "insufficient-gas",
        title: "Not enough testnet BTC for gas",
        body: "BTC is the gas asset on Mezo. Get testnet BTC from the Mezo faucet and try again.",
        detail: error.shortMessage,
      };
    }
    if (error.walk((e) => e instanceof WaitForTransactionReceiptTimeoutError)) {
      return {
        code: "tx-timeout",
        title: "Still waiting for confirmation",
        body: "The transaction was submitted but no receipt arrived in time. It may still confirm. Open the receipt page to keep checking.",
      };
    }

    const reason = revertReasonOf(error);
    if (reason) {
      return (
        fromRevertReason(reason) ?? {
          code: "simulation-reverted",
          title: "The call would revert",
          body: "Mezo's contracts rejected this redemption in simulation, so PegPath won't let you sign it.",
          detail: reason,
        }
      );
    }

    if (error.walk((e) => e instanceof HttpRequestError || e instanceof TimeoutError)) {
      return {
        code: "rpc-unavailable",
        title: "Quote unavailable",
        body: "PegPath couldn't reach the Mezo testnet RPC. Nothing from a previous check is being shown as current.",
        detail: error.shortMessage,
      };
    }

    const fromDetails = fromRevertReason(error.details ?? "") ?? fromRevertReason(error.shortMessage);
    if (fromDetails) return fromDetails;

    if (isUserRejectionCode(error)) {
      return toUserMessage(new UserRejectedRequestError(error));
    }

    return { code: "unknown", title: "Something went wrong", body: error.shortMessage, detail: error.details };
  }

  const message = error instanceof Error ? error.message : String(error);
  return { code: "unknown", title: "Something went wrong", body: message };
}

function isUserRejectionCode(error: BaseError): boolean {
  return Boolean(error.walk((e) => typeof e === "object" && e !== null && "code" in e && e.code === 4001));
}

function titleFor(code: PegPathErrorCode): string {
  switch (code) {
    case "rpc-unavailable":
      return "Quote unavailable";
    case "rpc-wrong-chain":
      return "RPC is not Mezo Testnet";
    case "deployment-mismatch":
      return "Mezo contracts don't match the verified deployment";
    case "oracle-stale":
      return "Price oracle is stale";
    case "oracle-invalid":
      return "Price oracle returned an invalid price";
    case "tcr-below-mcr":
      return "Redemptions are paused by the protocol";
    case "no-redeemable-troves":
      return "Nothing redeemable at this amount";
    case "hint-mismatch":
      return "Redemption hints disagree with trove state";
    case "price-sensitive":
      return "BTC price moved since the hints were computed";
    case "simulation-reverted":
      return "The call would revert";
    case "fee-unavailable":
      return "Redemption fee couldn't be determined";
    case "insufficient-musd":
      return "Not enough MUSD";
    case "insufficient-gas":
      return "Not enough testnet BTC for gas";
    case "wallet-rejected":
      return "You rejected the request in your wallet";
    case "wallet-wrong-chain":
      return "Wallet is on a different network";
    case "wallet-unavailable":
      return "Wallet unavailable";
    case "tx-reverted":
      return "Transaction reverted";
    case "tx-timeout":
      return "Still waiting for confirmation";
    case "unknown":
      return "Something went wrong";
  }
}
