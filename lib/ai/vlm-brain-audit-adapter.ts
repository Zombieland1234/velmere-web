import {
  createVlmKernelEvidenceItem,
  runVlmBrainKernel,
  type VlmBrainKernelDepth,
  type VlmBrainKernelEvidenceIndependence,
  type VlmBrainKernelEvidenceQuality,
  type VlmBrainKernelLocale,
  type VlmBrainKernelOutput,
} from "./vlm-brain-kernel";
import {
  buildVlmAuditFindingSchemaPack,
  vlmAuditFindingsToKernelFindings,
  type VlmAuditFindingInput,
  type VlmAuditFindingSchemaPack,
} from "./vlm-audit-finding-schema";

export type VlmAuditCaseInput = {
  caseId: string;
  title: string;
  scope?: string[];
  target?: string;
  repository?: string;
  filesReviewed?: number;
  routesReviewed?: number;
  findings?: Array<{
    id: string;
    title: string;
    severity: "info" | "watch" | "warning" | "critical";
    evidence?: string[];
    recommendation?: string;
  }>;
  missingEvidence?: string[];
  requestedReport?: "internal" | "customer" | "public_registry";
  observedAt?: string;
  providerEvidence?: Array<{
    id: string;
    label: string;
    source: string;
    providerFamily: string;
    independence?: Extract<VlmBrainKernelEvidenceIndependence, "independent" | "same_provider">;
    sourceTimestamp: string | null;
    quality?: VlmBrainKernelEvidenceQuality;
    confidence?: number;
    value?: string | number | boolean | null;
    missingReason?: string;
  }>;
};

export type VlmAuditKernelPayload = {
  case: VlmAuditCaseInput;
  auditFindingSchema: VlmAuditFindingSchemaPack;
  workflow: {
    status: "intake" | "triage" | "review" | "report_ready" | "blocked";
    requiredStages: string[];
    reportAllowed: boolean;
  };
};

function auditWorkflow(input: VlmAuditCaseInput): VlmAuditKernelPayload["workflow"] {
  const hasScope = Boolean(input.scope?.length || input.target || input.repository);
  const hasEvidence = Boolean(input.filesReviewed || input.routesReviewed || input.findings?.some((finding) => finding.evidence?.length));
  const hasCriticalMissing = Boolean(input.missingEvidence?.length);
  const status = !hasScope ? "intake" : hasCriticalMissing ? "blocked" : hasEvidence ? "review" : "triage";
  const requiredStages = [
    "scope-lock",
    "evidence-collection",
    "severity-mapping",
    "finding-proof",
    "recommendation-review",
    "customer-safe-report",
    "retest-or-registry-decision",
  ];
  return {
    status,
    requiredStages,
    reportAllowed: status === "review" && !hasCriticalMissing,
  };
}

type VlmAuditCaseFinding = NonNullable<VlmAuditCaseInput["findings"]>[number];

function auditSeverityForSchema(severity: VlmAuditCaseFinding["severity"]): VlmAuditFindingInput["severity"] {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "medium";
  if (severity === "watch") return "low";
  return "info";
}

function auditFindingInputs(input: VlmAuditCaseInput): VlmAuditFindingInput[] {
  return (input.findings ?? []).slice(0, 24).map((finding): VlmAuditFindingInput => ({
    id: finding.id,
    title: finding.title,
    severity: auditSeverityForSchema(finding.severity),
    confidence: finding.evidence?.length ? 76 : 42,
    evidence: finding.evidence?.map((evidence, index) => ({
      id: `${finding.id}.evidence.${index + 1}`,
      claim: evidence,
      source: "operator-intake",
      status: "partial" as const,
      confidence: 58,
      publicSafe: true,
    })),
    recommendation: finding.recommendation ?? "Finding requires recommendation, remediation owner and regression proof.",
    affectedSurface: input.target ?? input.repository ?? "velmere-audit",
  }));
}


