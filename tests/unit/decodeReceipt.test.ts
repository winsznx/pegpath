import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Hex, Transaction } from "viem";
import { reconcileReceipt, type ReceiptSource } from "@/lib/redemption/decodeReceipt";

// Real Mezo testnet transactions captured 2026-10-21 (see _source in the fixture).
const fixture = JSON.parse(readFileSync(new URL("../fixtures/testnet-redemptions.json", import.meta.url), "utf8"), (_, v) =>
  typeof v === "string" && v.startsWith("bigint:") ? BigInt(v.slice(7)) : v,
) as Record<
  string,
  {
    tx: Pick<Transaction, "hash" | "from" | "to" | "input" | "chainId">;
    receipt: ReceiptSource;
    blockTimestamp: bigint;
  }
>;

const SUCCESS = "0xa7362c536834267e4f7372dc9716afe833210237386fcff684ca040179c5fbc7" as Hex;
const REVERTED = "0xc97e93acae8a11c0dff3bc81046045a210569b0d04c51a983386d040e2d2866b" as Hex;

describe("reconcileReceipt on real testnet transactions", () => {
  it("verifies a successful redemption and derives net BTC from the event", () => {
    const { tx, receipt, blockTimestamp } = fixture[SUCCESS];
    const result = reconcileReceipt(tx, receipt, blockTimestamp);

    expect(result.status).toBe("confirmed-verified");
    expect(result.requestedAmount).toBe(134_565_604_251_868_004n);
    expect(result.redemption).toMatchObject({
      attemptedAmount: 134_565_604_251_868_004n,
      actualAmount: 134_565_604_251_868_004n,
      collateralSent: 1_772_897_081_589n,
      collateralFee: 13_296_728_111n,
      netBtcToRedeemer: 1_759_600_353_478n,
      trovesTouched: 1,
    });
    expect(result.musdBurned).toBe(134_565_604_251_868_004n);
    expect(result.gasCostBtcWei).toBe(397_389n * 146n);
  });

  it("matches the redeemer's observed BTC balance delta (gross minus fee minus gas)", () => {
    // Native balance of 0x18B0…248D at blocks 15566830 and 15566831, read from the RPC.
    const before = 9_666_777_302_714_459n;
    const after = 9_668_536_845_049_143n;
    const { tx, receipt, blockTimestamp } = fixture[SUCCESS];
    const result = reconcileReceipt(tx, receipt, blockTimestamp);

    expect(result.redemption!.netBtcToRedeemer - result.gasCostBtcWei!).toBe(after - before);
  });

  it("reports a reverted redemption without inventing amounts", () => {
    const { tx, receipt, blockTimestamp } = fixture[REVERTED];
    const result = reconcileReceipt(tx, receipt, blockTimestamp);

    expect(result.status).toBe("reverted");
    expect(result.redemption).toBeNull();
    expect(result.requestedAmount).not.toBeNull();
  });

  it("refuses to verify a transaction sent somewhere other than TroveManager", () => {
    const { tx, receipt, blockTimestamp } = fixture[SUCCESS];
    const result = reconcileReceipt({ ...tx, to: "0x0000000000000000000000000000000000000001" }, receipt, blockTimestamp);

    expect(result.status).toBe("not-a-redemption");
  });

  it("refuses a transaction from another chain", () => {
    const { tx, receipt, blockTimestamp } = fixture[SUCCESS];
    const result = reconcileReceipt({ ...tx, chainId: 31612 }, receipt, blockTimestamp);

    expect(result.status).toBe("not-a-redemption");
  });

  it("downgrades to confirmed-unverified when the Redemption event is missing", () => {
    const { tx, receipt, blockTimestamp } = fixture[SUCCESS];
    const withoutEvent = {
      ...receipt,
      logs: receipt.logs.filter(
        (l) => l.topics[0] !== "0x43a3f4082a4dbc33d78e317d2497d3a730bc7fc3574159dcea1056e62e5d9ad8",
      ),
    };
    const result = reconcileReceipt(tx, withoutEvent, blockTimestamp);

    expect(result.status).toBe("confirmed-unverified");
    expect(result.redemption).toBeNull();
  });

  it("downgrades when the MUSD burn doesn't match the event", () => {
    const { tx, receipt, blockTimestamp } = fixture[SUCCESS];
    const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const withoutBurn = { ...receipt, logs: receipt.logs.filter((l) => l.topics[0] !== transferTopic) };
    const result = reconcileReceipt(tx, withoutBurn, blockTimestamp);

    expect(result.status).toBe("confirmed-unverified");
  });
});
