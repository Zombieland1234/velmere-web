import { JSON_CONTROL_PATTERN } from "../ascii-control-characters";

import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256BytesDigest, sha256Digest } from "@/lib/security/cryptographic-digest";
import {
  buildCustomerSafeMinimalPdf,
  buildCustomerSafeMinimalPdfLegacyV1,
  isCustomerSafeProAuditPdfLine,
  PASS4808_PDF_RENDER_CONTRACT_ID,
  planCustomerSafePdf,
  type CustomerSafePdfOptions,
  type CustomerSafePdfRenderPlan,
} from "@/lib/security/pro-audit-pdf/customer-safe-renderer";
import { buildPass2569AuditSourceMatrix, buildPass2569AuditSourceSpine } from "@/lib/security/audit-source-spine";
import { buildPass2570AuditSourceQuorumReport } from "@/lib/security/audit-source-quorum-runtime";
import { buildPass2571AuditProviderIntelligenceReport } from "@/lib/security/audit-provider-intelligence";
import { buildPass2572AuditProviderRuntimeReport, readPass2572AuditProviderPrivateStaticEvidence } from "@/lib/security/audit-provider-runtime-client";
import { buildPass2573AuditRuntimeConfidenceReport } from "@/lib/security/audit-runtime-confidence";
import { buildPass2574AuditClaimLedgerReport } from "@/lib/security/audit-claim-ledger";
import { buildPass2575AuditSourceFreshnessReport } from "@/lib/security/audit-source-freshness";
import { buildPass2576AuditPermissionParserReport } from "@/lib/security/audit-permission-parser";
import { buildPass2577AuditLiquidityHolderLockRiskReport } from "@/lib/security/audit-liquidity-holder-lock-risk";
import { buildPass2578AuditReportAssemblerReport } from "@/lib/security/audit-report-assembler";
import { buildPass2579AdvancedManualReviewQueueReport } from "@/lib/security/advanced-manual-review-queue";
import { buildPass2580CustomerSafeDeliveryDecisionReport } from "@/lib/security/customer-safe-delivery-decision";
import { buildPass2581AuditVersionedRecheckReceiptReport } from "@/lib/security/audit-versioned-recheck-receipt";
import { buildPass2582RealProviderAdapterHardeningReport } from "@/lib/security/real-provider-adapter-hardening";
import { buildPass2583ContractSourceAbiExtractionReport } from "@/lib/security/contract-source-abi-extraction";
import { buildPass2584HolderLiquidityDepthEvidenceReport } from "@/lib/security/holder-liquidity-depth-evidence";
import { buildPass2585PremiumProPdfTemplateContractReport } from "@/lib/security/premium-pro-pdf-template-contract";
import { getAuditTierContract, type AuditTierId } from "@/lib/security/audit-tier-contract";
import { evaluateAuditPaidEvidenceReadiness } from "@/lib/security/audit-paid-evidence-readiness";
import {
  buildCustomerSafeAuditProviderRightsSummary,
  getCanonicalAuditProviderRightsRegistry,
  PASS4826_AUDIT_PROVIDER_RIGHTS_SUMMARY_SCHEMA,
  type AuditProviderRightsCustomerSummary,
  type AuditProviderRightsRegistry,
} from "@/lib/security/audit-provider-rights-currentness";
import { maskCustomerFacingPii } from "@/lib/security/privacy-redaction-pii-boundary-gate";
import { buildCanonicalEvidencePacket, verifyCanonicalEvidencePacketIntegrity } from "@/lib/market-integrity/canonical-evidence-packet";
import { buildAuditPublicSourceReceiptReport } from "@/lib/security/audit-public-source-receipts";
import { buildAuditEvidenceReceiptPacket, type AuditEvidenceReceiptRoots } from "@/lib/security/audit-evidence-receipt-packet";
import {
  buildAuditProviderEvidenceDimensions,
  PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID,
} from "@/lib/security/audit-provider-evidence-dimensions";
import type { AuditSourceCandidates } from "@/lib/security/audit-source-candidates";
import { parseVerifiedSoliditySourceBundle } from "@/lib/security/verified-solidity-source-bundle";
import { detectP78Erc2771MulticallContext } from "@/lib/security/erc2771-multicall-context-detector";
import { buildP79HistoricalDeploymentContextAdjudication } from "@/lib/security/audit-deployment-context-adjudicator";
import { buildAuditExecutionReleaseBindingDigest } from "@/lib/security/audit-execution-packet-release-gate";

const MAX_CUSTOMER_PDF_LINES = 480;
const SNAPSHOT_SCHEMA = "velmere.audit-pdf-snapshot.v1" as const;
const CONTENT_BOUND_LEGACY_MODEL_VERSION = "audit-report-assembler-pass2578-content-bound-pass4807" as const;
const RENDER_BOUND_LEGACY_MODEL_VERSION = "audit-report-assembler-pass2578-render-bound-pass4808" as const;
const P89_MODEL_VERSION = "audit-report-assembler-pass2578-evidence-dimensions-pass4809" as const;
const MODEL_VERSION = "audit-report-assembler-pass2578-rights-currentness-pass4828" as const;
type AuditPdfModelVersion =
  | typeof CONTENT_BOUND_LEGACY_MODEL_VERSION
  | typeof RENDER_BOUND_LEGACY_MODEL_VERSION
  | typeof P89_MODEL_VERSION
  | typeof MODEL_VERSION;

function hasRenderContractModel(modelVersion: AuditPdfModelVersion | undefined) {
  return modelVersion === RENDER_BOUND_LEGACY_MODEL_VERSION || modelVersion === P89_MODEL_VERSION || modelVersion === MODEL_VERSION;
}

type PaidAuditTier = Extract<AuditTierId, "pro" | "advanced">;
type AuditPdfTier = AuditTierId;
type Locale = "pl" | "en" | "de";

const PAID_AUDIT_MINIMUM_INDEPENDENT_UPSTREAMS: Record<PaidAuditTier, number> = {
  pro: 3,
  advanced: 4,
};

const PAID_AUDIT_CONFIDENCE_FLOOR: Record<PaidAuditTier, number> = {
  pro: 65,
  advanced: 75,
};

export const pass4828AuditPdfRightsDependencies: {
  registry: () => AuditProviderRightsRegistry;
} = {
  registry: getCanonicalAuditProviderRightsRegistry,
};

/** Legacy worker payload remains readable for old queued jobs, but score/confidence are ignored. */
export type ProAuditPdfRenderInput = {
  schemaVersion: "velmere.audit-pdf-worker-payload.v1";
  requestId: string;
  target: string;
  chain: string;
  locale: Locale;
  score: string;
  confidence: string;
  tier?: AuditPdfTier;
};

type ValidatedAuditPdfRenderInput = Omit<ProAuditPdfRenderInput, "tier"> & { tier: AuditPdfTier };
export type AuditPdfBuildInput = Omit<ValidatedAuditPdfRenderInput, "schemaVersion" | "score" | "confidence"> & {
  sourceCandidates?: AuditSourceCandidates;
  executionReleaseBinding?: AuditExecutionReleaseSnapshotBinding;
};

export type AuditExecutionReleaseSnapshotBinding = {
  schemaVersion: "velmere.audit-execution-release-gate.v1";
  decision: "ALLOW_COMPLETE";
  completionAllowed: true;
  persistAllowed: true;
  expectedTier: AuditPdfTier;
  caseRef: string;
  packetDigest: string;
  currentDeploymentReceiptDigest: string;
  matchedInputDigest: string;
  releaseBindingDigest: string;
};

export type ProAuditCanonicalLayout = {
  schemaVersion: "velmere.audit-canonical-layout.v1";
  sections: Array<{ id: string; title: string; lines: string[] }>;
  flattenedDigest: string;
  layoutDigest: string;
};

export type ProAuditPdfSnapshot = {
  schemaVersion: typeof SNAPSHOT_SCHEMA;
  requestId: string;
  target: string;
  chain: string;
  locale: Locale;
  tier: AuditPdfTier;
  generatedAt: string;
  modelVersion: AuditPdfModelVersion;
  calibrationProfileId: string | null;
  renderContract?: {
    id: typeof PASS4808_PDF_RENDER_CONTRACT_ID;
    planDigest: string;
    pageCount: number;
    renderedRowCount: number;
    unsupportedGlyphReplacements: number;
    pdfDigest: string;
    pdfByteLength: number;
  };
  canonicalEvidencePacketId: string;
  canonicalEvidenceDigest: string;
  sourceReceiptRoot: string;
  auditExecutionRelease?: AuditExecutionReleaseSnapshotBinding;
  providerTruth: {
    confirmedIdentityBoundProviders: number;
    independentProviderFamilies: string[];
    independentUpstreamRoots: string[];
    strictQuorumMet: boolean;
    /** Required only for P89+ snapshots. Legacy snapshots never inherit this guarantee. */
    evidenceDimensionVersion?: typeof PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID;
    successfulLiveProviderLanes?: number;
    successfulLiveProviderIds?: string[];
    duplicateStrictLanesRejected?: number;
    duplicateLiveLanesRejected?: number;
  };
  /** Required only for P90+ snapshots. Legacy snapshots never inherit commercial rights/currentness guarantees. */
  customerEligibility?: AuditProviderRightsCustomerSummary;
  publicSourceTruth: {
    submitted: number;
    contentBound: number;
    exactIdentityBound: number;
    allSubmittedSourcesBound: boolean;
  };
  evidenceRoots: AuditEvidenceReceiptRoots;
  evidenceReadiness: {
    proReady: boolean;
    advancedReady: boolean;
    reasons: string[];
    /** Required only for P89+ snapshots and bound into the immutable digest. */
    evidenceRows?: number;
  };
  verdict: {
    riskScore: number | null;
    riskLabel: string;
    confidenceScore: number;
    reviewPriorityScore: number;
    readinessScore: number;
  };
  layout: ProAuditCanonicalLayout;
  lines: string[];
  digest: string;
};

