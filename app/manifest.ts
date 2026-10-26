import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PegPath",
    short_name: "PegPath",
    description: SITE_DESCRIPTION,
    start_url: "/redeem",
    display: "standalone",
    background_color: "#eef1f4",
    theme_color: "#1a2230",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
