import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import { constantTimeTextEqual, hmacSha256Digest } from "@/lib/security/portable-hmac-sha256";
import {
  verifyCommercialCohortAntiCherryPickReceipt,
  type CommercialCohortAntiCherryPickReceipt,
} from "@/lib/worldclass/commercial-cohort-anti-cherry-pick";

import {
  PASS4809_COMMERCIAL_COHORT_ATTESTATION_SCHEMA,
  PASS4809_COMMERCIAL_COHORT_POLICY_ID,
  PASS4809_COMMERCIAL_COHORT_SCHEMA,
} from "@/lib/worldclass/commercial-cohort-types";
import type {
  CommercialCohortAggregate,
  CommercialCohortCase,
  CommercialCohortManifest,
  CommercialCohortProduct,
  CommercialCohortTier,
} from "@/lib/worldclass/commercial-cohort-types";
export {
  PASS4809_COMMERCIAL_COHORT_ATTESTATION_SCHEMA,
  PASS4809_COMMERCIAL_COHORT_POLICY_ID,
  PASS4809_COMMERCIAL_COHORT_SCHEMA,
} from "@/lib/worldclass/commercial-cohort-types";
export type {
  CommercialCohortAggregate,
  CommercialCohortCase,
  CommercialCohortEvidenceClass,
  CommercialCohortLocale,
  CommercialCohortManifest,
  CommercialCohortProduct,
  CommercialCohortTier,
} from "@/lib/worldclass/commercial-cohort-types";

export type CommercialCohortApproval = {
  schemaVersion: "velmere.commercial-cohort-approval.v1";
  approvedAt: string;
  approverIdDigest: string;
  signature: string;
};

export type CommercialCohortAttestation = {
  schemaVersion: typeof PASS4809_COMMERCIAL_COHORT_ATTESTATION_SCHEMA;
  policyVersion: typeof PASS4809_COMMERCIAL_COHORT_POLICY_ID;
  manifest: CommercialCohortManifest;
  issuedAt: string;
  expiresAt: string;
  operatorIdDigest: string;
  signature: string;
  approval?: CommercialCohortApproval;
};

export type CommercialCohortPublicCheckpointGateInput = {
  verified: boolean;
  publicCheckpointVerified: boolean;
  rollbackProtected: boolean;
  externallyWitnessed: boolean;
  keyRotationVerified: boolean;
  deploymentReceiptVerified: boolean;
  artifactBound: boolean;
  stagingE2eVerified: boolean;
  stagingE2eBound: boolean;
  stagingRollbackProtected: boolean;
  stagingSequence: number | null;
  stagingReceiptDigest: string | null;
  stagingProbeCount: number;
  chaosRecoveryVerified: boolean;
  recoveryBound: boolean;
  recoveryRollbackProtected: boolean;
  rtoRpoVerified: boolean;
  idempotencyVerified: boolean;
  chaosSequence: number | null;
  chaosReceiptDigest: string | null;
  chaosScenarioCount: number;
  observabilityVerified: boolean;
  telemetryBound: boolean;
  sloVerified: boolean;
  incidentResponseVerified: boolean;
  safeDegradationVerified: boolean;
  observabilityRollbackProtected: boolean;
  observabilitySequence: number | null;
  observabilityReceiptDigest: string | null;
  observabilityObjectiveCount: number;
  privacyVerified: boolean;
  tenantIsolationVerified: boolean;
  dataLifecycleVerified: boolean;
  abuseResistanceVerified: boolean;
  auditTrailVerified: boolean;
  privacyRollbackProtected: boolean;
  privacySequence: number | null;
  privacyReceiptDigest: string | null;
  privacyControlCount: number;
  supplyChainVerified: boolean;
  reproducibleBuild: boolean;
  vulnerabilityGatePassed: boolean;
  supplyChainBound: boolean;
  supplyChainProvenanceDigest: string | null;
  deploymentRollbackProtected: boolean;
  deploymentSequence: number | null;
  deploymentReceiptDigest: string | null;
  checkpointSequence: number | null;
  checkpointDigest: string | null;
  trustEpoch: number | null;
  externalWitnessCount: number;
  blockers: string[];
};

export type CommercialCohortGate = {
  schemaVersion: "velmere.commercial-cohort-gate.v1";
  policyVersion: typeof PASS4809_COMMERCIAL_COHORT_POLICY_ID;
  product: Exclude<CommercialCohortProduct, "pdf">;
  tier: Extract<CommercialCohortTier, "pro" | "advanced">;
  verified: boolean;
  primaryVerified: boolean;
  dualControlVerified: boolean;
  antiCherryPickVerified: boolean;
  precommitBound: boolean;
  transparencyBound: boolean;
  publicCheckpointVerified: boolean;
  rollbackProtected: boolean;
  externallyWitnessed: boolean;
  keyRotationVerified: boolean;
  deploymentReceiptVerified: boolean;
  artifactBound: boolean;
  stagingE2eVerified: boolean;
  stagingE2eBound: boolean;
  stagingRollbackProtected: boolean;
  stagingSequence: number | null;
  stagingReceiptDigest: string | null;
  stagingProbeCount: number;
  chaosRecoveryVerified: boolean;
  recoveryBound: boolean;
  recoveryRollbackProtected: boolean;
  rtoRpoVerified: boolean;
  idempotencyVerified: boolean;
  chaosSequence: number | null;
  chaosReceiptDigest: string | null;
  chaosScenarioCount: number;
  observabilityVerified: boolean;
  telemetryBound: boolean;
  sloVerified: boolean;
  incidentResponseVerified: boolean;
  safeDegradationVerified: boolean;
  observabilityRollbackProtected: boolean;
  observabilitySequence: number | null;
  observabilityReceiptDigest: string | null;
  observabilityObjectiveCount: number;
  privacyVerified: boolean;
  tenantIsolationVerified: boolean;
  dataLifecycleVerified: boolean;
  abuseResistanceVerified: boolean;
  auditTrailVerified: boolean;
  privacyRollbackProtected: boolean;
  privacySequence: number | null;
  privacyReceiptDigest: string | null;
  privacyControlCount: number;
  supplyChainVerified: boolean;
  reproducibleBuild: boolean;
  vulnerabilityGatePassed: boolean;
  supplyChainBound: boolean;
  supplyChainProvenanceDigest: string | null;
  deploymentRollbackProtected: boolean;
  deploymentSequence: number | null;
  deploymentReceiptDigest: string | null;
  checkpointSequence: number | null;
  checkpointDigest: string | null;
  trustEpoch: number | null;
  externalWitnessCount: number;
  ready: boolean;
  manifestDigest: string | null;
  antiCherryPickReceiptDigest: string | null;
  expiresAt: string | null;
  blockers: string[];
  metrics: CommercialCohortAggregate | null;
  pdfMetrics: CommercialCohortAggregate | null;
  thresholdSource: "internal_release_policy_not_external_benchmark";
};

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const CASE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{5,159}$/;