export type ProAuditPdfSnapshotRenderPayload = {
  schemaVersion: "velmere.audit-pdf-snapshot-render.v1";
  snapshot: ProAuditPdfSnapshot;
};

export type ProAuditPdfWorkerPayload = ProAuditPdfRenderInput | ProAuditPdfSnapshotRenderPayload;

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanPdfLine(value: unknown, max = 1_200) {
  return typeof value === "string"
    ? value.replace(JSON_CONTROL_PATTERN, " ").slice(0, max)
    : "";
}

function cleanDigest(value: unknown) {
  const text = clean(value, 80).toLowerCase();
  return /^sha256:[a-f0-9]{64}$/.test(text) ? text : "";
}

function finiteScore(value: unknown, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? Math.round(number) : null;
}

export function validateAuditExecutionReleaseSnapshotBinding(
  value: unknown,
  expectedTier: AuditPdfTier,
): AuditExecutionReleaseSnapshotBinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("audit_execution_release_binding_invalid");
  const input = value as Record<string, unknown>;
  const caseRef = clean(input.caseRef, 160);
  const packetDigest = cleanDigest(input.packetDigest);
  const currentDeploymentReceiptDigest = cleanDigest(input.currentDeploymentReceiptDigest);
  const matchedInputDigest = cleanDigest(input.matchedInputDigest);
  const releaseBindingDigest = cleanDigest(input.releaseBindingDigest);
  if (input.schemaVersion !== "velmere.audit-execution-release-gate.v1"
    || input.decision !== "ALLOW_COMPLETE"
    || input.completionAllowed !== true
    || input.persistAllowed !== true
    || input.expectedTier !== expectedTier
    || !caseRef || !packetDigest || !currentDeploymentReceiptDigest || !matchedInputDigest || !releaseBindingDigest) {
    throw new Error("audit_execution_release_binding_invalid");
  }
  const expectedReleaseBindingDigest = buildAuditExecutionReleaseBindingDigest({
    expectedTier,
    caseRef,
    packetDigest,
    currentDeploymentReceiptDigest,
    matchedInputDigest,
    completionAllowed: true,
    blockers: [],
  });
  if (releaseBindingDigest !== expectedReleaseBindingDigest) {
    throw new Error("audit_execution_release_binding_digest_mismatch");
  }
  return {
    schemaVersion: "velmere.audit-execution-release-gate.v1",
    decision: "ALLOW_COMPLETE",
    completionAllowed: true,
    persistAllowed: true,
    expectedTier,
    caseRef,
    packetDigest,
    currentDeploymentReceiptDigest,
    matchedInputDigest,
    releaseBindingDigest,
  };
}

function cleanStringArray(value: unknown, maxItems: number, maxLength = 120) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => clean(item, maxLength)).filter(Boolean))).sort().slice(0, maxItems)
    : [];
}

function buildCanonicalLayout(lines: string[]): ProAuditCanonicalLayout {
  const sections: ProAuditCanonicalLayout["sections"] = [];
  let current: { id: string; title: string; lines: string[] } | null = null;
  const startsSection = (line: string) => line.trim().endsWith(":") && line.trim().length <= 96;
  for (const line of lines) {
    if (!current || startsSection(line)) {
      if (current?.lines.length) sections.push(current);
      const title = line.trim() || `Section ${sections.length + 1}`;
      current = { id: `section-${String(sections.length + 1).padStart(2, "0")}`, title, lines: [line] };
    } else {
      current.lines.push(line);
    }
  }
  if (current?.lines.length) sections.push(current);
  if (!sections.length) sections.push({ id: "section-01", title: "Report", lines: [...lines] });
  const normalized = sections.map((section) => ({ ...section, lines: section.lines.slice(0, MAX_CUSTOMER_PDF_LINES) }));
  const flattened = normalized.flatMap((section) => section.lines).slice(0, MAX_CUSTOMER_PDF_LINES);
  const unsigned = { schemaVersion: "velmere.audit-canonical-layout.v1" as const, sections: normalized, flattenedDigest: sha256Digest(canonicalJson(flattened)) };
  return { ...unsigned, layoutDigest: sha256Digest(canonicalJson(unsigned)) };
}

function validateEvidenceRoots(value: unknown, requireLiveExecutionRoot: boolean, requireRightsCurrentnessRoot = false): AuditEvidenceReceiptRoots {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("audit_pdf_evidence_roots_invalid");
  const input = value as Record<string, unknown>;
  const keys: Array<keyof AuditEvidenceReceiptRoots> = [
    "providerResponseRoot", "publicSourceRoot", "sourceAbiRoot", "proxyImplementationRoot",
    "permissionRoot", "holderLiquidityRoot", "conflictArbitrationRoot", "aggregateRoot",
  ];
  const result = {} as AuditEvidenceReceiptRoots;
  for (const key of keys) {
    const digest = cleanDigest(input[key]);
    if (!digest) throw new Error(`audit_pdf_evidence_root_invalid:${key}`);
    result[key] = digest;
  }
  const liveExecutionRoot = cleanDigest(input.liveExecutionRoot);
  if (requireLiveExecutionRoot && !liveExecutionRoot) throw new Error("audit_pdf_evidence_root_invalid:liveExecutionRoot");
  if (liveExecutionRoot) result.liveExecutionRoot = liveExecutionRoot;
  const providerRightsCurrentnessRoot = cleanDigest(input.providerRightsCurrentnessRoot);
  if (requireRightsCurrentnessRoot && !providerRightsCurrentnessRoot) throw new Error("audit_pdf_evidence_root_invalid:providerRightsCurrentnessRoot");
  if (providerRightsCurrentnessRoot) result.providerRightsCurrentnessRoot = providerRightsCurrentnessRoot;
  return result;
}

function validateCanonicalLayout(value: unknown, lines: string[]): ProAuditCanonicalLayout {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("audit_pdf_layout_invalid");
  const input = value as Record<string, unknown>;
  if (input.schemaVersion !== "velmere.audit-canonical-layout.v1" || !Array.isArray(input.sections)) throw new Error("audit_pdf_layout_schema_invalid");
  const sections = input.sections.slice(0, 40).map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("audit_pdf_layout_section_invalid");
    const row = raw as Record<string, unknown>;
    const id = clean(row.id, 80) || `section-${index + 1}`;
    const title = clean(row.title, 160);
    const sectionLines = Array.isArray(row.lines) ? row.lines.map((line) => cleanPdfLine(line, 1_200)).slice(0, MAX_CUSTOMER_PDF_LINES) : [];
    if (!title || !sectionLines.some((line) => line.trim().length > 0)) throw new Error("audit_pdf_layout_section_content_invalid");
    return { id, title, lines: sectionLines };
  });
  const flattened = sections.flatMap((section) => section.lines).slice(0, MAX_CUSTOMER_PDF_LINES);
  if (canonicalJson(flattened) !== canonicalJson(lines)) throw new Error("audit_pdf_layout_line_parity_failed");
  const flattenedDigest = cleanDigest(input.flattenedDigest);
  const layoutDigest = cleanDigest(input.layoutDigest);
  const unsigned = { schemaVersion: "velmere.audit-canonical-layout.v1" as const, sections, flattenedDigest };
  if (!flattenedDigest || flattenedDigest !== sha256Digest(canonicalJson(flattened))) throw new Error("audit_pdf_layout_flattened_digest_invalid");
  if (!layoutDigest || layoutDigest !== sha256Digest(canonicalJson(unsigned))) throw new Error("audit_pdf_layout_digest_invalid");
  return { ...unsigned, layoutDigest };
}

export function validateProAuditPdfRenderInput(value: unknown): ValidatedAuditPdfRenderInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("audit_pdf_worker_payload_invalid");
  const input = value as Record<string, unknown>;
  if (input.schemaVersion !== "velmere.audit-pdf-worker-payload.v1") throw new Error("audit_pdf_worker_payload_schema_invalid");
  const requestId = clean(input.requestId, 80);
  const target = clean(input.target, 600);
  const chain = clean(input.chain, 40);
  const score = clean(input.score, 20);
  const confidence = clean(input.confidence, 20);
  const locale = input.locale === "pl" || input.locale === "de" ? input.locale : input.locale === "en" ? "en" : null;
  const tier = input.tier === "basic" || input.tier === "advanced" ? input.tier : "pro";
  if (!requestId || !target || !chain || !score || !confidence || !locale) throw new Error("audit_pdf_worker_payload_fields_invalid");
  return { schemaVersion: "velmere.audit-pdf-worker-payload.v1", requestId, target, chain, locale, score, confidence, tier };
}

function unsignedSnapshot(snapshot: Omit<ProAuditPdfSnapshot, "digest">) {
  return snapshot;
}

/**
 * A paid Audit PDF is an export boundary, not an evidence-status preview.
 * Every critical readiness signal must be green before bytes can be rendered
 * or persisted. Honest blocked/partial states remain available upstream, but
 * cannot be relabelled as a paid Pro/Advanced artifact.
 */
