import { describe, expect, it } from "vitest";
import { createPublicClient, http, type Address, type PublicClient } from "viem";
import { mezoTestnet } from "@/lib/chain/mezoTestnet";
import { buildHints, planAgainstChain } from "@/lib/redemption/buildHints";
import { fetchRedemptionReceipt } from "@/lib/redemption/decodeReceipt";
import { getQuote } from "@/lib/redemption/quote";
import { readProtocolSnapshot, readWalletSnapshot } from "@/lib/redemption/readPreflight";
import { simulateRedemption, toRedeemArgs } from "@/lib/redemption/simulate";
import { verifyDeployment } from "@/lib/redemption/verifyDeployment";

// Hits the real Mezo testnet. No fixtures. Run with `pnpm test:integration`.
const client = createPublicClient({ chain: mezoTestnet, transport: http(undefined, { retryCount: 3 }) }) as PublicClient;

// An EOA holding testnet MUSD (top holder list on explorer.test.mezo.org). Used only as an eth_call `from`.
const HOLDER = "0x401d68969c9afAdeEc0e9fE6B67221247CFa642F" as Address;
const EMPTY = "0x000000000000000000000000000000000000bEEF" as Address;
const E18 = 10n ** 18n;

describe("Mezo testnet (live)", () => {
  it("matches the verified deployment", async () => {
    const check = await verifyDeployment(client);
    expect(check.chainId).toBe(31611);
    expect(check.contracts.every((c) => c.ok)).toBe(true);
  });

  it("reads a consistent protocol snapshot", async () => {
    const s = await readProtocolSnapshot(client);
    console.info(`block ${s.blockNumber} price ${s.price} tcr ${s.tcr} troves ${s.troveCount} rate ${s.redemptionRate}`);
    expect(s.price).toBeGreaterThan(0n);
    expect(s.mcr).toBe((11n * E18) / 10n);
    expect(s.minNetDebt).toBe(1800n * E18);
    expect(s.gasCompensation).toBe(200n * E18);
  });

  it("plans, hints and simulates a 10 MUSD redemption from a real holder at the quote block", async () => {
    const snapshot = await readProtocolSnapshot(client);
    const { plan, troves } = await planAgainstChain(client, 10n * E18, snapshot);
    expect(plan.expectedRedeemed).toBe(10n * E18);

    const { hints, window } = await buildHints(client, plan, troves, snapshot);
    console.info(`window ${window?.lower}..${window?.upper} tolerance up ${window?.toleranceUpPpm}ppm down ${window?.toleranceDownPpm}ppm`);
    // Pinned to the quote block; gas estimation runs at `latest`, where the oracle has usually moved.
    await expect(
      simulateRedemption(client, HOLDER, toRedeemArgs(plan.amountToSubmit, hints, plan.iterations), {
        blockNumber: snapshot.blockNumber,
        estimateGas: false,
      }),
    ).resolves.toBeDefined();
  });

  it("caps 1,000 MUSD to what TroveManager will execute, where HintHelpers alone would revert", async () => {
    const result = await getQuote(client, { amountWei: 1000n * E18, wallet: HOLDER });
    expect(result.kind).toBe("blocked");
    if (result.kind !== "blocked") return;
    console.info(`suggested ${result.suggestedAmountWei} truncation ${result.plan?.truncation}`);
    expect(result.suggestedAmountWei).not.toBeNull();
    expect(result.suggestedAmountWei!).toBeLessThan(1000n * E18);

    // The capped amount is real but price-sensitive (~212 MUSD partial), so it should come back
    // either ready (oracle didn't move) or blocked as price-sensitive, never as a hint mismatch.
    const accepted = await getQuote(client, { amountWei: result.suggestedAmountWei!, wallet: HOLDER });
    if (accepted.kind === "blocked") expect(accepted.reason.code).toBe("price-sensitive");
  });

  it("produces a ready, robust quote end to end for a small amount", async () => {
    const result = await getQuote(client, { amountWei: E18 / 20n, wallet: HOLDER });
    if (result.kind === "blocked") console.error(result.reason);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    console.info(`timings ${JSON.stringify(result.timings)} netBtc ${result.quote.estimatedNetBtcWei} reliability ${JSON.stringify(result.quote.reliability, (_, v) => (typeof v === "bigint" ? v.toString() : v))} oracle ${JSON.stringify(result.quote.oracleMovement, (_, v) => (typeof v === "bigint" ? v.toString() : v))}`);
    expect(result.quote.estimatedNetBtcWei).toBeGreaterThan(0n);
    expect(result.quote.reliability.kind).toBe("robust");
  });

  it("flags 10 MUSD as price-sensitive and offers a reliable amount", async () => {
    const result = await getQuote(client, { amountWei: 10n * E18, wallet: HOLDER });
    const reliability = result.kind === "ready" ? result.quote.reliability : result.kind === "blocked" ? result.reliability : null;
    console.info(`kind ${result.kind} ${result.kind === "blocked" ? result.reason.title : ""} suggested ${result.kind === "blocked" ? result.suggestedAmountWei : "-"}`);
    expect(reliability?.kind).toBe("fragile");
    if (reliability?.kind === "fragile") expect(reliability.reliableAmountWei).not.toBeNull();
  });

  it("blocks a wallet with no MUSD before simulating", async () => {
    const wallet = await readWalletSnapshot(client, EMPTY);
    expect(wallet.musdBalance).toBe(0n);
    const result = await getQuote(client, { amountWei: E18, wallet: EMPTY });
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") expect(result.reason.code).toBe("insufficient-musd");
  });

  it("re-derives a real historical receipt from chain data", async () => {
    const receipt = await fetchRedemptionReceipt(client, "0xa7362c536834267e4f7372dc9716afe833210237386fcff684ca040179c5fbc7");
    expect(receipt.status).toBe("confirmed-verified");
    expect(receipt.redemption?.netBtcToRedeemer).toBe(1_759_600_353_478n);
  });

  it("re-derives a real reverted redemption with its replayed reason", async () => {
    const receipt = await fetchRedemptionReceipt(client, "0xc97e93acae8a11c0dff3bc81046045a210569b0d04c51a983386d040e2d2866b");
    console.info(`revert: ${receipt.revertReason} notes: ${receipt.verificationNotes.join(" | ")}`);
    expect(receipt.status).toBe("reverted");
  });
});

