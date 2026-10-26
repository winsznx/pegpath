import type { Metadata } from "next";
import { ReceiptsIndex } from "@/components/ReceiptsIndex";

export const metadata: Metadata = { title: "Receipts" };

export default function ReceiptsPage() {
  return <ReceiptsIndex />;
}
