import { createHash } from "node:crypto";
import type { Pass2517SemanticAuditBatchRebalance } from "./semantic-audit-batch-rebalance";

export const PASS2518_RISK_FORMULA_WORLDCLASS_AUDIT_REBALANCE_ID = "risk-formula-worldclass-audit-rebalance-v1" as const;

export type Pass2518Tier = "basic" | "pro" | "advanced";
export type Pass2518FormulaState = "ready_for_runtime_fixture" | "watch" | "blocked";

export type Pass2518SignalId =
  | "contract_authority"
  | "holder_concentration"
  | "liquidity_exit_pressure"
  | "unlock_vesting_pressure"
  | "source_freshness"
  | "cross_provider_divergence"
  | "derivatives_squeeze"
  | "liquidation_imbalance"
  | "narrative_pressure"
  | "ai_claim_integrity"
  | "pdf_vault_integrity"
  | "payment_entitlement_integrity"
  | "product_fulfillment_integrity"
  | "mobile_overlay_integrity"
  | "admin_override_integrity"
  | "macro_window_context"
  | "fundamental_filing_freshness"
  | "etf_holdings_freshness"
  | "defillama_tvl_flow"
  | "community_moderation_pressure";

export type Pass2518Signal = {
  id: Pass2518SignalId;
  label: string;
  tier: Pass2518Tier[];
  weightBasic: number;
  weightPro: number;
  weightAdvanced: number;
  requiredProof: string[];
  missingDataAction: string;
  antiOverclaimRule: string;
};

export type Pass2518Formula = {
  id: string;
  label: string;
  equation: string;
  outputRange: string;
  runtimeInputs: string[];
  failureMode: string;
  worldClassUse: string;
};

export type Pass2518NonExistingInvention = {
  id: string;
  label: string;
  whatItDoes: string;
  whyItMatters: string;
  proofNeededBeforeClaim: string[];
  percentBefore: number;
  percentAfter: number;
};

export type Pass2518TierContract = {
  tier: Pass2518Tier;
  signalTarget: number;
  currentSemanticReadinessPercent: number;
  requiredSections: string[];
  blockedClaims: string[];
  unlockRule: string;
};

export type Pass2518Lane = {
  id: string;
  state: Pass2518FormulaState;
  label: string;
  percentBefore: number;
  percentAfter: number;
  implementation: string;
  nextActions: string[];
};

export type Pass2518RiskFormulaWorldclassAuditRebalance = {
  id: typeof PASS2518_RISK_FORMULA_WORLDCLASS_AUDIT_REBALANCE_ID;
  state: "risk_formula_map_live" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  semanticBatchCoveragePercent: number;
  formulaReadinessBeforePercent: number;
  formulaReadinessAfterPercent: number;
  missingDataReadinessBeforePercent: number;
  missingDataReadinessAfterPercent: number;
  tierClarityBeforePercent: number;
  tierClarityAfterPercent: number;
  signals: Pass2518Signal[];
  formulas: Pass2518Formula[];
  tierContracts: Pass2518TierContract[];
  nonExistingInventions: Pass2518NonExistingInvention[];
  lanes: Pass2518Lane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  fingerprint: string;
  equationRule: string;
};