function clean(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseDate(value: unknown, code: string): Date {
  const text = clean(value, 64);
  const date = new Date(text);
  if (!text || !Number.isFinite(date.getTime())) throw new Error(code);
  return date;
}

function finite(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new Error("commercial_cohort_metric_invalid");
  return parsed;
}

function digest(value: unknown, code: string): string {
  const text = clean(value, 80).toLowerCase();
  if (!DIGEST.test(text)) throw new Error(code);
  return text;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? Number((numerator / denominator).toFixed(6)) : 0;
}

function percentile95(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)].toFixed(4));
}

function emptyAggregate(): CommercialCohortAggregate {
  return {
    caseCount: 0,
    uniqueSubjectCount: 0,
    tierCounts: { basic: 0, pro: 0, advanced: 0 },
    localeCounts: { pl: 0, en: 0, de: 0 },
    assetClasses: [],
    chains: [],
    upstreamRoots: [],
    evidenceClassCounts: { live_provider: 0, staging_replay: 0, synthetic_fixture: 0 },
    runtimeVersions: [],
    providerConfigDigests: [],
    value: { measuredCases: 0, basicUsefulRate: 0, proMaterialDeltaRate: 0, advancedMaterialDeltaRate: 0, advancedHumanReviewMaterialRate: 0 },
    audit: { truthLabeledCases: 0, manualReviewRate: 0, precision: 0, recall: 0, falsePositiveRate: 0, severityAgreementRate: 0 },
    market: { measuredCases: 0, quoteErrorP95Bps: null, staleRate: 0, conflictDetectionRate: 0, rankingStabilityRate: 0, sessionNormalizationRate: 0 },
    pdf: { measuredCases: 0, exactByteMatchRate: 0, parserValidRate: 0, unicodeRoundTripRate: 0, previewDataParityRate: 0, deterministicRerenderRate: 0 },
  };
}

function validateCase(input: CommercialCohortCase, generatedAt: Date): CommercialCohortCase {
  if (!input || input.schemaVersion !== "velmere.commercial-cohort-case.v1") throw new Error("commercial_cohort_case_schema_invalid");
  const caseId = clean(input.caseId, 160);
  const subjectId = clean(input.subjectId, 240);
  const assetClass = clean(input.assetClass, 80);
  const chain = input.chain === null ? null : clean(input.chain, 80) || null;
  if (!CASE_ID.test(caseId) || !subjectId || !assetClass) throw new Error("commercial_cohort_case_identity_invalid");
  if (!(["audit", "shield", "real_markets", "pdf"] as string[]).includes(input.product)) throw new Error("commercial_cohort_product_invalid");
  if (!(["basic", "pro", "advanced"] as string[]).includes(input.tier)) throw new Error("commercial_cohort_tier_invalid");
  if (!(["pl", "en", "de"] as string[]).includes(input.locale)) throw new Error("commercial_cohort_locale_invalid");
  if (!(["live_provider", "staging_replay", "synthetic_fixture"] as string[]).includes(input.evidenceClass)) throw new Error("commercial_cohort_evidence_class_invalid");
  const runtimeVersion = clean(input.runtimeVersion, 120);
  if (!runtimeVersion) throw new Error("commercial_cohort_runtime_version_missing");
  const providerConfigDigest = digest(input.providerConfigDigest, "commercial_cohort_provider_config_digest_invalid");
  const captureReceiptDigest = digest(input.captureReceiptDigest, "commercial_cohort_capture_receipt_digest_invalid");
  const observedAt = parseDate(input.observedAt, "commercial_cohort_observed_at_invalid");
  const outcomeObservedAt = parseDate(input.outcomeObservedAt, "commercial_cohort_outcome_at_invalid");
  if (outcomeObservedAt.getTime() < observedAt.getTime()) throw new Error("commercial_cohort_outcome_before_observation");
  if (outcomeObservedAt.getTime() > generatedAt.getTime()) throw new Error("commercial_cohort_lookahead_detected");
  const providerUpstreamRoots = unique((input.providerUpstreamRoots ?? []).map((item) => digest(item, "commercial_cohort_upstream_root_invalid")));
  if (!providerUpstreamRoots.length) throw new Error("commercial_cohort_upstream_roots_missing");

  const result: CommercialCohortCase = {
    schemaVersion: "velmere.commercial-cohort-case.v1",
    caseId,
    product: input.product,
    tier: input.tier,
    subjectId,
    assetClass,
    chain,
    locale: input.locale,
    evidenceClass: input.evidenceClass,
    runtimeVersion,
    providerConfigDigest,
    captureReceiptDigest,
    observedAt: observedAt.toISOString(),
    outcomeObservedAt: outcomeObservedAt.toISOString(),
    providerUpstreamRoots,
    inputDigest: digest(input.inputDigest, "commercial_cohort_input_digest_invalid"),
    outputDigest: digest(input.outputDigest, "commercial_cohort_output_digest_invalid"),
    groundTruthDigest: digest(input.groundTruthDigest, "commercial_cohort_truth_digest_invalid"),
  };

  if (input.product !== "pdf") {
    if (!input.valueMetrics) throw new Error("commercial_cohort_value_metrics_missing");
    result.valueMetrics = {
      basicUseful: input.valueMetrics.basicUseful === true,
      proAddsMaterialEvidence: input.valueMetrics.proAddsMaterialEvidence === true,
      advancedAddsMaterialEvidence: input.valueMetrics.advancedAddsMaterialEvidence === true,
      advancedHumanReviewMaterial: input.valueMetrics.advancedHumanReviewMaterial === true,
    };
  }

  if (input.product === "audit") {
    if (!input.auditMetrics) throw new Error("commercial_cohort_audit_metrics_missing");
    result.auditMetrics = {
      truePositives: Math.trunc(finite(input.auditMetrics.truePositives, 0, 10_000)),
      falsePositives: Math.trunc(finite(input.auditMetrics.falsePositives, 0, 10_000)),
      falseNegatives: Math.trunc(finite(input.auditMetrics.falseNegatives, 0, 10_000)),
      severityAgreement: finite(input.auditMetrics.severityAgreement, 0, 1),
      manualReviewed: input.auditMetrics.manualReviewed === true,
    };
  } else if (input.product === "shield" || input.product === "real_markets") {
    if (!input.marketMetrics) throw new Error("commercial_cohort_market_metrics_missing");
    result.marketMetrics = {
      quoteErrorBps: finite(input.marketMetrics.quoteErrorBps, 0, 100_000),
      stale: input.marketMetrics.stale === true,
      conflictExpected: input.marketMetrics.conflictExpected === true,
      conflictSurfaced: input.marketMetrics.conflictSurfaced === true,
      rankingStable: input.marketMetrics.rankingStable === true,
      sessionNormalized: input.marketMetrics.sessionNormalized === true,
    };
  } else {
    if (!input.pdfMetrics) throw new Error("commercial_cohort_pdf_metrics_missing");
    result.pdfMetrics = {
      exactByteMatch: input.pdfMetrics.exactByteMatch === true,
      parserValid: input.pdfMetrics.parserValid === true,
      unicodeRoundTrip: input.pdfMetrics.unicodeRoundTrip === true,
      previewDataParity: input.pdfMetrics.previewDataParity === true,
      deterministicRerender: input.pdfMetrics.deterministicRerender === true,
    };
  }
  return result;
}