export function assertProAuditPdfPaidCompleteness(snapshot: ProAuditPdfSnapshot) {
  if (snapshot.tier === "basic") return;
  const minimumUpstreams = PAID_AUDIT_MINIMUM_INDEPENDENT_UPSTREAMS[snapshot.tier];
  const tierMinimum = getAuditTierContract(snapshot.tier).minimumEvidence;
  const currentDimensionModel = snapshot.modelVersion === P89_MODEL_VERSION || snapshot.modelVersion === MODEL_VERSION;
  const currentRightsModel = snapshot.modelVersion === MODEL_VERSION;
  // P88-and-earlier snapshots froze the old combined strict=max(strict, live)
  // interpretation. They remain verifiable under that stronger historical rule
  // and never inherit the separate P89 execution-coverage guarantee.
  const minimumStrictReceiptLanes = currentDimensionModel
    ? tierMinimum.verifiedProviderReceipts
    : Math.max(tierMinimum.verifiedProviderReceipts, tierMinimum.liveLanes);
  const successfulLiveProviderLanes = currentDimensionModel
    ? snapshot.providerTruth.successfulLiveProviderLanes ?? -1
    : snapshot.providerTruth.confirmedIdentityBoundProviders;
  const evidenceRows = currentDimensionModel
    ? snapshot.evidenceReadiness.evidenceRows ?? -1
    : tierMinimum.evidenceRows;
  const tierReady = snapshot.tier === "advanced"
    ? snapshot.evidenceReadiness.advancedReady
    : snapshot.evidenceReadiness.proReady;
  const criticalEvidenceReasons = snapshot.evidenceReadiness.reasons.filter((reason) => (
    /(?:independent_(?:content_bound_)?upstream|two_independent|source(?:_or)?_abi|permission_evidence|holder_liquidity_evidence|all_submitted_public_sources|identity_(?:bound|mismatch)|content_bound_upstream)/i.test(reason)
  ));
  const blockers = [
    !tierReady ? `${snapshot.tier}_evidence_readiness_false` : null,
    !snapshot.providerTruth.strictQuorumMet ? "strict_quorum_not_met" : null,
    snapshot.providerTruth.independentUpstreamRoots.length < minimumUpstreams
      ? `independent_upstream_roots:${snapshot.providerTruth.independentUpstreamRoots.length}/${minimumUpstreams}`
      : null,
    snapshot.providerTruth.confirmedIdentityBoundProviders < minimumStrictReceiptLanes
      ? `identity_bound_provider_receipt_lanes:${snapshot.providerTruth.confirmedIdentityBoundProviders}/${minimumStrictReceiptLanes}`
      : null,
    currentDimensionModel && successfulLiveProviderLanes < tierMinimum.liveLanes
      ? `successful_live_provider_lanes:${successfulLiveProviderLanes}/${tierMinimum.liveLanes}`
      : null,
    currentDimensionModel && evidenceRows < tierMinimum.evidenceRows
      ? `evidence_rows:${evidenceRows}/${tierMinimum.evidenceRows}`
      : null,
    snapshot.providerTruth.independentProviderFamilies.length < tierMinimum.independentProviderFamilies
      ? `independent_provider_families:${snapshot.providerTruth.independentProviderFamilies.length}/${tierMinimum.independentProviderFamilies}`
      : null,
    currentRightsModel && !snapshot.customerEligibility?.commercialUseReady
      ? "provider_customer_eligibility_not_ready"
      : null,
    currentRightsModel && (snapshot.customerEligibility?.rightsCurrentStrictReceipts ?? -1) < tierMinimum.verifiedProviderReceipts
      ? `rights_current_strict_receipts:${snapshot.customerEligibility?.rightsCurrentStrictReceipts ?? -1}/${tierMinimum.verifiedProviderReceipts}`
      : null,
    currentRightsModel && (snapshot.customerEligibility?.rightsCurrentLiveExecutions ?? -1) < tierMinimum.liveLanes
      ? `rights_current_live_executions:${snapshot.customerEligibility?.rightsCurrentLiveExecutions ?? -1}/${tierMinimum.liveLanes}`
      : null,
    currentRightsModel && (snapshot.customerEligibility?.rightsCurrentProviderFamilies ?? -1) < tierMinimum.independentProviderFamilies
      ? `rights_current_provider_families:${snapshot.customerEligibility?.rightsCurrentProviderFamilies ?? -1}/${tierMinimum.independentProviderFamilies}`
      : null,
    currentRightsModel && (snapshot.customerEligibility?.rightsCurrentUpstreamRoots ?? -1) < minimumUpstreams
      ? `rights_current_upstream_roots:${snapshot.customerEligibility?.rightsCurrentUpstreamRoots ?? -1}/${minimumUpstreams}`
      : null,
    currentRightsModel && (snapshot.customerEligibility?.rightsCurrentFields ?? -1) < tierMinimum.evidenceRows
      ? `rights_current_customer_fields:${snapshot.customerEligibility?.rightsCurrentFields ?? -1}/${tierMinimum.evidenceRows}`
      : null,
    snapshot.verdict.confidenceScore < PAID_AUDIT_CONFIDENCE_FLOOR[snapshot.tier]
      ? `confidence_floor:${snapshot.verdict.confidenceScore}/${PAID_AUDIT_CONFIDENCE_FLOOR[snapshot.tier]}`
      : null,
    criticalEvidenceReasons.length > 0
      ? `critical_evidence_reasons:${criticalEvidenceReasons.join(",")}`
      : null,
    snapshot.publicSourceTruth.exactIdentityBound < snapshot.publicSourceTruth.submitted
      ? `public_source_exact_identity_binding:${snapshot.publicSourceTruth.exactIdentityBound}/${snapshot.publicSourceTruth.submitted}`
      : null,
    snapshot.tier === "advanced" && !snapshot.publicSourceTruth.allSubmittedSourcesBound
      ? "advanced_public_sources_not_content_bound"
      : null,
  ].filter((value): value is string => Boolean(value));
  if (blockers.length) throw new Error(`audit_pdf_paid_completeness_blocked:${blockers.join("|")}`);
}