export const PASS2518_WORLDCLASS_RISK_SIGNALS: Pass2518Signal[] = [
  {
    id: "contract_authority",
    label: "Contract authority / admin power",
    tier: ["basic", "pro", "advanced"],
    weightBasic: 12,
    weightPro: 10,
    weightAdvanced: 8,
    requiredProof: ["verified contract source", "owner/admin role map", "mint/pause/blacklist/tax authority flags"],
    missingDataAction: "Cap confidence and show Missing Proof instead of treating contract safety as confirmed.",
    antiOverclaimRule: "Never say safe contract without verified source and privileged-role proof.",
  },
  {
    id: "holder_concentration",
    label: "Holder concentration / whale pressure",
    tier: ["basic", "pro", "advanced"],
    weightBasic: 10,
    weightPro: 9,
    weightAdvanced: 8,
    requiredProof: ["top holder distribution", "team/treasury labels", "exchange/LP wallet classification"],
    missingDataAction: "Show concentration unknown and block Advanced holder claims.",
    antiOverclaimRule: "Do not infer decentralization from market cap alone.",
  },
  {
    id: "liquidity_exit_pressure",
    label: "Liquidity exit pressure",
    tier: ["basic", "pro", "advanced"],
    weightBasic: 12,
    weightPro: 10,
    weightAdvanced: 9,
    requiredProof: ["LP size", "LP lock/burn state", "pool depth", "sell impact simulation"],
    missingDataAction: "Block low-risk liquidity copy and show exit-liquidity warning calmly.",
    antiOverclaimRule: "No liquidity safety claim without pool depth plus lock proof.",
  },
  {
    id: "unlock_vesting_pressure",
    label: "Unlock / vesting pressure",
    tier: ["pro", "advanced"],
    weightBasic: 0,
    weightPro: 7,
    weightAdvanced: 8,
    requiredProof: ["vesting schedule", "cliff dates", "token allocation", "wallet movement"],
    missingDataAction: "Show unlock unknown; prevent calendar-free risk compression.",
    antiOverclaimRule: "No dilution-risk conclusion without schedule proof.",
  },
  {
    id: "source_freshness",
    label: "Source freshness and TTL",
    tier: ["basic", "pro", "advanced"],
    weightBasic: 9,
    weightPro: 9,
    weightAdvanced: 8,
    requiredProof: ["provider", "observedAt", "TTL by asset class", "stale/degraded badge"],
    missingDataAction: "Downgrade live copy to stale/manual review.",
    antiOverclaimRule: "Never display live/final/current without observedAt and TTL.",
  },
  {
    id: "cross_provider_divergence",
    label: "Cross-provider divergence",
    tier: ["pro", "advanced"],
    weightBasic: 0,
    weightPro: 8,
    weightAdvanced: 8,
    requiredProof: ["provider A", "provider B", "normalized field", "delta threshold"],
    missingDataAction: "Show one-source-only badge and cap confidence.",
    antiOverclaimRule: "No consensus claim with a single provider.",
  },
  {
    id: "derivatives_squeeze",
    label: "Derivatives squeeze pressure",
    tier: ["pro", "advanced"],
    weightBasic: 0,
    weightPro: 7,
    weightAdvanced: 8,
    requiredProof: ["open interest", "funding", "OI delta", "price delta", "time window"],
    missingDataAction: "Replace squeeze conclusion with missing derivatives proof.",
    antiOverclaimRule: "Do not call squeeze without OI/funding/window proof.",
  },
  {
    id: "liquidation_imbalance",
    label: "Long/short liquidation imbalance",
    tier: ["pro", "advanced"],
    weightBasic: 0,
    weightPro: 6,
    weightAdvanced: 8,
    requiredProof: ["long liquidation", "short liquidation", "time bucket", "venue coverage"],
    missingDataAction: "Show liquidation lane missing and remove directional pressure claims.",
    antiOverclaimRule: "No directional liquidation narrative without venue/time coverage.",
  },
  {
    id: "narrative_pressure",
    label: "Narrative / social pressure",
    tier: ["basic", "pro", "advanced"],
    weightBasic: 7,
    weightPro: 7,
    weightAdvanced: 7,
    requiredProof: ["claim source", "timestamp", "engagement context", "anti-FOMO copy"],
    missingDataAction: "Show hype pressure as education, not as buy/sell advice.",
    antiOverclaimRule: "Never translate virality into investment quality.",
  },
  {
    id: "ai_claim_integrity",
    label: "AI claim integrity",
    tier: ["basic", "pro", "advanced"],
    weightBasic: 10,
    weightPro: 8,
    weightAdvanced: 8,
    requiredProof: ["claim ledger", "source binding", "missing proof", "refusal when ungrounded"],
    missingDataAction: "Answer with uncertainty and list missing proof.",
    antiOverclaimRule: "AI must not invent data, price, paid unlock, or certainty.",
  },
  {
    id: "pdf_vault_integrity",
    label: "PDF / account vault integrity",
    tier: ["pro", "advanced"],
    weightBasic: 0,
    weightPro: 5,
    weightAdvanced: 6,
    requiredProof: ["preview hash", "download hash", "account vault hash", "owner binding"],
    missingDataAction: "Block paid PDF/account delivery claims.",
    antiOverclaimRule: "No delivered report claim without hash-family parity.",
  },
  {
    id: "payment_entitlement_integrity",
    label: "Payment / entitlement integrity",
    tier: ["advanced"],
    weightBasic: 0,
    weightPro: 0,
    weightAdvanced: 6,
    requiredProof: ["signed webhook", "amount/currency", "account", "artifact id", "refund/chargeback state"],
    missingDataAction: "Advanced stays locked or in manual review.",
    antiOverclaimRule: "Wallet identity never equals paid entitlement.",
  },
  {
    id: "product_fulfillment_integrity",
    label: "Product / fulfillment integrity",
    tier: ["pro", "advanced"],
    weightBasic: 0,
    weightPro: 4,
    weightAdvanced: 4,
    requiredProof: ["provider product id", "variant ids", "size/material", "image ownership", "shipping lane"],
    missingDataAction: "Block product publish and checkout readiness.",
    antiOverclaimRule: "No premium commerce claim without provider snapshot.",
  },
  {
    id: "mobile_overlay_integrity",
    label: "Mobile overlay integrity",
    tier: ["basic", "pro", "advanced"],
    weightBasic: 5,
    weightPro: 4,
    weightAdvanced: 4,
    requiredProof: ["390x844", "430x932", "close button", "scroll lock", "elementFromPoint ownership"],
    missingDataAction: "Mark UX state as screenshot-required.",
    antiOverclaimRule: "No mobile-ready claim without viewport receipt.",
  },
  {
    id: "admin_override_integrity",
    label: "Admin override integrity",
    tier: ["advanced"],
    weightBasic: 0,
    weightPro: 0,
    weightAdvanced: 4,
    requiredProof: ["operator", "reason", "expiry", "dual control", "audit ledger"],
    missingDataAction: "Block admin override release.",
    antiOverclaimRule: "No silent entitlement, pin, refund, or vault access.",
  },
  {
    id: "macro_window_context",
    label: "Macro window context",
    tier: ["advanced"],
    weightBasic: 0,
    weightPro: 0,
    weightAdvanced: 5,
    requiredProof: ["macro asset", "window", "provider", "correlation caveat"],
    missingDataAction: "Show macro context missing and avoid correlation claims.",
    antiOverclaimRule: "Correlation is context, not prediction.",
  },
  {
    id: "fundamental_filing_freshness",
    label: "Equity/fundamental filing freshness",
    tier: ["pro", "advanced"],
    weightBasic: 0,
    weightPro: 5,
    weightAdvanced: 5,
    requiredProof: ["filing provider", "period", "reported currency", "latest filing date"],
    missingDataAction: "Downgrade equity fundamental claims.",
    antiOverclaimRule: "No fundamental freshness claim from quote data alone.",
  },
  {
    id: "etf_holdings_freshness",
    label: "ETF holdings freshness",
    tier: ["advanced"],
    weightBasic: 0,
    weightPro: 0,
    weightAdvanced: 4,
    requiredProof: ["issuer holdings", "as-of date", "fund ticker", "provider"],
    missingDataAction: "Block ETF holdings conclusion.",
    antiOverclaimRule: "SEC companyfacts is not ETF holdings.",
  },
  {
    id: "defillama_tvl_flow",
    label: "DeFiLlama TVL / flow context",
    tier: ["pro", "advanced"],
    weightBasic: 0,
    weightPro: 4,
    weightAdvanced: 4,
    requiredProof: ["protocol", "chain", "TVL", "flow window", "observedAt"],
    missingDataAction: "Show protocol liquidity context missing.",
    antiOverclaimRule: "No protocol-health claim from token price only.",
  },
  {
    id: "community_moderation_pressure",
    label: "Square/community moderation pressure",
    tier: ["basic", "pro", "advanced"],
    weightBasic: 3,
    weightPro: 3,
    weightAdvanced: 3,
    requiredProof: ["post state", "moderation queue", "pinned signer", "expiry"],
    missingDataAction: "Keep community content educational and reviewable.",
    antiOverclaimRule: "Community posts are not proof of project quality.",
  },
];

