import {
  buildAuditWatchAssessment,
  buildAuditWatchPage,
  type AuditWatchAssessment,
  type AuditWatchLocale,
  type AuditWatchSubmission,
} from "./audit-watch";

export const PASS1534_AUDIT_REVIEW_FLOW_ID = "pass1534-audit-watch-review-flow" as const;
export const PASS1534_AUDIT_REVIEW_FLOW_TASKS = 84 as const;

export type AuditReviewLevel = "free_scan" | "basic_review" | "pro_review" | "advanced_review";
export type AuditReviewSeverity = "info" | "low" | "medium" | "high" | "critical";
export type AuditReviewStepState = "ready" | "needs_evidence" | "manual_only" | "disclosure_guarded";

export type AuditReviewSubmission = AuditWatchSubmission & {
  docsUrl?: string;
  githubUrl?: string;
  bountyScope?: string;
  contactEmail?: string;
  reviewLevel?: AuditReviewLevel;
  projectName?: string;
  /** PASS4142: route-level language preference; normalized copies may pass locale through the audit report chain. */
  locale?: string;
};

export type AuditReviewStep = {
  id: string;
  label: string;
  body: string;
  state: AuditReviewStepState;
};

export type AuditReviewFinding = {
  id: string;
  title: string;
  severity: AuditReviewSeverity;
  evidence: string;
  recommendation: string;
};

export type AuditReviewPreview = {
  passId: typeof PASS1534_AUDIT_REVIEW_FLOW_ID;
  requestId: string;
  normalized: Required<Pick<AuditReviewSubmission, "chain" | "reviewLevel">> & Partial<AuditReviewSubmission>;
  assessment: AuditWatchAssessment;
  reportTitle: string;
  badgeLanguage: string[];
  steps: AuditReviewStep[];
  findings: AuditReviewFinding[];
  lensPdf: {
    reportType: "audit_verification_report";
    sections: string[];
    redactionRequired: boolean;
  };
  shieldMap: {
    graphType: "audit_claim_evidence_graph";
    nodes: string[];
    edges: string[];
  };
  legalBoundary: string[];
};

const levelLabels: Record<AuditReviewLevel, string> = {
  free_scan: "Free Scan",
  basic_review: "Velmère Basic Audit",
  pro_review: "Pro Review",
  advanced_review: "Velmère Advanced Audit — not for sale",
};

const flowCopy = {
  pl: {
    consoleTitle: "Audit verification console",
    consoleBody:
      "Wklej publiczne źródła. Velmère przygotuje pasywny packet: status audytu, braki dowodów, PDF Lens i Shield Map graph — bez exploitów i bez porad inwestycyjnych.",
    formLabels: {
      projectName: "Nazwa projektu",
      contractAddress: "Adres kontraktu",
      chain: "Chain",
      auditUrl: "Publiczny raport audytu",
      website: "Strona projektu",
      docsUrl: "Docs / GitHub",
      bountyScope: "Bug bounty / safe harbor scope",
      contactEmail: "Kontakt do zgłoszenia",
      reviewLevel: "Poziom review",
      submit: "Wygeneruj review packet",
    },
    sampleTitle: "Co dostanie użytkownik",
    sampleItems: [
      "Audit Claim Check — czy badge audytu pasuje do adresu, daty i scope.",
      "Contract Control Review — owner, proxy, mint, blacklist, tax, pausable.",
      "Lens PDF — executive summary, findings, evidence gaps i safe disclaimers.",
      "Shield Map — audit report → deployed contract → source freshness → verdict.",
      "Responsible Disclosure Guard — wysokie ryzyko bez publicznych instrukcji exploita.",
    ],
    emptyResult: "Wynik preview pojawi się tutaj po wysłaniu formularza.",
  },
  en: {
    consoleTitle: "Audit verification console",
    consoleBody:
      "Paste public sources. Velmère prepares a passive packet: audit status, evidence gaps, Lens PDF and Shield Map graph — without exploit details or investment advice.",
    formLabels: {
      projectName: "Project name",
      contractAddress: "Contract address",
      chain: "Chain",
      auditUrl: "Public audit report",
      website: "Project website",
      docsUrl: "Docs / GitHub",
      bountyScope: "Bug bounty / safe harbor scope",
      contactEmail: "Disclosure contact",
      reviewLevel: "Review level",
      submit: "Generate review packet",
    },
    sampleTitle: "What the user gets",
    sampleItems: [
      "Audit Claim Check — whether the audit badge matches address, date and scope.",
      "Contract Control Review — owner, proxy, mint, blacklist, tax, pausable.",
      "Lens PDF — executive summary, findings, evidence gaps and safe disclaimers.",
      "Shield Map — audit report → deployed contract → source freshness → verdict.",
      "Responsible Disclosure Guard — high risk without public exploit instructions.",
    ],
    emptyResult: "The preview result will appear here after submitting the form.",
  },
  de: {
    consoleTitle: "Audit verification console",
    consoleBody:
      "Öffentliche Quellen einfügen. Velmère erstellt ein passives Packet: Audit-Status, Evidence Gaps, Lens PDF und Shield Map Graph — ohne Exploit-Details und ohne Anlageberatung.",
    formLabels: {
      projectName: "Projektname",
      contractAddress: "Contract address",
      chain: "Chain",
      auditUrl: "Öffentlicher Audit Report",
      website: "Projekt Website",
      docsUrl: "Docs / GitHub",
      bountyScope: "Bug bounty / safe harbor scope",
      contactEmail: "Disclosure Kontakt",
      reviewLevel: "Review level",
      submit: "Review packet generieren",
    },
    sampleTitle: "Was Nutzer erhalten",
    sampleItems: [
      "Audit Claim Check — ob Audit-Badge zu Adresse, Datum und Scope passt.",
      "Contract Control Review — Owner, Proxy, Mint, Blacklist, Tax, Pausable.",
      "Lens PDF — Executive Summary, Findings, Evidence Gaps und sichere Disclaimer.",
      "Shield Map — Audit Report → deployed contract → source freshness → verdict.",
      "Responsible Disclosure Guard — hohes Risiko ohne öffentliche Exploit-Anleitung.",
    ],
    emptyResult: "Das Preview-Ergebnis erscheint hier nach dem Absenden des Formulars.",
  },
} satisfies Record<AuditWatchLocale, {
  consoleTitle: string;
  consoleBody: string;
  formLabels: Record<string, string>;
  sampleTitle: string;
  sampleItems: string[];
  emptyResult: string;
}>;

