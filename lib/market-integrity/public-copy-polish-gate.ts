export type PublicCopyPolishSurface = "home" | "shop" | "product" | "cart" | "checkout" | "lens" | "shield-map";

export type PublicCopyPolishGateInput = {
  surface: PublicCopyPolishSurface;
  passLabelsVisible?: number;
  rawScoresVisible?: number;
  operatorTermsVisible?: number;
  walletPressure?: boolean;
  checkoutReady?: boolean;
  fitPathVisible?: boolean;
  deliveryReturnVisible?: boolean;
  dppTraceabilityScore?: number;
  mexcFreshnessSeconds?: number;
  scarcityPressure?: number;
};

export type PublicCopyPolishGate = {
  passId: "PASS321";
  surface: PublicCopyPolishSurface;
  uiInnovation: "concierge_proof_whisper";
  publicMode: "quiet_showroom" | "fit_concierge" | "proof_waitlist" | "checkout_ready" | "operator_silence";
  serenityScore: number;
  statusLine: string;
  headline: string;
  brief: string;
  badges: string[];
  hiddenInternals: string[];
  antiFomoBoundary: string;
  nextAction: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function buildPublicCopyPolishGate(input: PublicCopyPolishGateInput): PublicCopyPolishGate {
  const traceability = clamp(input.dppTraceabilityScore ?? 62);
  const freshness = input.mexcFreshnessSeconds ?? 420;
  const passPenalty = Math.min(30, Math.max(0, input.passLabelsVisible ?? 0) * 6);
  const scorePenalty = Math.min(24, Math.max(0, input.rawScoresVisible ?? 0) * 4);
  const operatorPenalty = Math.min(24, Math.max(0, input.operatorTermsVisible ?? 0) * 5);
  const walletPenalty = input.walletPressure ? 18 : 0;
  const scarcityPenalty = Math.min(20, Math.max(0, input.scarcityPressure ?? 0));
  const freshnessPenalty = freshness < 90 ? 18 : freshness < 240 ? 8 : 0;
  const fitBonus = input.fitPathVisible ? 10 : 0;
  const deliveryBonus = input.deliveryReturnVisible ? 12 : 0;
  const checkoutBonus = input.checkoutReady ? 14 : 0;

  const serenityScore = clamp(
    54 + traceability * 0.18 + fitBonus + deliveryBonus + checkoutBonus - passPenalty - scorePenalty - operatorPenalty - walletPenalty - scarcityPenalty - freshnessPenalty,
  );

  const publicMode: PublicCopyPolishGate["publicMode"] =
    passPenalty + scorePenalty + operatorPenalty > 30 || input.walletPressure ? "operator_silence" :
    input.checkoutReady && input.fitPathVisible && input.deliveryReturnVisible && serenityScore >= 78 ? "checkout_ready" :
    input.deliveryReturnVisible ? "proof_waitlist" :
    input.fitPathVisible ? "fit_concierge" :
    "quiet_showroom";

  const statusLine = publicMode === "checkout_ready"
    ? "ready when fit, delivery and receipt proof align"
    : publicMode === "operator_silence"
      ? "technical proof stays behind the curtain"
      : publicMode === "proof_waitlist"
        ? "quiet preview · waitlist before checkout"
        : publicMode === "fit_concierge"
          ? "fit first · material clear · no pressure"
          : "browse calmly · proof before urgency";

  const headline = publicMode === "checkout_ready"
    ? "A calm checkout path, only when proof is ready."
    : publicMode === "operator_silence"
      ? "The customer sees the showroom, not the control room."
      : "Private drop energy without the noisy dashboard.";

  return {
    passId: "PASS321",
    surface: input.surface,
    uiInnovation: "concierge_proof_whisper",
    publicMode,
    serenityScore,
    statusLine,
    headline,
    brief: "Velmère turns internal proof into a short concierge cue: fit, material, delivery and returns stay visible while pass IDs, raw scores and operator audit language stay out of the customer surface.",
    badges: [
      input.fitPathVisible ? "fit first" : "fit preview",
      input.deliveryReturnVisible ? "delivery + returns visible" : "delivery before payment",
      input.checkoutReady ? "receipt path ready" : "quiet waitlist",
      "no fake scarcity",
    ],
    hiddenInternals: [
      "PASS ledger labels",
      "raw /100 operator scores",
      "MEXC-style expiry internals",
      "provider audit fields",
      "redacted review telemetry",
    ],
    antiFomoBoundary: "Elite status is expressed as calm proof and invitation only: no countdown, no fake stock panic, no wallet pressure and no investment-style urgency.",
    nextAction: publicMode === "checkout_ready"
      ? "open checkout only with receipt proof"
      : publicMode === "operator_silence"
        ? "remove pass labels, raw scores and operator terms from the customer DOM"
        : "keep the page focused on product, fit and a quiet waitlist",
  };
}
