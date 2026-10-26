import type { Metadata } from "next";
import { RedeemWorkbench } from "@/components/RedeemWorkbench";

export const metadata: Metadata = { title: "Redeem" };

export default function RedeemPage() {
  return <RedeemWorkbench />;
}
