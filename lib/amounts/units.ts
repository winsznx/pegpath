export const TOKEN_DECIMALS = 18;
const SCALE = 10n ** BigInt(TOKEN_DECIMALS);

/** uint256 max, the hard ceiling for any on-chain amount. */
const UINT256_MAX = (1n << 256n) - 1n;

export type ParseAmountResult =
  | { ok: true; wei: bigint }
  | { ok: false; reason: "empty" | "format" | "zero" | "decimals" | "overflow" };

const DECIMAL_PATTERN = /^(\d+)(?:\.(\d*))?$|^\.(\d+)$/;

/**
 * Strict decimal parser for user-entered token amounts. Rejects negatives, exponents, separators,
 * NaN and anything with more than 18 fractional digits instead of rounding it.
 */
export function parseTokenAmount(input: string): ParseAmountResult {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, reason: "empty" };

  const match = DECIMAL_PATTERN.exec(trimmed);
  if (!match) return { ok: false, reason: "format" };

  const whole = match[1] ?? "0";
  const fraction = match[2] ?? match[3] ?? "";
  if (fraction.length > TOKEN_DECIMALS) return { ok: false, reason: "decimals" };

  const wei = BigInt(whole) * SCALE + BigInt(fraction.padEnd(TOKEN_DECIMALS, "0") || "0");
  if (wei > UINT256_MAX) return { ok: false, reason: "overflow" };
  if (wei === 0n) return { ok: false, reason: "zero" };
  return { ok: true, wei };
}

export const PARSE_ERROR_TEXT: Record<Exclude<ParseAmountResult, { ok: true }>["reason"], string> = {
  empty: "Enter an amount of MUSD.",
  format: "Use digits and an optional decimal point, like 25 or 12.5.",
  zero: "Amount must be greater than zero.",
  decimals: "MUSD supports at most 18 decimal places.",
  overflow: "That amount is larger than any possible token balance.",
};

/** Exact decimal string with trailing zeros removed. Never uses floating point. */
export function formatUnitsExact(wei: bigint, decimals = TOKEN_DECIMALS): string {
  const negative = wei < 0n;
  const abs = negative ? -wei : wei;
  const scale = 10n ** BigInt(decimals);
  const whole = abs / scale;
  const fraction = (abs % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}${fraction ? `.${fraction}` : ""}`;
}

function groupThousands(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Truncates (never rounds up) to `maxDecimals`. If a nonzero amount would display as zero, shows
 * "< 0.00…1" instead so a small amount is never presented as nothing.
 */
export function formatDisplay(wei: bigint, maxDecimals: number, decimals = TOKEN_DECIMALS): string {
  const negative = wei < 0n;
  const abs = negative ? -wei : wei;
  const scale = 10n ** BigInt(decimals);
  const whole = abs / scale;
  const fractionFull = (abs % scale).toString().padStart(decimals, "0");
  const fraction = fractionFull.slice(0, maxDecimals).replace(/0+$/, "");

  if (abs !== 0n && whole === 0n && fraction === "") {
    return `${negative ? "> -" : "< "}0.${"0".repeat(Math.max(0, maxDecimals - 1))}1`;
  }
  return `${negative ? "-" : ""}${groupThousands(whole.toString())}${fraction ? `.${fraction}` : ""}`;
}

export const formatMusd = (wei: bigint) => formatDisplay(wei, 4);
export const formatBtc = (wei: bigint) => formatDisplay(wei, 8);

/** Prices from Mezo's PriceFeed are USD per BTC with 18 decimals. */
export const formatUsdPrice = (raw: bigint) => formatDisplay(raw, 2);

/** 1e18-scaled ratio (TCR, ICR) to a percentage string. */
export function formatRatioPercent(ratio: bigint, decimals = 2): string {
  return `${formatDisplay(ratio * 100n, decimals)}%`;
}

/** Parts-per-million to a percentage with enough precision to stay nonzero, e.g. 23 → "0.0023%". */
export function formatPpmPercent(ppm: bigint): string {
  if (ppm === 0n) return "under 0.0001%";
  const decimals = ppm >= 10_000n ? 2 : ppm >= 1_000n ? 3 : 4;
  return `${formatDisplay(ppm, decimals, 4)}%`;
}

/** A symmetric price tolerance, e.g. "±0.0023%", or "under ±0.0001%" when it rounds to nothing. */
export function formatTolerance(ppm: bigint): string {
  return ppm === 0n ? "under ±0.0001%" : `±${formatPpmPercent(ppm)}`;
}
