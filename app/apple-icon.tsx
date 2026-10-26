import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#1a2230" }}>
        <svg width="180" height="180" viewBox="0 0 32 32">
          <circle cx="8" cy="10.5" r="3.25" fill="#6fb3d2" />
          <path d="M11 10.5h5c4 0 4 11 8 11" fill="none" stroke="#eef1f4" strokeWidth="2.25" strokeLinecap="round" />
          <circle cx="25.5" cy="21.5" r="3.25" fill="#e2a24a" />
        </svg>
      </div>
    ),
    size,
  );
}