function aggregateCases(cases: CommercialCohortCase[]): CommercialCohortAggregate {
  const aggregate = emptyAggregate();
  aggregate.caseCount = cases.length;
  aggregate.uniqueSubjectCount = new Set(cases.map((item) => item.subjectId)).size;
  for (const item of cases) {
    aggregate.tierCounts[item.tier] += 1;
    aggregate.localeCounts[item.locale] += 1;
    aggregate.evidenceClassCounts[item.evidenceClass] += 1;
  }
  aggregate.assetClasses = unique(cases.map((item) => item.assetClass));
  aggregate.chains = unique(cases.map((item) => item.chain ?? "").filter(Boolean));
  aggregate.upstreamRoots = unique(cases.flatMap((item) => item.providerUpstreamRoots));
  aggregate.runtimeVersions = unique(cases.map((item) => item.runtimeVersion));
  aggregate.providerConfigDigests = unique(cases.map((item) => item.providerConfigDigest));

  const value = cases.flatMap((item) => item.valueMetrics ? [item.valueMetrics] : []);
  if (value.length) {
    aggregate.value = {
      measuredCases: value.length,
      basicUsefulRate: ratio(value.filter((item) => item.basicUseful).length, value.length),
      proMaterialDeltaRate: ratio(value.filter((item) => item.proAddsMaterialEvidence).length, value.length),
      advancedMaterialDeltaRate: ratio(value.filter((item) => item.advancedAddsMaterialEvidence).length, value.length),
      advancedHumanReviewMaterialRate: ratio(value.filter((item) => item.advancedHumanReviewMaterial).length, value.length),
    };
  }

  const audit = cases.flatMap((item) => item.auditMetrics ? [item.auditMetrics] : []);
  if (audit.length) {
    const tp = audit.reduce((sum, item) => sum + item.truePositives, 0);
    const fp = audit.reduce((sum, item) => sum + item.falsePositives, 0);
    const fn = audit.reduce((sum, item) => sum + item.falseNegatives, 0);
    aggregate.audit = {
      truthLabeledCases: audit.length,
      manualReviewRate: ratio(audit.filter((item) => item.manualReviewed).length, audit.length),
      precision: ratio(tp, tp + fp),
      recall: ratio(tp, tp + fn),
      falsePositiveRate: ratio(fp, tp + fp),
      severityAgreementRate: ratio(audit.reduce((sum, item) => sum + item.severityAgreement, 0), audit.length),
    };
  }

  const market = cases.flatMap((item) => item.marketMetrics ? [item.marketMetrics] : []);
  if (market.length) {
    const conflicts = market.filter((item) => item.conflictExpected);
    aggregate.market = {
      measuredCases: market.length,
      quoteErrorP95Bps: percentile95(market.map((item) => item.quoteErrorBps)),
      staleRate: ratio(market.filter((item) => item.stale).length, market.length),
      conflictDetectionRate: conflicts.length ? ratio(conflicts.filter((item) => item.conflictSurfaced).length, conflicts.length) : 1,
      rankingStabilityRate: ratio(market.filter((item) => item.rankingStable).length, market.length),
      sessionNormalizationRate: ratio(market.filter((item) => item.sessionNormalized).length, market.length),
    };
  }

  const pdf = cases.flatMap((item) => item.pdfMetrics ? [item.pdfMetrics] : []);
  if (pdf.length) {
    aggregate.pdf = {
      measuredCases: pdf.length,
      exactByteMatchRate: ratio(pdf.filter((item) => item.exactByteMatch).length, pdf.length),
      parserValidRate: ratio(pdf.filter((item) => item.parserValid).length, pdf.length),
      unicodeRoundTripRate: ratio(pdf.filter((item) => item.unicodeRoundTrip).length, pdf.length),
      previewDataParityRate: ratio(pdf.filter((item) => item.previewDataParity).length, pdf.length),
      deterministicRerenderRate: ratio(pdf.filter((item) => item.deterministicRerender).length, pdf.length),
    };
  }
  return aggregate;
}