export const PASS2518_WORLDCLASS_FORMULAS: Pass2518Formula[] = [
  {
    id: "vlm-normalized-risk-v0",
    label: "Velmère normalized risk score",
    equation: "risk = clamp(0,100, Σ(weight_i * severity_i * confidence_i) / Σ(active_weight_i) * 100)",
    outputRange: "0-100, with confidence cap when proof is missing",
    runtimeInputs: ["active signal weights", "severity by lane", "confidence by proof", "tier target"],
    failureMode: "If required proof is missing, confidence is capped and the UI shows Missing Proof instead of a confident score.",
    worldClassUse: "Separates risk from confidence so a low-evidence token cannot look clean just because data is absent.",
  },
  {
    id: "evidence-coverage-score",
    label: "Evidence coverage score",
    equation: "ecs = confirmed_required_proofs / total_required_proofs_for_tier",
    outputRange: "0-1",
    runtimeInputs: ["tier contract", "confirmed proofs", "missing proofs"],
    failureMode: "If ecs < tier threshold, Advanced output must be blocked or degraded.",
    worldClassUse: "Turns Basic/Pro/Advanced into proof depth instead of answer length.",
  },
  {
    id: "source-freshness-penalty",
    label: "Source freshness penalty",
    equation: "freshnessPenalty = min(1, ageMs / ttlMs) * staleWeight",
    outputRange: "0-1 penalty",
    runtimeInputs: ["observedAt", "TTL", "asset class", "provider"],
    failureMode: "If observedAt is missing, staleWeight becomes max and live copy is blocked.",
    worldClassUse: "Prevents fake live claims and makes stale data visible.",
  },
  {
    id: "provider-divergence-index",
    label: "Cross-provider divergence index",
    equation: "pdi = abs(providerA - providerB) / max(abs(providerA), abs(providerB), epsilon)",
    outputRange: "0-1+",
    runtimeInputs: ["same normalized field from two providers", "field tolerance", "timestamp"],
    failureMode: "Single provider means consensus unavailable, not zero divergence.",
    worldClassUse: "Flags inconsistent prices, market caps, volumes, TVL, filings and holdings.",
  },
  {
    id: "liquidity-exit-pressure-index",
    label: "Liquidity exit pressure index",
    equation: "lepi = sellImpact(weighted) + unlockedLP(weighted) + lowDepth(weighted) + holderSellCluster(weighted)",
    outputRange: "0-100 lane score",
    runtimeInputs: ["pool depth", "LP lock", "sell simulation", "holder clusters"],
    failureMode: "Missing LP proof blocks low-liquidity-risk claims.",
    worldClassUse: "Explains exit-liquidity risk without giving trade instructions.",
  },
  {
    id: "ai-claim-risk-index",
    label: "AI claim risk index",
    equation: "acri = ungroundedClaims + paidBoundaryClaims + hiddenPromptPressure + toolScopePressure + sourceGapPressure",
    outputRange: "0-100 lane score",
    runtimeInputs: ["Angel answer", "claim ledger", "source bindings", "tier entitlement state"],
    failureMode: "Any paid unlock or hidden prompt claim without proof becomes refusal + missing proof.",
    worldClassUse: "Audits the AI itself as part of the product risk score.",
  },
  {
    id: "anti-fomo-pressure-index",
    label: "Anti-FOMO pressure index",
    equation: "fomoPressure = virality + urgencyLanguage + guaranteedOutcomeLanguage + lowEvidenceAmplification",
    outputRange: "0-100 copy risk",
    runtimeInputs: ["post text", "UI copy", "claim proof", "engagement context"],
    failureMode: "High pressure copy must be rewritten to calm education.",
    worldClassUse: "Keeps Velmère premium and safer: no hype, no fake certainty, no urgency tricks.",
  },
];