export function validateProAuditPdfSnapshot(value: unknown): ProAuditPdfSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("audit_pdf_snapshot_invalid");
  const input = value as Record<string, unknown>;
  if (input.schemaVersion !== SNAPSHOT_SCHEMA) throw new Error("audit_pdf_snapshot_schema_invalid");
  const requestId = clean(input.requestId, 80);
  const target = clean(input.target, 600);
  const chain = clean(input.chain, 40);
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : null;
  const tier = input.tier === "basic" || input.tier === "pro" || input.tier === "advanced" ? input.tier : null;
  const generatedAt = clean(input.generatedAt, 64);
  const modelVersion = input.modelVersion === MODEL_VERSION
    ? MODEL_VERSION
    : input.modelVersion === P89_MODEL_VERSION
      ? P89_MODEL_VERSION
      : input.modelVersion === RENDER_BOUND_LEGACY_MODEL_VERSION
        ? RENDER_BOUND_LEGACY_MODEL_VERSION
        : input.modelVersion === CONTENT_BOUND_LEGACY_MODEL_VERSION
          ? CONTENT_BOUND_LEGACY_MODEL_VERSION
          : null;
  const canonicalEvidencePacketId = clean(input.canonicalEvidencePacketId, 180);
  const canonicalEvidenceDigest = cleanDigest(input.canonicalEvidenceDigest);
  const sourceReceiptRoot = cleanDigest(input.sourceReceiptRoot);
  const digest = cleanDigest(input.digest);
  const lines = Array.isArray(input.lines)
    ? input.lines.map((line) => cleanPdfLine(line, 1_200)).slice(0, MAX_CUSTOMER_PDF_LINES)
    : [];
  const providerTruthRaw = input.providerTruth && typeof input.providerTruth === "object" && !Array.isArray(input.providerTruth)
    ? input.providerTruth as Record<string, unknown>
    : null;
  const verdictRaw = input.verdict && typeof input.verdict === "object" && !Array.isArray(input.verdict)
    ? input.verdict as Record<string, unknown>
    : null;
  const families = cleanStringArray(providerTruthRaw?.independentProviderFamilies, 16, 80);
  const upstreamRoots = cleanStringArray(providerTruthRaw?.independentUpstreamRoots, 16, 120);
  const publicSourceTruthRaw = input.publicSourceTruth && typeof input.publicSourceTruth === "object" && !Array.isArray(input.publicSourceTruth)
    ? input.publicSourceTruth as Record<string, unknown>
    : null;
  const readinessRaw = input.evidenceReadiness && typeof input.evidenceReadiness === "object" && !Array.isArray(input.evidenceReadiness)
    ? input.evidenceReadiness as Record<string, unknown>
    : null;
  const confirmedIdentityBoundProviders = finiteScore(providerTruthRaw?.confirmedIdentityBoundProviders, 0, 100);
  const currentDimensionModel = modelVersion === P89_MODEL_VERSION || modelVersion === MODEL_VERSION;
  const currentRightsModel = modelVersion === MODEL_VERSION;
  const evidenceDimensionVersion = providerTruthRaw?.evidenceDimensionVersion === PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID
    ? PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID
    : null;
  const successfulLiveProviderLanes = finiteScore(providerTruthRaw?.successfulLiveProviderLanes, 0, 100);
  const successfulLiveProviderIds = cleanStringArray(providerTruthRaw?.successfulLiveProviderIds, 32, 120);
  const duplicateStrictLanesRejected = finiteScore(providerTruthRaw?.duplicateStrictLanesRejected, 0, 100);
  const duplicateLiveLanesRejected = finiteScore(providerTruthRaw?.duplicateLiveLanesRejected, 0, 100);
  const evidenceRows = finiteScore(readinessRaw?.evidenceRows, 0, 100_000);
  const riskScore = verdictRaw?.riskScore === null ? null : finiteScore(verdictRaw?.riskScore, 0, 100);
  const confidenceScore = finiteScore(verdictRaw?.confidenceScore, 0, 100);
  const reviewPriorityScore = finiteScore(verdictRaw?.reviewPriorityScore, 0, 100);
  const readinessScore = finiteScore(verdictRaw?.readinessScore, 0, 100);
  const riskLabel = clean(verdictRaw?.riskLabel, 48);
  const parsedAt = Date.parse(generatedAt);
  if (!requestId || !target || !chain || !locale || !tier || !Number.isFinite(parsedAt) || !modelVersion) throw new Error("audit_pdf_snapshot_binding_invalid");
  if (!canonicalEvidencePacketId || !canonicalEvidenceDigest || !sourceReceiptRoot || !digest) throw new Error("audit_pdf_snapshot_digest_fields_invalid");
  if (lines.filter((line) => line.trim().length > 0).length < 30 || confirmedIdentityBoundProviders === null || confidenceScore === null || reviewPriorityScore === null || readinessScore === null || !riskLabel) {
    throw new Error("audit_pdf_snapshot_content_invalid");
  }
  if (currentDimensionModel && (
    evidenceDimensionVersion !== PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID
    || successfulLiveProviderLanes === null
    || successfulLiveProviderIds.length !== successfulLiveProviderLanes
    || duplicateStrictLanesRejected === null
    || duplicateLiveLanesRejected === null
    || evidenceRows === null
  )) throw new Error("audit_pdf_provider_evidence_dimensions_invalid");
  const eligibilityRaw = input.customerEligibility && typeof input.customerEligibility === "object" && !Array.isArray(input.customerEligibility)
    ? input.customerEligibility as Record<string, unknown>
    : null;
  let customerEligibility: AuditProviderRightsCustomerSummary | undefined;
  if (currentRightsModel) {
    const parsed = {
      schemaVersion: eligibilityRaw?.schemaVersion,
      registryDigest: clean(eligibilityRaw?.registryDigest, 80),
      evaluatedAt: clean(eligibilityRaw?.evaluatedAt, 64),
      reverifyBy: eligibilityRaw?.reverifyBy === null ? null : clean(eligibilityRaw?.reverifyBy, 64),
      tier: eligibilityRaw?.tier,
      successfulTechnicalProviders: finiteScore(eligibilityRaw?.successfulTechnicalProviders, 0, 100),
      dataCurrentProviders: finiteScore(eligibilityRaw?.dataCurrentProviders, 0, 100),
      rightsCurrentProviders: finiteScore(eligibilityRaw?.rightsCurrentProviders, 0, 100),
      technicalStrictReceipts: finiteScore(eligibilityRaw?.technicalStrictReceipts, 0, 100),
      rightsCurrentStrictReceipts: finiteScore(eligibilityRaw?.rightsCurrentStrictReceipts, 0, 100),
      technicalLiveExecutions: finiteScore(eligibilityRaw?.technicalLiveExecutions, 0, 100),
      rightsCurrentLiveExecutions: finiteScore(eligibilityRaw?.rightsCurrentLiveExecutions, 0, 100),
      rightsCurrentProviderFamilies: finiteScore(eligibilityRaw?.rightsCurrentProviderFamilies, 0, 100),
      rightsCurrentUpstreamRoots: finiteScore(eligibilityRaw?.rightsCurrentUpstreamRoots, 0, 100),
      customerRelevantFields: finiteScore(eligibilityRaw?.customerRelevantFields, 0, 10_000),
      rightsCurrentFields: finiteScore(eligibilityRaw?.rightsCurrentFields, 0, 10_000),
      blockedFields: finiteScore(eligibilityRaw?.blockedFields, 0, 10_000),
      commercialUseReady: eligibilityRaw?.commercialUseReady === true,
      limitationCodes: cleanStringArray(eligibilityRaw?.limitationCodes, 16, 100),
      summaryDigest: clean(eligibilityRaw?.summaryDigest, 80),
    };
    if (
      parsed.schemaVersion !== PASS4826_AUDIT_PROVIDER_RIGHTS_SUMMARY_SCHEMA
      || !/^sha256:[a-f0-9]{64}$/.test(parsed.registryDigest)
      || !Number.isFinite(Date.parse(parsed.evaluatedAt))
      || (parsed.reverifyBy !== null && !Number.isFinite(Date.parse(parsed.reverifyBy)))
      || parsed.tier !== tier
      || parsed.successfulTechnicalProviders === null
      || parsed.dataCurrentProviders === null
      || parsed.rightsCurrentProviders === null
      || parsed.technicalStrictReceipts === null
      || parsed.rightsCurrentStrictReceipts === null
      || parsed.technicalLiveExecutions === null
      || parsed.rightsCurrentLiveExecutions === null
      || parsed.rightsCurrentProviderFamilies === null
      || parsed.rightsCurrentUpstreamRoots === null
      || parsed.customerRelevantFields === null
      || parsed.rightsCurrentFields === null
      || parsed.blockedFields === null
      || !/^sha256:[a-f0-9]{64}$/.test(parsed.summaryDigest)
    ) throw new Error("audit_pdf_customer_eligibility_invalid");
    const unsignedEligibility = { ...parsed } as Record<string, unknown>;
    delete unsignedEligibility.summaryDigest;
    if (sha256Digest(canonicalJson(unsignedEligibility)) !== parsed.summaryDigest) throw new Error("audit_pdf_customer_eligibility_digest_invalid");
    customerEligibility = parsed as AuditProviderRightsCustomerSummary;
  }
  const evidenceRoots = validateEvidenceRoots(input.evidenceRoots, currentDimensionModel, currentRightsModel);
  if (currentRightsModel && !cleanDigest(evidenceRoots.providerRightsCurrentnessRoot)) throw new Error("audit_pdf_provider_rights_currentness_root_missing");
  if (evidenceRoots.aggregateRoot !== sourceReceiptRoot) throw new Error("audit_pdf_source_receipt_root_mismatch");
  if (currentDimensionModel) {
    const requiredDimensionLines = [
      `Report model reference: ${sha256Digest(modelVersion)}`,
      `Provider evidence dimension reference: ${sha256Digest(PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID)}`,
      `Identity-bound confirmed provider responses: ${confirmedIdentityBoundProviders}`,
      `Successful live direct-provider executions: ${successfulLiveProviderLanes}`,
      `Live execution root: ${evidenceRoots.liveExecutionRoot}`,
    ];
    if (requiredDimensionLines.some((line) => !lines.includes(line))) throw new Error("audit_pdf_provider_dimension_line_mismatch");
  }
  if (currentRightsModel && customerEligibility) {
    const requiredEligibilityLines = [
      `Provider customer eligibility: ${customerEligibility.commercialUseReady ? "ready" : "withheld"}`,
      `Eligible provider evidence: strict ${customerEligibility.rightsCurrentStrictReceipts}; live ${customerEligibility.rightsCurrentLiveExecutions}; fields ${customerEligibility.rightsCurrentFields}`,
      `Eligible provider independence: families ${customerEligibility.rightsCurrentProviderFamilies}; upstream roots ${customerEligibility.rightsCurrentUpstreamRoots}`,
      `Provider eligibility reference: ${customerEligibility.summaryDigest}`,
      `Provider rights/currentness root: ${evidenceRoots.providerRightsCurrentnessRoot}`,
    ];
    if (requiredEligibilityLines.some((line) => !lines.includes(line))) throw new Error("audit_pdf_provider_eligibility_line_mismatch");
  }
  const publicSubmitted = finiteScore(publicSourceTruthRaw?.submitted, 0, 4);
  const publicContentBound = finiteScore(publicSourceTruthRaw?.contentBound, 0, 4);
  const publicExactIdentityBound = finiteScore(publicSourceTruthRaw?.exactIdentityBound, 0, 4);
  if (publicSubmitted === null || publicContentBound === null || publicExactIdentityBound === null) throw new Error("audit_pdf_public_source_truth_invalid");
  const readinessReasons = cleanStringArray(readinessRaw?.reasons, 32, 240);
  const auditExecutionRelease = input.auditExecutionRelease === undefined
    ? undefined
    : validateAuditExecutionReleaseSnapshotBinding(input.auditExecutionRelease, tier);
  if (auditExecutionRelease) {
    const requiredExecutionLines = [
      `Audit execution packet: ${auditExecutionRelease.packetDigest}`,
      `Current deployment receipt: ${auditExecutionRelease.currentDeploymentReceiptDigest}`,
      `Matched-input tier value: ${auditExecutionRelease.matchedInputDigest}`,
      `Execution release binding: ${auditExecutionRelease.releaseBindingDigest}`,
    ];
    if (requiredExecutionLines.some((line) => !lines.includes(line))) throw new Error("audit_execution_release_line_mismatch");
  }
  const layout = validateCanonicalLayout(input.layout, lines);
  const baseFields: Omit<ProAuditPdfSnapshot, "digest" | "renderContract"> = {
    schemaVersion: SNAPSHOT_SCHEMA,
    requestId,
    target,
    chain,
    locale,
    tier,
    generatedAt: new Date(parsedAt).toISOString(),
    modelVersion,
    calibrationProfileId: typeof input.calibrationProfileId === "string" ? clean(input.calibrationProfileId, 180) || null : null,
    canonicalEvidencePacketId,
    canonicalEvidenceDigest,
    sourceReceiptRoot,
    ...(auditExecutionRelease ? { auditExecutionRelease } : {}),
    providerTruth: {
      confirmedIdentityBoundProviders,
      independentProviderFamilies: families,
      independentUpstreamRoots: upstreamRoots,
      strictQuorumMet: providerTruthRaw?.strictQuorumMet === true && upstreamRoots.length >= 2,
      ...(currentDimensionModel ? {
        evidenceDimensionVersion: PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID,
        successfulLiveProviderLanes: successfulLiveProviderLanes as number,
        successfulLiveProviderIds,
        duplicateStrictLanesRejected: duplicateStrictLanesRejected as number,
        duplicateLiveLanesRejected: duplicateLiveLanesRejected as number,
      } : {}),
    },
    ...(currentRightsModel && customerEligibility ? { customerEligibility } : {}),
    publicSourceTruth: {
      submitted: publicSubmitted,
      contentBound: publicContentBound,
      exactIdentityBound: publicExactIdentityBound,
      allSubmittedSourcesBound: publicSourceTruthRaw?.allSubmittedSourcesBound === true && publicContentBound === publicSubmitted,
    },
    evidenceRoots,
    evidenceReadiness: {
      proReady: readinessRaw?.proReady === true,
      advancedReady: readinessRaw?.advancedReady === true,
      reasons: readinessReasons,
      ...(currentDimensionModel ? { evidenceRows: evidenceRows as number } : {}),
    },
    verdict: { riskScore, riskLabel, confidenceScore, reviewPriorityScore, readinessScore },
    layout,
    lines,
  };
  let snapshotWithoutDigest: Omit<ProAuditPdfSnapshot, "digest">;
  if (hasRenderContractModel(modelVersion)) {
    const renderRaw = input.renderContract && typeof input.renderContract === "object" && !Array.isArray(input.renderContract)
      ? input.renderContract as Record<string, unknown>
      : null;
    const renderContract = {
      id: renderRaw?.id === PASS4808_PDF_RENDER_CONTRACT_ID ? PASS4808_PDF_RENDER_CONTRACT_ID : null,
      planDigest: cleanDigest(renderRaw?.planDigest),
      pageCount: finiteScore(renderRaw?.pageCount, 1, 200),
      renderedRowCount: finiteScore(renderRaw?.renderedRowCount, 1, MAX_CUSTOMER_PDF_LINES * 8),
      unsupportedGlyphReplacements: finiteScore(renderRaw?.unsupportedGlyphReplacements, 0, MAX_CUSTOMER_PDF_LINES * 16),
      pdfDigest: cleanDigest(renderRaw?.pdfDigest),
      pdfByteLength: finiteScore(renderRaw?.pdfByteLength, 1_000, 4 * 1024 * 1024),
    };
    if (!renderContract.id || !renderContract.planDigest || renderContract.pageCount === null || renderContract.renderedRowCount === null || renderContract.unsupportedGlyphReplacements === null || !renderContract.pdfDigest || renderContract.pdfByteLength === null) {
      throw new Error("audit_pdf_render_contract_invalid");
    }
    snapshotWithoutDigest = { ...baseFields, renderContract: renderContract as NonNullable<ProAuditPdfSnapshot["renderContract"]> };
  } else {
    snapshotWithoutDigest = baseFields;
  }
  const snapshot: ProAuditPdfSnapshot = { ...snapshotWithoutDigest, digest };
  if (snapshot.evidenceReadiness.advancedReady && !snapshot.evidenceReadiness.proReady) throw new Error("audit_pdf_advanced_readiness_without_pro");
  if (snapshot.evidenceReadiness.proReady && !snapshot.providerTruth.strictQuorumMet) throw new Error("audit_pdf_readiness_quorum_mismatch");
  const expected = sha256Digest(canonicalJson(unsignedSnapshot(snapshotWithoutDigest)));
  if (expected !== digest) throw new Error("audit_pdf_snapshot_integrity_failed");
  if (hasRenderContractModel(modelVersion)) assertRenderContract(snapshot);
  assertProAuditPdfPaidCompleteness(snapshot);
  return snapshot;
}

