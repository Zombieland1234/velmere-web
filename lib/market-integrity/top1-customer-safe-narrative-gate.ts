export type Pass2826NarrativeReleaseDecision = "allow" | "redact" | "block" | "review";

export type Pass2826CustomerSafeNarrativeGate = {
  schemaVersion: "pass2826_customer_safe_narrative_gate_v1";
  surface: string;
  tier: "Basic" | "Pro" | "Advanced";
  assetFamily: string;
  decision: Pass2826NarrativeReleaseDecision;
  customerVisibleSummary: string;
  claimLedger: Array<{
    claim: string;
    evidenceBinding: "source_receipt" | "missing_evidence" | "operator_addendum" | "methodology" | "blocked";
    allowedForCustomer: boolean;
    reason: string;
  }>;
  requiredNarrativeBlocks: {
    verdict: boolean;
    riskScore: boolean;
    confidenceScore: boolean;
    sourceStatus: boolean;
    missingEvidence: boolean;
    tierBoundary: boolean;
    notAdvice: boolean;
  };
  forbiddenLanguage: {
    detected: string[];
    blocked: boolean;
    replacementRule: string;
  };
  evidenceExplanation: {
    topDriversCount: number;
    mitigatorsCount: number;
    missingEvidenceCount: number;
    sourceFamilyCount: number;
    providerConflictCount: number;
    confidenceCapReason: string;
  };
  paidBoundary: {
    paidEvidenceAllowed: boolean;
    advancedReviewAllowed: boolean;
    redactionRule: string;
  };
  localeBoundary: {
    locale: "pl" | "en" | "de";
    localePure: boolean;
    rule: string;
  };
  releaseGate: {
    status: "allow" | "review" | "block";
    reason: string;
  };
  pdfRenderRule: string;
  angelNarrativeRule: string;
  auditTrail: Array<{ kind: "claim" | "evidence" | "paid_boundary" | "locale" | "ai_safety"; status: string }>;
};

export const PASS2826_CUSTOMER_SAFE_NARRATIVE_ACCEPTANCE_GATES = [
  "PASS2826: Customer-visible risk narratives must include risk, confidence, source status, missing evidence, tier boundary and not-advice language in the same payload.",
  "PASS2826: Narratives cannot use secure, guaranteed safe, risk-free, buy now, sell now, emergency or profit-pressure language unless converted into neutral evidence-bound wording.",
  "PASS2826: Every strong claim must bind to source receipt, methodology, missing evidence or signed Advanced addendum; unbound claims render as review/redacted metadata.",
  "PASS2826: Basic/Pro/Advanced narratives must not expose paid evidence unless report access, token, payload hash and source receipt root gates pass.",
  "PASS2826: Angel/VLM Brain/PDF/Shield Pro must share the same customer-safe narrative gate so AI copy cannot drift from PDF/source truth.",
] as const;

const FORBIDDEN_PATTERNS: Array<[RegExp, string]> = [
  [/\bsecure\b/i, "secure"],
  [/guaranteed\s+(safe|profit|return)/i, "guaranteed_claim"],
  [/risk[- ]?free/i, "risk_free"],
  [/\bbuy\s+now\b/i, "buy_now"],
  [/\bsell\s+now\b/i, "sell_now"],
  [/emergency\s+(buy|sell|profit)/i, "emergency_trade_pressure"],
  [/100%\s+(safe|profit|certain)/i, "absolute_certainty"],
];

function detectForbiddenLanguage(text: string) {
  return FORBIDDEN_PATTERNS.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
}

function statusFromDecision(decision: Pass2826NarrativeReleaseDecision): "allow" | "review" | "block" {
  if (decision === "block") return "block";
  if (decision === "redact" || decision === "review") return "review";
  return "allow";
}

