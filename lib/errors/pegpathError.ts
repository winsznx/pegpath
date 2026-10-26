export type PegPathErrorCode =
  | "rpc-unavailable"
  | "rpc-wrong-chain"
  | "deployment-mismatch"
  | "oracle-stale"
  | "oracle-invalid"
  | "tcr-below-mcr"
  | "no-redeemable-troves"
  | "hint-mismatch"
  | "price-sensitive"
  | "simulation-reverted"
  | "fee-unavailable"
  | "insufficient-musd"
  | "insufficient-gas"
  | "wallet-rejected"
  | "wallet-wrong-chain"
  | "wallet-unavailable"
  | "tx-reverted"
  | "tx-timeout"
  | "unknown";

export class PegPathError extends Error {
  readonly code: PegPathErrorCode;
  readonly detail?: string;

  constructor(code: PegPathErrorCode, message: string, options?: { detail?: string; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = "PegPathError";
    this.code = code;
    this.detail = options?.detail;
  }
}
