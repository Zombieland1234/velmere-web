export type PublicProvenanceDropSurface = "home" | "shop" | "product" | "cart" | "checkout";

export type PublicProvenanceDropConciergeGateInput = {
  surface: PublicProvenanceDropSurface;
  productPathVisible?: boolean;
  fitVisible?: boolean;
  materialVisible?: boolean;
  deliveryReturnVisible?: boolean;
  checkoutReady?: boolean;
  waitlistReady?: boolean;
  walletRequired?: boolean;
  mexcLiveWindowSeconds?: number;
  dppTraceabilityScore?: number;
  receiptReady?: boolean;
  operatorNoiseItems?: number;
  scarcityPressure?: number;
};

export type PublicProvenanceDropConciergeGate = {
  passId: "PASS323";
  surface: PublicProvenanceDropSurface;
  uiInnovation: "provenance_drop_concierge";
  conciergeMode: "silent_drop" | "provenance_preview" | "receipt_ready" | "backstage_hold";
  eliteStatus: "quiet_atelier" | "verified_waitlist" | "receipt_salon" | "withheld";
  provenanceScore: number;
  headline: string;
  customerLine: string;
  conciergeSteps: string[];
  backstageInternals: string[];
  antiFomoBoundary: string;
  nextAction: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function buildPublicProvenanceDropConciergeGate(input: PublicProvenanceDropConciergeGateInput): PublicProvenanceDropConciergeGate {
  const traceability = clamp(input.dppTraceabilityScore ?? 66);
  const liveWindow = input.mexcLiveWindowSeconds ?? 420;
  const livePenalty = liveWindow < 90 ? 18 : liveWindow < 240 ? 9 : 0;
  const operatorPenalty = Math.min(24, Math.max(0, input.operatorNoiseItems ?? 0) * 8);
  const walletPenalty = input.walletRequired ? 24 : 0;
  const scarcityPenalty = Math.min(26, Math.max(0, input.scarcityPressure ?? 0));

  const productBonus = input.productPathVisible ? 11 : 0;
  const fitBonus = input.fitVisible ? 9 : 0;
  const materialBonus = input.materialVisible ? 9 : 0;
  const deliveryBonus = input.deliveryReturnVisible ? 12 : 0;
  const receiptBonus = input.receiptReady ? 10 : 0;
  const checkoutBonus = input.checkoutReady ? 12 : 0;
  const waitlistBonus = input.waitlistReady ? 7 : 0;

  const provenanceScore = clamp(
    38 + traceability * 0.22 + productBonus + fitBonus + materialBonus + deliveryBonus + receiptBonus + checkoutBonus + waitlistBonus - livePenalty - operatorPenalty - walletPenalty - scarcityPenalty,
  );

  const conciergeMode: PublicProvenanceDropConciergeGate["conciergeMode"] =
    operatorPenalty > 15 || walletPenalty > 0 || scarcityPenalty > 16 ? "backstage_hold" :
    input.checkoutReady && input.receiptReady && provenanceScore >= 82 ? "receipt_ready" :
    traceability >= 68 && (input.fitVisible || input.materialVisible) ? "provenance_preview" :
    "silent_drop";

  const eliteStatus: PublicProvenanceDropConciergeGate["eliteStatus"] =
    conciergeMode === "backstage_hold" ? "withheld" :
    conciergeMode === "receipt_ready" ? "receipt_salon" :
    conciergeMode === "provenance_preview" ? "verified_waitlist" :
    "quiet_atelier";

  const headline = conciergeMode === "receipt_ready"
    ? "Receipt salon ready before payment."
    : conciergeMode === "backstage_hold"
      ? "Keep the drop quiet until proof is clean."
      : conciergeMode === "provenance_preview"
        ? "A private drop with visible provenance."
        : "A silent drop path without pressure.";

  const customerLine = conciergeMode === "receipt_ready"
    ? "Fit, material, delivery, returns and receipt proof are aligned before checkout."
    : conciergeMode === "backstage_hold"
      ? "Internal proof, wallet logic and source debt stay backstage until they are safe to show."
      : conciergeMode === "provenance_preview"
        ? "The customer sees a calm product path, not a control-room audit."
        : "Browse the garment, check the fit path and join quietly when the drop opens.";

  const conciergeSteps = [
    input.productPathVisible ? "product path" : "product preview",
    input.fitVisible ? "fit visible" : "fit next",
    input.materialVisible ? "material clear" : "material next",
    input.deliveryReturnVisible ? "delivery + returns" : "delivery before payment",
    input.receiptReady || input.checkoutReady ? "receipt salon" : "quiet waitlist",
  ];

  return {
    passId: "PASS323",
    surface: input.surface,
    uiInnovation: "provenance_drop_concierge",
    conciergeMode,
    eliteStatus,
    provenanceScore,
    headline,
    customerLine,
    conciergeSteps,
    backstageInternals: [
      "MEXC-style source freshness expiry",
      "Proof-of-Reserves snapshot internals",
      "LVMH/Aura-style DPP traceability scoring",
      "operator-only source debt",
      "raw provider and wallet readiness",
    ],
    antiFomoBoundary: "Elite status can be quiet and earned, but the public UI must keep no countdowns, no fake scarcity, no wallet pressure, no buy/sell commands, no ROI language and no safety guarantees.",
    nextAction: conciergeMode === "receipt_ready"
      ? "let checkout proceed only with receipt, delivery and return clarity"
      : conciergeMode === "backstage_hold"
        ? "remove pressure and keep proof debt backstage"
        : "show a short provenance concierge and keep the public path product-first",
  };
}

// no countdowns marker: public scarcity stays calm and never becomes urgency pressure.
