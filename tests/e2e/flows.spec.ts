import { expect, test } from "@playwright/test";
import { connect, installTestWallet } from "./testWallet";

// A real EOA holding testnet MUSD. The test wallet only reports this address; it can't sign for it.
const HOLDER = "0x401d68969c9afAdeEc0e9fE6B67221247CFa642F";

test("read-only quote without a wallet shows live chain data", async ({ page }) => {
  await page.goto("/redeem");
  await expect(page.getByText(/Mezo contracts verified against pinned implementations/)).toBeVisible();
  await expect(page.getByText(/Mezo contract data last checked at block/)).toBeVisible();
  await page.getByLabel("MUSD to redeem").fill("0.05");
  await page.getByRole("button", { name: "Check redemption" }).click();
  await expect(page.getByText("Read-only, no wallet")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Redemption path" })).toBeVisible();
  await expect(page.getByText("Connect a testnet wallet to check your balance and simulate")).toBeVisible();
});

test("rejects malformed amounts before any chain call", async ({ page }) => {
  await page.goto("/redeem");
  await page.getByLabel("MUSD to redeem").fill("1e3");
  await page.getByRole("button", { name: "Check redemption" }).click();
  await expect(page.getByText("Use digits and an optional decimal point, like 25 or 12.5.")).toBeVisible();
  await expect(page.getByText("Read-only, no wallet")).toHaveCount(0);
});

test("wrong chain blocks review and offers a switch", async ({ page }) => {
  await installTestWallet(page, { address: HOLDER, chainId: 1 });
  await page.goto("/redeem");
  await connect(page);
  await expect(page.getByRole("button", { name: "Switch to Mezo Testnet" })).toBeVisible();
  await page.getByLabel("MUSD to redeem").fill("0.05");
  await page.getByRole("button", { name: "Check redemption" }).click();
  await expect(page.getByRole("button", { name: "Review redemption" })).toBeDisabled();
  await expect(page.getByText("Switch your wallet to Mezo Testnet to review.")).toBeVisible();

  await page.getByRole("button", { name: "Switch to Mezo Testnet" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Mezo Testnet", exact: true }).click();
  await expect(page.getByRole("button", { name: /Connected\. Open account menu/ })).toBeVisible();
  await expect(page.getByText(/Your wallet's network changed|Refresh before reviewing|Review redemption/).first()).toBeVisible();
});

test("caps an amount the protocol can't fully redeem and never substitutes it silently", async ({ page }) => {
  await installTestWallet(page, { address: HOLDER, chainId: 31611 });
  await page.goto("/redeem");
  await connect(page);
  await page.getByLabel("MUSD to redeem").fill("100000");
  await page.getByRole("button", { name: "Check redemption" }).click();
  await expect(page.getByText("Only part of this amount can be redeemed right now")).toBeVisible();
  await expect(page.getByLabel("MUSD to redeem")).toHaveValue("100000");
  await expect(page.getByRole("button", { name: /Use estimated redeemable amount/ })).toBeVisible();
});

test("simulates, reviews, and handles a wallet rejection without sending", async ({ page }) => {
  await installTestWallet(page, { address: HOLDER, chainId: 31611 });
  await page.goto("/redeem");
  await connect(page);
  await expect(page.getByRole("button", { name: /Connected\. Open account menu/ })).toBeVisible();
  await page.getByLabel("MUSD to redeem").fill("0.05");
  await page.getByRole("button", { name: "Check redemption" }).click();
  await expect(page.getByText("Simulation passed")).toBeVisible();

  await page.getByRole("button", { name: "Review redemption" }).click();
  const drawer = page.getByRole("dialog", { name: "Review redemption" });
  await expect(drawer.getByText("You sign exactly")).toBeVisible();
  await expect(drawer.getByRole("link", { name: /TroveManager/ })).toBeVisible();

  const accept = drawer.getByRole("button", { name: "Accept updated quote" });
  if (await accept.isVisible()) await accept.click();
  await drawer.getByRole("button", { name: "Confirm in wallet" }).click();
  await expect(drawer.getByText("You rejected the request in your wallet")).toBeVisible();

  const signRequests = await page.evaluate(() => (window as unknown as { __signRequests: unknown[] }).__signRequests.length);
  expect(signRequests).toBe(1);
  await expect(page.getByText("Waiting for wallet")).toHaveCount(0);
});

test("receipt page rebuilds a real historical redemption from chain data", async ({ page }) => {
  await page.goto("/receipt/31611/0xa7362c536834267e4f7372dc9716afe833210237386fcff684ca040179c5fbc7");
  await expect(page.getByText("Redemption confirmed")).toBeVisible();
  await expect(page.getByText("0.1345 MUSD").first()).toBeVisible();
  await expect(page.getByText("0.00000175 BTC").first()).toBeVisible();
});

test("receipt page shows a real reverted redemption with its reason", async ({ page }) => {
  await page.goto("/receipt/31611/0xc97e93acae8a11c0dff3bc81046045a210569b0d04c51a983386d040e2d2866b");
  await expect(page.getByText("Transaction reverted")).toBeVisible();
  await expect(page.getByText("TroveManager: Unable to redeem any amount")).toBeVisible();
});

test("receipt page refuses other chains", async ({ page }) => {
  await page.goto("/receipt/1/0xa7362c536834267e4f7372dc9716afe833210237386fcff684ca040179c5fbc7");
  await expect(page.getByRole("heading", { name: "Unsupported network" })).toBeVisible();
});

test("landing page shows live Mezo readings and routes into the app", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Live, block \d+/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /six-argument call/ })).toBeVisible();
  await page.getByRole("link", { name: "Check a redemption" }).first().click();
  await expect(page.getByRole("heading", { name: "Redeem MUSD for BTC" })).toBeVisible();
});

test("onboarding reads the connected account's real balances", async ({ page }) => {
  await installTestWallet(page, { address: HOLDER, chainId: 31611 });
  await page.goto("/start");
  await connect(page);
  await expect(page.getByText(/Balance: .* MUSD/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Open redemption" })).toBeVisible();
});

test("receipts index opens a pasted hash", async ({ page }) => {
  await page.goto("/receipts");
  await page.getByLabel("Transaction hash").fill("0xa7362c536834267e4f7372dc9716afe833210237386fcff684ca040179c5fbc7");
  await page.getByRole("button", { name: "Open receipt" }).click();
  await expect(page.getByText("Redemption confirmed")).toBeVisible();
});

test("unknown routes get a useful 404", async ({ page }) => {
  await page.goto("/nope");
  await expect(page.getByRole("heading", { name: "This page isn't here" })).toBeVisible();
});