function resolveLocale(locale: string): AuditWatchLocale {
  return locale === "pl" || locale === "en" || locale === "de" ? locale : "en";
}

function safeText(value: unknown, max = 180): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/[<>]/g, "").trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function safeUrl(value: unknown): string | undefined {
  const text = safeText(value, 260);
  if (!text) return undefined;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function safeReviewLevel(value: unknown): AuditReviewLevel {
  return value === "basic_review" || value === "pro_review" || value === "advanced_review" || value === "free_scan"
    ? value
    : "free_scan";
}

function requestIdFor(input: AuditReviewSubmission): string {
  const seed = [input.projectName, input.contractAddress, input.auditUrl, input.website, input.chain]
    .filter(Boolean)
    .join("|") || "velmere-audit-watch";
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return `VLM-AUD-${new Date().getUTCFullYear()}-${hash.toString(16).padStart(8, "0").toUpperCase()}`;
}

export function normalizeAuditReviewSubmission(input: Partial<AuditReviewSubmission>): AuditReviewSubmission {
  return {
    projectName: safeText(input.projectName, 80),
    contractAddress: safeText(input.contractAddress, 96),
    chain: safeText(input.chain, 40) ?? "ethereum",
    auditUrl: safeUrl(input.auditUrl),
    website: safeUrl(input.website),
    docsUrl: safeUrl(input.docsUrl ?? input.githubUrl),
    githubUrl: safeUrl(input.githubUrl),
    bountyScope: safeUrl(input.bountyScope) ?? safeText(input.bountyScope, 180),
    contactEmail: safeText(input.contactEmail, 120),
    reviewLevel: safeReviewLevel(input.reviewLevel),
  };
}

export function buildAuditReviewFlow(locale: string) {
  const safeLocale = resolveLocale(locale);
  return {
    ...flowCopy[safeLocale],
    page: buildAuditWatchPage(safeLocale),
    passId: PASS1534_AUDIT_REVIEW_FLOW_ID,
    taskCount: PASS1534_AUDIT_REVIEW_FLOW_TASKS,
    reviewLevels: Object.entries(levelLabels).map(([id, label]) => ({ id, label })),
  };
}

export function buildAuditVerificationPreview(input: Partial<AuditReviewSubmission>): AuditReviewPreview {
  const normalized = normalizeAuditReviewSubmission(input);
  const assessment = buildAuditWatchAssessment(normalized);
  const hasAuditReport = Boolean(normalized.auditUrl);
  const hasContract = Boolean(normalized.contractAddress);
  const hasScope = Boolean(normalized.bountyScope || normalized.docsUrl);
  const hasContact = Boolean(normalized.contactEmail);
  const deeperAutomatedReview = normalized.reviewLevel === "pro_review" || normalized.reviewLevel === "advanced_review";

  const steps: AuditReviewStep[] = [
    {
      id: "audit-report-match",
      label: "Audit report ↔ deployed contract",
      body: "Match public audit report metadata against chain, address, commit/scope and project claim copy.",
      state: hasAuditReport && hasContract ? "ready" : "needs_evidence",
    },
    {
      id: "source-freshness",
      label: "Source freshness and post-audit changes",
      body: "Check whether verified source, proxy/admin state or deployment changed after the public report date.",
      state: hasContract ? "ready" : "needs_evidence",
    },
    {
      id: "scope-boundary",
      label: "Scope and legal boundary",
      body: "Keep the review passive unless written permission or bug bounty scope is provided.",
      state: hasScope ? "ready" : "manual_only",
    },
    {
      id: "disclosure-path",
      label: "Responsible disclosure path",
      body: "High-risk findings stay private and route to project contact or authorized bounty scope before public detail.",
      state: hasContact || normalized.bountyScope ? "ready" : "disclosure_guarded",
    },
  ];

  const findings: AuditReviewFinding[] = [
    {
      id: "audit-claim",
      title: hasAuditReport ? "Public audit claim available" : "Public audit report missing",
      severity: hasAuditReport ? "info" : "medium",
      evidence: hasAuditReport ? `Audit URL captured: ${normalized.auditUrl}` : "No public report URL was provided for scope/freshness comparison.",
      recommendation: hasAuditReport ? "Verify report date, address, commit hash and resolved findings." : "Request the public report URL before presenting any reviewed badge.",
    },
    {
      id: "contract-address",
      title: hasContract ? "Contract target captured" : "Contract address missing",
      severity: hasContract ? "low" : "high",
      evidence: hasContract ? `${normalized.chain}: ${normalized.contractAddress}` : "No deployed address was provided.",
      recommendation: hasContract ? "Compare deployed bytecode/source against audit scope." : "Require a deployed address for any contract-control review.",
    },
    {
      id: "scope-permission",
      title: hasScope ? "Scope evidence provided" : "Active testing not authorized",
      severity: hasScope ? "info" : "medium",
      evidence: hasScope ? "Docs, GitHub or bounty scope was included." : "No docs, GitHub or bug bounty scope was supplied.",
      recommendation: "Keep this as passive public review until explicit permission exists.",
    },
    {
      id: "review-depth",
      title: `${levelLabels[normalized.reviewLevel ?? "free_scan"]} selected`,
      severity: deeperAutomatedReview ? "low" : "info",
      evidence: deeperAutomatedReview ? "Deeper automated evidence checks remain gated by source availability, rights, entitlement and product availability." : "Automated preview only; confidence remains capped.",
      recommendation: deeperAutomatedReview ? "Run the automated evidence, conflict, remediation and retest gates; keep unresolved evidence visible before PDF export." : "Offer deeper analysis only after missing evidence is clear.",
    },
  ];

  return {
    passId: PASS1534_AUDIT_REVIEW_FLOW_ID,
    requestId: requestIdFor(normalized),
    normalized: {
      ...normalized,
      chain: normalized.chain ?? "ethereum",
      reviewLevel: normalized.reviewLevel ?? "free_scan",
    },
    assessment,
    reportTitle: `${normalized.projectName || "Project"} · Velmère Audit Verification Report`,
    badgeLanguage: ["Velmère Audit Checked", "Evidence Checked", "Pre-Audit Review"],
    steps,
    findings,
    lensPdf: {
      reportType: "audit_verification_report",
      sections: [
        "Cover and request ID",
        "Executive summary",
        "Audit claim status",
        "Contract/source freshness",
        "Admin/proxy control notes",
        "Evidence gaps",
        "Responsible disclosure boundary",
        "No custody / no seed / no investment advice disclaimer",
      ],
      redactionRequired: findings.some((finding) => finding.severity === "high" || finding.severity === "critical"),
    },
    shieldMap: {
      graphType: "audit_claim_evidence_graph",
      nodes: ["Public audit report", "Deployed contract", "Verified source", "Scope/commit", "Admin controls", "Evidence gaps", "Verdict"],
      edges: ["report→scope", "scope→contract", "contract→source", "source→admin-risk", "admin-risk→verdict", "gaps→confidence-cap"],
    },
    legalBoundary: [
      "passive-public-data-only",
      "no-custody",
      "no-seed-phrase",
      "no-investment-advice",
      "no-guarantee-of-safety",
      "no-unauthorized-active-testing",
      "no-exploit-instructions",
    ],
  };
}
