export type PublicProductPathwaySurface = "home" | "shop" | "product" | "cart" | "checkout";

export type PublicProductPathwayReceiptGateInput = {
  surface: PublicProductPathwaySurface;
  productVisible?: boolean;
  fitGuideVisible?: boolean;
  materialVisible?: boolean;
  deliveryReturnVisible?: boolean;
  checkoutReady?: boolean;
  waitlistReady?: boolean;
  walletRequired?: boolean;
  operatorNoiseItems?: number;
  copyBlocksVisible?: number;
  mexcFreshnessSeconds?: number;
  dppTraceabilityScore?: number;
  scarcityPressure?: number;
};

export type PublicProductPathwayReceiptGate = {
  passId: "PASS322";
  surface: PublicProductPathwaySurface;
  uiInnovation: "product_pathway_receipt";
  pathwayMode: "quiet_showroom" | "fit_guided" | "receipt_waitlist" | "checkout_receipt" | "operator_silence";
  clarityScore: number;
  headline: string;
  customerLine: string;
  receiptSteps: string[];
  hiddenInternals: string[];
  antiFomoBoundary: string;
  nextAction: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function buildPublicProductPathwayReceiptGate(input: PublicProductPathwayReceiptGateInput): PublicProductPathwayReceiptGate {
  const traceability = clamp(input.dppTraceabilityScore ?? 64);
  const freshness = input.mexcFreshnessSeconds ?? 420;
  const operatorNoise = Math.min(32, Math.max(0, input.operatorNoiseItems ?? 0) * 8);
  const copyDensityPenalty = Math.min(18, Math.max(0, (input.copyBlocksVisible ?? 1) - 1) * 4);
  const walletPenalty = input.walletRequired ? 22 : 0;
  const scarcityPenalty = Math.min(22, Math.max(0, input.scarcityPressure ?? 0));
  const freshnessPenalty = freshness < 90 ? 18 : freshness < 240 ? 8 : 0;
  const productBonus = input.productVisible ? 10 : 0;
  const fitBonus = input.fitGuideVisible ? 12 : 0;
  const materialBonus = input.materialVisible ? 10 : 0;
  const deliveryBonus = input.deliveryReturnVisible ? 12 : 0;
  const checkoutBonus = input.checkoutReady ? 14 : 0;
  const waitlistBonus = input.waitlistReady ? 6 : 0;

  const clarityScore = clamp(
    44 + traceability * 0.16 + productBonus + fitBonus + materialBonus + deliveryBonus + checkoutBonus + waitlistBonus - operatorNoise - copyDensityPenalty - walletPenalty - scarcityPenalty - freshnessPenalty,
  );

  const pathwayMode: PublicProductPathwayReceiptGate["pathwayMode"] =
    operatorNoise > 16 || walletPenalty > 0 ? "operator_silence" :
    input.checkoutReady && input.deliveryReturnVisible && input.fitGuideVisible && clarityScore >= 80 ? "checkout_receipt" :
    input.deliveryReturnVisible && (input.waitlistReady || !input.checkoutReady) ? "receipt_waitlist" :
    input.fitGuideVisible || input.materialVisible ? "fit_guided" :
    "quiet_showroom";

  const headline = pathwayMode === "checkout_receipt"
    ? "A clear product receipt before checkout."
    : pathwayMode === "operator_silence"
      ? "Keep the customer path clean; move proof noise backstage."
      : pathwayMode === "receipt_waitlist"
        ? "A quiet receipt path before the drop opens."
        : pathwayMode === "fit_guided"
          ? "Fit, fabric and delivery lead the decision."
          : "Browse the showroom without control-room noise.";

  const customerLine = pathwayMode === "checkout_receipt"
    ? "Fit, material, delivery and returns are visible before payment."
    : pathwayMode === "operator_silence"
      ? "Internal scores, pass logs and provider details stay out of the public journey."
      : pathwayMode === "receipt_waitlist"
        ? "Choose the garment, check fit and delivery, then join the quiet drop list."
        : pathwayMode === "fit_guided"
          ? "Start with fit and material; checkout waits for proof."
          : "The store stays product-first and calm.";

  const receiptSteps = [
    input.productVisible ? "garment selected" : "garment preview",
    input.fitGuideVisible ? "fit guide visible" : "fit guide next",
    input.materialVisible ? "material clear" : "material confirmation next",
    input.deliveryReturnVisible ? "delivery + returns visible" : "delivery before payment",
    input.checkoutReady ? "checkout receipt ready" : "quiet waitlist",
  ];

  return {
    passId: "PASS322",
    surface: input.surface,
    uiInnovation: "product_pathway_receipt",
    pathwayMode,
    clarityScore,
    headline,
    customerLine,
    receiptSteps,
    hiddenInternals: [
      "PASS build markers",
      "raw proof scores",
      "MEXC-style live expiry internals",
      "reserve/provenance operator snapshots",
      "provider/source audit noise",
    ],
    antiFomoBoundary: "Scarcity is allowed only as calm access status: no countdown, no fake stock panic, no wallet pressure, no buy/sell command and no investment-style urgency.",
    nextAction: pathwayMode === "checkout_receipt"
      ? "allow checkout only with product receipt, delivery and return proof"
      : pathwayMode === "operator_silence"
        ? "remove operator noise and consolidate public proof into one short receipt"
        : "keep the public page focused on product, fit, delivery and a quiet waitlist",
  };
}
