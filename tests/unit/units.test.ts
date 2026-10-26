import { describe, expect, it } from "vitest";
import { formatBtc, formatMusd, formatPpmPercent, formatRatioPercent, formatUnitsExact, parseTokenAmount } from "@/lib/amounts/units";

describe("parseTokenAmount", () => {
  it.each([
    ["1", 10n ** 18n],
    ["0.5", 5n * 10n ** 17n],
    [".25", 25n * 10n ** 16n],
    ["12.", 12n * 10n ** 18n],
    ["  7  ", 7n * 10n ** 18n],
    ["0.000000000000000001", 1n],
  ])("accepts %s", (input, wei) => {
    expect(parseTokenAmount(input)).toEqual({ ok: true, wei });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["0", "zero"],
    ["0.000", "zero"],
    ["-1", "format"],
    ["1e3", "format"],
    ["NaN", "format"],
    ["1,000", "format"],
    ["0x10", "format"],
    ["1.2.3", "format"],
    ["Infinity", "format"],
    ["0.0000000000000000001", "decimals"],
    ["1".padEnd(80, "0"), "overflow"],
  ])("rejects %j as %s", (input, reason) => {
    expect(parseTokenAmount(input)).toEqual({ ok: false, reason });
  });
});

describe("formatting", () => {
  it("never shows a nonzero BTC amount as zero", () => {
    expect(formatBtc(1n)).toBe("< 0.00000001");
    expect(formatBtc(0n)).toBe("0");
    expect(formatBtc(1_759_600_353_478n)).toBe("0.00000175");
  });

  it("truncates instead of rounding up", () => {
    expect(formatMusd(999_999_999_999_999_999n)).toBe("0.9999");
  });

  it("groups thousands", () => {
    expect(formatMusd(1_234_567n * 10n ** 18n)).toBe("1,234,567");
  });

  it("formats exact decimals", () => {
    expect(formatUnitsExact(134_565_604_251_868_004n)).toBe("0.134565604251868004");
    expect(formatUnitsExact(10n ** 18n)).toBe("1");
  });

  it("formats ratios", () => {
    expect(formatRatioPercent(2_976_461_351_992_261_590n)).toBe("297.64%");
  });
});

describe("formatPpmPercent", () => {
  it.each([
    [23n, "0.0023%"],
    [588n, "0.0588%"],
    [4_694n, "0.469%"],
    [25_000n, "2.5%"],
    [0n, "under 0.0001%"],
  ])("formats %s ppm as %s", (ppm, text) => {
    expect(formatPpmPercent(ppm)).toBe(text);
  });
});
