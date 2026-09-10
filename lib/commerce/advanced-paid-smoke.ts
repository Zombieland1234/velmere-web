import { listVlmPaidProducts } from "@/lib/commerce/vlm-paid-access";
import { buildVlmAdvancedOnlyPolicySummary } from "@/lib/commerce/vlm-advanced-only-access-policy";
import { currentSkuTruthSnapshot } from "@/lib/commerce/vlm-current-sku-truth";

export const PASS2230_ADVANCED_PAID_SMOKE_ID =
  "pass2230-current-sku-stop-sell-smoke" as const;

type SmokeStatus = "PASS" | "WARN" | "FAIL";
type SmokeRow = { id: string; status: SmokeStatus; releaseImpact: "blocker" | "runtime_receipt" | "info"; proof: string };

export function buildPass2230AdvancedPaidSmoke() {
  const policy = buildVlmAdvancedOnlyPolicySummary("en");
  const truth = currentSkuTruthSnapshot("en");
  const products = listVlmPaidProducts("en");
  const proProducts = products.filter((product) => product.id.startsWith("vlm_pro_"));
  const advancedProducts = products.filter((product) => product.id.startsWith("vlm_advanced_"));
  const rows: SmokeRow[] = [
    {
      id: "single_current_sku_truth",
      status: policy.actualPolicy === "basic_free_limited_prescreen__pro_invitation_only_beta__advanced_not_for_sale" ? "PASS" : "FAIL",
      releaseImpact: "blocker",
      proof: "Basic is free limited prescreen; Pro is invitation-only beta; Advanced is not for sale.",
    },
    {
      id: "public_checkout_disabled_all_non_basic",
      status: products.every((product) => product.publicCheckoutAllowed === false && product.amount === 0) ? "PASS" : "FAIL",
      releaseImpact: "blocker",
      proof: "No customer-visible Pro or Advanced product may expose public checkout or a price.",
    },
    {
      id: "pro_invitation_only",
      status: proProducts.length === 3 && proProducts.every((product) => product.customerDecision === "INVITATION_ONLY_CONTROLLED_BETA") ? "PASS" : "FAIL",
      releaseImpact: "blocker",
      proof: "All Pro surfaces inherit the same invitation-only controlled-beta decision.",
    },
    {
      id: "advanced_not_for_sale",
      status: advancedProducts.length === 3 && advancedProducts.every((product) => product.customerDecision === "NOT_FOR_SALE") ? "PASS" : "FAIL",
      releaseImpact: "blocker",
      proof: "All Advanced surfaces inherit NOT_FOR_SALE and cannot be promoted by legacy checkout metadata.",
    },
    {
      id: "human_review_claim_disabled",
      status: truth.tiers.advanced.humanReviewIncluded === false && truth.tiers.pro.humanReviewIncluded === false ? "PASS" : "FAIL",
      releaseImpact: "blocker",
      proof: "No current SKU includes human review, operator sign-off, or independent certification.",
    },
    {
      id: "customer_confidence_not_calibrated",
      status: [truth.tiers.basic, truth.tiers.pro, truth.tiers.advanced].every((tier) => tier.customerFindingConfidence === "NOT_CALIBRATED") ? "PASS" : "FAIL",
      releaseImpact: "blocker",
      proof: "Tier price or availability never increases finding confidence.",
    },
    {
      id: "global_stop_sell",
      status: truth.saleEnabled === false && truth.live === false && truth.productionApproved === false && truth.worldClassProven === false ? "PASS" : "FAIL",
      releaseImpact: "blocker",
      proof: "The current SKU registry is fail-closed globally.",
    },
  ];
  const blockers = rows.filter((row) => row.status === "FAIL");
  return {
    schemaVersion: PASS2230_ADVANCED_PAID_SMOKE_ID,
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "FAIL" : "PASS",
    releaseRule: "Do not expose price, checkout, paid CTA, human-review claim, or public Advanced access until a future signed SKU decision replaces this registry.",
    rows,
    blockers: blockers.map((row) => row.id),
  };
}
