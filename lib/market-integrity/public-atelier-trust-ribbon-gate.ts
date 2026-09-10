export type PublicAtelierTrustSurface = "home" | "shop" | "product" | "checkout" | "cart" | "lens";

export type PublicAtelierTrustRibbonGateInput = {
  surface: PublicAtelierTrustSurface;
  fitProofVisible?: boolean;
  materialProofVisible?: boolean;
  deliveryPromiseReady?: boolean;
  returnRightsVisible?: boolean;
  checkoutReady?: boolean;
  walletRequired?: boolean;
  dppTraceabilityScore?: number;
  sourceFreshnessSeconds?: number;
  scarcityPressure?: number;
  operatorCopyVisible?: boolean;
};

export type PublicAtelierTrustRibbonGate = {
  passId: "PASS320";
  surface: PublicAtelierTrustSurface;
  uiInnovation: "atelier_trust_ribbon";
  ribbonMode: "browse_ribbon" | "fit_ribbon" | "waitlist_ribbon" | "checkout_ribbon" | "operator_hold";
  customerTrustScore: number;
  prestigeStatus: "quiet_atelier" | "proof_waitlist" | "receipt_ready" | "withheld";
  sourceFreshness: "fresh" | "near_expiry" | "expired";
  ribbonSteps: string[];
  customerCopy: string;
  antiFomoBoundary: string;
  hiddenOperatorSignals: string[];
  nextAction: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function buildPublicAtelierTrustRibbonGate(input: PublicAtelierTrustRibbonGateInput): PublicAtelierTrustRibbonGate {
  const traceability = clamp(input.dppTraceabilityScore ?? 58);
  const freshnessSeconds = input.sourceFreshnessSeconds ?? 420;
  const freshnessPenalty = freshnessSeconds < 90 ? 18 : freshnessSeconds < 240 ? 8 : 0;
  const scarcityPenalty = Math.min(24, Math.max(0, input.scarcityPressure ?? 0));
  const operatorPenalty = input.operatorCopyVisible ? 18 : 0;
  const walletPenalty = input.walletRequired ? 22 : 0;

  const fit = input.fitProofVisible ? 13 : 0;
  const material = input.materialProofVisible ? 11 : 0;
  const delivery = input.deliveryPromiseReady ? 12 : 0;
  const returns = input.returnRightsVisible ? 10 : 0;
  const checkout = input.checkoutReady ? 12 : 0;

  const customerTrustScore = clamp(
    42 + traceability * 0.22 + fit + material + delivery + returns + checkout - freshnessPenalty - scarcityPenalty - operatorPenalty - walletPenalty,
  );

  const sourceFreshness: PublicAtelierTrustRibbonGate["sourceFreshness"] =
    freshnessSeconds < 90 ? "expired" : freshnessSeconds < 240 ? "near_expiry" : "fresh";

  const ribbonMode: PublicAtelierTrustRibbonGate["ribbonMode"] =
    input.walletRequired || sourceFreshness === "expired" || input.operatorCopyVisible ? "operator_hold" :
    input.checkoutReady && input.fitProofVisible && input.deliveryPromiseReady && input.returnRightsVisible && customerTrustScore >= 78 ? "checkout_ribbon" :
    input.deliveryPromiseReady || input.returnRightsVisible ? "waitlist_ribbon" :
    input.fitProofVisible || input.materialProofVisible ? "fit_ribbon" :
    "browse_ribbon";

  const prestigeStatus: PublicAtelierTrustRibbonGate["prestigeStatus"] =
    ribbonMode === "checkout_ribbon" ? "receipt_ready" :
    ribbonMode === "operator_hold" ? "withheld" :
    ribbonMode === "waitlist_ribbon" ? "proof_waitlist" :
    "quiet_atelier";

  const ribbonSteps = [
    input.fitProofVisible ? "fit visible" : "fit to confirm",
    input.materialProofVisible ? "material clear" : "material preview",
    input.deliveryPromiseReady ? "delivery ready" : "delivery before payment",
    input.returnRightsVisible ? "returns visible" : "returns before checkout",
  ];

  return {
    passId: "PASS320",
    surface: input.surface,
    uiInnovation: "atelier_trust_ribbon",
    ribbonMode,
    customerTrustScore,
    prestigeStatus,
    sourceFreshness,
    ribbonSteps,
    customerCopy: ribbonMode === "checkout_ribbon"
      ? "Receipt, fit, delivery and return rights are aligned enough for a calm checkout path."
      : "Velmère keeps the purchase path calm: product proof first, delivery and return rights before payment, no wallet pressure.",
    antiFomoBoundary: "Prestige is shown as calm proof status only: no countdown, no fake scarcity, no wallet pressure, no investment-style urgency.",
    hiddenOperatorSignals: [
      "provider readiness score",
      "MEXC-style source expiry window",
      "DPP traceability class",
      "operator copy density",
      "redacted audit lane",
    ],
    nextAction: ribbonMode === "checkout_ribbon"
      ? "open proof-gated checkout"
      : ribbonMode === "operator_hold"
        ? "hide technical copy and keep operator review internal"
        : ribbonMode === "waitlist_ribbon"
          ? "show quiet waitlist and delivery boundary"
          : "keep browsing focused on fit and material",
  };
}
