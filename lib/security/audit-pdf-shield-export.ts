import {
  buildAuditReportById,
  buildAuditReportPdfManifest,
  type AuditReportQueueRecord,
} from "./audit-report-queue";

export const PASS1654_AUDIT_PDF_SHIELD_EXPORT_ID = "audit-pdf-shield-export-product" as const;
export const PASS1654_AUDIT_PDF_SHIELD_EXPORT_TASKS = 112 as const;

export type AuditExportLocale = "pl" | "en" | "de";
export type AuditExportTone = "good" | "warn" | "danger" | "neutral";

export type AuditExportFinding = {
  id: string;
  severity: string;
  title: string;
  evidence: string;
  publicSummary: string;
  recommendation: string;
  disclosure: "public_ok" | "redact_before_publication" | "responsible_disclosure_first";
  lensAnchor: string;
  mapAnchor: string;
};

export type AuditExportPdfSection = {
  id: string;
  title: string;
  body: string;
  bullets: string[];
  redaction: "public" | "client" | "operator";
};

export type AuditExportMapNode = {
  id: string;
  label: string;
  type: "source" | "contract" | "claim" | "risk" | "gap" | "verdict";
  tone: AuditExportTone;
  body: string;
};

export type AuditExportMapEdge = {
  from: string;
  to: string;
  label: string;
};

export type AuditReportExportPayload = {
  passId: typeof PASS1654_AUDIT_PDF_SHIELD_EXPORT_ID;
  taskCount: typeof PASS1654_AUDIT_PDF_SHIELD_EXPORT_TASKS;
  locale: AuditExportLocale;
  reportId: string;
  projectName: string;
  publicRoute: string;
  exportRoute: string;
  apiRoute: string;
  pdf: {
    reportType: "audit_verification_report";
    exportAllowed: boolean;
    redactionRequired: boolean;
    title: string;
    subtitle: string;
    coverBadges: string[];
    executiveSummary: string[];
    sections: AuditExportPdfSection[];
    findings: AuditExportFinding[];
    appendix: string[];
    forbiddenClaims: string[];
  };
  shieldMap: {
    graphType: "audit_claim_evidence_graph";
    title: string;
    nodes: AuditExportMapNode[];
    edges: AuditExportMapEdge[];
    evidenceCoverage: number;
    /** @deprecated compatibility alias; public semantics are evidence coverage. */
    confidenceCap: number;
    verdict: string;
  };
  releaseGate: {
    lensPdfFullPayload: true;
    shieldMapFullPayload: true;
    queueRecordRequired: true;
    noCertifiedSafe: true;
    noExploitInstructions: true;
    noInvestmentAdvice: true;
    noCustody: true;
    noSeedPhrase: true;
    activeTestingRequiresAuthorization: true;
  };
};

const copy = {
  pl: {
    title: "Velmère Audit Verification Report",
    subtitle: "Pełny payload pod Lens PDF i Shield Map evidence graph — publiczny, zredagowany i bez instrukcji exploitów.",
    mapTitle: "Shield Map: audit claim → evidence → verdict",
    appendix: [
      "Ten raport jest review/pre-auditem, nie certyfikacją regulacyjną.",
      "Velmère nie gwarantuje bezpieczeństwa i nie udziela porad inwestycyjnych.",
      "Aktywne testy wymagają pisemnej zgody albo bug bounty scope.",
      "High-risk detail pozostaje prywatny do zakończenia responsible disclosure.",
    ],
  },
  en: {
    title: "Velmère Audit Verification Report",
    subtitle: "A full Lens PDF and Shield Map evidence graph payload — public, redacted and without exploit instructions.",
    mapTitle: "Shield Map: audit claim → evidence → verdict",
    appendix: [
      "This report is a review/pre-audit, not a regulatory certification.",
      "Velmère does not guarantee safety and does not provide investment advice.",
      "Active testing requires written permission or bug bounty scope.",
      "High-risk detail stays private until responsible disclosure is completed.",
    ],
  },
  de: {
    title: "Velmère Audit Verification Report",
    subtitle: "Ein vollständiger Payload für Lens PDF und Shield Map Evidence Graph — öffentlich, redigiert und ohne Exploit-Anleitung.",
    mapTitle: "Shield Map: Audit Claim → Evidenz → Verdict",
    appendix: [
      "Dieser Report ist ein Review/Pre-Audit, keine regulatorische Zertifizierung.",
      "Velmère garantiert keine Sicherheit und bietet keine Anlageberatung.",
      "Aktive Tests erfordern schriftliche Erlaubnis oder Bug-Bounty-Scope.",
      "High-Risk Details bleiben privat, bis Responsible Disclosure abgeschlossen ist.",
    ],
  },
} satisfies Record<AuditExportLocale, { title: string; subtitle: string; mapTitle: string; appendix: string[] }>;