export function validateProAuditPdfWorkerPayload(value: unknown): ProAuditPdfWorkerPayload {
  if (value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).schemaVersion === "velmere.audit-pdf-snapshot-render.v1") {
    const snapshot = validateProAuditPdfSnapshot((value as Record<string, unknown>).snapshot);
    return { schemaVersion: "velmere.audit-pdf-snapshot-render.v1", snapshot };
  }
  return validateProAuditPdfRenderInput(value);
}

function isCustomerRuntimeLine(line: string) {
  if (!isCustomerSafeProAuditPdfLine(line)) return false;
  return !/\bpass\d{3,}\b|service[- ]role|private trace|release board|ci artifact/i.test(line);
}

function maskAuditPdfLine(line: string) {
  const trimmed = line.trim();
  if (/^Target:\s*0x[a-fA-F0-9]{40}$/.test(trimmed)) return trimmed;
  // P79: preserve only the closed, engine-generated historical chain-evidence row.
  // These are public contract/transaction identifiers, not customer wallet identity.
  if (/^historicalDeployment=0x[a-fA-F0-9]{40}; snapshotBlock=\d+; attackBlock=\d+; attackTx=0x[a-fA-F0-9]{64}; proxy=EIP_1167_COMPATIBLE_MINIMAL_PROXY; implementation=0x[a-fA-F0-9]{40}; trustedForwarder=0x[a-fA-F0-9]{40}; upstreamReplay=PASS; profit=[0-9.]+ WBNB; independentVelmereReplay=false; currentExploitabilityProven=false$/.test(trimmed)) {
    return trimmed;
  }
  // P81: preserve only the complete engine-generated exact-block current deployment quorum row.
  // Free-form addresses/hashes remain blocked; every proof boundary must be present.
  if (/^currentDeployment=0x[a-fA-F0-9]{40}; snapshotBlock=\d+; blockHash=0x[a-fA-F0-9]{64}; stateRoot=0x[a-fA-F0-9]{64}; runtimeSha256=sha256:[a-f0-9]{64}; proxy=EIP_1167_COMPATIBLE_MINIMAL_PROXY; implementation=0x[a-fA-F0-9]{40}; implementationSha256=sha256:[a-f0-9]{64}; trustedForwarder=0x[a-fA-F0-9]{40}; trustedForwarderState=(?:ACTIVE|INACTIVE); negativeControl=INACTIVE; currentExploitabilityProven=false; independentReplay=false$/.test(trimmed)) {
    return trimmed;
  }
  return maskCustomerFacingPii(line);
}

function localizedCopy(locale: Locale, tier: AuditPdfTier) {
  if (locale === "pl") return {
    title: `VELMÈRE ${tier === "advanced" ? "ADVANCED" : tier === "pro" ? "PRO" : "BASIC"} AUDYT`,
    subtitle: tier === "advanced" ? "Rozszerzony automatyczny raport informacyjny" : tier === "pro" ? "Rozszerzony automatyczny raport dowodowy" : "Automatyczny raport wstępnego audytu",
    scope: "Zakres i granice bezpieczeństwa:", passive: "- Wyłącznie pasywna analiza publicznych i uprawnionych źródeł.",
    custody: "- Bez dostępu do portfela, seed phrase, kluczy i nieautoryzowanych aktywnych testów.",
    disclaimer: "- Wynik jest związany z dowodami i nie stanowi gwarancji bezpieczeństwa ani porady inwestycyjnej.",
    sources: "Źródła i pokrycie:", claims: "Twierdzenia i świeżość:", permissions: "Uprawnienia i powierzchnia kontroli:",
    liquidity: "Płynność, holderzy i dowody locków:", contract: "Kod kontraktu i ABI:", final: "Wynik końcowy:", advanced: "Automatyczna warstwa Advanced:",
  };
  if (locale === "de") return {
    title: `VELMÈRE ${tier === "advanced" ? "ADVANCED" : tier === "pro" ? "PRO" : "BASIC"} AUDIT`,
    subtitle: tier === "advanced" ? "Erweiterter automatisierter Informationsbericht" : tier === "pro" ? "Erweiterter automatisierter Evidenzbericht" : "Automatisierter Audit-Vorprüfbericht",
    scope: "Umfang und Sicherheitsgrenze:", passive: "- Nur passive Auswertung öffentlicher und autorisierter Quellen.",
    custody: "- Kein Wallet-, Seed-Phrase- oder Schlüsselzugriff und keine unautorisierten aktiven Tests.",
    disclaimer: "- Der evidenzgebundene Befund ist keine Sicherheitsgarantie und keine Anlageberatung.",
    sources: "Quellen und Abdeckung:", claims: "Claims und Aktualität:", permissions: "Berechtigungen und Kontrollfläche:",
    liquidity: "Liquidität, Holder und Lock-Evidenz:", contract: "Contract Source und ABI:", final: "Abschlussbericht:", advanced: "Automatisierte Advanced-Ebene:",
  };
  return {
    title: `VELMERE ${tier === "advanced" ? "ADVANCED" : tier === "pro" ? "PRO" : "BASIC"} AUDIT`,
    subtitle: tier === "advanced" ? "Extended automated informational report" : tier === "pro" ? "Extended automated evidence report" : "Automated audit prescreen report",
    scope: "Scope and safety boundary:", passive: "- Passive review of public and authorized sources only.",
    custody: "- No wallet, seed phrase or private-key access and no unauthorized active testing.",
    disclaimer: "- Findings are evidence-bound and are not a safety guarantee or investment advice.",
    sources: "Sources and coverage:", claims: "Claims and freshness:", permissions: "Permission and control surface:",
    liquidity: "Liquidity, holders and lock evidence:", contract: "Contract source and ABI evidence:", final: "Final report:", advanced: "Advanced automated layer:",
  };
}