function caseDigest(value: CommercialCohortCase): string {
  return sha256Digest(canonicalJson(value));
}

export function buildCommercialCohortManifest(args: { cases: CommercialCohortCase[]; generatedAt?: Date }): CommercialCohortManifest {
  const generatedAt = args.generatedAt ?? new Date();
  if (!Array.isArray(args.cases) || !args.cases.length) throw new Error("commercial_cohort_cases_missing");
  const validated = args.cases.map((item) => validateCase(item, generatedAt));
  if (new Set(validated.map((item) => item.caseId)).size !== validated.length) throw new Error("commercial_cohort_duplicate_case_id");
  const ordered = [...validated].sort((a, b) => a.caseId.localeCompare(b.caseId));
  const caseDigests = ordered.map(caseDigest);
  const product = (id: CommercialCohortProduct) => aggregateCases(ordered.filter((item) => item.product === id));
  const times = ordered.flatMap((item) => [new Date(item.observedAt).getTime(), new Date(item.outcomeObservedAt).getTime()]);
  const unsigned = {
    schemaVersion: PASS4809_COMMERCIAL_COHORT_SCHEMA,
    policyVersion: PASS4809_COMMERCIAL_COHORT_POLICY_ID,
    generatedAt: generatedAt.toISOString(),
    windowStart: new Date(Math.min(...times)).toISOString(),
    windowEnd: new Date(Math.max(...times)).toISOString(),
    caseRoot: sha256Digest(canonicalJson(caseDigests)),
    caseDigests,
    aggregateByProduct: {
      audit: product("audit"),
      shield: product("shield"),
      real_markets: product("real_markets"),
      pdf: product("pdf"),
    },
  } as const;
  return { ...unsigned, manifestDigest: sha256Digest(canonicalJson(unsigned)) };
}

function attestationPayload(value: {
  schemaVersion: typeof PASS4809_COMMERCIAL_COHORT_ATTESTATION_SCHEMA;
  policyVersion: typeof PASS4809_COMMERCIAL_COHORT_POLICY_ID;
  manifest: CommercialCohortManifest;
  issuedAt: string;
  expiresAt: string;
  operatorIdDigest: string;
}): string {
  return canonicalJson(value);
}

function approvalPayload(args: { attestation: CommercialCohortAttestation; approvedAt: string; approverIdDigest: string }): string {
  return canonicalJson({
    schemaVersion: "velmere.commercial-cohort-approval.v1",
    policyVersion: args.attestation.policyVersion,
    manifestDigest: args.attestation.manifest.manifestDigest,
    primarySignature: args.attestation.signature,
    issuedAt: args.attestation.issuedAt,
    expiresAt: args.attestation.expiresAt,
    operatorIdDigest: args.attestation.operatorIdDigest,
    approvedAt: args.approvedAt,
    approverIdDigest: args.approverIdDigest,
  });
}

export function signCommercialCohortAttestation(args: {
  manifest: CommercialCohortManifest;
  secret: string;
  operatorId: string;
  issuedAt?: Date;
  expiresAt: Date;
}): CommercialCohortAttestation {
  if (args.secret.trim().length < 32) throw new Error("commercial_cohort_signing_secret_too_short");
  const issuedAt = args.issuedAt ?? new Date();
  if (args.expiresAt.getTime() <= issuedAt.getTime()) throw new Error("commercial_cohort_expiry_invalid");
  if (args.expiresAt.getTime() - issuedAt.getTime() > 45 * 24 * 60 * 60 * 1_000) throw new Error("commercial_cohort_expiry_too_long");
  const operatorId = clean(args.operatorId, 200);
  if (!operatorId) throw new Error("commercial_cohort_operator_id_missing");
  const unsigned = {
    schemaVersion: PASS4809_COMMERCIAL_COHORT_ATTESTATION_SCHEMA,
    policyVersion: PASS4809_COMMERCIAL_COHORT_POLICY_ID,
    manifest: args.manifest,
    issuedAt: issuedAt.toISOString(),
    expiresAt: args.expiresAt.toISOString(),
    operatorIdDigest: sha256Digest(operatorId),
  } as const;
  return { ...unsigned, signature: hmacSha256Digest(args.secret.trim(), attestationPayload(unsigned)) };
}

