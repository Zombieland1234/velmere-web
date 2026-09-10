import type { TokenRiskResult } from "./risk-types";
import { buildHolderIntelligence } from "./holder-intelligence";
import { buildStressScenarios } from "./stress-simulator";
import { buildChartRegime } from "./chart-regime";

export type VlmAccessTierId = "public" | "member" | "pro" | "research" | "api";
export type VlmAccessStatus = "open" | "member_only" | "pro_required" | "research_required" | "api_ready";
export type VlmAccessRisk = "low" | "watch" | "high";

export type VlmAccessFeature = {
  id: string;
  label: string;
  tier: VlmAccessTierId;
  status: VlmAccessStatus;
  reason: string;
  guardrail: string;
};

export type VlmAccessTier = {
  id: VlmAccessTierId;
  label: string;
  badge: string;
  utility: string;
  features: string[];
  legalTone: string;
};

export type VlmShieldAccessBrief = {
  version: "vlm_shield_access_v4_pass62_control_plane";
  product: "Velmere Shield";
  tokenRole: "utility_access_layer";
  recommendedTier: VlmAccessTierId;
  accessRisk: VlmAccessRisk;
  summary: string;
  tiers: VlmAccessTier[];
  featureMatrix: VlmAccessFeature[];
  complianceGuardrails: string[];
  launchChecklist: Array<{ id: string; label: string; status: "ready" | "watch" | "blocked"; fix: string }>;
  copyRules: string[];
  nextBuildStep: string;
  pass59AccessGates: Array<{ id: string; label: string; status: "ready" | "watch" | "blocked"; reason: string }>;
  pass60PolicySpine: Array<{ id: string; label: string; status: "ready" | "watch" | "blocked"; guardrail: string }>;
  pass62ControlRails: Array<{ id: string; label: string; status: "ready" | "watch" | "blocked"; guardrail: string }>;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function tierForResult(result: TokenRiskResult): VlmAccessTierId {
  const holder = buildHolderIntelligence(result);
  const stress = buildStressScenarios(result);
  const chart = buildChartRegime(result, {
    bars: result.chart?.sevenDay?.length ?? 0,
    source: result.chart?.sevenDay?.length ? "sparkline" : "metric fallback",
  });
  const worstStress = Math.max(...stress.scenarios.map((item) => item.score), 0);
  const complexity = clamp(
    result.score * 0.36 +
      holder.holderRiskScore * 0.22 +
      worstStress * 0.24 +
      chart.score * 0.18 -
      (result.dataQuality === "live" ? 8 : 0),
  );
  if (complexity >= 76) return "research";
  if (complexity >= 55) return "pro";
  if (complexity >= 28) return "member";
  return "public";
}

export function buildVlmShieldAccess(result: TokenRiskResult): VlmShieldAccessBrief {
  const holder = buildHolderIntelligence(result);
  const stress = buildStressScenarios(result);
  const chart = buildChartRegime(result, {
    bars: result.chart?.sevenDay?.length ?? 0,
    source: result.chart?.sevenDay?.length ? "sparkline" : "metric fallback",
  });
  const worstStress = Math.max(...stress.scenarios.map((item) => item.score), 0);
  const recommendedTier = tierForResult(result);
  const missingCoreData = result.dataQuality !== "live" || holder.dataCompleteness < 45 || chart.confidence < 55;
  const accessRisk: VlmAccessRisk = missingCoreData ? "watch" : result.score >= 70 || worstStress >= 75 ? "high" : "low";

  const tiers: VlmAccessTier[] = [
    {
      id: "public",
      label: "Public scan",
      badge: "Free",
      utility: "Basic market-integrity preview for one asset.",
      features: ["clean search", "token identity", "basic score", "non-accusatory summary"],
      legalTone: "Educational triage only. No investment promise.",
    },
    {
      id: "member",
      label: "VLM member",
      badge: "Utility",
      utility: "Unlocks saved watchlists, longer history and AI explanations.",
      features: ["Ask Shield", "watchlist", "risk replay", "evidence snippets"],
      legalTone: "Access utility, not yield, dividend, security or profit claim.",
    },
    {
      id: "pro",
      label: "Shield Pro",
      badge: "Analyst",
      utility: "Adds SOC queue, stress simulator, chart regime and holder uncertainty panels.",
      features: ["SOC command queue", "stress scenarios", "chart regime", "holder map proxy"],
      legalTone: "Analyst workflow. Results require independent verification.",
    },
    {
      id: "research",
      label: "Research desk",
      badge: "Review",
      utility: "Case-file workflow for high-risk or incomplete-data assets.",
      features: ["case timeline", "deep evidence JSON", "manual review queue", "data-gap escalation"],
      legalTone: "No accusation. High severity means review priority only.",
    },
    {
      id: "api",
      label: "API access",
      badge: "Future",
      utility: "Programmatic access for controlled integrations.",
      features: ["rate limits", "audit logs", "server keys", "usage policy"],
      legalTone: "Requires ToS, abuse limits and data-source licensing check.",
    },
  ];

  const featureMatrix: VlmAccessFeature[] = [
    {
      id: "basic-scan",
      label: "Basic token scan",
      tier: "public",
      status: "open",
      reason: "Every user can inspect a low-friction risk preview.",
      guardrail: "Keep language as anomaly detection, not trading advice.",
    },
    {
      id: "ask-shield",
      label: "Ask Shield AI bot",
      tier: "member",
      status: recommendedTier === "public" ? "open" : "member_only",
      reason: "AI explanations become useful when watchlists and replay context exist.",
      guardrail: "Bot must show uncertainty and never promise price direction.",
    },
    {
      id: "soc-queue",
      label: "SOC command queue",
      tier: "pro",
      status: recommendedTier === "pro" || recommendedTier === "research" ? "pro_required" : "member_only",
      reason: "Multi-layer command queue should be part of serious analysis, not casual hype.",
      guardrail: "Command priority means review order, not proof of manipulation.",
    },
    {
      id: "holder-clusters",
      label: "Holder cluster intelligence",
      tier: "pro",
      status: holder.dataCompleteness < 55 ? "pro_required" : "api_ready",
      reason: `Holder data completeness is ${Math.round(holder.dataCompleteness)}% and uncertainty is ${holder.dataUncertaintyPercent}%.`,
      guardrail: "Missing holder API must stay visible as uncertainty.",
    },
    {
      id: "evidence-bundle",
      label: "Evidence JSON bundle",
      tier: "research",
      status: result.score >= 65 || accessRisk !== "low" ? "research_required" : "member_only",
      reason: "Evidence bundles should be generated when risk or uncertainty is material.",
      guardrail: "Evidence is machine-generated triage, not legal proof.",
    },
    {
      id: "api-terminal",
      label: "Shield API terminal",
      tier: "api",
      status: "api_ready",
      reason: "Endpoints exist, but production API needs rate limits and audit logs.",
      guardrail: "Do not expose unrestricted scanning without abuse protection.",
    },
  ];

  const launchChecklist = [
    {
      id: "utility-copy",
      label: "VLM utility copy",
      status: "ready" as const,
      fix: "Use access, membership, tooling and workflow language only.",
    },
    {
      id: "investment-claims",
      label: "No investment claims",
      status: "ready" as const,
      fix: "Never say VLM will increase in value, pay yield, or create profit.",
    },
    {
      id: "wallet-gating",
      label: "Wallet gating",
      status: "watch" as const,
      fix: "Add wallet signature verification before real VLM gated features.",
    },
    {
      id: "user-preferences",
      label: "Saved access state",
      status: "watch" as const,
      fix: "Persist plan, watchlist and limits in Supabase after auth is ready.",
    },
    {
      id: "terms-policy",
      label: "Terms and risk policy",
      status: "blocked" as const,
      fix: "Add ToS, privacy, data-source policy, token utility disclaimer and acceptable-use rules before public launch.",
    },
  ];

  return {
    version: "vlm_shield_access_v4_pass62_control_plane",
    product: "Velmere Shield",
    tokenRole: "utility_access_layer",
    recommendedTier,
    accessRisk,
    summary: `VLM should act as a utility/access layer for Shield workflows: scans, watchlists, AI explanations, SOC queue and evidence bundles. For ${result.token.symbol}, recommended access mode is ${recommendedTier}; this is a product-access suggestion, not an investment signal.`,
    tiers,
    featureMatrix,
    complianceGuardrails: [
      "VLM copy must describe utility/access only, never profit, yield, ROI or price appreciation.",
      "Shield outputs are automated anomaly triage, not legal proof, accusation or financial advice.",
      "High risk means review priority. It does not mean fraud or manipulation by itself.",
      "Missing data must be visible in UI and must never be interpreted as safety.",
      "Wallet/token gating must include ToS, privacy policy, rate limits and abuse prevention before production.",
    ],
    launchChecklist,
    copyRules: [
      "Say: access layer, member tools, analysis credits, watchlist, evidence export.",
      "Do not say: investment, guaranteed, profit, moon, yield, dividend, passive income.",
      "Use: may indicate anomaly, requires review, data uncertainty, source quality.",
      "Avoid: scam, fraud, manipulation proven, buy, sell, safe token.",
    ],
    nextBuildStep: "Build wallet/session gating UI with preview status first, then connect Supabase preferences and wallet signature verification.",
    pass59AccessGates: [
      { id: "utility-positioning", label: "Utility positioning", status: "ready", reason: "All VLM copy stays on access, membership and workflow language." },
      { id: "wallet-signature", label: "Wallet signature", status: "watch", reason: "UI can describe access now; production needs wallet verification before gating." },
      { id: "usage-limits", label: "Usage limits", status: "watch", reason: "AI/risk endpoints need member limits, abuse prevention and audit logs." },
      { id: "legal-policy", label: "Legal policy pack", status: "blocked", reason: "Public VLM utility requires ToS, privacy, data-source policy and acceptable-use rules." },
    ],
    pass60PolicySpine: [
      { id: "access-not-investment", label: "Access, not investment", status: "ready", guardrail: "Every benefit must be phrased as tooling, credits, workflow, saved state or analysis access." },
      { id: "member-limits", label: "Member usage limits", status: "watch", guardrail: "Before production, limit scans, AI prompts and exports per tier to avoid abuse and cost leaks." },
      { id: "wallet-session", label: "Wallet/session proof", status: "watch", guardrail: "Use wallet signature and authenticated session before any gated feature is enforced." },
      { id: "legal-pack", label: "Policy pack", status: "blocked", guardrail: "Publish ToS, privacy, data-source policy, acceptable-use policy and utility-token disclaimer before public launch." },
    ],
    pass62ControlRails: [
      { id: "entitlement-contract", label: "Entitlement contract", status: "watch", guardrail: "Define exact feature limits per tier before any VLM gate is enforced." },
      { id: "wallet-session-proof", label: "Wallet/session proof", status: "watch", guardrail: "Use signed wallet message plus authenticated session; never rely on client-only UI state." },
      { id: "usage-metering", label: "Usage metering", status: "blocked", guardrail: "Add scan, AI prompt, evidence export and API rate counters before public member traffic." },
      { id: "refund-support-copy", label: "Support and access copy", status: "watch", guardrail: "Describe access rights, limits and support channels; avoid value, profit or investment wording." },
    ],
  };
}
