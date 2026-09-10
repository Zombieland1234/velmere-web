import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "./ascii-control-characters";

import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import {
  buildCustomerSafeAuditLayoutModel,
  renderCustomerSafeAuditPdf,
  PASS4820_CUSTOMER_SAFE_AUDIT_PDF_ID,
  type CustomerSafeAuditLayoutInput,
  type CustomerSafeAuditLayoutModel,
} from "@/lib/security/customer-safe-audit-layout";
import type { buildPass4820AuditCustomerReportPipeline } from "@/lib/security/audit-customer-report-pipeline";
import type { AuditTierId } from "@/lib/security/audit-tier-contract";
import {
  assertPass4824PayloadFieldPacket,
  type Pass4824CanonicalFieldPacket,
} from "@/lib/reporting/canonical-field-registry";
import {
  buildCanonicalCustomerArtifact,
  verifyCanonicalCustomerArtifact,
  type CanonicalCustomerArtifact,
} from "@/lib/reporting/canonical-customer-artifact";
import {
  isPass4824ExactPdfAccountCustomerArtifactSnapshot,
  verifyPass4822AccountCustomerArtifactOwner,
  verifyPass4822AccountCustomerArtifactSnapshot,
  type AccountCustomerArtifactSnapshot,
} from "@/lib/reporting/account-customer-artifact-snapshot";
import {
  assertPass4824PdfBlobMatchesSnapshot,
  type AccountCustomerArtifactPdfBlob,
} from "@/lib/reporting/account-customer-artifact-pdf-blob";

export const PASS4821_AUDIT_ACCOUNT_CUSTOMER_SNAPSHOT_ID = "pass4821-audit-account-customer-snapshot-v1" as const;
export const P80_AUDIT_EXACT_ACCOUNT_ARTIFACT_BINDING_ID = "p80-audit-exact-account-artifact-binding-v1" as const;

export type AuditExactAccountArtifactBinding = {
  schemaVersion: typeof P80_AUDIT_EXACT_ACCOUNT_ARTIFACT_BINDING_ID;
  storage: "exact_immutable_blob";
  snapshotId: string;
  snapshotDigest: string;
  artifactDigest: string;
  pdfBlobId: string;
  pdfBlobRecordDigest: string;
  pdfDigest: string;
  pdfByteLength: number;
};

export type AuditCustomerPipelineResult = ReturnType<typeof buildPass4820AuditCustomerReportPipeline>;

export type AuditAccountCustomerSnapshot = {
  schemaVersion: typeof PASS4821_AUDIT_ACCOUNT_CUSTOMER_SNAPSHOT_ID;
  snapshotId: string;
  reportId: string;
  requestId: string;
  accountIdHash: string;
  requestedTier: AuditTierId;
  deliveredTier: AuditTierId;
  locale: "pl" | "en" | "de";
  projectName: string;
  targetLabel: string;
  riskScore: number | null;
  confidenceScore: number | null;
  releaseState: AuditCustomerPipelineResult["releaseState"];
  pipelineDigest: string;
  projectionDigest: string;
  sourceLayoutDigest: string;
  customerReportDigest: string;
  canonicalFieldPacket: Pass4824CanonicalFieldPacket | null;
  generatedAt: string;
  layoutInput: CustomerSafeAuditLayoutInput;
  canonicalLayout: CustomerSafeAuditLayoutModel;
  canonicalArtifact: CanonicalCustomerArtifact;
  pdfArtifact: {
    schemaVersion: string;
    pdfDigest: string;
    pdfByteLength: number;
    renderPlanDigest: string;
    pageCount: number;
    renderedRowCount: number;
    unsupportedGlyphReplacements: number;
  };
  /**
   * Present only after the exact account-owned PDF bundle has been persisted and
   * read back through the immutable artifact store. Legacy snapshots remain
   * verifiable, but they cannot pass the final delivery gate.
   */
  exactAccountArtifact?: AuditExactAccountArtifactBinding;
  snapshotDigest: string;
};

const AUDIT_SNAPSHOT_BASE_KEYS = Object.freeze([
  "accountIdHash", "canonicalArtifact", "canonicalLayout", "confidenceScore", "customerReportDigest",
  "deliveredTier", "generatedAt", "layoutInput", "locale", "pdfArtifact", "pipelineDigest",
  "projectName", "projectionDigest", "releaseState", "reportId", "requestId", "requestedTier", "riskScore",
  "schemaVersion", "snapshotDigest", "snapshotId", "sourceLayoutDigest", "targetLabel",
] as const);

