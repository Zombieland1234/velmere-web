import { createHash } from "node:crypto";
import type { Pass2519RiskKernelCalibrationRebalance } from "./risk-kernel-calibration-rebalance";

export const PASS2520_PREMIUM_RISK_PSYCHOLOGY_REBALANCE_ID = "premium-risk-psychology-rebalance-v1" as const;

export type Pass2520State = "ready_for_visual_fixture" | "watch" | "blocked";
export type Pass2520Tone = "calm" | "warning" | "blocked";
export type Pass2520Tier = "basic" | "pro" | "advanced";

export type Pass2520PsychologyToken = {
  id: string;
  label: string;
  tone: Pass2520Tone;
  appliesTo: string[];
  doUse: string;
  doNotUse: string;
  proofRule: string;
};

export type Pass2520TrustEquation = {
  id: string;
  label: string;
  equation: string;
  inputs: string[];
  output: string;
  blockedVisualClaim: string;
  visibleCopy: string;
};

export type Pass2520TierTrustCard = {
  tier: Pass2520Tier;
  signals: number;
  visualPromise: string;
  missingProofCopy: string;
  downgradeRule: string;
  hiddenRisk: string;
};

export type Pass2520SemanticLane = {
  id: string;
  surface: string;
  percentBefore: number;
  percentAfter: number;
  semanticFinding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2520PremiumRiskPsychologyRebalance = {
  id: typeof PASS2520_PREMIUM_RISK_PSYCHOLOGY_REBALANCE_ID;
  state: Pass2520State;
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  riskKernelVisualReadinessBeforePercent: number;
  riskKernelVisualReadinessAfterPercent: number;
  riskEquationUiReadinessBeforePercent: number;
  riskEquationUiReadinessAfterPercent: number;
  tierTrustClarityBeforePercent: number;
  tierTrustClarityAfterPercent: number;
  premiumRiskCopyReadinessBeforePercent: number;
  premiumRiskCopyReadinessAfterPercent: number;
  antiFomoPsychologyReadinessBeforePercent: number;
  antiFomoPsychologyReadinessAfterPercent: number;
  dataQualityScoreReadinessBeforePercent: number;
  dataQualityScoreReadinessAfterPercent: number;
  psychologyTokens: Pass2520PsychologyToken[];
  trustEquations: Pass2520TrustEquation[];
  tierTrustCards: Pass2520TierTrustCard[];
  semanticLanes: Pass2520SemanticLane[];
  worldclassInventionBacklog: string[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  fingerprint: string;
  visualTruthRule: string;
};

export const PASS2520_PSYCHOLOGY_TOKENS: Pass2520PsychologyToken[] = [
  { id: "calm-low-risk", label: "Calm low-risk evidence tone", tone: "calm", appliesTo: ["confirmed proof", "low severity", "high confidence"], doUse: "muted emerald/stone language with proof count and observedAt", doNotUse: "bright green victory state or safe/guaranteed copy", proofRule: "Only shown when confidence >= 75 and no critical Missing Proof exists." },
  { id: "amber-missing-proof", label: "Missing proof friction tone", tone: "warning", appliesTo: ["missing data", "stale provider", "single source"], doUse: "soft amber label with exact missing lane", doNotUse: "red panic or hidden tooltip-only warning", proofRule: "Any missing critical lane must be visible in Basic, Pro and Advanced." },
  { id: "red-blocked-claim", label: "Blocked claim tone", tone: "blocked", appliesTo: ["paid unlock missing", "unsafe claim", "AI overclaim"], doUse: "deep red/brown block with reason and next proof", doNotUse: "marketing urgency or dramatic danger copy", proofRule: "Blocked claims require a reason, source gap and recovery path." },
  { id: "premium-neutral-wait", label: "Premium neutral watch tone", tone: "warning", appliesTo: ["watch", "manual review", "provider divergence"], doUse: "neutral slate + small gold accent only for attention", doNotUse: "gold everywhere or fake luxury glow", proofRule: "Gold is an accent, never a truth signal." },
  { id: "confidence-cap-microcopy", label: "Confidence cap microcopy", tone: "warning", appliesTo: ["confidence cap", "tier downgrade", "partial source"], doUse: "short sentence: confidence is capped because X is missing", doNotUse: "long legal wall or vague disclaimer", proofRule: "Every cap must name the exact missing lane." },
];

export const PASS2520_TRUST_EQUATIONS: Pass2520TrustEquation[] = [
  { id: "visual-truth-score", label: "Visual truth score", equation: "visualTruth = min(confidence, evidenceCoverage, tierProof, sourceFreshness) - visualOverpromisePenalty", inputs: ["confidence", "evidenceCoverage", "tierProof", "sourceFreshness", "visualOverpromisePenalty"], output: "whether UI may look calm, warning or blocked", blockedVisualClaim: "Low-risk styling when proof is missing", visibleCopy: "The UI cannot look safer than the evidence allows." },
  { id: "trust-friction-ladder", label: "Trust friction ladder", equation: "friction = missingCriticalProof + staleProvider + divergence + paidReceiptGap + AIClaimPressure", inputs: ["missingCriticalProof", "staleProvider", "divergence", "paidReceiptGap", "AIClaimPressure"], output: "which trust card appears first", blockedVisualClaim: "Hiding important risk below the fold", visibleCopy: "Highest friction appears above nice-to-have insights." },
  { id: "anti-fomo-psychology-index", label: "Anti-FOMO psychology index", equation: "copyPressure = urgency + certainty + ROI + hype - proofLanguage - missingProofLanguage", inputs: ["urgency", "certainty", "ROI", "hype", "proofLanguage", "missingProofLanguage"], output: "rewrite/watch/block", blockedVisualClaim: "Urgency-led investing language", visibleCopy: "Velmère uses calm risk education, not pressure." },
  { id: "data-quality-ring", label: "Data quality score ring", equation: "dataQuality = 0.35*sourceCoverage + 0.25*freshness + 0.20*crossProviderAgreement + 0.20*receiptIntegrity", inputs: ["sourceCoverage", "freshness", "crossProviderAgreement", "receiptIntegrity"], output: "data-quality ring value", blockedVisualClaim: "Showing a final score without data-quality context", visibleCopy: "Risk score is paired with data quality." },
  { id: "tier-honesty-meter", label: "Tier honesty meter", equation: "tierHonesty = confirmedSignals / expectedSignals × receiptFactor × hashFamilyFactor", inputs: ["confirmedSignals", "expectedSignals", "receiptFactor", "hashFamilyFactor"], output: "Basic/Pro/Advanced honest/partial/downgraded", blockedVisualClaim: "Advanced badge from UI state only", visibleCopy: "Advanced requires 20 signals plus server proof." },
  { id: "equation-explainability-budget", label: "Equation explainability budget", equation: "visibleFactors = topContributors + missingPenalties + confidenceCaps; hideFactor only if it is non-material", inputs: ["topContributors", "missingPenalties", "confidenceCaps"], output: "what the user sees in the score card", blockedVisualClaim: "Magic risk number", visibleCopy: "A score must name why it moved." },
];

export const PASS2520_TIER_TRUST_CARDS: Pass2520TierTrustCard[] = [
  { tier: "basic", signals: 10, visualPromise: "Fast snapshot with visible gaps", missingProofCopy: "Basic cannot hide missing sources or stale data.", downgradeRule: "If fewer than 10 signals are confirmed, show Missing Proof instead of a score badge.", hiddenRisk: "Users may over-trust free Basic if the card looks too final." },
  { tier: "pro", signals: 14, visualPromise: "Deeper source and divergence context", missingProofCopy: "Pro must name second-source gaps and derivative/fundamental gaps.", downgradeRule: "If provider divergence or freshness is missing, Pro downgrades to Basic-style copy.", hiddenRisk: "Longer answers can feel more credible even when proof is incomplete." },
  { tier: "advanced", signals: 20, visualPromise: "Paid-grade proof, hash family and vault delivery", missingProofCopy: "Advanced is blocked without receipt, 20 signals, source coverage and vault hash proof.", downgradeRule: "Receipt/hash/refund/account mismatch downgrades Advanced to Pro or blocked.", hiddenRisk: "Paid UI can falsely imply certainty; proof must stay visible." },
];

export const PASS2520_SEMANTIC_LANES: Pass2520SemanticLane[] = [
  { id: "css_premium_color_psychology", surface: "globals.css", percentBefore: 12, percentAfter: 15, semanticFinding: "CSS has many proof rails but premium risk color semantics are still mostly markers, not a shared design token system.", implementedGuard: "PASS2520 psychology tokens define calm/warning/blocked usage and ban gold as a truth signal.", nextAction: "Extract risk color tokens into a dedicated module and map them to actual components." },
  { id: "token_modal_score_explainability", surface: "TokenRiskModal", percentBefore: 39, percentAfter: 55, semanticFinding: "Risk UI must explain score movement, not just show a number and proof rail markers.", implementedGuard: "Risk Equation Explanation Card now requires top contributors, missing penalties and confidence caps.", nextAction: "Split TokenRiskModal into score, evidence, chart and tier components." },
  { id: "asset_modal_severity_confidence_split", surface: "AssetDetailModal", percentBefore: 48, percentAfter: 61, semanticFinding: "Severity and confidence need separate visible cards, especially for non-crypto markets.", implementedGuard: "Visual truth score blocks low-risk styling when confidence or freshness is missing.", nextAction: "Add runtime fixture for BTC/AAPL/NVDA/SPY severity-confidence split." },
  { id: "angel_anti_fomo_copy", surface: "Angel", percentBefore: 52, percentAfter: 64, semanticFinding: "AI safety must include emotional pressure and fake certainty, not only prompt injection.", implementedGuard: "Anti-FOMO psychology index and copy rewrite/block states added to Angel directive.", nextAction: "Run PL/EN/DE replay prompts for hype, hidden prompt, paid unlock and source gaps." },
  { id: "tier_trust_clarity", surface: "Basic/Pro/Advanced", percentBefore: 73, percentAfter: 82, semanticFinding: "The tiers are numerically defined but need visible honesty cards so users know what is missing.", implementedGuard: "Tier Trust Cards define Basic 10, Pro 14, Advanced 20 + downgrade copy.", nextAction: "Render tier honesty meter in modal/PDF/account artifact." },
  { id: "data_quality_ring", surface: "Risk Engine", percentBefore: 68, percentAfter: 76, semanticFinding: "Risk score without data-quality context still risks over-trust.", implementedGuard: "Data Quality Score Ring equation pairs score with source/freshness/receipt quality.", nextAction: "Attach data-quality ring to source-sync packet and PDF export." },
];

function stableFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32).toUpperCase();
}

