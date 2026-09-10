import { buildAuditReportById, buildAuditReportQueue } from "./audit-report-queue";
import { buildAuditReportExportPayload } from "./audit-pdf-shield-export";

export const PASS1894_AUDIT_PUBLIC_REGISTRY_ID = "pass1894-audit-watch-public-registry" as const;
export const PASS1894_AUDIT_PUBLIC_REGISTRY_TASKS = 92 as const;

export type AuditRegistryLocale = "pl" | "en" | "de";
export type AuditRegistryTone = "gold" | "cyan" | "emerald" | "amber" | "rose" | "neutral";
export type AuditRegistryStatus =
  | "audit_verified"
  | "scope_mismatch"
  | "audit_outdated"
  | "changed_after_audit"
  | "needs_evidence"
  | "private_disclosure";
export type AuditRegistrySort = "evidence" | "confidence" | "freshness" | "admin" | "severity";

export type AuditRegistryProject = {
  id: string;
  projectName: string;
  chain: string;
  category: "token" | "proxy" | "bridge" | "staking" | "exchange" | "unknown";
  status: AuditRegistryStatus;
  statusLabel: string;
  statusTone: AuditRegistryTone;
  evidenceCoverage: number;
  /** @deprecated compatibility alias; registry score is evidence coverage, not calibrated confidence. */
  confidenceCap: number;
  scopeMatch: number;
  sourceFreshness: number;
  adminControlRisk: number;
  severity: "low" | "medium" | "high" | "private";
  auditClaim: string;
  evidenceSummary: string;
  missingEvidence: string[];
  nextAction: string;
  publicReportRoute: string;
  exportRoute: string;
  badgeLanguage: "Velmère Audit Checked" | "Evidence Checked" | "Needs Evidence" | "Private Disclosure";
  safeToPublish: boolean;
};

export type AuditRegistryDashboard = {
  passId: typeof PASS1894_AUDIT_PUBLIC_REGISTRY_ID;
  taskCount: typeof PASS1894_AUDIT_PUBLIC_REGISTRY_TASKS;
  locale: AuditRegistryLocale;
  eyebrow: string;
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  listingTitle: string;
  listingBody: string;
  scoreboardTitle: string;
  scoreboardBody: string;
  noResultCopy: string;
  filters: { id: "all" | AuditRegistryStatus; label: string }[];
  projects: AuditRegistryProject[];
  metrics: { id: string; label: string; value: string | number; tone: AuditRegistryTone }[];
  methodology: { id: string; label: string; body: string }[];
  releaseGate: {
    hasPublicRegistry: true;
    hasSearchInput: true;
    hasStatusFilters: true;
    hasLeaderboardScorecard: true;
    linksToReportStatus: true;
    linksToFullExport: true;
    noFakeClientLogos: true;
    noCertifiedSafe: true;
    noNoRiskClaim: true;
    noInvestmentAdvice: true;
    noPublicExploitInstructions: true;
  };
};