export function analyzeAuditCaseWithVlmKernel(input: {
  auditCase: VlmAuditCaseInput;
  locale?: VlmBrainKernelLocale;
  depth?: VlmBrainKernelDepth;
  generatedAt?: string;
}): VlmBrainKernelOutput<VlmAuditKernelPayload> {
  const auditCase = input.auditCase;
  const workflow = auditWorkflow(auditCase);
  const auditFindingSchema = buildVlmAuditFindingSchemaPack({
    findings: auditFindingInputs(auditCase),
    locale: input.locale ?? "pl",
    requestedDepth: input.depth ?? "advanced",
    accessMode: input.depth === "advanced" ? "local_advanced_demo" : input.depth === "pro" ? "local_pro_demo" : "free_basic",
    paidAccessVerified: input.depth === "advanced" || input.depth === "pro",
  });
  const providerEvidence = (auditCase.providerEvidence ?? []).slice(0, 24).map((item) => createVlmKernelEvidenceItem({
    id: `audit.provider.${item.id}`,
    label: item.label,
    source: item.source,
    providerFamily: item.providerFamily,
    independence: item.independence ?? "independent",
    sourceTimestamp: item.sourceTimestamp,
    freshnessProfile: "audit_evidence",
    quality: item.quality ?? (item.missingReason ? "missing" : "strong"),
    freshness: "unknown",
    confidence: item.confidence ?? (item.missingReason ? 0 : 82),
    value: item.value ?? item.source,
    missingReason: item.missingReason,
  }));
  const evidence = [
    ...providerEvidence,
    createVlmKernelEvidenceItem({
      id: "audit.scope",
      label: "Audit scope",
      source: "operator-intake",
      providerFamily: "operator-audit-intake",
      independence: "operator",
      sourceTimestamp: auditCase.observedAt ?? input.generatedAt ?? null,
      freshnessProfile: "audit_evidence",
      quality: auditCase.scope?.length || auditCase.target || auditCase.repository ? "strong" : "missing",
      freshness: "fresh",
      confidence: auditCase.scope?.length || auditCase.target || auditCase.repository ? 84 : 0,
      value: auditCase.scope?.join(", ") ?? auditCase.target ?? auditCase.repository ?? null,
      missingReason: auditCase.scope?.length || auditCase.target || auditCase.repository ? undefined : "Audit scope is not locked.",
    }),
    createVlmKernelEvidenceItem({
      id: "audit.review-volume",
      label: "Files and routes reviewed",
      source: "audit-runtime",
      providerFamily: "vlm-audit-runtime",
      independence: "derived",
      sourceTimestamp: input.generatedAt ?? auditCase.observedAt ?? null,
      freshnessProfile: "audit_evidence",
      quality: auditCase.filesReviewed || auditCase.routesReviewed ? "medium" : "weak",
      freshness: "fresh",
      confidence: auditCase.filesReviewed || auditCase.routesReviewed ? 72 : 36,
      value: `${auditCase.filesReviewed ?? 0} files / ${auditCase.routesReviewed ?? 0} routes`,
    }),
    createVlmKernelEvidenceItem({
      id: "audit.findings",
      label: "Findings with proof",
      source: "audit-brain",
      providerFamily: "vlm-audit-brain",
      independence: "derived",
      sourceTimestamp: input.generatedAt ?? auditCase.observedAt ?? null,
      freshnessProfile: "audit_evidence",
      quality: auditCase.findings?.length ? "medium" : "weak",
      freshness: "fresh",
      confidence: auditCase.findings?.length ? 70 : 38,
      value: auditCase.findings?.length ?? 0,
    }),
    createVlmKernelEvidenceItem({
      id: "audit.missing-evidence",
      label: "Missing audit evidence",
      source: "audit-brain",
      providerFamily: "vlm-audit-brain",
      independence: "derived",
      sourceTimestamp: input.generatedAt ?? auditCase.observedAt ?? null,
      freshnessProfile: "audit_evidence",
      quality: auditCase.missingEvidence?.length ? "missing" : "strong",
      freshness: "fresh",
      confidence: auditCase.missingEvidence?.length ? 0 : 82,
      value: auditCase.missingEvidence?.length ?? 0,
      missingReason: auditCase.missingEvidence?.length ? auditCase.missingEvidence.join(", ") : undefined,
    }),
  ];

  return runVlmBrainKernel(
    {
      surface: "audit",
      depth: input.depth ?? "advanced",
      locale: input.locale ?? "pl",
      input: auditCase,
      evidence,
      intent: "audit_case_review",
      memoryKey: `audit:${auditCase.caseId}`,
      generatedAt: input.generatedAt,
    },
    { case: auditCase, auditFindingSchema, workflow },
    {
      confidence: workflow.reportAllowed ? 76 : 48,
      status: workflow.status === "blocked" ? "blocked" : workflow.reportAllowed ? "ready" : "needs_review",
      headline: workflow.reportAllowed ? "Audit Brain: case gotowy do raportu" : "Audit Brain: case wymaga dalszego dowodu",
      summary: "VLM Kernel ujednolicił audyt: intake, scope, evidence, severity, proof, rekomendacje i decyzję czy raport może wyjść do klienta.",
      findings: [
        {
          id: "audit.workflow",
          title: "Audit Brain buduje case workflow",
          body: "Każdy audyt musi przejść przez scope, evidence, severity, finding proof, rekomendacje i customer-safe report.",
          severity: "info",
          confidence: 82,
          evidenceIds: ["audit.scope", "audit.findings"],
        },
        ...vlmAuditFindingsToKernelFindings(auditFindingSchema.findings),
      ],
      nextActions: workflow.requiredStages.map((stage, index) => ({
        id: `audit.stage.${stage}`,
        title: stage,
        body: `Audit Brain stage ${index + 1}: ${stage}.`,
        required: !workflow.reportAllowed,
        owner: index < 2 ? "operator" : "ai",
      })),
    },
  );
}
