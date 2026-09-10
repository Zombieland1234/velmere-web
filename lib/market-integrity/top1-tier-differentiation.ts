import { buildPdfChartLifecycleDecision, type ChartLifecycleReceipt, type SourceReceipt, type VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";

export type TierEvidenceLaneState = "visible" | "locked" | "not_applicable";

export type TierEvidenceLane = {
  id: string;
  label: string;
  state: TierEvidenceLaneState;
  customerCopy: string;
  receiptRule: string;
};

export type TierEvidenceProfile = {
  schemaVersion: "pass2811_tier_evidence_profile_v1";
  tier: VelmereTier;
  sourceFamilyBudget: string;
  minimumIndependentSourceFamilies: number;
  pdfPageBudget: string;
  chartPolicy: "basic_skeleton_or_single_source" | "pro_source_chart_with_receipts" | "advanced_reviewed_chart_with_conflict_notes";
  receiptBundle: "summary_only" | "visible_source_receipts" | "signed_receipt_bundle";
  humanReview: "not_included" | "locked" | "required";
  entitlementRule: string;
  visibleLanes: TierEvidenceLane[];
  lockedLanes: TierEvidenceLane[];
  acceptanceGate: string;
};

export type TierDifferentiationGate = {
  schemaVersion: "pass2811_basic_pro_advanced_diff_gate_v1";
  passed: boolean;
  checkedAt: string;
  tiersCompared: VelmereTier[];
  fieldSetFingerprints: Record<VelmereTier, string>;
  failures: string[];
  customerSafeCopy: string;
};

const LANE_COPY: Record<string, { label: string; customerCopy: string; receiptRule: string }> = {
  identity: {
    label: "Identity / target resolution",
    customerCopy: "Target identity, symbol/name, chain/family and visible source label.",
    receiptRule: "Must show the resolver/source family used for the target.",
  },
  decimal_score: {
    label: "Decimal risk + confidence",
    customerCopy: "Risk and confidence are shown separately with two decimal places.",
    receiptRule: "Must use the canonical methodology summary, not a rounded UI-only number.",
  },
  missing_evidence: {
    label: "Missing evidence",
    customerCopy: "Missing lanes are visible and lower confidence instead of being hidden.",
    receiptRule: "Each missing lane must be named in the payload.",
  },
  source_receipts: {
    label: "Source receipt table",
    customerCopy: "Provider, source family, timestamp, freshness and used lane are visible.",
    receiptRule: "Requires receipt ids and provider-family grouping.",
  },
  chart_lifecycle: {
    label: "Chart lifecycle / PDF parity",
    customerCopy: "Charts either carry source candles or render as neutral skeleton/unavailable boxes.",
    receiptRule: "Requires ChartLifecycleReceipt and PdfChartRenderDecision.",
  },
  provider_conflict: {
    label: "Provider conflict review",
    customerCopy: "Provider disagreements are shown and lower confidence until reviewed.",
    receiptRule: "Requires conflict count and source-family labels.",
  },
  liquidity_microstructure: {
    label: "Liquidity / order-book / slippage lanes",
    customerCopy: "Depth, spread, slippage and stress lanes are shown only when provider receipts exist.",
    receiptRule: "Requires venue-labelled provider receipts; otherwise remains locked/missing.",
  },
  human_review: {
    label: "Manual QA / operator notes",
    customerCopy: "Advanced review notes are private, signed and access-controlled.",
    receiptRule: "Requires server entitlement, operator audit log and signed receipt.",
  },
  private_delivery: {
    label: "Private delivery / account receipt",
    customerCopy: "Advanced report delivery is tied to account/receipt, never to client-only state.",
    receiptRule: "Requires server-side entitlement receipt and expiring report token.",
  },
};

function lane(id: keyof typeof LANE_COPY, state: TierEvidenceLaneState): TierEvidenceLane {
  const base = LANE_COPY[id];
  return { id, state, ...base };
}

export function buildTierEvidenceProfile(tier: VelmereTier): TierEvidenceProfile {
  if (tier === "Advanced") {
    const visibleLanes = [
      lane("identity", "visible"),
      lane("decimal_score", "visible"),
      lane("missing_evidence", "visible"),
      lane("source_receipts", "visible"),
      lane("chart_lifecycle", "visible"),
      lane("provider_conflict", "visible"),
      lane("liquidity_microstructure", "visible"),
      lane("human_review", "visible"),
      lane("private_delivery", "visible"),
    ];
    return {
      schemaVersion: "pass2811_tier_evidence_profile_v1",
      tier,
      sourceFamilyBudget: "8–12+ source families when available",
      minimumIndependentSourceFamilies: 8,
      pdfPageBudget: "full PDF + signed appendix + operator notes",
      chartPolicy: "advanced_reviewed_chart_with_conflict_notes",
      receiptBundle: "signed_receipt_bundle",
      humanReview: "required",
      entitlementRule: "Requires server-side paid entitlement, signed operator receipt and private delivery token. Client state or success URL is never enough.",
      visibleLanes,
      lockedLanes: [],
      acceptanceGate: "Advanced must contain human-review boundary, conflict notes and private receipt state; it cannot be Pro with longer text.",
    };
  }

  if (tier === "Pro") {
    const visibleLanes = [
      lane("identity", "visible"),
      lane("decimal_score", "visible"),
      lane("missing_evidence", "visible"),
      lane("source_receipts", "visible"),
      lane("chart_lifecycle", "visible"),
      lane("provider_conflict", "visible"),
      lane("liquidity_microstructure", "visible"),
    ];
    const lockedLanes = [lane("human_review", "locked"), lane("private_delivery", "locked")];
    return {
      schemaVersion: "pass2811_tier_evidence_profile_v1",
      tier,
      sourceFamilyBudget: "5–8 source families",
      minimumIndependentSourceFamilies: 5,
      pdfPageBudget: "full automatic PDF + source receipt table",
      chartPolicy: "pro_source_chart_with_receipts",
      receiptBundle: "visible_source_receipts",
      humanReview: "locked",
      entitlementRule: "Requires server-side paid entitlement for full PDF/source receipts. Success URL alone is not an entitlement.",
      visibleLanes,
      lockedLanes,
      acceptanceGate: "Pro must expose receipts, conflicts and chart lifecycle. Manual review stays visibly locked.",
    };
  }

  const visibleLanes = [lane("identity", "visible"), lane("decimal_score", "visible"), lane("missing_evidence", "visible"), lane("chart_lifecycle", "visible")];
  const lockedLanes = [
    lane("source_receipts", "locked"),
    lane("provider_conflict", "locked"),
    lane("liquidity_microstructure", "locked"),
    lane("human_review", "locked"),
    lane("private_delivery", "locked"),
  ];
  return {
    schemaVersion: "pass2811_tier_evidence_profile_v1",
    tier,
    sourceFamilyBudget: "2–4 source families max",
    minimumIndependentSourceFamilies: 2,
    pdfPageBudget: "short public pre-screen / limited or watermarked preview",
    chartPolicy: "basic_skeleton_or_single_source",
    receiptBundle: "summary_only",
    humanReview: "not_included",
    entitlementRule: "Free public triage only. It must show missing evidence and paid boundaries without pretending to be a full audit.",
    visibleLanes,
    lockedLanes,
    acceptanceGate: "Basic must remain a short triage with visible missing evidence; it cannot silently show Pro/Advanced proof lanes.",
  };
}

export function buildTierFieldSetFingerprint(profile: TierEvidenceProfile) {
  return [
    profile.tier,
    profile.minimumIndependentSourceFamilies,
    profile.pdfPageBudget,
    profile.chartPolicy,
    profile.receiptBundle,
    profile.humanReview,
    profile.visibleLanes.map((item) => item.id).join("+"),
    profile.lockedLanes.map((item) => item.id).join("+"),
  ].join("|");
}

export function buildTierDifferentiationGate(profiles: TierEvidenceProfile[]): TierDifferentiationGate {
  const checkedAt = new Date().toISOString();
  const byTier = new Map(profiles.map((profile) => [profile.tier, profile]));
  const required: VelmereTier[] = ["Basic", "Pro", "Advanced"];
  const failures: string[] = [];
  const fieldSetFingerprints = required.reduce((acc, tier) => {
    const profile = byTier.get(tier) ?? buildTierEvidenceProfile(tier);
    acc[tier] = buildTierFieldSetFingerprint(profile);
    return acc;
  }, {} as Record<VelmereTier, string>);

  const unique = new Set(Object.values(fieldSetFingerprints));
  if (unique.size !== required.length) failures.push("Basic/Pro/Advanced field-set fingerprints are not unique.");
  if ((byTier.get("Basic") ?? buildTierEvidenceProfile("Basic")).visibleLanes.some((item) => item.id === "human_review")) failures.push("Basic exposes manual QA, which must stay locked/not included.");
  if ((byTier.get("Pro") ?? buildTierEvidenceProfile("Pro")).humanReview !== "locked") failures.push("Pro must keep manual QA locked.");
  if ((byTier.get("Advanced") ?? buildTierEvidenceProfile("Advanced")).humanReview !== "required") failures.push("Advanced must require manual QA.");
  if ((byTier.get("Basic") ?? buildTierEvidenceProfile("Basic")).receiptBundle === (byTier.get("Pro") ?? buildTierEvidenceProfile("Pro")).receiptBundle) failures.push("Basic and Pro receipt bundles are identical.");

  return {
    schemaVersion: "pass2811_basic_pro_advanced_diff_gate_v1",
    passed: failures.length === 0,
    checkedAt,
    tiersCompared: required,
    fieldSetFingerprints,
    failures,
    customerSafeCopy: failures.length
      ? "Tier differentiation is not safe to claim until the listed failures are fixed."
      : "Basic, Pro and Advanced have different visible lanes, receipt depth, chart policy and entitlement/human-review boundaries.",
  };
}

export function buildPass2811TierSuite() {
  const profiles = (["Basic", "Pro", "Advanced"] as VelmereTier[]).map(buildTierEvidenceProfile);
  return {
    schemaVersion: "pass2811_tier_suite_v1" as const,
    profiles,
    gate: buildTierDifferentiationGate(profiles),
  };
}

export function buildChartTierPdfGuard(args: { tier: VelmereTier; chartLifecycleReceipt: ChartLifecycleReceipt; receipts: SourceReceipt[] }) {
  const profile = buildTierEvidenceProfile(args.tier);
  const decision = buildPdfChartLifecycleDecision(args.chartLifecycleReceipt);
  const receiptFamilies = new Set(args.receipts.map((receipt) => receipt.sourceFamily));
  const missingIndependentSources = Math.max(0, profile.minimumIndependentSourceFamilies - receiptFamilies.size);
  const advancedReceiptMissing = args.tier === "Advanced" && !args.receipts.some((receipt) => receipt.sourceFamily === "manual_review");
  const proReceiptMissing = args.tier !== "Basic" && args.receipts.length < profile.minimumIndependentSourceFamilies;
  const blockedReasons = [
    decision.acceptedForPdf ? null : decision.reason,
    missingIndependentSources > 0 ? `${missingIndependentSources} independent source family receipt(s) missing for ${args.tier}.` : null,
    advancedReceiptMissing ? "Advanced requires manual_review receipt before reviewed chart/report copy." : null,
    proReceiptMissing ? `${args.tier} requires deeper receipt bundle before paid PDF claim.` : null,
  ].filter(Boolean) as string[];

  return {
    schemaVersion: "pass2811_chart_tier_pdf_guard_v1" as const,
    tier: args.tier,
    acceptedForTierPdf: blockedReasons.length === 0,
    chartDecision: decision,
    sourceFamilyCount: receiptFamilies.size,
    minimumIndependentSourceFamilies: profile.minimumIndependentSourceFamilies,
    blockedReasons,
    rendererRule: blockedReasons.length
      ? "Render locked/skeleton/missing-evidence state and show tier boundary before any stronger PDF claim."
      : "Render source-bound chart with source footer, receipt table and tier-specific visible lanes.",
  };
}

export const PASS2811_TIER_ACCEPTANCE_GATES = [
  "Basic, Pro and Advanced must have unique field-set fingerprints; no tier can be only longer text.",
  "Basic shows identity, decimal risk/confidence, missing evidence and chart lifecycle only; full receipt bundles stay locked.",
  "Pro shows source receipts, provider conflicts and liquidity/chart proof when receipts exist; manual QA remains locked.",
  "Advanced requires server entitlement, manual_review receipt, operator notes boundary and private delivery token.",
  "PDF renderer must combine chart lifecycle with tier rules before drawing source-bound charts or paid claims.",
] as const;