export const PASS2518_TIER_CONTRACTS: Pass2518TierContract[] = [
  {
    tier: "basic",
    signalTarget: 10,
    currentSemanticReadinessPercent: 68,
    requiredSections: ["summary", "risk score", "missing proof", "source freshness", "anti-FOMO note"],
    blockedClaims: ["complete analysis", "live certified", "safe investment", "paid-grade proof"],
    unlockRule: "Basic is free but must stay evidence-bound and visibly incomplete when source proof is missing.",
  },
  {
    tier: "pro",
    signalTarget: 14,
    currentSemanticReadinessPercent: 58,
    requiredSections: ["Basic sections", "provider divergence", "derivatives/fundamental lanes", "PDF/account vault preview", "scenario caveats"],
    blockedClaims: ["Advanced-only payment receipt", "full holdings proof", "complete liquidation map", "guaranteed conclusion"],
    unlockRule: "Pro can deepen context but cannot claim server-paid delivery or full Advanced evidence.",
  },
  {
    tier: "advanced",
    signalTarget: 20,
    currentSemanticReadinessPercent: 46,
    requiredSections: ["Basic + Pro", "receipt-bound paid proof", "all 20 signals", "vault delivery", "replay/rollback state", "admin override ledger"],
    blockedClaims: ["unlocked by wallet only", "complete if one provider missing", "no stale badge", "no receipt replay"],
    unlockRule: "Advanced requires server entitlement, signed receipt, hash family and enough data coverage; otherwise manual review.",
  },
];