const copy = {
  pl: {
    eyebrow: "PASS1894 Audit Watch registry",
    title: "Publiczny indeks audytów i claimów — jak leaderboard, ale bez fake bezpieczeństwa.",
    subtitle:
      "Velmère pokazuje publiczne statusy: verified, outdated, scope mismatch, changed after audit i needs evidence. To nie jest lista 'safe coins'. To evidence-first registry, który mówi co da się potwierdzić, a czego brakuje.",
    searchPlaceholder: "Szukaj projektu, chaina, statusu albo claimu…",
    listingTitle: "Audit Watch registry",
    listingBody:
      "Każdy rekord prowadzi do publicznej karty statusu i pełnego exportu pod Lens PDF / Shield Map. Dane są sample-ready, bez prawdziwych logotypów klientów i bez obietnic bezpieczeństwa.",
    scoreboardTitle: "Scoreboard bez hype",
    scoreboardBody:
      "Ranking nie nagradza marketingu. Liczy scope match, świeżość źródeł, admin control risk, redakcję high-risk i evidence gaps.",
    noResultCopy: "Brak wyników dla tego filtra. Zmień status albo zapytanie.",
  },
  en: {
    eyebrow: "PASS1894 Audit Watch registry",
    title: "A public index for audits and claims — leaderboard-style, without fake safety.",
    subtitle:
      "Velmère shows public statuses: verified, outdated, scope mismatch, changed after audit and needs evidence. This is not a 'safe coins' list. It is an evidence-first registry that shows what can be confirmed and what is missing.",
    searchPlaceholder: "Search project, chain, status or claim…",
    listingTitle: "Audit Watch registry",
    listingBody:
      "Every record links to a public status card and full export for Lens PDF / Shield Map. The data is sample-ready, without real client logos and without safety promises.",
    scoreboardTitle: "Scoreboard without hype",
    scoreboardBody:
      "The ranking does not reward marketing. It tracks scope match, source freshness, admin control risk, high-risk redaction and evidence gaps.",
    noResultCopy: "No results for this filter. Change the status or query.",
  },
  de: {
    eyebrow: "PASS1894 Audit Watch registry",
    title: "Öffentlicher Index für Audits und Claims — Leaderboard-Style, ohne Fake-Safety.",
    subtitle:
      "Velmère zeigt öffentliche Status: verified, outdated, scope mismatch, changed after audit und needs evidence. Keine 'safe coins' Liste, sondern ein Evidence-first Registry.",
    searchPlaceholder: "Projekt, Chain, Status oder Claim suchen…",
    listingTitle: "Audit Watch registry",
    listingBody:
      "Jeder Eintrag verlinkt auf Public Status und Full Export für Lens PDF / Shield Map. Sample-ready, ohne echte Client-Logos und ohne Sicherheitsversprechen.",
    scoreboardTitle: "Scoreboard ohne Hype",
    scoreboardBody:
      "Das Ranking belohnt kein Marketing. Es misst Scope Match, Source Freshness, Admin Control Risk, High-Risk Redaction und Evidence Gaps.",
    noResultCopy: "Keine Ergebnisse für diesen Filter. Status oder Suchbegriff ändern.",
  },
} satisfies Record<AuditRegistryLocale, Omit<AuditRegistryDashboard, "passId" | "taskCount" | "locale" | "projects" | "metrics" | "methodology" | "filters" | "releaseGate">>;

const statusLabels = {
  pl: {
    audit_verified: "Audit verified",
    scope_mismatch: "Scope mismatch",
    audit_outdated: "Audit outdated",
    changed_after_audit: "Changed after audit",
    needs_evidence: "Needs evidence",
    private_disclosure: "Private disclosure",
  },
  en: {
    audit_verified: "Audit verified",
    scope_mismatch: "Scope mismatch",
    audit_outdated: "Audit outdated",
    changed_after_audit: "Changed after audit",
    needs_evidence: "Needs evidence",
    private_disclosure: "Private disclosure",
  },
  de: {
    audit_verified: "Audit verified",
    scope_mismatch: "Scope mismatch",
    audit_outdated: "Audit outdated",
    changed_after_audit: "Changed after audit",
    needs_evidence: "Needs evidence",
    private_disclosure: "Private disclosure",
  },
} satisfies Record<AuditRegistryLocale, Record<AuditRegistryStatus, string>>;

function resolveLocale(locale: string): AuditRegistryLocale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

function toneForStatus(status: AuditRegistryStatus): AuditRegistryTone {
  if (status === "audit_verified") return "emerald";
  if (status === "scope_mismatch" || status === "changed_after_audit") return "amber";
  if (status === "private_disclosure") return "rose";
  if (status === "audit_outdated") return "cyan";
  return "neutral";
}

