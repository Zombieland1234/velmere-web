export type PublicFirstPurchaseSurface = "home" | "shop" | "product" | "checkout" | "cart" | "lens";

export type PublicFirstPurchaseFlowGateInput = {
  surface: PublicFirstPurchaseSurface;
  selectedSize?: boolean;
  checkoutReady?: boolean;
  productProofScore?: number;
  sourceConfidence?: number;
  liveWindowSeconds?: number;
  walletRequired?: boolean;
  waitlistReady?: boolean;
  dppTraceabilityReady?: boolean;
  scarcityPressure?: number;
  copyDensity?: "minimal" | "balanced" | "heavy";
};

export type PublicFirstPurchaseFlowGate = {
  passId: "PASS319";
  surface: PublicFirstPurchaseSurface;
  uiInnovation: "quiet_first_purchase_constellation";
  mode: "browse" | "fit_first" | "waitlist_atelier" | "checkout_ready" | "operator_hold";
  flowScore: number;
  liveWindow: "fresh" | "near_expiry" | "stale";
  eliteStatus: "atelier_preview" | "private_waitlist" | "proof_earned" | "withheld";
  antiFomoBoundary: string;
  customerSteps: string[];
  hiddenOperatorSignals: string[];
  nextAction: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function buildPublicFirstPurchaseFlowGate(input: PublicFirstPurchaseFlowGateInput): PublicFirstPurchaseFlowGate {
  const productProof = clamp(input.productProofScore ?? 58);
  const sourceConfidence = clamp(input.sourceConfidence ?? 64);
  const liveWindowSeconds = input.liveWindowSeconds ?? 480;
  const densityPenalty = input.copyDensity === "heavy" ? 14 : input.copyDensity === "balanced" ? 6 : 0;
  const walletPenalty = input.walletRequired ? 24 : 0;
  const scarcityPenalty = Math.min(22, Math.max(0, input.scarcityPressure ?? 0));
  const fitBonus = input.selectedSize ? 8 : 0;
  const checkoutBonus = input.checkoutReady ? 14 : 0;
  const waitlistBonus = input.waitlistReady ? 6 : 0;
  const traceabilityBonus = input.dppTraceabilityReady ? 8 : 0;
  const livePenalty = liveWindowSeconds < 90 ? 14 : liveWindowSeconds < 240 ? 7 : 0;

  const flowScore = clamp(58 + productProof * 0.18 + sourceConfidence * 0.12 + fitBonus + checkoutBonus + waitlistBonus + traceabilityBonus - densityPenalty - walletPenalty - scarcityPenalty - livePenalty);

  const liveWindow: PublicFirstPurchaseFlowGate["liveWindow"] = liveWindowSeconds < 90 ? "stale" : liveWindowSeconds < 240 ? "near_expiry" : "fresh";

  const mode: PublicFirstPurchaseFlowGate["mode"] =
    input.checkoutReady && input.selectedSize && flowScore >= 78 ? "checkout_ready" :
    input.walletRequired || liveWindow === "stale" ? "operator_hold" :
    input.waitlistReady ? "waitlist_atelier" :
    input.selectedSize ? "fit_first" :
    "browse";

  const eliteStatus: PublicFirstPurchaseFlowGate["eliteStatus"] =
    mode === "checkout_ready" && input.dppTraceabilityReady ? "proof_earned" :
    mode === "waitlist_atelier" ? "private_waitlist" :
    mode === "operator_hold" ? "withheld" :
    "atelier_preview";

  const customerSteps = [
    "choose fit",
    "read material",
    "check delivery and returns",
    input.checkoutReady ? "checkout when ready" : "join quiet drop list",
  ];

  const hiddenOperatorSignals = [
    "provider proof score",
    "MEXC-style live expiry window",
    "reserve/provenance snapshot class",
    "operator source debt",
    "no raw audit payload",
  ];

  return {
    passId: "PASS319",
    surface: input.surface,
    uiInnovation: "quiet_first_purchase_constellation",
    mode,
    flowScore,
    liveWindow,
    eliteStatus,
    antiFomoBoundary: "No countdowns, no fake scarcity, no wallet pressure and no investment-style urgency. Status is earned by proof and fit clarity.",
    customerSteps,
    hiddenOperatorSignals,
    nextAction: mode === "checkout_ready" ? "open checkout with confirmed totals" : mode === "fit_first" ? "show delivery and returns before cart" : mode === "waitlist_atelier" ? "capture calm waitlist interest" : "keep product browsing simple",
  };
}
