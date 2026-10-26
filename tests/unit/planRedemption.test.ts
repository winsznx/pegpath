import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import {
  AMOUNT_GRID_WEI,
  collateralFee,
  FULL_CLOSE_MARGIN_WEI,
  planRedemption,
  type TroveSnapshot,
} from "@/lib/redemption/planRedemption";

const E18 = 10n ** 18n;
const musd = (n: number) => BigInt(Math.round(n * 1e6)) * 10n ** 12n;

// Values shaped like the Mezo testnet tail on 2026-10-21: 200 MUSD gas compensation, 1,800 min net debt.
const params = { price: 82_841n * E18, mcr: (11n * E18) / 10n, minNetDebt: musd(1800), gasCompensation: musd(200) };

function trove(owner: string, totalDebt: number, icrPct = 115): TroveSnapshot {
  return {
    owner: owner.padEnd(42, "0") as Address,
    coll: 0n,
    principal: musd(totalDebt),
    interest: 0n,
    icr: (BigInt(icrPct) * E18) / 100n,
  };
}

// Net debts: 2,012 / 1,997 / 1,800 / 2,500
const tail = [trove("0xa1", 2212), trove("0xb2", 2197), trove("0xc3", 2000), trove("0xd4", 2700)];

describe("planRedemption", () => {
  it("redeems a small amount in full from the last trove", () => {
    const plan = planRedemption(musd(10), tail, params, 10n);
    expect(plan.amountToSubmit).toBe(musd(10));
    expect(plan.expectedRedeemed).toBe(musd(10));
    expect(plan.truncation).toBe("none");
    expect(plan.partialTrove).toBe(tail[0].owner);
    expect(plan.iterations).toBe(1n);
  });

  it("caps a partial at net debt minus the 1,800 MUSD minimum (the live 1,000 MUSD revert case)", () => {
    const plan = planRedemption(musd(1000), tail, params, 10n);
    expect(plan.expectedRedeemed).toBe(musd(212));
    expect(plan.amountToSubmit).toBe(musd(212));
    expect(plan.truncation).toBe("min-net-debt");
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]).toMatchObject({ kind: "partial", netDebtAfter: musd(1800) });
  });

  it("closes a trove when the amount covers its net debt plus margin, then partially redeems the next", () => {
    const plan = planRedemption(musd(2100), tail, params, 10n);
    expect(plan.steps.map((s) => s.kind)).toEqual(["close", "partial"]);
    expect(plan.expectedRedeemed).toBe(musd(2100));
    expect(plan.amountToSubmit).toBe(musd(2100));
    expect(plan.partialTrove).toBe(tail[1].owner);
    expect(plan.iterations).toBe(2n);
  });

  it("does not treat an exact net-debt amount as a full close", () => {
    const plan = planRedemption(musd(2012), tail, params, 10n);
    expect(plan.steps[0].kind).toBe("partial");
    expect(plan.expectedRedeemed).toBe(musd(212));
  });

  it("adds a grid-snapped margin when the plan ends on a close and the next trove has no capacity", () => {
    const tailAtMinimum = [trove("0xa1", 2212), trove("0xc3", 2000)];
    const plan = planRedemption(musd(3000), tailAtMinimum, params, 10n);
    expect(plan.steps.map((s) => s.kind)).toEqual(["close"]);
    expect(plan.expectedRedeemed).toBe(musd(2012));
    expect(plan.partialTrove).toBeNull();
    expect(plan.amountToSubmit).toBe(musd(2012) + FULL_CLOSE_MARGIN_WEI);
    expect(plan.amountToSubmit % AMOUNT_GRID_WEI).toBe(0n);
    expect(plan.iterations).toBe(2n);
  });

  it("skips undercollateralized troves and counts them toward maxIterations", () => {
    const withBad = [trove("0xee", 2500, 105), ...tail];
    const plan = planRedemption(musd(10), withBad, params, 10n);
    expect(plan.steps[0].kind).toBe("skip-undercollateralized");
    expect(plan.partialTrove).toBe(tail[0].owner);
    expect(plan.iterations).toBe(2n);
  });

  it("stops at maxIterations after closing the troves it may visit", () => {
    const plan = planRedemption(musd(100_000), tail, params, 1n);
    expect(plan.truncation).toBe("max-iterations");
    expect(plan.expectedRedeemed).toBe(musd(2012));
    expect(plan.iterations).toBe(1n);
  });

  it("reports no-more-troves when the list runs out", () => {
    const plan = planRedemption(musd(10), [], params, 10n);
    expect(plan.truncation).toBe("no-more-troves");
    expect(plan.expectedRedeemed).toBe(0n);
    expect(plan.amountToSubmit).toBe(0n);
  });

  it("returns zero when the only trove sits at the minimum debt", () => {
    const plan = planRedemption(musd(50), [trove("0xc3", 2000)], params, 10n);
    expect(plan.expectedRedeemed).toBe(0n);
    expect(plan.truncation).toBe("min-net-debt");
  });

  it("is stable: replanning the suggested amount returns the same signed amount", () => {
    const first = planRedemption(musd(1000), tail, params, 10n);
    const second = planRedemption(first.amountToSubmit, tail, params, 10n);
    expect(second.amountToSubmit).toBe(first.amountToSubmit);
    expect(second.truncation).toBe("none");
  });

  it("computes collateral with integer division per trove, like TroveManager", () => {
    const plan = planRedemption(musd(10), tail, params, 10n);
    expect(plan.expectedCollateralDrawn).toBe((musd(10) * E18) / params.price);
  });
});

describe("collateralFee", () => {
  it("matches BorrowerOperations.getRedemptionRate at 0.75%", () => {
    expect(collateralFee(E18, (E18 * 3n) / 400n)).toBe(7_500_000_000_000_000n);
  });
});
