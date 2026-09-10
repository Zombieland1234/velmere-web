import {
  buildAuditVerificationPreview,
  normalizeAuditReviewSubmission,
  type AuditReviewFinding,
  type AuditReviewLevel,
  type AuditReviewPreview,
  type AuditReviewSubmission,
} from "./audit-review-flow";
import {
  buildAuditSampleReport,
  type AuditSampleFindingCard,
  type AuditSampleLocale,
  type AuditSampleTone,
} from "./audit-sample-report";

export const PASS1614_AUDIT_REPORT_QUEUE_ID = "audit-report-queue-status-pages" as const;
export const PASS1614_AUDIT_REPORT_QUEUE_TASKS = 124 as const;

export type AuditReportQueueLocale = AuditSampleLocale;
export type AuditReportStatus =
  | "queued"
  | "triage"
  | "lens_ready"
  | "shield_map_ready"
  | "waiting_for_evidence"
  | "private_disclosure"
  | "published_sample";
export type AuditReportLane = "free_scan" | "basic_review" | "pro_review" | "advanced_review" | "disclosure";
export type AuditReportAudience = "public" | "client" | "operator";

export type AuditReportTimelineItem = {
  id: string;
  label: string;
  state: "done" | "active" | "blocked" | "pending";
  body: string;
};

export type AuditReportQueueRecord = {
  passId: typeof PASS1614_AUDIT_REPORT_QUEUE_ID;
  reportId: string;
  slug: string;
  locale: AuditReportQueueLocale;
  projectName: string;
  chain: string;
  reviewLevel: AuditReviewLevel;
  lane: AuditReportLane;
  status: AuditReportStatus;
  statusLabel: string;
  statusTone: AuditSampleTone;
  evidenceCoverage: number;
  /** @deprecated compatibility alias; this deterministic heuristic is evidence coverage, not calibrated confidence. */
  confidenceCap: number;
  publicRoute: string;
  adminRoute: string;
  preview: AuditReviewPreview;
  findings: AuditSampleFindingCard[];
  queueSignals: string[];
  nextActions: string[];
  timeline: AuditReportTimelineItem[];
  lensExport: {
    enabled: boolean;
    route: string;
    reportType: "audit_verification_report";
    sections: string[];
    redactionRequired: boolean;
  };
  shieldMapExport: {
    enabled: boolean;
    graphType: "audit_claim_evidence_graph";
    nodes: string[];
    edges: string[];
  };
  boundaries: {
    audience: AuditReportAudience;
    publicCanShow: string[];
    privateUntilDisclosure: string[];
    forbiddenClaims: string[];
  };
};

export type AuditReportPublicPage = {
  passId: typeof PASS1614_AUDIT_REPORT_QUEUE_ID;
  taskCount: typeof PASS1614_AUDIT_REPORT_QUEUE_TASKS;
  locale: AuditReportQueueLocale;
  copy: {
    eyebrow: string;
    title: string;
    subtitle: string;
    status: string;
    timeline: string;
    findings: string;
    lens: string;
    map: string;
    boundaries: string;
    back: string;
    request: string;
  };
  record: AuditReportQueueRecord;
};

export type AuditAdminInbox = {
  passId: typeof PASS1614_AUDIT_REPORT_QUEUE_ID;
  taskCount: typeof PASS1614_AUDIT_REPORT_QUEUE_TASKS;
  locale: AuditReportQueueLocale;
  title: string;
  body: string;
  metrics: { label: string; value: string | number }[];
  lanes: { id: AuditReportLane; label: string; records: AuditReportQueueRecord[] }[];
  releaseGate: {
    requiresManualReviewBeforePaidBadge: true;
    blocksCertifiedSafeLanguage: true;
    blocksPublicExploitDetail: true;
    keepsActiveTestingAuthorizedOnly: true;
  };
};

