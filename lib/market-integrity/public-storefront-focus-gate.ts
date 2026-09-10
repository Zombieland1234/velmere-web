export type PublicStorefrontSurface =
  | "home"
  | "shop"
  | "product"
  | "lens"
  | "square"
  | "community"
  | "security"
  | "research-lab";

export type PublicStorefrontFocusGateInput = {
  surface: PublicStorefrontSurface;
  operatorPanelsPresent?: number;
  primaryCtaCount?: number;
  walletRequired?: boolean;
  checkoutReady?: boolean;
  pdfPreviewReady?: boolean;
  evidenceMode?: "public" | "operator" | "admin";
  copyDensity?: "minimal" | "balanced" | "heavy";
};

export type PublicStorefrontFocusGate = {
  passId: "PASS318";
  surface: PublicStorefrontSurface;
  publicMode: "storefront" | "search-capsule" | "community-board" | "trust-page";
  customerFocusScore: number;
  operatorSurfaceMode: "removed_from_public_route" | "hidden_until_admin_console";
  primaryPath: string;
  visibleSignals: string[];
  blockedPublicSignals: string[];
  nextAction: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function buildPublicStorefrontFocusGate(input: PublicStorefrontFocusGateInput): PublicStorefrontFocusGate {
  const operatorPenalty = Math.min(35, (input.operatorPanelsPresent ?? 0) * 9);
  const ctaPenalty = Math.max(0, (input.primaryCtaCount ?? 1) - 1) * 8;
  const walletPenalty = input.walletRequired ? 18 : 0;
  const densityPenalty = input.copyDensity === "heavy" ? 16 : input.copyDensity === "balanced" ? 6 : 0;
  const proofBonus = input.pdfPreviewReady ? 6 : 0;
  const checkoutBonus = input.checkoutReady ? 8 : 0;

  const score = clamp(82 + proofBonus + checkoutBonus - operatorPenalty - ctaPenalty - walletPenalty - densityPenalty);

  const publicMode: PublicStorefrontFocusGate["publicMode"] =
    input.surface === "lens" ? "search-capsule" :
    input.surface === "square" || input.surface === "community" ? "community-board" :
    input.surface === "security" || input.surface === "research-lab" ? "trust-page" :
    "storefront";

  const primaryPath =
    input.surface === "lens" ? "search → short capsule → Shield/PDF preview" :
    input.surface === "square" || input.surface === "community" ? "read public board → login later" :
    input.surface === "security" ? "trust pillars → contact support" :
    input.surface === "research-lab" ? "hypothesis → method → limits" :
    "product → size → delivery/returns → waitlist/checkout";

  const visibleSignals = [
    "one primary path",
    "no operator wall",
    "wallet optional",
    "short proof copy",
  ];

  const blockedPublicSignals = [
    "launch readiness wall",
    "provider/SKU internals",
    "raw audit payload",
    "fake urgency",
    "buy/sell command",
  ];

  return {
    passId: "PASS318",
    surface: input.surface,
    publicMode,
    customerFocusScore: score,
    operatorSurfaceMode: input.operatorPanelsPresent ? "removed_from_public_route" : "hidden_until_admin_console",
    primaryPath,
    visibleSignals,
    blockedPublicSignals,
    nextAction: score >= 82 ? "polish visual hierarchy and product proof" : "remove copy density and extra CTAs",
  };
}