function expectedAuditSnapshotKeys(snapshot: Partial<AuditAccountCustomerSnapshot>) {
  return [
    ...AUDIT_SNAPSHOT_BASE_KEYS,
    ...(Object.prototype.hasOwnProperty.call(snapshot, "canonicalFieldPacket") ? ["canonicalFieldPacket"] : []),
    ...(Object.prototype.hasOwnProperty.call(snapshot, "exactAccountArtifact") ? ["exactAccountArtifact"] : []),
  ].sort();
}

function clean(value: unknown, max = 1_200) {
  return typeof value === "string"
    ? value.replace(ASCII_CONTROL_OR_MARKUP_PATTERN, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function normalizeLocale(value: unknown): "pl" | "en" | "de" {
  return value === "pl" || value === "de" || value === "en" ? value : "en";
}

function digestWithoutPrefix(value: string) {
  return value.replace(/^sha256:/, "");
}

function validDigest(value: unknown) {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/i.test(value);
}

function tierRank(value: AuditTierId) {
  return value === "advanced" ? 3 : value === "pro" ? 2 : 1;
}

function copy(locale: "pl" | "en" | "de") {
  if (locale === "pl") return {
    titleSuffix: "raport audytu",
    summary: (tier: string, risk: number | null, confidence: number | null) => `Dostarczony poziom: ${tier}. Wynik ryzyka: ${risk ?? "brak danych"}/100. Pewność: ${confidence ?? "brak danych"}/100. Raport pokazuje wyłącznie evidence-bound ustalenia i jawne braki dowodowe.`,
    boundary: "Customer-safe snapshot: bez instrukcji exploita, prywatnych notatek operatora, danych płatniczych, seed phrase, gwarancji bezpieczeństwa i porad inwestycyjnych.",
  };
  if (locale === "de") return {
    titleSuffix: "Auditbericht",
    summary: (tier: string, risk: number | null, confidence: number | null) => `Gelieferte Stufe: ${tier}. Risikowert: ${risk ?? "keine Daten"}/100. Konfidenz: ${confidence ?? "keine Daten"}/100. Der Bericht zeigt nur evidence-bound Feststellungen und sichtbare Evidenzlücken.`,
    boundary: "Customer-safe Snapshot: keine Exploit-Anleitungen, privaten Operator-Notizen, Zahlungsdaten, Seed Phrases, Sicherheitsgarantien oder Anlageberatung.",
  };
  return {
    titleSuffix: "audit report",
    summary: (tier: string, risk: number | null, confidence: number | null) => `Delivered tier: ${tier}. Risk score: ${risk ?? "unavailable"}/100. Confidence: ${confidence ?? "unavailable"}/100. The report exposes only evidence-bound findings and explicit evidence gaps.`,
    boundary: "Customer-safe snapshot: no exploit instructions, private operator notes, payment data, seed phrases, safety guarantees or investment advice.",
  };
}

function safeNumber(value: unknown): number | null {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function unique(values: string[], maxItems: number, maxLength = 900) {
  return Array.from(new Set(values.map((value) => clean(value, maxLength)).filter(Boolean))).slice(0, maxItems);
}

function auditSnapshotUnsigned(
  snapshot: Omit<AuditAccountCustomerSnapshot, "snapshotDigest">,
  options?: { includeCanonicalFieldPacket?: boolean; includeExactAccountArtifact?: boolean },
) {
  const unsignedBase = {
    schemaVersion: snapshot.schemaVersion,
    snapshotId: snapshot.snapshotId,
    reportId: snapshot.reportId,
    requestId: snapshot.requestId,
    accountIdHash: snapshot.accountIdHash,
    requestedTier: snapshot.requestedTier,
    deliveredTier: snapshot.deliveredTier,
    locale: snapshot.locale,
    projectName: snapshot.projectName,
    targetLabel: snapshot.targetLabel,
    riskScore: snapshot.riskScore,
    confidenceScore: snapshot.confidenceScore,
    releaseState: snapshot.releaseState,
    pipelineDigest: snapshot.pipelineDigest,
    projectionDigest: snapshot.projectionDigest,
    sourceLayoutDigest: snapshot.sourceLayoutDigest,
    customerReportDigest: snapshot.customerReportDigest,
    generatedAt: snapshot.generatedAt,
    layoutInput: snapshot.layoutInput,
    canonicalLayout: snapshot.canonicalLayout,
    canonicalArtifact: snapshot.canonicalArtifact,
    pdfArtifact: snapshot.pdfArtifact,
  } as const;
  const withFieldPacket = options?.includeCanonicalFieldPacket
    ? { ...unsignedBase, canonicalFieldPacket: snapshot.canonicalFieldPacket ?? null }
    : unsignedBase;
  return options?.includeExactAccountArtifact
    ? { ...withFieldPacket, exactAccountArtifact: snapshot.exactAccountArtifact }
    : withFieldPacket;
}

function validExactAccountArtifactBinding(
  value: unknown,
  snapshot: Partial<AuditAccountCustomerSnapshot>,
): value is AuditExactAccountArtifactBinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const binding = value as Partial<AuditExactAccountArtifactBinding>;
  const keys = Object.keys(binding).sort();
  const expected = [
    "artifactDigest", "pdfBlobId", "pdfBlobRecordDigest", "pdfByteLength", "pdfDigest",
    "schemaVersion", "snapshotDigest", "snapshotId", "storage",
  ].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) return false;
  if (binding.schemaVersion !== P80_AUDIT_EXACT_ACCOUNT_ARTIFACT_BINDING_ID || binding.storage !== "exact_immutable_blob") return false;
  if (typeof binding.snapshotId !== "string" || !/^artifact-audit-[a-f0-9]{16}-[a-f0-9]{64}$/i.test(binding.snapshotId)) return false;
  if (typeof binding.pdfBlobId !== "string" || !/^pdf-[a-f0-9]{16}-[a-f0-9]{64}$/i.test(binding.pdfBlobId)) return false;
  if (![binding.snapshotDigest, binding.artifactDigest, binding.pdfBlobRecordDigest, binding.pdfDigest].every(validDigest)) return false;
  if (!Number.isSafeInteger(binding.pdfByteLength) || Number(binding.pdfByteLength) <= 0) return false;
  if (!snapshot.accountIdHash || !snapshot.canonicalArtifact) return false;
  const artifactHex = String(binding.artifactDigest).replace(/^sha256:/, "");
  if (binding.snapshotId !== `artifact-audit-${snapshot.accountIdHash.slice(0, 16)}-${artifactHex}`) return false;
  if (binding.pdfBlobId !== `pdf-${snapshot.accountIdHash.slice(0, 16)}-${artifactHex}`) return false;
  return binding.artifactDigest === snapshot.canonicalArtifact.artifactDigest
    && binding.pdfDigest === snapshot.canonicalArtifact.pdfDigest
    && binding.pdfByteLength === snapshot.canonicalArtifact.pdfByteLength;
}

export function buildAuditAccountCustomerSnapshot(args: {
  pipeline: AuditCustomerPipelineResult;
  accountIdHash: string;
  requestId: string;
  projectName?: string | null;
  targetLabel?: string | null;
}): AuditAccountCustomerSnapshot {
  const pipeline = args.pipeline;
  const visibleTier = pipeline.customerReport.deliveryPolicy.visibleTier?.toLowerCase() ?? null;
  if (!visibleTier) throw new Error("audit_customer_snapshot_delivery_unavailable");
  if (visibleTier !== pipeline.deliveredTier) throw new Error("audit_customer_snapshot_delivery_tier_mismatch");
  const fieldInspection = assertPass4824PayloadFieldPacket(pipeline.customerReport, { module: "audit", tier: pipeline.deliveredTier });
  const canonicalFieldPacket = fieldInspection.state === "verified"
    ? (pipeline.customerReport as typeof pipeline.customerReport & { pass4824CanonicalFieldPacket: Pass4824CanonicalFieldPacket }).pass4824CanonicalFieldPacket
    : null;
  const normalizedAccountIdHash = clean(args.accountIdHash, 80).toLowerCase();
  if (!/^[a-f0-9]{64}$/i.test(normalizedAccountIdHash)) throw new Error("audit_customer_snapshot_account_hash_invalid");
  const report = pipeline.customerReport;
  const locale = normalizeLocale(report.locale);
  const labels = copy(locale);
  const projectName = clean(args.projectName, 180) || clean(report.target.name, 180) || "Velmère Audit";
  const targetLabel = clean(args.targetLabel, 180) || clean(report.target.symbol, 180) || projectName;
  const riskScore = safeNumber(report.summary.riskScore);
  const confidenceScore = safeNumber(report.summary.confidenceScore);
  const decisionSections = report.decisionSections;
  const projectedFindings = pipeline.projection.report.topFindings.slice(0, 8);
  const findingLines = projectedFindings.map((finding) => {
    const detail = pipeline.deliveredTier === "basic" ? finding.publicLine : finding.proLine;
    return `Finding [${finding.severity.toUpperCase()}] ${finding.title}: ${detail} | source=${finding.sourceFamily}`;
  });
  const findingActions = pipeline.deliveredTier === "basic"
    ? []
    : projectedFindings.map((finding) => `Finding action - ${finding.title}: ${finding.advancedAction}`);
  const sourceTruthLines = [
    `Source-bound provider receipts: ${pipeline.sourceTruth.providerReceiptCount}`,
    `Content-bound current receipts: ${pipeline.sourceTruth.contentBoundProviderReceiptCount}`,
    `Independent upstream roots: ${pipeline.sourceTruth.strictUpstreamRoots.length ? pipeline.sourceTruth.strictUpstreamRoots.join(", ") : "none"}`,
  ];
  const sections = unique([
    ...decisionSections.map((section) => `${section.title}: ${section.summary}`),
    ...findingLines,
    ...sourceTruthLines,
  ], 28);
  const nextSteps = unique([...decisionSections.flatMap((section) => section.actions), ...findingActions], 24);
  const missingEvidence = unique(report.missingEvidence.map((item) => `Missing evidence: ${item}`), 12);
  const forbidden = [
    "Certified Safe",
    "No Risk",
    "Guaranteed secure",
    "Exploit instructions",
    "Seed phrase request",
    "Investment advice",
    "Raw payment or webhook details",
    "Private reviewer identity or notes",
  ];
  const reportId = clean(report.reportId, 160);
  const requestId = clean(args.requestId, 160);
  if (!reportId || !requestId) throw new Error("audit_customer_snapshot_identity_required");
  if (tierRank(pipeline.deliveredTier) > tierRank(pipeline.requestedTier)) throw new Error("audit_customer_snapshot_tier_escalation_forbidden");
  const generatedAtInput = clean(report.generatedAt, 80) || new Date().toISOString();
  let generatedAt: string;
  try {
    generatedAt = new Date(generatedAtInput).toISOString();
  } catch {
    throw new Error("audit_customer_snapshot_generated_at_invalid");
  }
  const layoutInput: CustomerSafeAuditLayoutInput = {
    reportId,
    requestId,
    locale,
    title: `${projectName} · ${labels.titleSuffix}`,
    summary: labels.summary(pipeline.deliveredTier, riskScore, confidenceScore),
    status: "analysis_complete",
    projectName,
    reviewLevel: `${pipeline.requestedTier}_requested/${pipeline.deliveredTier}_delivered`,
    sections: unique([...sections, ...missingEvidence], 32),
    nextSteps,
    forbidden,
    customerBoundary: labels.boundary,
    refreshedAt: generatedAt,
  };
  const canonicalLayout = buildCustomerSafeAuditLayoutModel(layoutInput);
  const renderedPdf = renderCustomerSafeAuditPdf(layoutInput);
  if (renderedPdf.layoutDigest !== canonicalLayout.layoutDigest) throw new Error("audit_customer_snapshot_layout_pdf_digest_mismatch");
  const pdfArtifact = {
    schemaVersion: renderedPdf.schemaVersion,
    pdfDigest: renderedPdf.pdfDigest,
    pdfByteLength: renderedPdf.pdfByteLength,
    renderPlanDigest: renderedPdf.renderPlanDigest,
    pageCount: renderedPdf.pageCount,
    renderedRowCount: renderedPdf.renderedRowCount,
    unsupportedGlyphReplacements: renderedPdf.unsupportedGlyphReplacements,
  };
  const customerReportDigest = sha256Digest(canonicalJson(report));
  const canonicalArtifact = buildCanonicalCustomerArtifact({
    surface: "audit",
    rendererId: renderedPdf.schemaVersion,
    reportId,
    requestedTier: pipeline.requestedTier,
    deliveredTier: pipeline.deliveredTier,
    payloadDigest: customerReportDigest,
    layoutDigest: canonicalLayout.layoutDigest,
    renderPlanDigest: renderedPdf.renderPlanDigest,
    pdfDigest: renderedPdf.pdfDigest,
    pdfByteLength: renderedPdf.pdfByteLength,
    pageCount: renderedPdf.pageCount,
    renderedRowCount: renderedPdf.renderedRowCount,
  });
  const unsigned = {
    schemaVersion: PASS4821_AUDIT_ACCOUNT_CUSTOMER_SNAPSHOT_ID,
    snapshotId: `audit_customer_${digestWithoutPrefix(sha256Digest(canonicalJson({ reportId, requestId, pipelineDigest: pipeline.pipelineDigest, accountIdHash: normalizedAccountIdHash }))).slice(0, 32)}`,
    reportId,
    requestId,
    accountIdHash: normalizedAccountIdHash,
    requestedTier: pipeline.requestedTier,
    deliveredTier: pipeline.deliveredTier,
    locale,
    projectName,
    targetLabel,
    riskScore,
    confidenceScore,
    releaseState: pipeline.releaseState,
    pipelineDigest: pipeline.pipelineDigest,
    projectionDigest: pipeline.projection.projectionDigest,
    sourceLayoutDigest: pipeline.customerReportPreviewLayout.layoutDigest,
    customerReportDigest,
    canonicalFieldPacket,
    generatedAt,
    layoutInput,
    canonicalLayout,
    canonicalArtifact,
    pdfArtifact,
  } as const;
  const canonicalUnsigned = auditSnapshotUnsigned(unsigned, { includeCanonicalFieldPacket: true });
  return { ...unsigned, snapshotDigest: sha256Digest(canonicalJson(canonicalUnsigned)) };
}

export function bindAuditAccountCustomerSnapshotToExactArtifact(args: {
  snapshot: AuditAccountCustomerSnapshot;
  accountArtifactSnapshot: AccountCustomerArtifactSnapshot;
  pdfBlob: AccountCustomerArtifactPdfBlob;
  accountId: string;
}): AuditAccountCustomerSnapshot {
  if (!verifyAuditAccountCustomerSnapshot(args.snapshot)) throw new Error("audit_exact_artifact_base_snapshot_invalid");
  if (args.snapshot.exactAccountArtifact) throw new Error("audit_exact_artifact_already_bound");
  if (!verifyPass4822AccountCustomerArtifactSnapshot(args.accountArtifactSnapshot)
    || !isPass4824ExactPdfAccountCustomerArtifactSnapshot(args.accountArtifactSnapshot)
    || args.accountArtifactSnapshot.surface !== "audit"
    || args.accountArtifactSnapshot.payloadKind !== "audit_customer_report_v1") {
    throw new Error("audit_exact_artifact_account_snapshot_invalid");
  }
  if (!verifyPass4822AccountCustomerArtifactOwner(args.accountArtifactSnapshot, args.accountId)) {
    throw new Error("audit_exact_artifact_owner_mismatch");
  }
  assertPass4824PdfBlobMatchesSnapshot({
    blob: args.pdfBlob,
    snapshot: args.accountArtifactSnapshot,
    accountId: args.accountId,
  });
  if (args.accountArtifactSnapshot.accountIdHash !== args.snapshot.accountIdHash
    || args.accountArtifactSnapshot.reportId !== args.snapshot.reportId
    || args.accountArtifactSnapshot.requestedTier !== args.snapshot.requestedTier
    || args.accountArtifactSnapshot.deliveredTier !== args.snapshot.deliveredTier
    || args.accountArtifactSnapshot.locale !== args.snapshot.locale
    || args.accountArtifactSnapshot.generatedAt !== args.snapshot.generatedAt
    || args.accountArtifactSnapshot.payloadDigest !== args.snapshot.customerReportDigest
    || args.accountArtifactSnapshot.canonicalArtifact.artifactDigest !== args.snapshot.canonicalArtifact.artifactDigest) {
    throw new Error("audit_exact_artifact_cross_binding_mismatch");
  }
  const exactAccountArtifact: AuditExactAccountArtifactBinding = {
    schemaVersion: P80_AUDIT_EXACT_ACCOUNT_ARTIFACT_BINDING_ID,
    storage: "exact_immutable_blob",
    snapshotId: args.accountArtifactSnapshot.snapshotId,
    snapshotDigest: args.accountArtifactSnapshot.snapshotDigest,
    artifactDigest: args.accountArtifactSnapshot.canonicalArtifact.artifactDigest,
    pdfBlobId: args.pdfBlob.blobId,
    pdfBlobRecordDigest: args.pdfBlob.recordDigest,
    pdfDigest: args.pdfBlob.pdfDigest,
    pdfByteLength: args.pdfBlob.pdfByteLength,
  };
  const { snapshotDigest: _oldDigest, ...base } = args.snapshot;
  const rebound = { ...base, exactAccountArtifact } satisfies Omit<AuditAccountCustomerSnapshot, "snapshotDigest">;
  const unsigned = auditSnapshotUnsigned(rebound, {
    includeCanonicalFieldPacket: Object.prototype.hasOwnProperty.call(args.snapshot, "canonicalFieldPacket"),
    includeExactAccountArtifact: true,
  });
  return { ...rebound, snapshotDigest: sha256Digest(canonicalJson(unsigned)) };
}

export function hasExactAuditAccountArtifactBinding(
  snapshot: AuditAccountCustomerSnapshot | null | undefined,
): snapshot is AuditAccountCustomerSnapshot & { exactAccountArtifact: AuditExactAccountArtifactBinding } {
  return Boolean(snapshot?.exactAccountArtifact && validExactAccountArtifactBinding(snapshot.exactAccountArtifact, snapshot));
}

export function verifyAuditAccountCustomerSnapshot(value: unknown): value is AuditAccountCustomerSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Partial<AuditAccountCustomerSnapshot>;
  const keys = Object.keys(snapshot).sort();
  const expectedKeys = expectedAuditSnapshotKeys(snapshot);
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) return false;
  if (snapshot.schemaVersion !== PASS4821_AUDIT_ACCOUNT_CUSTOMER_SNAPSHOT_ID) return false;
  if (!snapshot.snapshotId || !snapshot.reportId || !snapshot.requestId || !snapshot.accountIdHash) return false;
  if (!validDigest(snapshot.pipelineDigest) || !validDigest(snapshot.projectionDigest) || !validDigest(snapshot.sourceLayoutDigest) || !validDigest(snapshot.customerReportDigest) || !validDigest(snapshot.snapshotDigest)) return false;
  if (!snapshot.layoutInput || !snapshot.canonicalLayout || !snapshot.canonicalArtifact || !snapshot.pdfArtifact) return false;
  if (snapshot.canonicalFieldPacket) {
    try {
      assertPass4824PayloadFieldPacket(
        { pass4824CanonicalFieldPacket: snapshot.canonicalFieldPacket },
        { module: "audit", tier: snapshot.deliveredTier },
      );
    } catch {
      return false;
    }
  }
  if (!verifyCanonicalCustomerArtifact(snapshot.canonicalArtifact) || snapshot.canonicalArtifact.surface !== "audit") return false;
  if (snapshot.requestedTier !== "basic" && snapshot.requestedTier !== "pro" && snapshot.requestedTier !== "advanced") return false;
  if (snapshot.deliveredTier !== "basic" && snapshot.deliveredTier !== "pro" && snapshot.deliveredTier !== "advanced") return false;
  if (tierRank(snapshot.deliveredTier) > tierRank(snapshot.requestedTier)) return false;
  if (snapshot.locale !== "pl" && snapshot.locale !== "de" && snapshot.locale !== "en") return false;
  if (!/^[a-f0-9]{64}$/i.test(snapshot.accountIdHash)) return false;
  if (!Number.isFinite(Date.parse(String(snapshot.generatedAt ?? "")))) return false;
  if (snapshot.layoutInput.reportId !== snapshot.reportId || snapshot.layoutInput.requestId !== snapshot.requestId || snapshot.layoutInput.locale !== snapshot.locale) return false;
  if (snapshot.canonicalLayout.reportId !== snapshot.reportId || snapshot.canonicalLayout.requestId !== snapshot.requestId || snapshot.canonicalLayout.locale !== snapshot.locale) return false;
  if (snapshot.pdfArtifact.schemaVersion !== PASS4820_CUSTOMER_SAFE_AUDIT_PDF_ID) return false;
  if (!Number.isSafeInteger(snapshot.pdfArtifact.pdfByteLength) || snapshot.pdfArtifact.pdfByteLength <= 0) return false;
  if (!Number.isSafeInteger(snapshot.pdfArtifact.pageCount) || snapshot.pdfArtifact.pageCount <= 0) return false;
  if (!Number.isSafeInteger(snapshot.pdfArtifact.renderedRowCount) || snapshot.pdfArtifact.renderedRowCount <= 0) return false;
  const rebuilt = buildCustomerSafeAuditLayoutModel(snapshot.layoutInput);
  if (rebuilt.layoutDigest !== snapshot.canonicalLayout.layoutDigest) return false;
  if (canonicalJson(rebuilt) !== canonicalJson(snapshot.canonicalLayout)) return false;
  if (!validDigest(snapshot.pdfArtifact.pdfDigest) || !validDigest(snapshot.pdfArtifact.renderPlanDigest)) return false;
  if (snapshot.pdfArtifact.unsupportedGlyphReplacements !== 0) return false;
  if (snapshot.canonicalArtifact.rendererId !== snapshot.pdfArtifact.schemaVersion) return false;
  if (snapshot.canonicalArtifact.reportId !== snapshot.reportId) return false;
  if (snapshot.canonicalArtifact.requestedTier !== snapshot.requestedTier || snapshot.canonicalArtifact.deliveredTier !== snapshot.deliveredTier) return false;
  if (snapshot.canonicalArtifact.payloadDigest !== snapshot.customerReportDigest) return false;
  if (snapshot.canonicalArtifact.layoutDigest !== snapshot.canonicalLayout.layoutDigest) return false;
  if (snapshot.canonicalArtifact.renderPlanDigest !== snapshot.pdfArtifact.renderPlanDigest) return false;
  if (snapshot.canonicalArtifact.pdfDigest !== snapshot.pdfArtifact.pdfDigest) return false;
  if (snapshot.canonicalArtifact.pdfByteLength !== snapshot.pdfArtifact.pdfByteLength
    || snapshot.canonicalArtifact.pageCount !== snapshot.pdfArtifact.pageCount
    || snapshot.canonicalArtifact.renderedRowCount !== snapshot.pdfArtifact.renderedRowCount) return false;

  // A bound exact artifact is verified against its immutable blob at storage/read
  // boundaries. Do not regenerate the PDF while loading or delivering it: that
  // would violate the exact-byte contract and could make preview/download depend
  // on a changed renderer or runtime. Legacy unbound snapshots retain the old
  // deterministic re-render integrity check, but they remain delivery-ineligible.
  if (snapshot.exactAccountArtifact !== undefined) {
    if (!validExactAccountArtifactBinding(snapshot.exactAccountArtifact, snapshot)) return false;
  } else {
    const rerendered = renderCustomerSafeAuditPdf(snapshot.layoutInput);
    if (rerendered.layoutDigest !== snapshot.canonicalLayout.layoutDigest) return false;
    if (snapshot.pdfArtifact.pdfDigest !== rerendered.pdfDigest) return false;
    if (snapshot.pdfArtifact.pdfByteLength !== rerendered.pdfByteLength) return false;
    if (snapshot.pdfArtifact.renderPlanDigest !== rerendered.renderPlanDigest) return false;
    if (snapshot.pdfArtifact.pageCount !== rerendered.pageCount) return false;
    if (snapshot.pdfArtifact.renderedRowCount !== rerendered.renderedRowCount) return false;
    if (rerendered.unsupportedGlyphReplacements !== 0) return false;
    if (snapshot.canonicalArtifact.rendererId !== rerendered.schemaVersion) return false;
  }
  const unsigned = auditSnapshotUnsigned(snapshot as Omit<AuditAccountCustomerSnapshot, "snapshotDigest">, {
    includeCanonicalFieldPacket: Object.prototype.hasOwnProperty.call(snapshot, "canonicalFieldPacket"),
    includeExactAccountArtifact: Object.prototype.hasOwnProperty.call(snapshot, "exactAccountArtifact"),
  });
  return sha256Digest(canonicalJson(unsigned)) === snapshot.snapshotDigest;
}