function resolveLocale(locale: string): AuditExportLocale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

function toneForSeverity(severity: string): AuditExportTone {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "medium") return "warn";
  if (severity === "low") return "good";
  return "neutral";
}

function findingPayload(record: AuditReportQueueRecord): AuditExportFinding[] {
  return record.findings.map((finding) => ({
    id: finding.id,
    severity: finding.severity,
    title: finding.title,
    evidence: finding.evidence,
    publicSummary: finding.publicSummary,
    recommendation: finding.recommendation,
    disclosure: finding.privateHandling,
    lensAnchor: finding.lensAnchor,
    mapAnchor: finding.mapAnchor,
  }));
}

function pdfSections(record: AuditReportQueueRecord): AuditExportPdfSection[] {
  const manifest = buildAuditReportPdfManifest(record.slug, record.locale);
  const missingEvidence = record.preview.assessment.missingEvidence;
  return [
    {
      id: "cover",
      title: "Cover + review boundary",
      body: `${record.projectName} · ${record.chain} · ${record.reportId}`,
      bullets: ["Velmère Audit Checked", "Evidence Checked", record.statusLabel, `${record.evidenceCoverage}% evidence coverage`],
      redaction: "public",
    },
    {
      id: "executive-summary",
      title: "Executive summary",
      body: "A human-readable summary of what the public audit claim proves, what it does not prove and which evidence is still missing.",
      bullets: record.nextActions.slice(0, 4),
      redaction: "public",
    },
    {
      id: "scope-freshness",
      title: "Scope and freshness matrix",
      body: "Compares audit URL, deployed contract, docs/GitHub and disclosure route before evidence coverage can increase.",
      bullets: record.queueSignals.concat(missingEvidence.map((item) => `missing:${item}`)).slice(0, 8),
      redaction: "public",
    },
    {
      id: "findings-table",
      title: "Findings table",
      body: "Severity, evidence, public summary, recommendation and redaction state. Public output avoids exploit detail.",
      bullets: record.findings.map((finding) => `${finding.severity}: ${finding.title}`),
      redaction: record.lensExport.redactionRequired ? "operator" : "public",
    },
    {
      id: "appendix",
      title: "Disclosure and limitations appendix",
      body: "Defines no-custody, no-seed, no-investment-advice and active-testing authorization boundaries.",
      bullets: manifest.forbiddenClaims.map((claim) => `blocked:${claim}`),
      redaction: "public",
    },
  ];
}

function graphNodes(record: AuditReportQueueRecord): AuditExportMapNode[] {
  const redactionTone: AuditExportTone = record.lensExport.redactionRequired ? "danger" : "good";
  const nodes: AuditExportMapNode[] = [
    {
      id: "audit-report",
      label: "Public audit report",
      type: "source",
      tone: record.preview.normalized.auditUrl ? "good" : "warn",
      body: record.preview.normalized.auditUrl ? "Audit URL attached to the queue record." : "Audit URL missing; evidence coverage remains limited.",
    },
    {
      id: "deployed-contract",
      label: "Deployed contract",
      type: "contract",
      tone: record.preview.normalized.contractAddress ? "good" : "warn",
      body: record.preview.normalized.contractAddress ? "Contract address can be compared with report scope." : "Contract address missing from intake.",
    },
    {
      id: "scope-claim",
      label: "Scope claim",
      type: "claim",
      tone: record.reviewLevel === "free_scan" ? "neutral" : "good",
      body: `Review lane: ${record.reviewLevel.replace(/_/g, " ")}.`,
    },
    {
      id: "findings-risk",
      label: "Visible findings",
      type: "risk",
      tone: redactionTone,
      body: `${record.findings.length} findings mapped to public summary and Lens/Shield anchors.`,
    },
    {
      id: "evidence-gaps",
      label: "Evidence gaps",
      type: "gap",
      tone: record.preview.assessment.missingEvidence.length ? "warn" : "good",
      body: record.preview.assessment.missingEvidence.length ? record.preview.assessment.missingEvidence.join(" · ") : "No core intake gap in the sample packet.",
    },
    {
      id: "verdict",
      label: record.statusLabel,
      type: "verdict",
      tone: record.statusTone,
      body: `Evidence coverage is ${record.evidenceCoverage}%. Forbidden claims remain blocked.`,
    },
  ];
  return nodes.concat(record.findings.slice(0, 3).map((finding): AuditExportMapNode => ({
    id: `finding-${finding.id}`,
    label: finding.title,
    type: "risk",
    tone: toneForSeverity(finding.severity),
    body: finding.publicSummary,
  })));
}

