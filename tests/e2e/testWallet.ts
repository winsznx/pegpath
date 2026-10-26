import type { Page } from "@playwright/test";

/**
 * A minimal EIP-1193 provider for browser tests. Reads go to the real Mezo testnet RPC; any signing
 * request is rejected with code 4001, exactly as a person pressing "Reject" would. It never holds a
 * key, so it cannot send a transaction.
 */
export async function installTestWallet(page: Page, options: { address: string; chainId: number }) {
  await page.addInitScript(({ address, chainId }) => {
    const listeners: Record<string, Array<(arg: unknown) => void>> = {};
    let currentChain = chainId;
    const emit = (event: string, arg: unknown) => (listeners[event] ?? []).forEach((fn) => fn(arg));
    const reject = (message: string) => Object.assign(new Error(message), { code: 4001 });
    const provider = {
      isMetaMask: false,
      on: (event: string, fn: (arg: unknown) => void) => ((listeners[event] ??= []).push(fn), provider),
      removeListener: (event: string, fn: (arg: unknown) => void) => {
        listeners[event] = (listeners[event] ?? []).filter((f) => f !== fn);
        return provider;
      },
      async request({ method, params }: { method: string; params?: unknown[] }) {
        switch (method) {
          case "eth_requestAccounts":
          case "eth_accounts":
            return [address];
          case "eth_chainId":
            return `0x${currentChain.toString(16)}`;
          case "wallet_switchEthereumChain": {
            const target = parseInt((params?.[0] as { chainId: string }).chainId, 16);
            currentChain = target;
            emit("chainChanged", `0x${target.toString(16)}`);
            return null;
          }
          case "wallet_addEthereumChain":
            return null;
          case "wallet_requestPermissions":
          case "wallet_getPermissions":
            return [{ parentCapability: "eth_accounts" }];
          case "eth_sendTransaction":
          case "eth_signTransaction":
          case "personal_sign":
          case "eth_signTypedData_v4":
            (window as unknown as { __signRequests: unknown[] }).__signRequests.push({ method, params });
            throw reject("User rejected the request.");
          default: {
            const res = await fetch("https://rpc.test.mezo.org", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? [] }),
            });
            const body = await res.json();
            if (body.error) throw Object.assign(new Error(body.error.message), body.error);
            return body.result;
          }
        }
      },
    };
    (window as unknown as { __signRequests: unknown[] }).__signRequests = [];
    (window as unknown as { ethereum: unknown }).ethereum = provider;
  }, options);
}

/** Opens Mezo Passport's RainbowKit modal and picks the injected EVM wallet. */
export async function connect(page: Page) {
  const connectButton = page.getByRole("button", { name: "Connect wallet" }).first();
  const alreadyConnected = page.getByRole("button", { name: /Connected\. Open account menu|Switch to Mezo Testnet/ });
  await connectButton.or(alreadyConnected).first().waitFor();
  if (await alreadyConnected.isVisible()) return;
  await connectButton.click();
  await page.getByRole("dialog").getByRole("button", { name: /Browser Wallet|Injected/i }).click();
}
