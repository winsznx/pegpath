import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { largestReliableLot, partialWindow, RELIABLE_TOLERANCE_PPM, tolerancePpm } from "@/lib/redemption/partialWindow";
import type { TroveSnapshot } from "@/lib/redemption/planRedemption";

const E18 = 10n ** 18n;
// Tail trove 0xDA04…AaAa as read from Mezo testnet on 2026-10-21 (coll, principal, accrued interest).
const trove: TroveSnapshot = {
  owner: "0xDA04759E54728B6636Fe48F7c9795c7B609bAaAa" as Address,
  coll: 29_938_000_000_000_000n,
  principal: 2_201_989_990_000_000_000_000n,
  interest: 10_064_887_511_566_082_174n,
  icr: 1_120_235_273_412_832_981n,
};
const price = 82_841_902_700_000_000_000_000n;
const rateBps = 100n;

describe("partialWindow", () => {
  it("puts the lower edge exactly where HintHelpers does (coll after lot, principal untouched while lot < interest)", () => {
    const w = partialWindow(trove, 10n * E18, price, rateBps);
    const newColl = trove.coll - (10n * E18 * E18) / price;
    expect(w.lower).toBe((newColl * 10n ** 20n) / trove.principal);
    expect(w.upper).toBeGreaterThan(w.lower);
    expect(w.hint).toBe((w.lower + w.upper) / 2n);
  });

  it("reduces principal once the lot exceeds accrued interest", () => {
    const lot = 100n * E18;
    const w = partialWindow(trove, lot, price, rateBps);
    const newColl = trove.coll - (lot * E18) / price;
    const newPrincipal = trove.principal - (lot - trove.interest);
    expect(w.lower).toBe((newColl * 10n ** 20n) / newPrincipal);
  });

  it("gives a 10 MUSD partial only ~23 ppm of price tolerance (live observation)", () => {
    const t = tolerancePpm(partialWindow(trove, 10n * E18, price, rateBps));
    expect(t).toBeGreaterThanOrEqual(20n);
    expect(t).toBeLessThanOrEqual(26n);
  });

  it("gives smaller lots proportionally more tolerance", () => {
    const small = tolerancePpm(partialWindow(trove, E18 / 20n, price, rateBps));
    const big = tolerancePpm(partialWindow(trove, E18, price, rateBps));
    expect(small).toBeGreaterThan(big * 15n);
  });

  it("finds the largest lot meeting the reliability target", () => {
    const lot = largestReliableLot(trove, 10n * E18, price, rateBps);
    expect(lot).toBeGreaterThan(0n);
    expect(lot).toBeLessThan(E18);
    expect(tolerancePpm(partialWindow(trove, lot, price, rateBps))).toBeGreaterThanOrEqual(RELIABLE_TOLERANCE_PPM);
  });

  it("returns the requested lot unchanged when it is already reliable", () => {
    expect(largestReliableLot(trove, E18 / 100n, price, rateBps)).toBe(E18 / 100n);
  });
});
