import { ImageResponse } from "next/og";

export const alt = "PegPath: turn testnet MUSD into BTC and see the outcome before you sign";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#eef1f4", padding: 72, color: "#1a2230" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="64" height="64" viewBox="0 0 28 28">
            <circle cx="5" cy="8" r="3.25" fill="#2d6f8f" />
            <path d="M8 8 H14 C18 8 18 20 22 20" fill="none" stroke="#1a2230" strokeWidth="2.25" strokeLinecap="round" />
            <circle cx="23.5" cy="20" r="3.25" fill="#a86a14" />
          </svg>
          <span style={{ fontSize: 44, fontWeight: 700 }}>PegPath</span>
          <span style={{ fontSize: 24, background: "#f6edd0", color: "#8a6200", padding: "6px 16px", borderRadius: 999 }}>Mezo Testnet</span>
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>Turn testnet MUSD into BTC. See the outcome before you sign.</div>
        <div style={{ fontSize: 28, color: "#4a5566" }}>Live reads, exact simulation, receipts rebuilt from chain data.</div>
      </div>
    ),
    size,
  );
}