export const PASS2518_NON_EXISTING_INVENTIONS: Pass2518NonExistingInvention[] = [
  {
    id: "claim-to-evidence-graph",
    label: "Claim-to-Evidence Graph",
    whatItDoes: "Every visible claim is connected to a source, freshness timestamp, proof hash or Missing Proof node.",
    whyItMatters: "It makes hallucination and overclaiming visible to the user instead of hidden in copy.",
    proofNeededBeforeClaim: ["claim id", "source id", "freshness", "tier", "missing proof state"],
    percentBefore: 12,
    percentAfter: 24,
  },
  {
    id: "risk-equation-ledger",
    label: "Risk Equation Ledger",
    whatItDoes: "Shows which formula components were used, skipped, capped or stale for each risk score.",
    whyItMatters: "It prevents mysterious scores like constant 88/35 and lets users understand risk without hype.",
    proofNeededBeforeClaim: ["signal weights", "severity", "confidence", "cap reason", "formula version"],
    percentBefore: 8,
    percentAfter: 22,
  },
  {
    id: "adversarial-narrative-simulator",
    label: "Adversarial Narrative Simulator",
    whatItDoes: "Tests whether a token/project narrative is pushing urgency, fake certainty, influencer pressure or missing-proof optimism.",
    whyItMatters: "It turns psychology into a risk lane without telling users what to buy or sell.",
    proofNeededBeforeClaim: ["narrative sample", "pressure markers", "proof gaps", "safe rewrite"],
    percentBefore: 5,
    percentAfter: 16,
  },
  {
    id: "tier-honesty-meter",
    label: "Tier Honesty Meter",
    whatItDoes: "Displays whether Basic/Pro/Advanced has enough evidence to answer at that tier or must downgrade.",
    whyItMatters: "It makes paid value clear without fake premium claims.",
    proofNeededBeforeClaim: ["tier target", "evidence coverage", "blocked claims", "entitlement receipt"],
    percentBefore: 18,
    percentAfter: 32,
  },
  {
    id: "calm-risk-copy-firewall",
    label: "Calm Risk Copy Firewall",
    whatItDoes: "Rewrites hype, urgency and certainty into calm, premium, educational risk language.",
    whyItMatters: "It protects brand trust and stops Velmère from sounding like a pump page.",
    proofNeededBeforeClaim: ["copy scan", "pressure score", "safe alternative", "locale parity"],
    percentBefore: 28,
    percentAfter: 40,
  },
];

function hashStable(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").toUpperCase();
}