function renderOptionsForSnapshot(snapshot: Pick<ProAuditPdfSnapshot, "locale" | "tier" | "requestId" | "generatedAt">): CustomerSafePdfOptions {
  const copy = localizedCopy(snapshot.locale, snapshot.tier);
  return {
    title: copy.title,
    subtitle: copy.subtitle,
    maxLines: MAX_CUSTOMER_PDF_LINES,
    footer: snapshot.tier === "basic"
      ? "BASIC automated informational prescreen | Not independently certified or guaranteed safe"
      : `${snapshot.tier.toUpperCase()} automated informational analysis | Not manually QA-checked, independently certified or guaranteed safe`,
    issuer: "Issued by Velmère Security",
    generator: "Generated automatically by Velmère Security Engine",
    documentId: snapshot.requestId,
    generatedAt: snapshot.generatedAt,
    locale: snapshot.locale,
    classification: "customer_private",
  };
}

export function buildProAuditPdfRenderPlan(snapshot: ProAuditPdfSnapshot): CustomerSafePdfRenderPlan {
  if (!hasRenderContractModel(snapshot.modelVersion) || !snapshot.renderContract) throw new Error("audit_pdf_render_plan_unavailable_for_content_bound_legacy_snapshot");
  const canonicalLines = snapshot.layout.sections.flatMap((section) => section.lines);
  return planCustomerSafePdf(canonicalLines, renderOptionsForSnapshot(snapshot));
}

function assertRenderContract(snapshot: ProAuditPdfSnapshot) {
  if (!hasRenderContractModel(snapshot.modelVersion)) return;
  const contract = snapshot.renderContract;
  if (!contract || contract.id !== PASS4808_PDF_RENDER_CONTRACT_ID) throw new Error("audit_pdf_render_contract_missing");
  const plan = buildProAuditPdfRenderPlan(snapshot);
  const canonicalLines = snapshot.layout.sections.flatMap((section) => section.lines);
  const pdf = new Uint8Array(buildCustomerSafeMinimalPdf(canonicalLines, renderOptionsForSnapshot(snapshot)));
  if (
    plan.planDigest !== contract.planDigest
    || plan.pages.length !== contract.pageCount
    || plan.renderedRowCount !== contract.renderedRowCount
    || plan.unsupportedGlyphReplacements !== contract.unsupportedGlyphReplacements
    || sha256BytesDigest(pdf) !== contract.pdfDigest
    || pdf.byteLength !== contract.pdfByteLength
  ) throw new Error("audit_pdf_render_contract_mismatch");
  if (plan.unsupportedGlyphReplacements !== 0) throw new Error("audit_pdf_unsupported_glyphs_present");
}