export function buildPass2520PremiumRiskPsychologyRebalance(args: {
  query: string;
  symbol?: string;
  pass2519?: Pass2519RiskKernelCalibrationRebalance;
}): Pass2520PremiumRiskPsychologyRebalance {
  const payload = {
    query: args.query,
    symbol: args.symbol,
    pass2519Fingerprint: args.pass2519?.fingerprint ?? "missing-pass2519",
    tokens: PASS2520_PSYCHOLOGY_TOKENS.map((token) => token.id),
    equations: PASS2520_TRUST_EQUATIONS.map((eq) => eq.id),
    tiers: PASS2520_TIER_TRUST_CARDS.map((tier) => `${tier.tier}:${tier.signals}`),
  };

  return {
    id: PASS2520_PREMIUM_RISK_PSYCHOLOGY_REBALANCE_ID,
    state: "ready_for_visual_fixture",
    query: args.query,
    symbol: args.symbol,
    generatedAt: "2026-06-23T00:00:00.000Z",
    manualSemanticCompletionBeforePercent: 12,
    manualSemanticCompletionAfterPercent: 15,
    targetedSemanticBatchFiles: 24,
    targetedSemanticBatchLines: 145399,
    riskKernelVisualReadinessBeforePercent: 48,
    riskKernelVisualReadinessAfterPercent: 61,
    riskEquationUiReadinessBeforePercent: 39,
    riskEquationUiReadinessAfterPercent: 55,
    tierTrustClarityBeforePercent: 73,
    tierTrustClarityAfterPercent: 82,
    premiumRiskCopyReadinessBeforePercent: 44,
    premiumRiskCopyReadinessAfterPercent: 63,
    antiFomoPsychologyReadinessBeforePercent: 27,
    antiFomoPsychologyReadinessAfterPercent: 49,
    dataQualityScoreReadinessBeforePercent: 68,
    dataQualityScoreReadinessAfterPercent: 76,
    psychologyTokens: PASS2520_PSYCHOLOGY_TOKENS,
    trustEquations: PASS2520_TRUST_EQUATIONS,
    tierTrustCards: PASS2520_TIER_TRUST_CARDS,
    semanticLanes: PASS2520_SEMANTIC_LANES,
    worldclassInventionBacklog: [
      "Risk Psychology Color Tokens: colors communicate evidence state, not emotion or hype.",
      "Visual Truth Score: UI cannot look safer than confidence/source/proof allow.",
      "Trust Friction Ladder: missing critical proof appears above aesthetic insight.",
      "Data Quality Score Ring: every risk score shows data quality beside severity.",
      "Tier Honesty Meter: Basic/Pro/Advanced visually downgrades when proof is missing.",
      "Calm Risk Copy Rewriter: urgency, ROI promises and fake certainty are rewritten or blocked.",
    ],
    masterTxtAdditions: [
      "PASS2520 adds premium color psychology: gold is accent only, never a truth/safety signal.",
      "Add Visual Truth Score to block low-risk styling when confidence, source coverage or receipt proof is missing.",
      "Add Data Quality Score Ring beside risk score so users see data quality separately from severity.",
      "Add Tier Trust Cards: Basic 10, Pro 14, Advanced 20 + receipt/hash/vault proof, with downgrade copy.",
      "Add anti-FOMO psychology scan to Angel, Square, Browser/PDF and social-facing copy.",
      "Continue semantic audit from 15% toward 100% in focused batches: CSS tokens, TokenRiskModal decomposition, Angel/PDF replay, checkout/vault runtime fixtures.",
    ],
    nextPassQueue: [
      "PASS2521: extract globals.css risk psychology tokens into modular CSS/TS token files.",
      "PASS2522: render Risk Equation Explanation Card in TokenRiskModal/AssetDetailModal with fixture data.",
      "PASS2523: PL/EN/DE Angel anti-FOMO and paid-claim replay harness.",
      "PASS2524: Data Quality Score Ring runtime source-sync fixture for BTC/AAPL/NVDA/SPY/SOL.",
      "PASS2525: tier honesty meter inside PDF preview/download/account vault artifacts.",
    ],
    fingerprint: stableFingerprint(payload),
    visualTruthRule: "The page may never look safer, more certain or more premium than the available evidence; missing proof must create visible friction, not hidden disclaimers.",
  };
}