export function approveCommercialCohortAttestation(args: {
  attestation: CommercialCohortAttestation;
  primarySecret: string;
  approverSecret: string;
  approverId: string;
  approvedAt?: Date;
}): CommercialCohortAttestation {
  const primaryVerification = verifyCommercialCohortAttestation({
    attestation: args.attestation,
    secret: args.primarySecret,
    now: args.approvedAt ?? new Date(),
  });
  if (!primaryVerification.verified) throw new Error(`commercial_cohort_primary_attestation_invalid:${primaryVerification.blockers.join("|")}`);
  const primarySecret = args.primarySecret.trim();
  const approverSecret = args.approverSecret.trim();
  if (approverSecret.length < 32) throw new Error("commercial_cohort_approver_secret_too_short");
  if (constantTimeTextEqual(primarySecret, approverSecret)) throw new Error("commercial_cohort_dual_control_secret_reused");
  const approvedAt = args.approvedAt ?? new Date();
  const issuedAt = parseDate(args.attestation.issuedAt, "issued_at_invalid");
  const expiresAt = parseDate(args.attestation.expiresAt, "expires_at_invalid");
  if (approvedAt.getTime() < issuedAt.getTime() || approvedAt.getTime() >= expiresAt.getTime()) throw new Error("commercial_cohort_approval_time_invalid");
  const approverId = clean(args.approverId, 200);
  if (!approverId) throw new Error("commercial_cohort_approver_id_missing");
  const approverIdDigest = sha256Digest(approverId);
  if (approverIdDigest === args.attestation.operatorIdDigest) throw new Error("commercial_cohort_same_operator_and_approver");
  const approvedAtText = approvedAt.toISOString();
  const approval: CommercialCohortApproval = {
    schemaVersion: "velmere.commercial-cohort-approval.v1",
    approvedAt: approvedAtText,
    approverIdDigest,
    signature: hmacSha256Digest(approverSecret, approvalPayload({ attestation: args.attestation, approvedAt: approvedAtText, approverIdDigest })),
  };
  return { ...args.attestation, approval };
}

export function verifyCommercialCohortApproval(args: {
  attestation: CommercialCohortAttestation;
  approverSecret: string | null;
  now?: Date;
}): { verified: boolean; blockers: string[] } {
  const blockers: string[] = [];
  const approval = args.attestation?.approval;
  if (!approval) blockers.push("commercial_cohort_approval_missing");
  if (!args.approverSecret) blockers.push("commercial_cohort_approver_secret_missing");
  if (approval?.schemaVersion !== "velmere.commercial-cohort-approval.v1") blockers.push("commercial_cohort_approval_schema_invalid");
  try {
    if (approval && args.approverSecret) {
      if (!DIGEST.test(approval.approverIdDigest)) blockers.push("commercial_cohort_approver_id_digest_invalid");
      const secret = args.approverSecret.trim();
      if (secret.length < 32) blockers.push("commercial_cohort_approver_secret_unavailable");
      const approvedAt = parseDate(approval.approvedAt, "commercial_cohort_approved_at_invalid");
      const issuedAt = parseDate(args.attestation.issuedAt, "issued_at_invalid");
      const expiresAt = parseDate(args.attestation.expiresAt, "expires_at_invalid");
      const now = args.now ?? new Date();
      if (approvedAt.getTime() < issuedAt.getTime() || approvedAt.getTime() >= expiresAt.getTime()) blockers.push("commercial_cohort_approval_time_invalid");
      if (approvedAt.getTime() > now.getTime() + 60_000) blockers.push("commercial_cohort_approval_in_future");
      if (approval.approverIdDigest === args.attestation.operatorIdDigest) blockers.push("commercial_cohort_same_operator_and_approver");
      const expected = hmacSha256Digest(secret, approvalPayload({
        attestation: args.attestation,
        approvedAt: approval.approvedAt,
        approverIdDigest: approval.approverIdDigest,
      }));
      if (!DIGEST.test(approval.signature) || !constantTimeTextEqual(approval.signature, expected)) blockers.push("commercial_cohort_approval_signature_invalid");
    }
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "commercial_cohort_approval_validation_failed");
  }
  return { verified: blockers.length === 0, blockers: unique(blockers) };
}

export function verifyCommercialCohortAttestation(args: {
  attestation: CommercialCohortAttestation;
  secret: string;
  now?: Date;
}): { verified: boolean; blockers: string[] } {
  const blockers: string[] = [];
  const { attestation } = args;
  if (!attestation || attestation.schemaVersion !== PASS4809_COMMERCIAL_COHORT_ATTESTATION_SCHEMA) blockers.push("attestation_schema_invalid");
  if (attestation?.policyVersion !== PASS4809_COMMERCIAL_COHORT_POLICY_ID) blockers.push("attestation_policy_invalid");
  if (args.secret.trim().length < 32) blockers.push("attestation_secret_unavailable");
  try {
    if (!attestation?.manifest || attestation.manifest.schemaVersion !== PASS4809_COMMERCIAL_COHORT_SCHEMA) throw new Error("manifest_schema_invalid");
    if (!DIGEST.test(attestation.operatorIdDigest)) blockers.push("operator_id_digest_invalid");
    const { manifestDigest, ...unsignedManifest } = attestation.manifest;
    if (!DIGEST.test(manifestDigest) || manifestDigest !== sha256Digest(canonicalJson(unsignedManifest))) blockers.push("manifest_digest_invalid");
    if (attestation.manifest.caseRoot !== sha256Digest(canonicalJson(attestation.manifest.caseDigests))) blockers.push("case_root_invalid");
    const issuedAt = parseDate(attestation.issuedAt, "issued_at_invalid");
    const expiresAt = parseDate(attestation.expiresAt, "expires_at_invalid");
    const now = args.now ?? new Date();
    if (issuedAt.getTime() > now.getTime() + 60_000) blockers.push("attestation_issued_in_future");
    if (expiresAt.getTime() <= now.getTime()) blockers.push("attestation_expired");
    if (expiresAt.getTime() - issuedAt.getTime() > 45 * 24 * 60 * 60 * 1_000) blockers.push("attestation_window_too_long");
    const unsigned = {
      schemaVersion: attestation.schemaVersion,
      policyVersion: attestation.policyVersion,
      manifest: attestation.manifest,
      issuedAt: attestation.issuedAt,
      expiresAt: attestation.expiresAt,
      operatorIdDigest: attestation.operatorIdDigest,
    } as const;
    const expected = hmacSha256Digest(args.secret.trim(), attestationPayload(unsigned));
    if (!DIGEST.test(attestation.signature) || !constantTimeTextEqual(attestation.signature, expected)) blockers.push("attestation_signature_invalid");
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "attestation_validation_failed");
  }
  return { verified: blockers.length === 0, blockers: unique(blockers) };
}