export async function buildProAuditPdfSnapshotArtifact(input: AuditPdfBuildInput): Promise<{ snapshot: ProAuditPdfSnapshot; pdfBytes: Uint8Array }> {
  const { requestId, target, chain, locale, tier, sourceCandidates = {} } = input;
  const auditExecutionRelease = input.executionReleaseBinding === undefined
    ? undefined
    : validateAuditExecutionReleaseSnapshotBinding(input.executionReleaseBinding, tier);
  const tierContract = getAuditTierContract(tier);
  const reviewLevel = tierContract.reviewLevel;
  const copy = localizedCopy(locale, tier);
  const generatedAt = new Date().toISOString();
  const isContract = /^0x[a-fA-F0-9]{40}$/.test(target);
  const inferredSources: AuditSourceCandidates = {
    ...sourceCandidates,
    ...(target.startsWith("https://github.com/") && !sourceCandidates.githubUrl ? { githubUrl: target } : {}),
    ...(target.startsWith("https://") && !target.startsWith("https://github.com/") && !sourceCandidates.website ? { website: target } : {}),
  };
  const baseInput = {
    locale, chain,
    contractAddress: isContract ? target : undefined,
    projectName: isContract ? undefined : target,
    auditUrl: inferredSources.auditUrl,
    docsUrl: inferredSources.docsUrl,
    githubUrl: inferredSources.githubUrl,
    website: inferredSources.website,
  };

  const sourceSpine = buildPass2569AuditSourceSpine(locale);
  const sourceRows = buildPass2569AuditSourceMatrix(locale).slice(0, 12);
  const sourceQuorum = buildPass2570AuditSourceQuorumReport({ ...baseInput, reviewLevel });
  const providerIntelligence = buildPass2571AuditProviderIntelligenceReport({ ...baseInput, reviewLevel, sourceQuorum });
  const [providerRuntime, publicSources] = await Promise.all([
    buildPass2572AuditProviderRuntimeReport({ ...baseInput, reviewLevel, providerIntelligence }),
    buildAuditPublicSourceReceiptReport({ ...inferredSources, contractAddress: isContract ? target : null, chain }),
  ]);
  const privateStaticEvidence = readPass2572AuditProviderPrivateStaticEvidence(providerRuntime);
  const verifiedSourceBundle = parseVerifiedSoliditySourceBundle(privateStaticEvidence?.sourceText);
  const sourceContextIntegrity = verifiedSourceBundle.valid
    ? detectP78Erc2771MulticallContext(verifiedSourceBundle.files)
    : null;
  const historicalDeploymentContext = buildP79HistoricalDeploymentContextAdjudication({
    chain,
    contractAddress: isContract ? target : undefined,
    sourceContextIntegrity,
  });
  const runtimeConfidence = buildPass2573AuditRuntimeConfidenceReport({ ...baseInput, reviewLevel, sourceQuorum, providerRuntime });
  const claimLedger = buildPass2574AuditClaimLedgerReport({
    ...baseInput,
    reviewLevel,
    sourceQuorum,
    providerRuntime,
    runtimeConfidence,
    sourceContextIntegrity,
    deploymentContextEvidence: historicalDeploymentContext,
  });
  const sourceFreshness = buildPass2575AuditSourceFreshnessReport({ ...baseInput, reviewLevel, providerRuntime, claimLedger });
  const permissionParser = buildPass2576AuditPermissionParserReport({ ...baseInput, reviewLevel, providerRuntime, claimLedger, sourceFreshness });
  const liquidityHolderRisk = buildPass2577AuditLiquidityHolderLockRiskReport({ ...baseInput, reviewLevel, providerRuntime, claimLedger, sourceFreshness, permissionParser });
  const reportAssembler = buildPass2578AuditReportAssemblerReport({ ...baseInput, reviewLevel, providerRuntime, runtimeConfidence, claimLedger, sourceFreshness, permissionParser, liquidityHolderRisk });
  const canonicalEvidencePacket = buildCanonicalEvidencePacket({ assetKey: target, tier, surface: "audit", locale, generatedAt, auditReport: reportAssembler });
  if (!verifyCanonicalEvidencePacketIntegrity(canonicalEvidencePacket)) throw new Error("audit_pdf_canonical_evidence_integrity_failed");

  const rightsRegistry = pass4828AuditPdfRightsDependencies.registry();
  const evidencePacket = buildAuditEvidenceReceiptPacket({
    providerRuntime,
    publicSources,
    permissionParser,
    liquidityHolderRisk,
    tier,
    rightsRegistry,
    evaluatedAt: generatedAt,
  });
  const evidenceDimensions = buildAuditProviderEvidenceDimensions(providerRuntime.lanes);
  const strictReceipts = evidenceDimensions.strictLanes.map((lane) => ({
      laneId: lane.id,
      provider: lane.provider,
      providerFamily: lane.providerFamily ?? null,
      upstreamRoot: lane.lineage.upstreamRoot,
      correlationGroup: lane.lineage.correlationGroup,
      requestedAddress: lane.identity?.requestedAddress?.toLowerCase() ?? null,
      resolvedAddress: lane.identity?.resolvedAddress?.toLowerCase() ?? null,
      requestedChainId: lane.identity?.requestedChainId ?? null,
      resolvedChainId: lane.identity?.resolvedChainId ?? null,
      bodyDigest: lane.receipt?.bodyDigest ?? null,
      observedAt: lane.receipt?.observedAt ?? null,
      evidence: lane.evidence,
    }));
  const independentProviderFamilies = Array.from(new Set(strictReceipts.map((receipt) => receipt.providerFamily).filter(Boolean))).sort() as string[];
  const independentUpstreamRoots = evidencePacket.upstreamTruth.independentUpstreamRoots;
  const sourceReceiptRoot = evidencePacket.roots.aggregateRoot;
  const allSubmittedSourcesBound = publicSources.summary.submitted === publicSources.summary.contentBound;
  const proMinimum = getAuditTierContract("pro").minimumEvidence;
  const advancedMinimum = getAuditTierContract("advanced").minimumEvidence;
  const evidenceRowCount = Math.max(0, Math.trunc(Number(reportAssembler.summary.totalEvidence) || 0));
  const basicPaidReadiness = evaluateAuditPaidEvidenceReadiness({
    lanes: providerRuntime.lanes,
    tier: "basic",
    tierContract: getAuditTierContract("basic"),
    evidenceRows: evidenceRowCount,
    authorityEvidence: null,
    rightsRegistry,
    evaluatedAt: generatedAt,
  });
  const proPaidReadiness = evaluateAuditPaidEvidenceReadiness({
    lanes: providerRuntime.lanes,
    tier: "pro",
    tierContract: getAuditTierContract("pro"),
    evidenceRows: evidenceRowCount,
    authorityEvidence: null,
    rightsRegistry,
    evaluatedAt: generatedAt,
  });
  const advancedPaidReadiness = evaluateAuditPaidEvidenceReadiness({
    lanes: providerRuntime.lanes,
    tier: "advanced",
    tierContract: getAuditTierContract("advanced"),
    evidenceRows: evidenceRowCount,
    authorityEvidence: null,
    rightsRegistry,
    evaluatedAt: generatedAt,
  });
  const customerEligibility = buildCustomerSafeAuditProviderRightsSummary(
    tier === "advanced"
      ? advancedPaidReadiness.rightsCurrentness
      : tier === "pro"
        ? proPaidReadiness.rightsCurrentness
        : basicPaidReadiness.rightsCurrentness,
  );
  const readinessReasons = Array.from(new Set([
    !evidencePacket.upstreamTruth.strictQuorumMet ? "two_independent_content_bound_upstreams_required" : null,
    evidencePacket.counts.sourceAbiReceipts < 1 ? "source_or_abi_receipt_required" : null,
    !allSubmittedSourcesBound ? "all_submitted_public_sources_must_be_content_bound" : null,
    evidenceDimensions.strictReceiptCount < proMinimum.verifiedProviderReceipts
      ? `pro_verified_provider_receipts:${evidenceDimensions.strictReceiptCount}/${proMinimum.verifiedProviderReceipts}`
      : null,
    evidenceDimensions.successfulLiveLaneCount < proMinimum.liveLanes
      ? `pro_successful_live_provider_lanes:${evidenceDimensions.successfulLiveLaneCount}/${proMinimum.liveLanes}`
      : null,
    evidenceRowCount < proMinimum.evidenceRows
      ? `pro_evidence_rows:${evidenceRowCount}/${proMinimum.evidenceRows}`
      : null,
    evidenceDimensions.strictReceiptCount < advancedMinimum.verifiedProviderReceipts
      ? `advanced_verified_provider_receipts:${evidenceDimensions.strictReceiptCount}/${advancedMinimum.verifiedProviderReceipts}`
      : null,
    evidenceDimensions.successfulLiveLaneCount < advancedMinimum.liveLanes
      ? `advanced_successful_live_provider_lanes:${evidenceDimensions.successfulLiveLaneCount}/${advancedMinimum.liveLanes}`
      : null,
    evidenceRowCount < advancedMinimum.evidenceRows
      ? `advanced_evidence_rows:${evidenceRowCount}/${advancedMinimum.evidenceRows}`
      : null,
    ...evidencePacket.missing,
    ...customerEligibility.limitationCodes.map((code) => `provider_eligibility:${code}`),
  ].filter((item): item is string => Boolean(item)))).sort();
  const permissionEvidenceReady = permissionParser.signals.some((signal) => signal.state === "detected" || signal.state === "not_detected" || signal.state === "not_applicable");
  const holderLiquidityEvidenceReady = liquidityHolderRisk.signals.some((signal) => signal.state === "confirmed" || signal.state === "partial");
  if (!permissionEvidenceReady) readinessReasons.push("permission_evidence_not_resolved");
  if (!holderLiquidityEvidenceReady) readinessReasons.push("holder_liquidity_evidence_not_resolved");
  readinessReasons.sort();
  const proReady = proPaidReadiness.met
    && evidencePacket.upstreamTruth.strictQuorumMet
    && independentUpstreamRoots.length >= PAID_AUDIT_MINIMUM_INDEPENDENT_UPSTREAMS.pro
    && evidencePacket.counts.sourceAbiReceipts >= 1;
  const advancedReady = proReady
    && advancedPaidReadiness.met
    && independentUpstreamRoots.length >= PAID_AUDIT_MINIMUM_INDEPENDENT_UPSTREAMS.advanced
    && allSubmittedSourcesBound
    && permissionEvidenceReady
    && holderLiquidityEvidenceReady;


  let advancedCustomerLines: string[] = [];
  let advancedStatusLines: string[] = [];
  let contractSourceRows: Array<{ label: string; output: string }> = [];
  let holderDepthRows: Array<{ label: string; output: string }> = [];
  if (tier === "advanced") {
    const advancedManualReviewQueue = buildPass2579AdvancedManualReviewQueueReport({ ...baseInput, reviewLevel, reportAssembler });
    const customerSafeDeliveryDecision = buildPass2580CustomerSafeDeliveryDecisionReport({ ...baseInput, reviewLevel, reportAssembler, advancedManualReviewQueue });
    const versionedRecheckReceipt = buildPass2581AuditVersionedRecheckReceiptReport({ ...baseInput, reviewLevel, reportAssembler, customerSafeDeliveryDecision });
    const realProviderAdapterHardening = buildPass2582RealProviderAdapterHardeningReport({ ...baseInput, reviewLevel, providerIntelligence, providerRuntime, versionedRecheckReceipt });
    const contractSourceAbiExtraction = buildPass2583ContractSourceAbiExtractionReport({ ...baseInput, reviewLevel, providerRuntime, permissionParser, realProviderAdapterHardening });
    const holderLiquidityDepthEvidence = buildPass2584HolderLiquidityDepthEvidenceReport({ ...baseInput, reviewLevel, providerRuntime, liquidityHolderRisk, realProviderAdapterHardening, contractSourceAbiExtraction });
    const premiumTemplate = buildPass2585PremiumProPdfTemplateContractReport({
      ...baseInput, reviewLevel, reportAssembler, customerSafeDeliveryDecision, versionedRecheckReceipt,
      realProviderAdapterHardening, contractSourceAbiExtraction, holderLiquidityDepthEvidence,
    });
    advancedCustomerLines = premiumTemplate.customerPdfLines;
    advancedStatusLines = [
      `Delivery status at analysis snapshot: ${customerSafeDeliveryDecision.summary.deliveryStatus.replaceAll("_", " ")}`,
      `Delivery readiness at analysis snapshot: ${customerSafeDeliveryDecision.summary.deliveryReadiness}/100`,
      `Automated advanced scenario items: ${advancedManualReviewQueue.summary.totalItems}`,
      `Evidence items ready for advanced automated processing: ${advancedManualReviewQueue.summary.readyForAutomation}`,
      "Manually QA-checked assurance is not included in this automated report; document integrity binds the issuer, snapshot and PDF digest only.",
    ];
    contractSourceRows = contractSourceAbiExtraction.publicRows.slice(0, 12);
    holderDepthRows = holderLiquidityDepthEvidence.publicRows.slice(0, 12);
  }

  const lines = [
    copy.title,
    `Tier: ${tier.toUpperCase()} | Availability: ${tierContract.price?.label ?? (tier === "pro" ? "Invitation only" : tier === "advanced" ? "Not for sale" : "Free")}`,
    `Request ID: ${requestId}`,
    `Generated: ${generatedAt}`,
    `Target: ${target}`,
    `Network: ${chain}`,
    `Report model reference: ${sha256Digest(MODEL_VERSION)}`,
    `Canonical evidence packet: ${canonicalEvidencePacket.packetId}`,
    `Canonical evidence SHA-256: sha256:${canonicalEvidencePacket.integrity.digest}`,
    `Evidence packet root: ${sourceReceiptRoot}`,
    `Provider response root: ${evidencePacket.roots.providerResponseRoot}`,
    `Public source root: ${evidencePacket.roots.publicSourceRoot}`,
    `Source and ABI root: ${evidencePacket.roots.sourceAbiRoot}`,
    `Permission root: ${evidencePacket.roots.permissionRoot}`,
    `Holder and liquidity root: ${evidencePacket.roots.holderLiquidityRoot}`,
    `Live execution root: ${evidencePacket.roots.liveExecutionRoot}`,
    `Provider rights/currentness root: ${evidencePacket.roots.providerRightsCurrentnessRoot}`,
    `Provider evidence dimension reference: ${sha256Digest(PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID)}`,
    `Provider customer eligibility: ${customerEligibility.commercialUseReady ? "ready" : "withheld"}`,
    `Eligible provider evidence: strict ${customerEligibility.rightsCurrentStrictReceipts}; live ${customerEligibility.rightsCurrentLiveExecutions}; fields ${customerEligibility.rightsCurrentFields}`,
    `Eligible provider independence: families ${customerEligibility.rightsCurrentProviderFamilies}; upstream roots ${customerEligibility.rightsCurrentUpstreamRoots}`,
    `Provider eligibility reference: ${customerEligibility.summaryDigest}`,
    ...(auditExecutionRelease ? [
      `Audit execution packet: ${auditExecutionRelease.packetDigest}`,
      `Current deployment receipt: ${auditExecutionRelease.currentDeploymentReceiptDigest}`,
      `Matched-input tier value: ${auditExecutionRelease.matchedInputDigest}`,
      `Execution release binding: ${auditExecutionRelease.releaseBindingDigest}`,
    ] : []),
    ...(customerEligibility.limitationCodes.length ? [`Provider limitations: ${customerEligibility.limitationCodes.join(", ")}`] : []),
    `Identity-bound confirmed provider responses: ${strictReceipts.length}`,
    `Successful live direct-provider executions: ${evidenceDimensions.successfulLiveLaneCount}`,
    `Independent upstream roots: ${independentUpstreamRoots.length ? independentUpstreamRoots.join(", ") : "none"}`,
    `Strict two-upstream quorum: ${independentUpstreamRoots.length >= 2 ? "met" : "not met"}`,
    `Submitted public sources: ${publicSources.summary.submitted}; content-bound: ${publicSources.summary.contentBound}; exact identity-bound: ${publicSources.summary.exactIdentityBound}`,
    tier === "basic"
      ? "Basic evidence boundary: informational prescreen; missing or unavailable evidence remains explicit."
      : `Paid evidence readiness: ${tier === "advanced" ? (advancedReady ? "ready for automated advanced delivery checks" : "blocked pending evidence") : (proReady ? "ready" : "blocked pending evidence")}`,
    `Decision domain: ${canonicalEvidencePacket.decision.primaryDomain ?? "unavailable"}`,
    `Cross-domain aggregation: ${canonicalEvidencePacket.decision.crossDomainAggregation}`,
    "",
    copy.scope, copy.passive, copy.custody, copy.disclaimer,
    "",
    `Included in ${tier.toUpperCase()}:`, ...tierContract.includes.map((line) => `- ${line}`),
    `Not included in ${tier.toUpperCase()}:`, ...tierContract.excludes.map((line) => `- ${line}`),
    "", copy.sources, sourceSpine.sourceQuorumRule, sourceQuorum.quorumRule, providerIntelligence.rule, providerRuntime.rule, runtimeConfidence.rule, runtimeConfidence.customerVerdict,
    ...publicSources.customerRows.flatMap((row, index) => [`Public source ${index + 1}: ${row.label} - ${row.status}`, `   ${row.output}`]),
    `Evidence coverage: ${runtimeConfidence.overall.sourceCoverageScore}/100`,
    `Risk: ${runtimeConfidence.overall.riskScore === null ? "Unavailable - no verified adverse finding" : `${runtimeConfidence.overall.riskLabel} ${runtimeConfidence.overall.riskScore}/100`}`,
    "Risk-score interpretation: evidence-ranking score, not an event probability.",
    "Uncertainty interpretation: deterministic evidence-sensitivity band, not an empirical confidence interval.",
    "Empirical calibration: unavailable unless a signed chronological holdout profile is attached and valid at delivery time.",
    `Review priority: ${runtimeConfidence.overall.reviewPriorityScore}/100`,
    `Source confidence: ${runtimeConfidence.overall.sourceConfidence}/100`,
    ...sourceRows.flatMap((row, index) => [`${index + 1}. ${row.label}`, `   Basic: ${row.basic}`, `   Pro: ${row.pro}`, `   Missing-data rule: ${row.rule}`]),
    "", copy.claims,
    `Claims: confirmed ${claimLedger.summary.confirmed}, partial ${claimLedger.summary.partial}, missing ${claimLedger.summary.missing}, blocked ${claimLedger.summary.blocked}`,
    `Freshness: fresh ${sourceFreshness.summary.fresh}, acceptable ${sourceFreshness.summary.acceptable}, stale ${sourceFreshness.summary.stale}, expired ${sourceFreshness.summary.expired}`,
    ...sourceFreshness.proPdfRows.slice(0, 16).flatMap((row, index) => [`${index + 1}. ${row.label} - ${row.status}`, `   ${row.output}`]),
    "", "Top findings:",
    ...reportAssembler.topFindings.slice(0, 7).flatMap((finding, index) => [
      `${index + 1}. ${finding.title} - ${finding.severity}`,
      `   ${finding.proLine}`,
    ]),
    "", copy.permissions,
    ...permissionParser.proPdfRows.slice(0, 18).flatMap((row, index) => [`${index + 1}. ${row.label} - ${row.status} - ${row.severity}`, `   ${row.output}`]),
    "", copy.liquidity,
    ...liquidityHolderRisk.proPdfRows.slice(0, 18).flatMap((row, index) => [`${index + 1}. ${row.label} - ${row.status} - ${row.severity}`, `   ${row.output}`]),
    ...holderDepthRows.map((row) => `${row.label}: ${row.output}`),
    "", copy.contract, ...contractSourceRows.map((row) => `${row.label}: ${row.output}`),
    "", copy.final,
    `Verdict: ${reportAssembler.finalVerdict.riskScore === null ? reportAssembler.finalVerdict.riskLabel : `${reportAssembler.finalVerdict.riskLabel} ${reportAssembler.finalVerdict.riskScore}/100`}`,
    `Review priority: ${reportAssembler.finalVerdict.reviewPriorityScore}/100`,
    `Confidence: ${reportAssembler.finalVerdict.sourceConfidence}/100`,
    `Readiness: ${reportAssembler.finalVerdict.readinessScore}/100`,
    "Report sections:",
    ...reportAssembler.proPdfSections.flatMap((section, index) => [
      `${index + 1}. ${section.title}`,
      `   State: ${section.state.replaceAll("_", " ")} | Evidence: ${section.evidenceCount} | Missing: ${section.missingCount}`,
      `   ${section.customerSummary}`,
    ]),
    ...(tier === "advanced" ? ["", copy.advanced, ...advancedCustomerLines, ...advancedStatusLines] : []),
    "",
    "Missing evidence remains explicitly missing; unavailable data is never treated as confirmed.",
  ].map((line) => maskAuditPdfLine(String(line))).filter(isCustomerRuntimeLine).slice(0, MAX_CUSTOMER_PDF_LINES);

  if (lines.length < 30) throw new Error("audit_pdf_customer_content_too_small");
  const layout = buildCanonicalLayout(lines);
  const renderOptions = renderOptionsForSnapshot({ locale, tier, requestId, generatedAt });
  const canonicalLines = layout.sections.flatMap((section) => section.lines);
  const renderPlan = planCustomerSafePdf(canonicalLines, renderOptions);
  if (renderPlan.unsupportedGlyphReplacements !== 0) throw new Error("audit_pdf_unsupported_glyphs_present");
  const renderedPdf = new Uint8Array(buildCustomerSafeMinimalPdf(canonicalLines, renderOptions));
  const snapshotWithoutDigest: Omit<ProAuditPdfSnapshot, "digest"> = {
    schemaVersion: SNAPSHOT_SCHEMA,
    requestId,
    target,
    chain,
    locale,
    tier,
    generatedAt,
    modelVersion: MODEL_VERSION,
    calibrationProfileId: null,
    renderContract: {
      id: PASS4808_PDF_RENDER_CONTRACT_ID,
      planDigest: renderPlan.planDigest,
      pageCount: renderPlan.pages.length,
      renderedRowCount: renderPlan.renderedRowCount,
      unsupportedGlyphReplacements: renderPlan.unsupportedGlyphReplacements,
      pdfDigest: sha256BytesDigest(renderedPdf),
      pdfByteLength: renderedPdf.byteLength,
    },
    canonicalEvidencePacketId: canonicalEvidencePacket.packetId,
    canonicalEvidenceDigest: `sha256:${canonicalEvidencePacket.integrity.digest}`,
    sourceReceiptRoot,
    ...(auditExecutionRelease ? { auditExecutionRelease } : {}),
    providerTruth: {
      confirmedIdentityBoundProviders: strictReceipts.length,
      independentProviderFamilies,
      independentUpstreamRoots,
      strictQuorumMet: independentUpstreamRoots.length >= 2,
      evidenceDimensionVersion: PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID,
      successfulLiveProviderLanes: evidenceDimensions.successfulLiveLaneCount,
      successfulLiveProviderIds: evidenceDimensions.successfulLiveProviderIds,
      duplicateStrictLanesRejected: evidenceDimensions.duplicateStrictLanesRejected,
      duplicateLiveLanesRejected: evidenceDimensions.duplicateLiveLanesRejected,
    },
    customerEligibility,
    publicSourceTruth: {
      submitted: publicSources.summary.submitted,
      contentBound: publicSources.summary.contentBound,
      exactIdentityBound: publicSources.summary.exactIdentityBound,
      allSubmittedSourcesBound,
    },
    evidenceRoots: evidencePacket.roots,
    evidenceReadiness: {
      proReady,
      advancedReady,
      reasons: readinessReasons.slice(0, 32),
      evidenceRows: evidenceRowCount,
    },
    verdict: {
      riskScore: reportAssembler.finalVerdict.riskScore,
      riskLabel: reportAssembler.finalVerdict.riskLabel,
      confidenceScore: reportAssembler.finalVerdict.sourceConfidence,
      reviewPriorityScore: reportAssembler.finalVerdict.reviewPriorityScore,
      readinessScore: reportAssembler.finalVerdict.readinessScore,
    },
    layout,
    lines,
  };
  const snapshot = { ...snapshotWithoutDigest, digest: sha256Digest(canonicalJson(snapshotWithoutDigest)) };
  // Building the immutable evidence snapshot may produce an honest blocked
  // status. Validation and persistence remain paid export boundaries. The
  // exact bytes returned here are the first and only customer-artifact render;
  // completion stores these bytes instead of rendering again on download.
  return { snapshot, pdfBytes: new Uint8Array(renderedPdf) };
}