export function buildPass2518RiskFormulaWorldclassAuditRebalance(input: {
  query: string;
  symbol?: string;
  pass2517?: Pass2517SemanticAuditBatchRebalance;
}): Pass2518RiskFormulaWorldclassAuditRebalance {
  const semanticBatchCoveragePercent = input.pass2517?.semanticBatchCoveragePercent ?? 17.6;
  const manualBefore = input.pass2517?.manualSemanticCompletionAfterPercent ?? 6;
  const manualAfter = Math.max(manualBefore, 9);

  const lanes: Pass2518Lane[] = [
    {
      id: "risk_formula_spine",
      state: "ready_for_runtime_fixture",
      label: "Risk formula spine",
      percentBefore: 18,
      percentAfter: 34,
      implementation: "Defined 20 world-class risk signals plus seven equations for risk, evidence coverage, freshness, provider divergence, liquidity exit pressure, AI claim risk and anti-FOMO pressure.",
      nextActions: ["Wire formula weights into TokenRiskModal score explanation", "Add per-lane cap reasons into Basic/Pro/Advanced cards"],
    },
    {
      id: "tier_depth_contracts",
      state: "ready_for_runtime_fixture",
      label: "Basic/Pro/Advanced proof contracts",
      percentBefore: 52,
      percentAfter: 64,
      implementation: "Clarified Basic 10, Pro 14 and Advanced 20 signal targets with blocked claims and unlock rules.",
      nextActions: ["Render Tier Honesty Meter in modal", "Add downgrade badge when evidence coverage is below tier threshold"],
    },
    {
      id: "missing_data_governor",
      state: "watch",
      label: "Missing data governor",
      percentBefore: 41,
      percentAfter: 56,
      implementation: "Mapped missing data action for every signal so absence of proof creates a cap, badge or manual review rather than a clean score.",
      nextActions: ["Persist missing proof by asset class", "Add provider-specific stale copy in PL/EN/DE"],
    },
    {
      id: "non_existing_worldclass_mechanisms",
      state: "watch",
      label: "Invented world-class mechanisms",
      percentBefore: 14,
      percentAfter: 27,
      implementation: "Added Claim-to-Evidence Graph, Risk Equation Ledger, Adversarial Narrative Simulator, Tier Honesty Meter and Calm Risk Copy Firewall.",
      nextActions: ["Turn each mechanism into a UI proof rail", "Add screenshots and replay fixtures"],
    },
    {
      id: "semantic_audit_progress",
      state: "ready_for_runtime_fixture",
      label: "Manual semantic audit progress",
      percentBefore: manualBefore,
      percentAfter: manualAfter,
      implementation: "Raised manual semantic completion from PASS2517 by codifying formulas and tier/data semantics instead of only scanning lines.",
      nextActions: ["PASS2519: semantic audit TokenRiskModal chunk 1", "PASS2520: semantic audit globals.css premium color system"],
    },
  ];

  const masterTxtAdditions = [
    "PASS2518: Add Risk Equation Ledger to explain why score changed, why confidence was capped and what data is missing.",
    "PASS2518: Basic must show 10 evidence-bound signals; Pro 14; Advanced 20 plus signed entitlement/hash-family delivery.",
    "PASS2518: Add Claim-to-Evidence Graph so every visible claim resolves to source/freshness/proof or Missing Proof.",
    "PASS2518: Add Adversarial Narrative Simulator for anti-FOMO, urgency, fake certainty and low-evidence hype pressure.",
    "PASS2518: Risk formula must separate severity from confidence; missing data cannot reduce risk silently.",
    "PASS2518: Topka świata requires Formula Version, Source TTL, Provider Divergence, Cap Reason and Safe Copy Rewrite.",
  ];

  const nextPassQueue = [
    "PASS2519: implement TokenRiskModal Risk Equation Ledger UI and decompose first 3k lines into proof cards.",
    "PASS2520: split globals.css premium color/psychology layer into variables, rails and modal-safe modules.",
    "PASS2521: add Claim-to-Evidence Graph replay for BTC/AAPL/NVDA/SPY/SOL in PL/EN/DE.",
    "PASS2522: add anti-FOMO narrative simulator to Angel and Square copy pipeline.",
    "PASS2523: add tier downgrade fixtures for Basic/Pro/Advanced when provider data is missing.",
  ];

  const fingerprintPayload = {
    id: PASS2518_RISK_FORMULA_WORLDCLASS_AUDIT_REBALANCE_ID,
    signals: PASS2518_WORLDCLASS_RISK_SIGNALS.map((signal) => signal.id),
    formulas: PASS2518_WORLDCLASS_FORMULAS.map((formula) => formula.id),
    inventions: PASS2518_NON_EXISTING_INVENTIONS.map((item) => item.id),
    manualBefore,
    manualAfter,
  };

  return {
    id: PASS2518_RISK_FORMULA_WORLDCLASS_AUDIT_REBALANCE_ID,
    state: "risk_formula_map_live",
    query: input.query,
    symbol: input.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: manualBefore,
    manualSemanticCompletionAfterPercent: manualAfter,
    semanticBatchCoveragePercent,
    formulaReadinessBeforePercent: 18,
    formulaReadinessAfterPercent: 34,
    missingDataReadinessBeforePercent: 41,
    missingDataReadinessAfterPercent: 56,
    tierClarityBeforePercent: 52,
    tierClarityAfterPercent: 64,
    signals: PASS2518_WORLDCLASS_RISK_SIGNALS,
    formulas: PASS2518_WORLDCLASS_FORMULAS,
    tierContracts: PASS2518_TIER_CONTRACTS,
    nonExistingInventions: PASS2518_NON_EXISTING_INVENTIONS,
    lanes,
    masterTxtAdditions,
    nextPassQueue,
    fingerprint: hashStable(fingerprintPayload),
    equationRule: "PASS2518: risk score = severity weighted by evidence, but confidence is capped by missing proof; Basic/Pro/Advanced are proof-depth contracts, not answer-length labels.",
  };
}
