import type { Product } from "@/lib/products/types";
import type { CommerceLaunchAudit } from "@/lib/products/launch-readiness";
import type { ProductProviderTruthSnapshot } from "@/lib/launch/provider-truth-ledger";

export const PASS316_PUBLIC_COMMERCE_TRIM_GATE = "PASS316_PUBLIC_COMMERCE_TRIM_GATE" as const;

type PublicCommerceTrimSurface = "shop" | "product" | "clothing";

type BuildPublicCommerceTrimGateInput = {
  surface: PublicCommerceTrimSurface;
  products: Product[];
  launchAudit?: CommerceLaunchAudit;
  productSnapshot?: ProductProviderTruthSnapshot;
};

export type PublicCommerceTrimGate = {
  marker: typeof PASS316_PUBLIC_COMMERCE_TRIM_GATE;
  surface: PublicCommerceTrimSurface;
  customerMode: "clean_storefront" | "preview_product";
  publicCopyRule: "product_first";
  hiddenOperatorPanels: string[];
  customerSignals: string[];
  buyerSummary: string;
  auditBoundary: string;
};

export function buildPublicCommerceTrimGate(input: BuildPublicCommerceTrimGateInput): PublicCommerceTrimGate {
  const previewCount = input.products.filter((product) => product.status !== "active" || product.fulfilmentMode === "disabled").length;
  const score = input.productSnapshot?.score ?? input.launchAudit?.averageScore ?? 0;
  const needsPreviewLanguage = previewCount > 0 || score < 70;

  return {
    marker: PASS316_PUBLIC_COMMERCE_TRIM_GATE,
    surface: input.surface,
    customerMode: input.surface === "product" ? "preview_product" : "clean_storefront",
    publicCopyRule: "product_first",
    hiddenOperatorPanels: [
      "CommerceLaunchControl",
      "ProviderTruthLedgerPanel",
      "ShippingReturnsTruthPanel",
      "raw provider source mode",
      "operator blocker list",
    ],
    customerSignals: needsPreviewLanguage
      ? ["preview drop", "size first", "checkout locked until ready"]
      : ["product live", "size first", "delivery before payment"],
    buyerSummary: needsPreviewLanguage
      ? "Customer sees a calm preview, product facts and why checkout is not open yet. Operator-only readiness debt stays hidden from the buyer surface."
      : "Customer sees the product, material, size, delivery and return path without internal launch-control noise.",
    auditBoundary:
      "PASS316 keeps provider, tax, shipping, webhook and order-state audit data in code/admin guard lanes instead of rendering a long public wall under shop pages.",
  };
}