function graphEdges(record: AuditReportQueueRecord): AuditExportMapEdge[] {
  const base: AuditExportMapEdge[] = [
    { from: "audit-report", to: "scope-claim", label: "defines claimed coverage" },
    { from: "scope-claim", to: "deployed-contract", label: "must match live address" },
    { from: "deployed-contract", to: "findings-risk", label: "drives visible risk checks" },
    { from: "findings-risk", to: "evidence-gaps", label: "reduces evidence coverage when unresolved" },
    { from: "evidence-gaps", to: "verdict", label: "feeds public status" },
  ];
  return base.concat(record.findings.slice(0, 3).map((finding): AuditExportMapEdge => ({
    from: "findings-risk",
    to: `finding-${finding.id}`,
    label: `${finding.severity} finding`,
  })));
}

export function buildAuditReportExportPayload(id = "sample", locale = "en"): AuditReportExportPayload {
  const safeLocale = resolveLocale(locale);
  const record = buildAuditReportById(id, safeLocale);
  const fullFindings = findingPayload(record);
  const localized = copy[safeLocale];
  const exportRoute = `/${safeLocale}/security/audits/export/${record.slug}`;
  const apiRoute = `/api/security/audit-report-assembler?locale=${safeLocale}&target=${encodeURIComponent(record.preview.normalized.contractAddress || record.projectName || record.slug)}&tier=basic`;

  return {
    passId: PASS1654_AUDIT_PDF_SHIELD_EXPORT_ID,
    taskCount: PASS1654_AUDIT_PDF_SHIELD_EXPORT_TASKS,
    locale: safeLocale,
    reportId: record.reportId,
    projectName: record.projectName,
    publicRoute: record.publicRoute,
    exportRoute,
    apiRoute,
    pdf: {
      reportType: "audit_verification_report",
      exportAllowed: record.lensExport.enabled,
      redactionRequired: record.lensExport.redactionRequired,
      title: localized.title,
      subtitle: localized.subtitle,
      coverBadges: ["Velmère Audit Checked", "Evidence Checked", record.statusLabel, "No certified safe claim"],
      executiveSummary: [
        `${record.projectName} is in ${record.statusLabel} state with ${record.evidenceCoverage}% evidence coverage.`,
        "Velmère checks public audit claims against visible evidence instead of treating badges as guarantees.",
        "The PDF payload is bounded to evidence, findings, recommendations, redaction state and explicit limitations.",
        record.lensExport.redactionRequired
          ? "Sensitive detail requires responsible disclosure before publication."
          : "Public export can proceed after operator review without exploit detail.",
      ],
      sections: pdfSections(record),
      findings: fullFindings,
      appendix: localized.appendix,
      forbiddenClaims: record.boundaries.forbiddenClaims,
    },
    shieldMap: {
      graphType: "audit_claim_evidence_graph",
      title: localized.mapTitle,
      nodes: graphNodes(record),
      edges: graphEdges(record),
      evidenceCoverage: record.evidenceCoverage,
      confidenceCap: record.evidenceCoverage,
      verdict: record.statusLabel,
    },
    releaseGate: {
      lensPdfFullPayload: true,
      shieldMapFullPayload: true,
      queueRecordRequired: true,
      noCertifiedSafe: true,
      noExploitInstructions: true,
      noInvestmentAdvice: true,
      noCustody: true,
      noSeedPhrase: true,
      activeTestingRequiresAuthorization: true,
    },
  };
}

export function buildAuditReportExportQueue(locale = "en") {
  return ["sample", "vlm-audit-0001", "vlm-audit-0002", "vlm-audit-0003"].map((id) => buildAuditReportExportPayload(id, locale));
}