describe("PegPathRedeemer on Mezo Testnet (live, 26 Oct 2026)", () => {
  const REDEEMER = "0x126088EaE43E0c0d4c4AE5D6111d4B0223284164" as Address;

  it.each([
    ["0x3127f8288a249eb89b7b03b55573128d23469531f7654f38f0b410171cb2c4ed", 5n * 10n ** 16n],
    ["0x8f2b3d8d97c1ddd7d7b5dc172f7c1abf3d1bec7205edaa49eaee80ea45afbb78", 10n ** 16n],
  ] as const)("verifies router redemption %s", async (hash, amount) => {
    const { fetchRedemptionReceipt: fetchWith } = await import("@/lib/redemption/decodeReceipt");
    const r = await fetchWith(client, hash);
    console.info(hash, r.status, JSON.stringify(r.redemption, (_, v) => (typeof v === "bigint" ? v.toString() : v)), r.verificationNotes.join(" | "));
    expect(r.to?.toLowerCase()).toBe(REDEEMER.toLowerCase());
    expect(r.status).toBe("confirmed-verified");
    expect(r.redemption?.actualAmount).toBe(amount);
  });

  it("records the reverted 0.1 MUSD attempt that HintHelpers over-approved", async () => {
    const r = await fetchRedemptionReceipt(client, "0x87974f4d9a9e3aa9ac38c39cc60483c415881305c1e24208828df0b28ef62aec");
    expect(r.status).toBe("reverted");
  });
});
