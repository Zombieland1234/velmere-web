"use client";

import WalletSafetyExplainer from "@/components/vlm/WalletSafetyExplainer";

export default function WalletBoundaryExplainer({
  variant = "compact",
}: {
  variant?: "compact" | "full";
}) {
  return <WalletSafetyExplainer variant={variant} />;
}