export async function buildProAuditPdfSnapshot(input: AuditPdfBuildInput): Promise<ProAuditPdfSnapshot> {
  const artifact = await buildProAuditPdfSnapshotArtifact(input);
  return artifact.snapshot;
}

export function renderProAuditPdfSnapshot(value: ProAuditPdfSnapshot): Uint8Array {
  const snapshot = validateProAuditPdfSnapshot(value);
  const canonicalLines = snapshot.layout.sections.flatMap((section) => section.lines);
  const options = renderOptionsForSnapshot(snapshot);
  if (snapshot.modelVersion === CONTENT_BOUND_LEGACY_MODEL_VERSION) {
    return new Uint8Array(buildCustomerSafeMinimalPdfLegacyV1(canonicalLines, options));
  }
  assertRenderContract(snapshot);
  return new Uint8Array(buildCustomerSafeMinimalPdf(canonicalLines, options));
}

export async function renderProAuditPdfWorkerPayload(value: ProAuditPdfWorkerPayload): Promise<Uint8Array> {
  const payload = validateProAuditPdfWorkerPayload(value);
  if (payload.schemaVersion === "velmere.audit-pdf-snapshot-render.v1") return renderProAuditPdfSnapshot(payload.snapshot);
  const legacy = validateProAuditPdfRenderInput(payload);
  const snapshot = await buildProAuditPdfSnapshot({ requestId: legacy.requestId, target: legacy.target, chain: legacy.chain, locale: legacy.locale, tier: legacy.tier });
  return renderProAuditPdfSnapshot(snapshot);
}

export async function renderProAuditPdf(input: ProAuditPdfRenderInput): Promise<Uint8Array> {
  return renderProAuditPdfWorkerPayload(input);
}