const localeCopy = {
  pl: {
    page: {
      eyebrow: "Velmère Audit Report Status",
      title: "Publiczna karta statusu raportu audytowego.",
      subtitle:
        "Każde zgłoszenie ma request ID, status, pokrycie dowodów, PDF Lens hook, Shield Map hook i granicę disclosure. Publiczny widok pokazuje dowody bez instrukcji wykorzystania luk.",
      status: "status raportu",
      timeline: "kolejka review",
      findings: "findings",
      lens: "Lens PDF export",
      map: "Shield Map graph",
      boundaries: "granice publikacji",
      back: "Wróć do Audit Watch",
      request: "Wyślij review",
    },
    inbox: {
      title: "Audit review inbox",
      body:
        "Operator widzi kolejkę requestów, status PDF/Shield Map, redakcję high-risk findings i granicę active testing. To jest inbox do ręcznej weryfikacji, nie automatyczne Certified Safe.",
    },
    statuses: {
      queued: "Queued",
      triage: "Triage",
      lens_ready: "Lens ready",
      shield_map_ready: "Shield Map ready",
      waiting_for_evidence: "Waiting for evidence",
      private_disclosure: "Private disclosure",
      published_sample: "Published sample",
    },
  },
  en: {
    page: {
      eyebrow: "Velmère Audit Report Status",
      title: "A public status card for an audit report.",
      subtitle:
        "Every request has a request ID, status, evidence coverage, Lens PDF hook, Shield Map hook and disclosure boundary. The public view shows evidence without exploit instructions.",
      status: "report status",
      timeline: "review queue",
      findings: "findings",
      lens: "Lens PDF export",
      map: "Shield Map graph",
      boundaries: "publication boundaries",
      back: "Back to Audit Watch",
      request: "Submit review",
    },
    inbox: {
      title: "Audit review inbox",
      body:
        "Operators see request queue, PDF/Shield Map status, high-risk redaction and active-testing boundary. This is a manual review inbox, not an automated Certified Safe badge.",
    },
    statuses: {
      queued: "Queued",
      triage: "Triage",
      lens_ready: "Lens ready",
      shield_map_ready: "Shield Map ready",
      waiting_for_evidence: "Waiting for evidence",
      private_disclosure: "Private disclosure",
      published_sample: "Published sample",
    },
  },
  de: {
    page: {
      eyebrow: "Velmère Audit Report Status",
      title: "Eine öffentliche Statuskarte für einen Audit Report.",
      subtitle:
        "Jede Anfrage hat Request ID, Status, Evidenzabdeckung, Lens PDF Hook, Shield Map Hook und Disclosure Boundary. Die öffentliche Ansicht zeigt Evidenz ohne Exploit-Anleitung.",
      status: "Report Status",
      timeline: "Review Queue",
      findings: "Findings",
      lens: "Lens PDF Export",
      map: "Shield Map Graph",
      boundaries: "Veröffentlichungsgrenzen",
      back: "Zurück zu Audit Watch",
      request: "Review einreichen",
    },
    inbox: {
      title: "Audit review inbox",
      body:
        "Operatoren sehen Request Queue, PDF/Shield Map Status, High-Risk Redaction und Active-Testing Boundary. Das ist ein manueller Review Inbox, kein automatisches Certified Safe Badge.",
    },
    statuses: {
      queued: "Queued",
      triage: "Triage",
      lens_ready: "Lens ready",
      shield_map_ready: "Shield Map ready",
      waiting_for_evidence: "Waiting for evidence",
      private_disclosure: "Private disclosure",
      published_sample: "Published sample",
    },
  },
} satisfies Record<AuditReportQueueLocale, {
  page: AuditReportPublicPage["copy"];
  inbox: { title: string; body: string };
  statuses: Record<AuditReportStatus, string>;
}>;

const sampleSubmissions: AuditReviewSubmission[] = [
  {
    projectName: "Velmère sample token",
    contractAddress: "0x0000000000000000000000000000000000000000",
    chain: "ethereum",
    auditUrl: "https://example.com/public-audit.pdf",
    website: "https://example.com",
    docsUrl: "https://docs.example.com",
    githubUrl: "https://github.com/example/project",
    bountyScope: "passive review only until client authorization is signed",
    contactEmail: "security@example.com",
    reviewLevel: "basic_review",
  },
  {
    projectName: "Proxy upgrade review",
    contractAddress: "0x1111111111111111111111111111111111111111",
    chain: "ethereum",
    auditUrl: "https://example.com/proxy-audit.pdf",
    website: "https://proxy.example",
    docsUrl: "https://docs.proxy.example",
    bountyScope: "authorized passive evidence check",
    contactEmail: "security@proxy.example",
    reviewLevel: "pro_review",
  },
  {
    projectName: "Missing evidence project",
    contractAddress: "",
    chain: "base",
    auditUrl: "",
    website: "https://missing.example",
    docsUrl: "https://docs.missing.example",
    reviewLevel: "free_scan",
  },
  {
    projectName: "Disclosure guarded finding",
    contractAddress: "0x2222222222222222222222222222222222222222",
    chain: "polygon",
    auditUrl: "https://example.com/disclosure-audit.pdf",
    website: "https://disclosure.example",
    docsUrl: "https://docs.disclosure.example",
    bountyScope: "https://hackerone.example/scope",
    contactEmail: "security@disclosure.example",
    reviewLevel: "advanced_review",
  },
];

function resolveLocale(locale: string): AuditReportQueueLocale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