function severityWeight(severity: AuditRegistryProject["severity"]): number {
  if (severity === "private") return 4;
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

const registrySeeds: Array<Omit<AuditRegistryProject, "statusLabel" | "statusTone" | "publicReportRoute" | "exportRoute" | "confidenceCap" | "evidenceCoverage"> & { reportSlug: string }> = [
  {
    id: "velmere-sample-token",
    reportSlug: "sample",
    projectName: "Velmère sample token",
    chain: "ethereum",
    category: "token",
    status: "needs_evidence",
    scopeMatch: 0,
    sourceFreshness: 0,
    adminControlRisk: 28,
    severity: "low",
    auditClaim: "Synthetic sample record only; it is not a verified project or customer audit.",
    evidenceSummary: "The sample demonstrates the registry schema. It carries no external reviewer, remediation or customer evidence.",
    missingEvidence: ["third-party reviewer signature", "final remediation receipt"],
    nextAction: "Keep outside verified metrics until independent evidence is bound and reviewed.",
    badgeLanguage: "Needs Evidence",
    safeToPublish: false,
  },
  {
    id: "proxy-upgrade-review",
    reportSlug: "vlm-proxy-upgrade-review-8f2a1c",
    projectName: "Proxy upgrade review",
    chain: "ethereum",
    category: "proxy",
    status: "changed_after_audit",
    scopeMatch: 58,
    sourceFreshness: 70,
    adminControlRisk: 74,
    severity: "medium",
    auditClaim: "The audit exists, but proxy/admin context needs post-audit change review.",
    evidenceSummary: "Audit and docs are present; admin/proxy role changes require a freshness check before any badge is upgraded.",
    missingEvidence: ["post-audit admin role log", "proxy implementation timestamp"],
    nextAction: "Request implementation history and owner/admin confirmation.",
    badgeLanguage: "Evidence Checked",
    safeToPublish: true,
  },
  {
    id: "missing-evidence-project",
    reportSlug: "vlm-missing-evidence-project-2c8a0e",
    projectName: "Missing evidence project",
    chain: "base",
    category: "unknown",
    status: "needs_evidence",
    scopeMatch: 24,
    sourceFreshness: 31,
    adminControlRisk: 55,
    severity: "medium",
    auditClaim: "Project claims an audit, but no public report URL or deployed contract address is attached.",
    evidenceSummary: "Velmère can show missing evidence and safe next steps, but cannot raise evidence coverage without public artifacts.",
    missingEvidence: ["contract address", "public audit URL", "disclosure contact"],
    nextAction: "Ask project for public audit report, contract and docs/GitHub.",
    badgeLanguage: "Needs Evidence",
    safeToPublish: true,
  },
  {
    id: "disclosure-guarded-finding",
    reportSlug: "vlm-disclosure-guarded-finding-6d64de",
    projectName: "Disclosure guarded finding",
    chain: "polygon",
    category: "staking",
    status: "private_disclosure",
    scopeMatch: 68,
    sourceFreshness: 63,
    adminControlRisk: 81,
    severity: "private",
    auditClaim: "High-risk evidence is routed privately and public details are redacted.",
    evidenceSummary: "The registry can show status and boundary, not exploit steps or private proof-of-concept details.",
    missingEvidence: ["completed disclosure thread", "remediation receipt"],
    nextAction: "Keep detail private until the owner confirms remediation or safe disclosure window.",
    badgeLanguage: "Private Disclosure",
    safeToPublish: false,
  },
  {
    id: "bridge-scope-mismatch",
    reportSlug: "vlm-bridge-scope-mismatch-94b3fd",
    projectName: "Bridge scope mismatch",
    chain: "arbitrum",
    category: "bridge",
    status: "scope_mismatch",
    scopeMatch: 36,
    sourceFreshness: 72,
    adminControlRisk: 69,
    severity: "high",
    auditClaim: "Marketing references an audit, but the public report appears to cover token logic, not bridge operations.",
    evidenceSummary: "Scope mismatch is visible and can be explained without claiming exploitability.",
    missingEvidence: ["bridge module audit", "operator multisig policy", "pause/upgrade documentation"],
    nextAction: "Request a bridge-specific audit or downgrade public badge language.",
    badgeLanguage: "Needs Evidence",
    safeToPublish: true,
  },
  {
    id: "liquidity-lock-watch",
    reportSlug: "vlm-liquidity-lock-watch-5f7e0a",
    projectName: "Liquidity lock watch",
    chain: "bsc",
    category: "token",
    status: "audit_outdated",
    scopeMatch: 62,
    sourceFreshness: 41,
    adminControlRisk: 66,
    severity: "medium",
    auditClaim: "Audit report is older than the current liquidity and ownership claims.",
    evidenceSummary: "Public data should be refreshed before the project can use stronger evidence language.",
    missingEvidence: ["current LP lock proof", "ownership transition evidence", "latest source verification"],
    nextAction: "Re-check LP lock, owner state and published source freshness.",
    badgeLanguage: "Evidence Checked",
    safeToPublish: true,
  },
];

function buildProject(seed: (typeof registrySeeds)[number], locale: AuditRegistryLocale): AuditRegistryProject {
  const record = buildAuditReportById(seed.reportSlug, locale);
  const exportPayload = buildAuditReportExportPayload(seed.reportSlug, locale);
  return {
    ...seed,
    evidenceCoverage: record.evidenceCoverage,
    confidenceCap: record.evidenceCoverage,
    statusLabel: statusLabels[locale][seed.status],
    statusTone: toneForStatus(seed.status),
    publicReportRoute: record.publicRoute,
    exportRoute: exportPayload.exportRoute,
  };
}

function buildMetrics(projects: AuditRegistryProject[]): AuditRegistryDashboard["metrics"] {
  const publishable = projects.filter((project) => project.safeToPublish).length;
  const verified = projects.filter((project) => project.status === "audit_verified").length;
  const needsEvidence = projects.filter((project) => project.status === "needs_evidence" || project.status === "scope_mismatch").length;
  const avgEvidenceCoverage = Math.round(projects.reduce((sum, project) => sum + project.evidenceCoverage, 0) / projects.length);
  return [
    { id: "records", label: "registry records", value: projects.length, tone: "neutral" },
    { id: "verified", label: "verified", value: verified, tone: "emerald" },
    { id: "needs-evidence", label: "needs evidence", value: needsEvidence, tone: "amber" },
    { id: "publishable", label: "public-safe summaries", value: publishable, tone: "cyan" },
    { id: "evidence", label: "avg evidence coverage", value: `${avgEvidenceCoverage}%`, tone: "gold" },
  ];
}

function buildMethodology(locale: AuditRegistryLocale): AuditRegistryDashboard["methodology"] {
  const shared = {
    pl: [
      ["scope", "Scope match", "Czy publiczny audyt dotyczy tego samego kontraktu, chaina, commita i modułu."],
      ["freshness", "Source freshness", "Czy po audycie zmienił się kontrakt, proxy, owner, liquidity albo claim marketingowy."],
      ["controls", "Admin control", "Czy owner, proxy admin, tax router albo pause role nadal mogą zmienić ryzyko projektu."],
      ["publication", "Publication boundary", "Publiczny indeks pokazuje status i rekomendacje, ale nie exploit steps ani gwarancję safety."],
    ],
    en: [
      ["scope", "Scope match", "Whether the public audit covers the same contract, chain, commit and module."],
      ["freshness", "Source freshness", "Whether contract, proxy, owner, liquidity or marketing claims changed after the audit."],
      ["controls", "Admin control", "Whether owner, proxy admin, tax router or pause roles can still change project risk."],
      ["publication", "Publication boundary", "The public index shows status and recommendations, never exploit steps or a safety guarantee."],
    ],
    de: [
      ["scope", "Scope match", "Ob der öffentliche Audit denselben Contract, Chain, Commit und Modul abdeckt."],
      ["freshness", "Source freshness", "Ob Contract, Proxy, Owner, Liquidity oder Marketing Claims nach dem Audit geändert wurden."],
      ["controls", "Admin control", "Ob Owner, Proxy Admin, Tax Router oder Pause Roles das Projektrisiko weiter verändern können."],
      ["publication", "Publication boundary", "Der Public Index zeigt Status und Empfehlungen, nie Exploit Steps oder Safety Guarantee."],
    ],
  } satisfies Record<AuditRegistryLocale, [string, string, string][]>;
  return shared[locale].map(([id, label, body]) => ({ id, label, body }));
}

export function buildAuditRegistryDashboard(locale = "en", query = "", status: string = "all", sort: AuditRegistrySort = "evidence"): AuditRegistryDashboard {
  const safeLocale = resolveLocale(locale);
  const q = query.trim().toLowerCase();
  const rawProjects = registrySeeds.map((seed) => buildProject(seed, safeLocale));
  const filtered = rawProjects.filter((project) => {
    const statusOk = status === "all" || project.status === status;
    const haystack = [project.projectName, project.chain, project.category, project.status, project.auditClaim, project.evidenceSummary, project.badgeLanguage].join(" ").toLowerCase();
    return statusOk && (!q || haystack.includes(q));
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "freshness") return b.sourceFreshness - a.sourceFreshness;
    if (sort === "admin") return b.adminControlRisk - a.adminControlRisk;
    if (sort === "severity") return severityWeight(b.severity) - severityWeight(a.severity);
    return b.evidenceCoverage - a.evidenceCoverage;
  });

  const filters: AuditRegistryDashboard["filters"] = [
    { id: "all", label: "All" },
    { id: "audit_verified", label: statusLabels[safeLocale].audit_verified },
    { id: "scope_mismatch", label: statusLabels[safeLocale].scope_mismatch },
    { id: "audit_outdated", label: statusLabels[safeLocale].audit_outdated },
    { id: "changed_after_audit", label: statusLabels[safeLocale].changed_after_audit },
    { id: "needs_evidence", label: statusLabels[safeLocale].needs_evidence },
    { id: "private_disclosure", label: statusLabels[safeLocale].private_disclosure },
  ];

  return {
    passId: PASS1894_AUDIT_PUBLIC_REGISTRY_ID,
    taskCount: PASS1894_AUDIT_PUBLIC_REGISTRY_TASKS,
    locale: safeLocale,
    ...copy[safeLocale],
    filters,
    projects: sorted,
    metrics: buildMetrics(rawProjects),
    methodology: buildMethodology(safeLocale),
    releaseGate: {
      hasPublicRegistry: true,
      hasSearchInput: true,
      hasStatusFilters: true,
      hasLeaderboardScorecard: true,
      linksToReportStatus: true,
      linksToFullExport: true,
      noFakeClientLogos: true,
      noCertifiedSafe: true,
      noNoRiskClaim: true,
      noInvestmentAdvice: true,
      noPublicExploitInstructions: true,
    },
  };
}

export function buildAuditRegistryApiPayload(locale = "en") {
  const dashboard = buildAuditRegistryDashboard(locale);
  const queue = buildAuditReportQueue(locale);
  return {
    passId: PASS1894_AUDIT_PUBLIC_REGISTRY_ID,
    taskCount: PASS1894_AUDIT_PUBLIC_REGISTRY_TASKS,
    registryRoute: `/${dashboard.locale}/security/audits/registry`,
    projectCount: dashboard.projects.length,
    statuses: dashboard.filters.map((filter) => filter.id),
    metrics: dashboard.metrics,
    projects: dashboard.projects,
    queueSignals: queue.map((record) => ({ reportId: record.reportId, slug: record.slug, status: record.status, evidenceCoverage: record.evidenceCoverage })),
    boundary: ["no Certified Safe", "no No Risk", "no investment advice", "no public exploit instructions"],
  };
}
