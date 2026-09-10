import type { VelmereSourceFamily, VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { VelmereReportAssetFamily } from "@/lib/market-integrity/report-asset-family";

export type VlmBrainLane =
  | "source_router"
  | "evidence_normalizer"
  | "risk_lane_engine"
  | "confidence_engine"
  | "narrative_engine"
  | "pdf_engine"
  | "quality_control_layer";

export type VlmBrainSourcePlan = {
  schemaVersion: "pass2813_vlm_brain_source_plan_v1";
  assetFamily: VelmereReportAssetFamily;
  tier: VelmereTier;
  requiredBrainLanes: VlmBrainLane[];
  requiredSourceFamilies: VelmereSourceFamily[];
  forbiddenLanes: string[];
  missingEvidencePolicy: string;
  confidencePolicy: string;
  chartPolicy: string;
  paidBoundaryPolicy: string;
  customerSafeNarrativeRules: string[];
  releaseGate: {
    status: "pass" | "warn" | "block";
    reasons: string[];
  };
};

export type VlmBrainClaimFirewall = {
  schemaVersion: "pass2813_vlm_brain_claim_firewall_v1";
  allowedVerdictLanguage: string[];
  blockedVerdictLanguage: string[];
  rendererRule: string;
  pdfRule: string;
  angelRule: string;
};

export const PASS2813_VLM_BRAIN_ACCEPTANCE_GATES = [
  "VLM Brain must route by asset family before selecting risk lanes; BTC/AAPL/stablecoin/ERC-20 cannot share the same lane set.",
  "Narrative output must say missing evidence when source quorum is partial or failed; it must not convert missing data into a scam accusation.",
  "No customer-facing answer may say secure/guaranteed/safe based only on client state, fixture data or one provider family.",
  "PDF, Shield, Real Markets and Shield Pro must expose the same source plan and claim-firewall state for the same report payload.",
  "Advanced remains NOT_FOR_SALE; no human-review language may appear without a future independently approved SKU and review receipt.",
] as const;

const BASE_LANES = [
  "source_router",
  "evidence_normalizer",
  "risk_lane_engine",
  "confidence_engine",
  "narrative_engine",
  "pdf_engine",
] as const satisfies readonly VlmBrainLane[];

function sourceFamiliesForAssetFamily(family: VelmereReportAssetFamily): VelmereSourceFamily[] {
  if (family === "equity" || family === "etf" || family === "fx" || family === "commodity" || family === "real_estate") {
    return ["yahoo_stooq", "sec_edgar", "velmere_internal"];
  }
  if (family === "stablecoin") {
    return ["coingecko", "defillama", "dexscreener", "scanner", "velmere_internal"];
  }
  if (family === "defi_protocol") {
    return ["defillama", "dexscreener", "scanner", "coingecko", "velmere_internal"];
  }
  if (family === "erc20") {
    return ["coingecko", "dexscreener", "scanner", "defillama", "velmere_internal"];
  }
  if (family === "exchange_health") {
    return ["coingecko", "binance", "mexc", "defillama", "velmere_internal"];
  }
  return ["coingecko", "binance", "mexc", "dexscreener", "velmere_internal"];
}

function forbiddenLanesForAssetFamily(family: VelmereReportAssetFamily): string[] {
  if (family === "equity" || family === "etf" || family === "fx" || family === "commodity" || family === "real_estate") {
    return ["token holder concentration", "contract permission tax", "LP owner can drain liquidity", "honeypot sell simulation"];
  }
  if (family === "stablecoin") return ["equity earnings surprise", "stock split narrative", "ETF holdings as token holders"];
  return ["earnings calendar as contract permission proof", "SEC filing as DEX liquidity proof"];
}

export function buildPass2813VlmBrainSourcePlan(args: {
  assetFamily: VelmereReportAssetFamily;
  tier: VelmereTier;
  sourceFamilyCount: number;
  missingEvidenceCount: number;
  providerConflictCount: number;
  chartSourceBound: boolean;
  paidEvidenceAllowed?: boolean;
  manualReviewPresent?: boolean; // legacy compatibility only; never authorizes a current customer claim
}): VlmBrainSourcePlan {
  const requiredSourceFamilies = sourceFamiliesForAssetFamily(args.assetFamily);
  const requiredBrainLanes: VlmBrainLane[] = [...BASE_LANES];
  const reasons: string[] = [];
  if (args.sourceFamilyCount < 2) reasons.push("source quorum below public confidence floor");
  if (args.missingEvidenceCount >= 4) reasons.push("missing evidence cap must be visible");
  if (args.providerConflictCount > 0) reasons.push("provider conflicts require confidence cap and source conflict table");
  if (!args.chartSourceBound) reasons.push("chart cannot render as live/source-bound; neutral skeleton required");
  if (args.tier === "Pro" && !args.paidEvidenceAllowed) reasons.push("Pro controlled-beta evidence locked without server-bound invitation entitlement");
  if (args.tier === "Advanced") reasons.push("Advanced is not for sale and cannot be released");
  

  return {
    schemaVersion: "pass2813_vlm_brain_source_plan_v1",
    assetFamily: args.assetFamily,
    tier: args.tier,
    requiredBrainLanes,
    requiredSourceFamilies,
    forbiddenLanes: forbiddenLanesForAssetFamily(args.assetFamily),
    missingEvidencePolicy: "Missing evidence lowers confidence and must be rendered as unknown/missing proof, not as an accusation.",
    confidencePolicy: "Confidence is capped by source family count, missing evidence, provider conflicts and chart lifecycle state.",
    chartPolicy: args.chartSourceBound
      ? "Chart may render as source-bound only with receipt, timeframe, lastUpdated and candle count."
      : "Chart must render as neutral skeleton/unavailable box; do not draw fake sparkline or fake OHLCV.",
    paidBoundaryPolicy: args.tier === "Basic"
      ? "Basic remains public triage and must show what Pro/Advanced would add."
      : args.tier === "Pro"
        ? "Pro evidence requires server-bound invitation entitlement, account binding, expiring report token, and payload hash; public checkout and wallet connect do not unlock it."
        : "Advanced is not for sale; no entitlement, payment marker, or wallet connection may unlock it.",
    customerSafeNarrativeRules: [
      "Say observed risk, not guaranteed safety.",
      "Say source-bound, fallback, or missing evidence explicitly.",
      "Separate risk score from confidence score in every tier.",
      "Do not recommend buy/sell/hold; explain evidence and limits only.",
    ],
    releaseGate: {
      status: reasons.some((reason) => reason.includes("controlled-beta") || reason.includes("not for sale") || reason.includes("Advanced")) ? "block" : reasons.length ? "warn" : "pass",
      reasons,
    },
  };
}

export function buildPass2813VlmBrainClaimFirewall(plan: VlmBrainSourcePlan): VlmBrainClaimFirewall {
  return {
    schemaVersion: "pass2813_vlm_brain_claim_firewall_v1",
    allowedVerdictLanguage: [
      "lower observed risk based on available evidence",
      "elevated observed risk with limited confidence",
      "source quorum partial",
      "missing evidence prevents a stronger claim",
      "controlled evidence is locked until current server-bound access exists",
    ],
    blockedVerdictLanguage: [
      "secure",
      "guaranteed safe",
      "risk-free",
      "buy now",
      "sell now",
      "Advanced unlocked by wallet connect",
      "live chart confirmed without chart receipt",
    ],
    rendererRule: plan.releaseGate.status === "pass"
      ? "Render customer-safe explanation with risk/confidence/source plan visible."
      : "Render customer-safe warning/locked state before any verdict-like sentence.",
    pdfRule: "PDF must include source plan, forbidden lane guard and claim-firewall status in the appendix/source methodology section.",
    angelRule: "Angel/VLM Brain must answer from the source plan; if a requested lane is forbidden for the asset family, it must explain the mismatch instead of hallucinating data.",
  };
}

export function buildPass2813SurfaceBrainPlan(args: {
  surface: "Shield" | "Real Markets" | "Shield Pro" | "PDF";
  assetFamilies: VelmereReportAssetFamily[];
  tier: VelmereTier;
  sourceBoundCharts: number;
  skeletonCharts: number;
  paidEvidenceAllowed?: boolean;
}) {
  const uniqueFamilies = [...new Set(args.assetFamilies.length ? args.assetFamilies : ["unknown"])] as VelmereReportAssetFamily[];
  const plans = uniqueFamilies.map((family) => buildPass2813VlmBrainSourcePlan({
    assetFamily: family,
    tier: args.tier,
    sourceFamilyCount: args.sourceBoundCharts > 0 ? 2 : 1,
    missingEvidenceCount: args.skeletonCharts > 0 ? 2 : 0,
    providerConflictCount: 0,
    chartSourceBound: args.sourceBoundCharts > 0,
    paidEvidenceAllowed: args.paidEvidenceAllowed,
    manualReviewPresent: args.tier !== "Advanced" ? true : false,
  }));
  return {
    schemaVersion: "pass2813_surface_vlm_brain_plan_v1" as const,
    surface: args.surface,
    tier: args.tier,
    assetFamilies: uniqueFamilies,
    sourceBoundCharts: args.sourceBoundCharts,
    skeletonCharts: args.skeletonCharts,
    plans,
    acceptanceGates: [...PASS2813_VLM_BRAIN_ACCEPTANCE_GATES],
    rule: "Surface must expose which VLM Brain source plan is active before rendering paid/advanced or live-chart claims.",
  };
}