export function buildPass2826CustomerSafeNarrativeGate(args: {
  surface: string;
  tier: "Basic" | "Pro" | "Advanced";
  assetFamily: string;
  locale?: "pl" | "en" | "de";
  narrativeText?: string | null;
  riskScorePresent?: boolean;
  confidenceScorePresent?: boolean;
  sourceFamilyCount?: number;
  missingEvidenceCount?: number;
  providerConflictCount?: number;
  topDriversCount?: number;
  mitigatorsCount?: number;
  confidenceCapReason?: string | null;
  paidEvidenceAllowed?: boolean;
  advancedReviewAllowed?: boolean;
  sourceReceiptPresent?: boolean;
  methodologyLinked?: boolean;
  missingEvidenceShown?: boolean;
  tierBoundaryShown?: boolean;
  notAdviceShown?: boolean;
  localePure?: boolean;
}): Pass2826CustomerSafeNarrativeGate {
  const narrativeText = args.narrativeText ?? "";
  const forbidden = detectForbiddenLanguage(narrativeText);
  const sourceFamilyCount = Math.max(0, Number(args.sourceFamilyCount ?? 0));
  const missingEvidenceCount = Math.max(0, Number(args.missingEvidenceCount ?? 0));
  const providerConflictCount = Math.max(0, Number(args.providerConflictCount ?? 0));
  const paidEvidenceAllowed = Boolean(args.paidEvidenceAllowed);
  const advancedReviewAllowed = Boolean(args.advancedReviewAllowed);
  const requiredNarrativeBlocks = {
    verdict: narrativeText.trim().length > 0,
    riskScore: Boolean(args.riskScorePresent),
    confidenceScore: Boolean(args.confidenceScorePresent),
    sourceStatus: sourceFamilyCount > 0,
    missingEvidence: Boolean(args.missingEvidenceShown) || missingEvidenceCount > 0,
    tierBoundary: Boolean(args.tierBoundaryShown),
    notAdvice: Boolean(args.notAdviceShown),
  };
  const missingRequired = Object.entries(requiredNarrativeBlocks).filter(([, ok]) => !ok).map(([name]) => name);
  const weakEvidence = sourceFamilyCount < (args.tier === "Basic" ? 1 : args.tier === "Pro" ? 3 : 5);
  const paidLeakRisk = (args.tier === "Pro" || args.tier === "Advanced") && !paidEvidenceAllowed;
  const advancedLeakRisk = args.tier === "Advanced" && !advancedReviewAllowed;
  const localePure = args.localePure !== false;
  let decision: Pass2826NarrativeReleaseDecision = "allow";
  if (!localePure || forbidden.includes("buy_now") || forbidden.includes("sell_now") || forbidden.includes("guaranteed_claim") || forbidden.includes("absolute_certainty")) decision = "block";
  else if (forbidden.length > 0 || paidLeakRisk || advancedLeakRisk) decision = "redact";
  else if (missingRequired.length > 0 || weakEvidence || providerConflictCount > 0) decision = "review";

  const claimLedger = [
    {
      claim: "risk score explanation",
      evidenceBinding: args.riskScorePresent && args.confidenceScorePresent ? "methodology" : "missing_evidence",
      allowedForCustomer: Boolean(args.riskScorePresent && args.confidenceScorePresent),
      reason: "Risk and confidence must appear together; decimal precision without confidence is false certainty.",
    },
    {
      claim: "source status / source quorum",
      evidenceBinding: sourceFamilyCount > 0 ? "source_receipt" : "missing_evidence",
      allowedForCustomer: sourceFamilyCount > 0,
      reason: sourceFamilyCount > 0 ? "At least one source family/receipt is present." : "No source family is present, so narrative must say missing evidence.",
    },
    {
      claim: "paid Pro/Advanced evidence",
      evidenceBinding: paidEvidenceAllowed ? "source_receipt" : "blocked",
      allowedForCustomer: paidEvidenceAllowed || args.tier === "Basic",
      reason: paidEvidenceAllowed ? "Paid report gates passed." : "Paid evidence is redacted until entitlement/report token/payload hash/source root pass.",
    },
    {
      claim: "Advanced analysis verification note",
      evidenceBinding: advancedReviewAllowed ? "operator_addendum" : "blocked",
      allowedForCustomer: args.tier !== "Advanced" || advancedReviewAllowed,
      reason: advancedReviewAllowed ? "Signed Advanced addendum is payload-bound." : "Advanced note must stay locked until signoff/replay gates pass.",
    },
  ] as Pass2826CustomerSafeNarrativeGate["claimLedger"];

  const status = statusFromDecision(decision);
  return {
    schemaVersion: "pass2826_customer_safe_narrative_gate_v1",
    surface: args.surface,
    tier: args.tier,
    assetFamily: args.assetFamily,
    decision,
    customerVisibleSummary: decision === "allow"
      ? "Narrative can render as customer-safe evidence-bound copy."
      : decision === "redact"
        ? "Narrative can render only after paid/forbidden-language redaction."
        : decision === "review"
          ? "Narrative needs review because evidence, required blocks or provider conflict boundaries are incomplete."
          : "Narrative is blocked because it contains unsafe certainty/trade-pressure/language or locale drift.",
    claimLedger,
    requiredNarrativeBlocks,
    forbiddenLanguage: {
      detected: forbidden,
      blocked: forbidden.length > 0,
      replacementRule: "Replace absolute certainty and trade-pressure copy with neutral wording: observed risk based on available evidence, missing evidence, confidence cap, and no buy/sell recommendation.",
    },
    evidenceExplanation: {
      topDriversCount: Math.max(0, Number(args.topDriversCount ?? 0)),
      mitigatorsCount: Math.max(0, Number(args.mitigatorsCount ?? 0)),
      missingEvidenceCount,
      sourceFamilyCount,
      providerConflictCount,
      confidenceCapReason: args.confidenceCapReason ?? (missingEvidenceCount > 0 ? "Missing evidence lowers confidence." : "Confidence follows available source quorum."),
    },
    paidBoundary: {
      paidEvidenceAllowed,
      advancedReviewAllowed,
      redactionRule: "Paid lanes and Advanced notes render only when entitlement, one-time token, payload hash, source root and replay/signoff gates pass.",
    },
    localeBoundary: {
      locale: args.locale ?? "en",
      localePure,
      rule: "Customer narrative must be generated in one locale only; mixed-language snippets are a PDF/customer delivery blocker.",
    },
    releaseGate: {
      status,
      reason: status === "allow" ? "All required customer-safe narrative gates passed." : status === "review" ? "Narrative requires redaction/review before customer delivery." : "Narrative is blocked until unsafe language or locale drift is removed.",
    },
    pdfRenderRule: "PDF can print narrative only when claim ledger, paid redaction, locale purity and required blocks pass; otherwise print missing-evidence/redaction box.",
    angelNarrativeRule: "Angel/VLM Brain must use this gate before answering so chat copy cannot be more certain than PDF/source receipts.",
    auditTrail: [
      { kind: "claim", status: forbidden.length ? `forbidden:${forbidden.join(",")}` : "neutral_language" },
      { kind: "evidence", status: `sources:${sourceFamilyCount}:missing:${missingEvidenceCount}:conflicts:${providerConflictCount}` },
      { kind: "paid_boundary", status: paidEvidenceAllowed ? "paid_evidence_allowed" : "paid_evidence_redacted" },
      { kind: "locale", status: localePure ? `locale_pure:${args.locale ?? "en"}` : "locale_drift_blocked" },
      { kind: "ai_safety", status },
    ],
  };
}