function slugFromReportId(reportId: string): string {
  return reportId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toneForStatus(status: AuditReportStatus): AuditSampleTone {
  if (status === "private_disclosure") return "danger";
  if (status === "waiting_for_evidence" || status === "triage") return "warn";
  if (status === "lens_ready" || status === "shield_map_ready" || status === "published_sample") return "good";
  return "neutral";
}

function evidenceCoverageForPreview(preview: AuditReviewPreview): number {
  const totalSteps = preview.steps.length;
  const readySteps = preview.steps.filter((step) => step.state === "ready").length;
  // Public coverage describes fulfilled review-evidence steps only. Finding severity is kept
  // on the risk axis and must not be folded into evidence coverage.
  return totalSteps > 0 ? Math.round((readySteps / totalSteps) * 100) : 0;
}

function statusForPreview(preview: AuditReviewPreview): AuditReportStatus {
  if (preview.lensPdf.redactionRequired) return "private_disclosure";
  if (preview.assessment.missingEvidence.length >= 2) return "waiting_for_evidence";
  if (preview.normalized.reviewLevel === "pro_review") return "shield_map_ready";
  if (preview.normalized.reviewLevel === "advanced_review") return "triage";
  if (preview.normalized.reviewLevel === "basic_review") return "lens_ready";
  return "queued";
}

function findingCards(findings: AuditReviewFinding[]): AuditSampleFindingCard[] {
  return findings.map((finding) => {
    const sensitive = finding.severity === "high" || finding.severity === "critical";
    return {
      ...finding,
      publicSummary: sensitive
        ? "The public report keeps details redacted until responsible disclosure is completed."
        : "This finding can be shown as evidence language, never as a safety guarantee.",
      privateHandling: sensitive ? "responsible_disclosure_first" : finding.severity === "medium" ? "redact_before_publication" : "public_ok",
      lensAnchor: `lens:${finding.id}`,
      mapAnchor: `shield-map:${finding.id}`,
    };
  });
}

export function buildAuditReportQueueRecord(input: Partial<AuditReviewSubmission>, locale = "en"): AuditReportQueueRecord {
  const safeLocale = resolveLocale(locale);
  const normalized = normalizeAuditReviewSubmission(input);
  const preview = buildAuditVerificationPreview(normalized);
  const reportId = preview.requestId;
  const slug = slugFromReportId(reportId);
  const status = statusForPreview(preview);
  const evidenceCoverage = evidenceCoverageForPreview(preview);
  const highRisk = preview.lensPdf.redactionRequired;
  const hasContact = Boolean(normalized.contactEmail || normalized.bountyScope);
  const projectName = normalized.projectName || "Untitled audit review";
  const level = normalized.reviewLevel ?? "free_scan";

  return {
    passId: PASS1614_AUDIT_REPORT_QUEUE_ID,
    reportId,
    slug,
    locale: safeLocale,
    projectName,
    chain: normalized.chain ?? "ethereum",
    reviewLevel: level,
    lane: highRisk ? "disclosure" : level,
    status,
    statusLabel: localeCopy[safeLocale].statuses[status],
    statusTone: toneForStatus(status),
    evidenceCoverage,
    confidenceCap: evidenceCoverage,
    publicRoute: `/${safeLocale}/security/audits`,
    adminRoute: `/${safeLocale}/admin/security/audit-inbox`,
    preview,
    findings: findingCards(preview.findings),
    queueSignals: [
      `request:${reportId}`,
      `level:${level}`,
      `status:${status}`,
      `evidence-coverage:${evidenceCoverage}`,
      preview.lensPdf.redactionRequired ? "redaction-required" : "public-summary-ok",
      preview.shieldMap.graphType,
    ],
    nextActions: [
      normalized.contractAddress ? "Compare deployed contract with audit scope." : "Request deployed contract address.",
      normalized.auditUrl ? "Capture report date, scope and commit hash." : "Request public audit report URL.",
      hasContact ? "Keep disclosure route attached to private notes." : "Request security contact before public high-risk detail.",
      highRisk ? "Redact sensitive detail before any public page update." : "Prepare Lens PDF export after operator review.",
    ],
    timeline: [
      {
        id: "intake",
        label: "Intake captured",
        state: "done",
        body: "Public sources are normalized and unsafe text is stripped before the queue record is built.",
      },
      {
        id: "triage",
        label: "Evidence triage",
        state: preview.assessment.missingEvidence.length ? "active" : "done",
        body: "Audit URL, deployed contract, docs/GitHub and disclosure route are checked before evidence coverage increases.",
      },
      {
        id: "lens-export",
        label: "Lens PDF export",
        state: status === "lens_ready" || status === "shield_map_ready" || status === "published_sample" ? "done" : "pending",
        body: "PDF stays bounded to public evidence, redaction appendix and no investment advice language.",
      },
      {
        id: "shield-map",
        label: "Shield Map graph",
        state: status === "shield_map_ready" || status === "published_sample" ? "done" : level === "pro_review" || level === "advanced_review" ? "active" : "pending",
        body: "Graph connects audit report, deployed contract, verified source, admin controls, evidence gaps and verdict.",
      },
      {
        id: "publication",
        label: "Public status page",
        state: highRisk ? "blocked" : "active",
        body: "Public page can show status and recommendations, but never exploit instructions or Certified Safe language.",
      },
    ],
    lensExport: {
      enabled: !highRisk,
      route: `/api/security/audit-report-assembler?locale=${safeLocale}&target=${encodeURIComponent(normalized.contractAddress || normalized.projectName || slug)}&tier=basic`,
      reportType: "audit_verification_report",
      sections: preview.lensPdf.sections,
      redactionRequired: preview.lensPdf.redactionRequired,
    },
    shieldMapExport: {
      enabled: level === "pro_review" || level === "advanced_review",
      graphType: preview.shieldMap.graphType,
      nodes: preview.shieldMap.nodes,
      edges: preview.shieldMap.edges,
    },
    boundaries: {
      audience: highRisk ? "operator" : "public",
      publicCanShow: ["request ID", "status", "evidence coverage", "risk class", "recommendations", "missing evidence"],
      privateUntilDisclosure: ["exploit steps", "proof-of-concept payloads", "private contact thread", "unverified accusations"],
      forbiddenClaims: ["Certified Safe", "No Risk", "Approved Investment", "Guaranteed secure"],
    },
  };
}

export function buildAuditReportQueue(locale = "en"): AuditReportQueueRecord[] {
  return sampleSubmissions.map((submission) => buildAuditReportQueueRecord(submission, locale));
}

export function buildAuditReportById(id: string | undefined, locale = "en"): AuditReportQueueRecord {
  const safeId = (id || "sample").toLowerCase();
  const queue = buildAuditReportQueue(locale);
  if (safeId === "sample") {
    return {
      ...queue[0],
      status: "published_sample",
      statusLabel: localeCopy[resolveLocale(locale)].statuses.published_sample,
      statusTone: "good",
    };
  }
  return queue.find((record) => record.slug === safeId || record.reportId.toLowerCase() === safeId) ?? queue[0];
}

export function buildAuditReportPublicPage(locale = "en", id = "sample"): AuditReportPublicPage {
  const safeLocale = resolveLocale(locale);
  return {
    passId: PASS1614_AUDIT_REPORT_QUEUE_ID,
    taskCount: PASS1614_AUDIT_REPORT_QUEUE_TASKS,
    locale: safeLocale,
    copy: localeCopy[safeLocale].page,
    record: buildAuditReportById(id, safeLocale),
  };
}

export function buildAuditAdminInbox(locale = "en"): AuditAdminInbox {
  const safeLocale = resolveLocale(locale);
  const records = buildAuditReportQueue(safeLocale);
  const lanes: AuditAdminInbox["lanes"] = (["free_scan", "basic_review", "pro_review", "advanced_review", "disclosure"] as const).map((lane) => ({
    id: lane,
    label: lane.replace(/_/g, " "),
    records: records.filter((record) => record.lane === lane),
  }));
  const redaction = records.filter((record) => record.lensExport.redactionRequired).length;
  const ready = records.filter((record) => record.status === "lens_ready" || record.status === "shield_map_ready" || record.status === "published_sample").length;

  return {
    passId: PASS1614_AUDIT_REPORT_QUEUE_ID,
    taskCount: PASS1614_AUDIT_REPORT_QUEUE_TASKS,
    locale: safeLocale,
    title: localeCopy[safeLocale].inbox.title,
    body: localeCopy[safeLocale].inbox.body,
    metrics: [
      { label: "queue", value: records.length },
      { label: "ready", value: ready },
      { label: "redaction", value: redaction },
      { label: "avg evidence coverage", value: `${Math.round(records.reduce((sum, record) => sum + record.evidenceCoverage, 0) / records.length)}%` },
    ],
    lanes,
    releaseGate: {
      requiresManualReviewBeforePaidBadge: true,
      blocksCertifiedSafeLanguage: true,
      blocksPublicExploitDetail: true,
      keepsActiveTestingAuthorizedOnly: true,
    },
  };
}

export function buildAuditReportPdfManifest(id = "sample", locale = "en") {
  const record = buildAuditReportById(id, locale);
  const sample = buildAuditSampleReport(locale, record.reviewLevel);
  return {
    passId: PASS1614_AUDIT_REPORT_QUEUE_ID,
    reportId: record.reportId,
    reportType: "audit_verification_report" as const,
    exportAllowed: record.lensExport.enabled,
    redactionRequired: record.lensExport.redactionRequired,
    route: record.lensExport.route,
    sections: record.lensExport.sections,
    sampleOutline: sample.sections.lensPdfOutline,
    publicRoute: record.publicRoute,
    forbiddenClaims: record.boundaries.forbiddenClaims,
  };
}
