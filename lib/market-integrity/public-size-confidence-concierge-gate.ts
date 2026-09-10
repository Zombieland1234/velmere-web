export type PublicSizeConfidenceSurface = "home" | "shop" | "product" | "cart" | "checkout";

export type PublicSizeConfidenceConciergeGateInput = {
  surface: PublicSizeConfidenceSurface;
  garmentMeasurementsVisible?: boolean;
  selectedSize?: boolean;
  materialCareVisible?: boolean;
  deliveryReturnVisible?: boolean;
  checkoutReady?: boolean;
  waitlistReady?: boolean;
  walletRequired?: boolean;
  bodyComparisonCopyVisible?: boolean;
  mexcLiveWindowSeconds?: number;
  dppProductInfoScore?: number;
  operatorNoiseItems?: number;
  scarcityPressure?: number;
};

export type PublicSizeConfidenceConciergeGate = {
  passId: "PASS324";
  surface: PublicSizeConfidenceSurface;
  uiInnovation: "mirrorless_fit_concierge";
  conciergeMode: "fit_ready" | "fit_preview" | "size_review" | "backstage_hold";
  eliteStatus: "private_fit_room" | "atelier_waitlist" | "receipt_fit_lock" | "withheld";
  fitConfidenceScore: number;
  headline: string;
  customerLine: string;
  fitSteps: string[];
  backstageInternals: string[];
  antiFomoBoundary: string;
  nextAction: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function buildPublicSizeConfidenceConciergeGate(input: PublicSizeConfidenceConciergeGateInput): PublicSizeConfidenceConciergeGate {
  const dppProductInfo = clamp(input.dppProductInfoScore ?? 64);
  const liveWindow = input.mexcLiveWindowSeconds ?? 360;
  const livePenalty = liveWindow < 90 ? 16 : liveWindow < 240 ? 7 : 0;
  const operatorPenalty = Math.min(22, Math.max(0, input.operatorNoiseItems ?? 0) * 7);
  const walletPenalty = input.walletRequired ? 24 : 0;
  const scarcityPenalty = Math.min(24, Math.max(0, input.scarcityPressure ?? 0));
  const bodyComparisonPenalty = input.bodyComparisonCopyVisible ? 28 : 0;

  const measurementBonus = input.garmentMeasurementsVisible ? 16 : 0;
  const selectedSizeBonus = input.selectedSize ? 10 : 0;
  const careBonus = input.materialCareVisible ? 10 : 0;
  const deliveryBonus = input.deliveryReturnVisible ? 12 : 0;
  const checkoutBonus = input.checkoutReady ? 10 : 0;
  const waitlistBonus = input.waitlistReady ? 6 : 0;

  const fitConfidenceScore = clamp(
    34 + dppProductInfo * 0.24 + measurementBonus + selectedSizeBonus + careBonus + deliveryBonus + checkoutBonus + waitlistBonus - livePenalty - operatorPenalty - walletPenalty - scarcityPenalty - bodyComparisonPenalty,
  );

  const conciergeMode: PublicSizeConfidenceConciergeGate["conciergeMode"] =
    walletPenalty > 0 || scarcityPenalty > 15 || bodyComparisonPenalty > 0 || operatorPenalty > 14 ? "backstage_hold" :
    input.checkoutReady && input.selectedSize && fitConfidenceScore >= 82 ? "fit_ready" :
    input.garmentMeasurementsVisible && input.materialCareVisible ? "fit_preview" :
    "size_review";

  const eliteStatus: PublicSizeConfidenceConciergeGate["eliteStatus"] =
    conciergeMode === "backstage_hold" ? "withheld" :
    conciergeMode === "fit_ready" ? "receipt_fit_lock" :
    conciergeMode === "fit_preview" ? "private_fit_room" :
    "atelier_waitlist";

  const headline = conciergeMode === "fit_ready"
    ? "Fit is locked before checkout."
    : conciergeMode === "fit_preview"
      ? "Fit confidence starts with the garment, not the body."
      : conciergeMode === "backstage_hold"
        ? "Hold fit copy until it stays calm and factual."
        : "Size review stays quiet until measurements are clear.";

  const customerLine = conciergeMode === "fit_ready"
    ? "The selected size, garment measurements, material care and delivery/return path are clear before payment."
    : conciergeMode === "fit_preview"
      ? "Compare the garment measurements with a hoodie you already like; no body scoring, no pressure and no fake scarcity."
      : conciergeMode === "backstage_hold"
        ? "Any wallet pressure, body-comparison copy or urgency stays backstage until it is removed."
        : "Use the size guide first; checkout waits until the product path is ready.";

  const fitSteps = [
    input.garmentMeasurementsVisible ? "garment measurements" : "measurements next",
    input.selectedSize ? "size selected" : "choose size calmly",
    input.materialCareVisible ? "material + care" : "material next",
    input.deliveryReturnVisible ? "delivery + returns" : "delivery before payment",
    input.checkoutReady ? "checkout receipt" : "quiet waitlist",
  ];

  return {
    passId: "PASS324",
    surface: input.surface,
    uiInnovation: "mirrorless_fit_concierge",
    conciergeMode,
    eliteStatus,
    fitConfidenceScore,
    headline,
    customerLine,
    fitSteps,
    backstageInternals: [
      "MEXC-style source freshness expiry",
      "LVMH/Aura-style verified product information",
      "garment-measurement-only fit logic",
      "operator-only provider and checkout readiness",
      "anti-body-comparison copy firewall",
    ],
    antiFomoBoundary: "Fit confidence can feel private and premium, but the public UI must keep no countdowns, no fake scarcity, no body ranking, no wallet pressure, no ROI language and no safety guarantees.",
    nextAction: conciergeMode === "fit_ready"
      ? "let checkout proceed only with size, care, delivery, returns and receipt clarity"
      : conciergeMode === "backstage_hold"
        ? "remove body-comparison, urgency, wallet pressure and operator noise from the public surface"
        : "show a short mirrorless fit concierge and keep the path product-first",
  };
}

// no body ranking marker: fit guidance compares garment measurements to garments the customer already owns, never to body ideals.
// no countdowns marker: quiet-drop status can be premium without urgency pressure.