function atLeast(value: number, threshold: number, code: string, blockers: string[]) {
  if (value < threshold) blockers.push(`${code}:${value}/${threshold}`);
}

function atMost(value: number | null, threshold: number, code: string, blockers: string[]) {
  if (value === null || value > threshold) blockers.push(`${code}:${value ?? "missing"}/${threshold}`);
}

export function evaluateCommercialCohortGate(args: {
  attestation: CommercialCohortAttestation | null;
  secret: string | null;
  approverSecret?: string | null;
  antiCherryPickReceipt?: CommercialCohortAntiCherryPickReceipt | null;
  antiCherryPickSecret?: string | null;
  antiCherryPickApproverSecret?: string | null;
  requireAntiCherryPick?: boolean;
  publicCheckpoint?: CommercialCohortPublicCheckpointGateInput | null;
  requirePublicCheckpoint?: boolean;
  product: Exclude<CommercialCohortProduct, "pdf">;
  tier: Extract<CommercialCohortTier, "pro" | "advanced">;
  now?: Date;
}): CommercialCohortGate {
  const blockers: string[] = [];
  if (!args.attestation) blockers.push("commercial_cohort_attestation_missing");
  if (!args.secret) blockers.push("commercial_cohort_signing_secret_missing");
  const verification = args.attestation && args.secret
    ? verifyCommercialCohortAttestation({ attestation: args.attestation, secret: args.secret, now: args.now })
    : { verified: false, blockers: [] };
  blockers.push(...verification.blockers);
  const approvalVerification = args.tier === "advanced" && args.attestation
    ? verifyCommercialCohortApproval({ attestation: args.attestation, approverSecret: args.approverSecret ?? null, now: args.now })
    : { verified: args.tier !== "advanced", blockers: [] as string[] };
  if (args.tier === "advanced") blockers.push(...approvalVerification.blockers);
  const antiCherryPickRequired = args.requireAntiCherryPick === true;
  const antiCherryPickVerification = args.attestation && args.antiCherryPickReceipt
    ? verifyCommercialCohortAntiCherryPickReceipt({
        receipt: args.antiCherryPickReceipt,
        manifest: args.attestation.manifest,
        secret: args.antiCherryPickSecret ?? null,
        approverSecret: args.antiCherryPickApproverSecret ?? null,
        requireApproval: antiCherryPickRequired,
        now: args.now,
      })
    : {
        verified: !antiCherryPickRequired,
        primaryVerified: !antiCherryPickRequired,
        approvalVerified: !antiCherryPickRequired,
        precommitBound: !antiCherryPickRequired,
        transparencyBound: !antiCherryPickRequired,
        blockers: antiCherryPickRequired ? ["commercial_cohort_anti_cherry_pick_receipt_missing"] : [],
      };
  if (antiCherryPickRequired) blockers.push(...antiCherryPickVerification.blockers);
  const publicCheckpointRequired = args.requirePublicCheckpoint === true;
  const publicCheckpointVerification = args.publicCheckpoint ?? {
    verified: !publicCheckpointRequired,
    publicCheckpointVerified: !publicCheckpointRequired,
    rollbackProtected: !publicCheckpointRequired,
    externallyWitnessed: !publicCheckpointRequired,
    keyRotationVerified: !publicCheckpointRequired,
    deploymentReceiptVerified: !publicCheckpointRequired,
    artifactBound: !publicCheckpointRequired,
    stagingE2eVerified: !publicCheckpointRequired,
    stagingE2eBound: !publicCheckpointRequired,
    stagingRollbackProtected: !publicCheckpointRequired,
    stagingSequence: null,
    stagingReceiptDigest: null,
    stagingProbeCount: 0,
    chaosRecoveryVerified: !publicCheckpointRequired,
    recoveryBound: !publicCheckpointRequired,
    recoveryRollbackProtected: !publicCheckpointRequired,
    rtoRpoVerified: !publicCheckpointRequired,
    idempotencyVerified: !publicCheckpointRequired,
    chaosSequence: null,
    chaosReceiptDigest: null,
    chaosScenarioCount: 0,
    observabilityVerified: !publicCheckpointRequired,
    telemetryBound: !publicCheckpointRequired,
    sloVerified: !publicCheckpointRequired,
    incidentResponseVerified: !publicCheckpointRequired,
    safeDegradationVerified: !publicCheckpointRequired,
    observabilityRollbackProtected: !publicCheckpointRequired,
    observabilitySequence: null,
    observabilityReceiptDigest: null,
    observabilityObjectiveCount: 0,
    privacyVerified: !publicCheckpointRequired,
    tenantIsolationVerified: !publicCheckpointRequired,
    dataLifecycleVerified: !publicCheckpointRequired,
    abuseResistanceVerified: !publicCheckpointRequired,
    auditTrailVerified: !publicCheckpointRequired,
    privacyRollbackProtected: !publicCheckpointRequired,
    privacySequence: null,
    privacyReceiptDigest: null,
    privacyControlCount: 0,
    supplyChainVerified: !publicCheckpointRequired,
    reproducibleBuild: !publicCheckpointRequired,
    vulnerabilityGatePassed: !publicCheckpointRequired,
    supplyChainBound: !publicCheckpointRequired,
    supplyChainProvenanceDigest: null,
    deploymentRollbackProtected: !publicCheckpointRequired,
    deploymentSequence: null,
    deploymentReceiptDigest: null,
    checkpointSequence: null,
    checkpointDigest: null,
    trustEpoch: null,
    externalWitnessCount: 0,
    blockers: publicCheckpointRequired ? ["commercial_cohort_public_checkpoint_missing"] : [],
  };
  if (publicCheckpointRequired) blockers.push(...publicCheckpointVerification.blockers);
  const metrics = args.attestation?.manifest.aggregateByProduct[args.product] ?? null;
  const pdfMetrics = args.attestation?.manifest.aggregateByProduct.pdf ?? null;

  if (metrics) {
    atLeast(metrics.caseCount, 50, `${args.product}_case_count`, blockers);
    atLeast(metrics.uniqueSubjectCount, 50, `${args.product}_unique_subjects`, blockers);
    atLeast(metrics.evidenceClassCounts.live_provider, 50, `${args.product}_live_provider_cases`, blockers);
    if (metrics.evidenceClassCounts.staging_replay > 0 || metrics.evidenceClassCounts.synthetic_fixture > 0) blockers.push(`${args.product}_non_live_cases_present`);
    if (metrics.runtimeVersions.length !== 1) blockers.push(`${args.product}_mixed_runtime_versions:${metrics.runtimeVersions.length}`);
    if (metrics.providerConfigDigests.length !== 1) blockers.push(`${args.product}_mixed_provider_configurations:${metrics.providerConfigDigests.length}`);
    atLeast(metrics.upstreamRoots.length, args.tier === "advanced" ? 4 : 3, `${args.product}_upstream_roots`, blockers);
    atLeast(metrics.value.measuredCases, 50, `${args.product}_value_cases`, blockers);
    atLeast(metrics.value.basicUsefulRate, 0.95, `${args.product}_basic_useful_rate`, blockers);
    atLeast(metrics.value.proMaterialDeltaRate, 0.9, `${args.product}_pro_material_delta_rate`, blockers);
    if (args.tier === "advanced") atLeast(metrics.value.advancedMaterialDeltaRate, 0.9, `${args.product}_advanced_material_delta_rate`, blockers);
    if (args.product === "audit" && args.tier === "advanced") atLeast(metrics.value.advancedHumanReviewMaterialRate, 0.9, "audit_human_review_material_rate", blockers);
    if (args.product === "audit") {
      atLeast(metrics.audit.truthLabeledCases, 50, "audit_truth_labeled_cases", blockers);
      atLeast(metrics.chains.length, 3, "audit_chain_diversity", blockers);
      atLeast(metrics.audit.precision, args.tier === "advanced" ? 0.93 : 0.9, "audit_precision", blockers);
      atLeast(metrics.audit.recall, args.tier === "advanced" ? 0.85 : 0.8, "audit_recall", blockers);
      atMost(metrics.audit.falsePositiveRate, args.tier === "advanced" ? 0.07 : 0.1, "audit_false_positive_rate", blockers);
      atLeast(metrics.audit.severityAgreementRate, args.tier === "advanced" ? 0.85 : 0.8, "audit_severity_agreement", blockers);
      atLeast(metrics.audit.manualReviewRate, args.tier === "advanced" ? 1 : 0.2, "audit_manual_review_rate", blockers);
    } else {
      atMost(metrics.market.quoteErrorP95Bps, args.product === "real_markets" ? (args.tier === "advanced" ? 75 : 100) : (args.tier === "advanced" ? 100 : 150), `${args.product}_quote_error_p95_bps`, blockers);
      atMost(metrics.market.staleRate, args.tier === "advanced" ? 0.03 : 0.05, `${args.product}_stale_rate`, blockers);
      atLeast(metrics.market.conflictDetectionRate, args.tier === "advanced" ? 0.95 : 0.9, `${args.product}_conflict_detection`, blockers);
      atLeast(metrics.market.rankingStabilityRate, args.tier === "advanced" ? 0.95 : 0.9, `${args.product}_ranking_stability`, blockers);
      if (args.product === "real_markets") {
        atLeast(metrics.assetClasses.length, 5, "real_markets_asset_class_diversity", blockers);
        atLeast(metrics.market.sessionNormalizationRate, args.tier === "advanced" ? 0.98 : 0.95, "real_markets_session_normalization", blockers);
      }
    }
  }

  if (args.product === "audit" && pdfMetrics) {
    atLeast(pdfMetrics.caseCount, 150, "pdf_case_count", blockers);
    atLeast(pdfMetrics.evidenceClassCounts.live_provider, 150, "pdf_live_provider_cases", blockers);
    if (pdfMetrics.evidenceClassCounts.staging_replay > 0 || pdfMetrics.evidenceClassCounts.synthetic_fixture > 0) blockers.push("pdf_non_live_cases_present");
    if (pdfMetrics.runtimeVersions.length !== 1) blockers.push(`pdf_mixed_runtime_versions:${pdfMetrics.runtimeVersions.length}`);
    if (pdfMetrics.providerConfigDigests.length !== 1) blockers.push(`pdf_mixed_provider_configurations:${pdfMetrics.providerConfigDigests.length}`);
    atLeast(pdfMetrics.tierCounts.basic, 50, "pdf_basic_count", blockers);
    atLeast(pdfMetrics.tierCounts.pro, 50, "pdf_pro_count", blockers);
    atLeast(pdfMetrics.tierCounts.advanced, 50, "pdf_advanced_count", blockers);
    atLeast(pdfMetrics.localeCounts.pl, 30, "pdf_pl_count", blockers);
    atLeast(pdfMetrics.localeCounts.en, 30, "pdf_en_count", blockers);
    atLeast(pdfMetrics.localeCounts.de, 30, "pdf_de_count", blockers);
    atLeast(pdfMetrics.pdf.exactByteMatchRate, 1, "pdf_exact_byte_rate", blockers);
    atLeast(pdfMetrics.pdf.parserValidRate, 1, "pdf_parser_rate", blockers);
    atLeast(pdfMetrics.pdf.unicodeRoundTripRate, 1, "pdf_unicode_rate", blockers);
    atLeast(pdfMetrics.pdf.previewDataParityRate, 1, "pdf_preview_parity_rate", blockers);
    atLeast(pdfMetrics.pdf.deterministicRerenderRate, 1, "pdf_deterministic_rerender_rate", blockers);
  } else if (args.product === "audit") {
    blockers.push("pdf_cohort_missing");
  }

  const uniqueBlockers = unique(blockers);
  return {
    schemaVersion: "velmere.commercial-cohort-gate.v1",
    policyVersion: PASS4809_COMMERCIAL_COHORT_POLICY_ID,
    product: args.product,
    tier: args.tier,
    verified: verification.verified && approvalVerification.verified && antiCherryPickVerification.verified && publicCheckpointVerification.verified,
    primaryVerified: verification.verified,
    dualControlVerified: approvalVerification.verified,
    antiCherryPickVerified: antiCherryPickVerification.verified,
    precommitBound: antiCherryPickVerification.precommitBound,
    transparencyBound: antiCherryPickVerification.transparencyBound,
    publicCheckpointVerified: publicCheckpointVerification.publicCheckpointVerified,
    rollbackProtected: publicCheckpointVerification.rollbackProtected,
    externallyWitnessed: publicCheckpointVerification.externallyWitnessed,
    keyRotationVerified: publicCheckpointVerification.keyRotationVerified,
    deploymentReceiptVerified: publicCheckpointVerification.deploymentReceiptVerified,
    artifactBound: publicCheckpointVerification.artifactBound,
    stagingE2eVerified: publicCheckpointVerification.stagingE2eVerified,
    stagingE2eBound: publicCheckpointVerification.stagingE2eBound,
    stagingRollbackProtected: publicCheckpointVerification.stagingRollbackProtected,
    stagingSequence: publicCheckpointVerification.stagingSequence,
    stagingReceiptDigest: publicCheckpointVerification.stagingReceiptDigest,
    stagingProbeCount: publicCheckpointVerification.stagingProbeCount,
    chaosRecoveryVerified: publicCheckpointVerification.chaosRecoveryVerified,
    recoveryBound: publicCheckpointVerification.recoveryBound,
    recoveryRollbackProtected: publicCheckpointVerification.recoveryRollbackProtected,
    rtoRpoVerified: publicCheckpointVerification.rtoRpoVerified,
    idempotencyVerified: publicCheckpointVerification.idempotencyVerified,
    chaosSequence: publicCheckpointVerification.chaosSequence,
    chaosReceiptDigest: publicCheckpointVerification.chaosReceiptDigest,
    chaosScenarioCount: publicCheckpointVerification.chaosScenarioCount,
    observabilityVerified: publicCheckpointVerification.observabilityVerified,
    telemetryBound: publicCheckpointVerification.telemetryBound,
    sloVerified: publicCheckpointVerification.sloVerified,
    incidentResponseVerified: publicCheckpointVerification.incidentResponseVerified,
    safeDegradationVerified: publicCheckpointVerification.safeDegradationVerified,
    observabilityRollbackProtected: publicCheckpointVerification.observabilityRollbackProtected,
    observabilitySequence: publicCheckpointVerification.observabilitySequence,
    observabilityReceiptDigest: publicCheckpointVerification.observabilityReceiptDigest,
    observabilityObjectiveCount: publicCheckpointVerification.observabilityObjectiveCount,
    privacyVerified: publicCheckpointVerification.privacyVerified,
    tenantIsolationVerified: publicCheckpointVerification.tenantIsolationVerified,
    dataLifecycleVerified: publicCheckpointVerification.dataLifecycleVerified,
    abuseResistanceVerified: publicCheckpointVerification.abuseResistanceVerified,
    auditTrailVerified: publicCheckpointVerification.auditTrailVerified,
    privacyRollbackProtected: publicCheckpointVerification.privacyRollbackProtected,
    privacySequence: publicCheckpointVerification.privacySequence,
    privacyReceiptDigest: publicCheckpointVerification.privacyReceiptDigest,
    privacyControlCount: publicCheckpointVerification.privacyControlCount,
    supplyChainVerified: publicCheckpointVerification.supplyChainVerified,
    reproducibleBuild: publicCheckpointVerification.reproducibleBuild,
    vulnerabilityGatePassed: publicCheckpointVerification.vulnerabilityGatePassed,
    supplyChainBound: publicCheckpointVerification.supplyChainBound,
    supplyChainProvenanceDigest: publicCheckpointVerification.supplyChainProvenanceDigest,
    deploymentRollbackProtected: publicCheckpointVerification.deploymentRollbackProtected,
    deploymentSequence: publicCheckpointVerification.deploymentSequence,
    deploymentReceiptDigest: publicCheckpointVerification.deploymentReceiptDigest,
    checkpointSequence: publicCheckpointVerification.checkpointSequence,
    checkpointDigest: publicCheckpointVerification.checkpointDigest,
    trustEpoch: publicCheckpointVerification.trustEpoch,
    externalWitnessCount: publicCheckpointVerification.externalWitnessCount,
    ready: verification.verified && approvalVerification.verified && antiCherryPickVerification.verified && publicCheckpointVerification.verified && uniqueBlockers.length === 0,
    manifestDigest: args.attestation?.manifest.manifestDigest ?? null,
    antiCherryPickReceiptDigest: args.antiCherryPickReceipt ? sha256Digest(canonicalJson(args.antiCherryPickReceipt)) : null,
    expiresAt: args.attestation?.expiresAt ?? null,
    blockers: uniqueBlockers,
    metrics,
    pdfMetrics,
    thresholdSource: "internal_release_policy_not_external_benchmark",
  };
}
