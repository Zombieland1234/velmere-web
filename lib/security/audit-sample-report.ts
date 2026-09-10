import {
  buildAuditVerificationPreview,
  type AuditReviewFinding,
  type AuditReviewLevel,
  type AuditReviewPreview,
  type AuditReviewSubmission,
} from "./audit-review-flow";

export const PASS1574_AUDIT_SAMPLE_REPORT_ID = "audit-sample-report-productization" as const;
export const PASS1574_AUDIT_SAMPLE_REPORT_TASKS = 96 as const;

export type AuditSampleLocale = "pl" | "en" | "de";
export type AuditSampleTone = "good" | "warn" | "danger" | "neutral";
export type AuditSamplePackageId = "free_scan" | "basic_review" | "pro_review" | "advanced_review";

export type AuditSampleFindingCard = AuditReviewFinding & {
  publicSummary: string;
  privateHandling: "public_ok" | "redact_before_publication" | "responsible_disclosure_first";
  lensAnchor: string;
  mapAnchor: string;
};

export type AuditSamplePackage = {
  id: AuditSamplePackageId;
  label: string;
  eyebrow: string;
  body: string;
  cta: string;
  deliverables: string[];
  boundary: string;
};

export type AuditSampleReport = {
  passId: typeof PASS1574_AUDIT_SAMPLE_REPORT_ID;
  taskCount: typeof PASS1574_AUDIT_SAMPLE_REPORT_TASKS;
  locale: AuditSampleLocale;
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
  };
  sampleInput: AuditReviewSubmission;
  preview: AuditReviewPreview;
  reportId: string;
  verdict: {
    label: string;
    tone: AuditSampleTone;
    evidenceCoverage: number;
    /** @deprecated compatibility alias; this heuristic is evidence coverage, not calibrated confidence. */
    confidence: number;
    body: string;
  };
  sections: {
    executiveSummary: string[];
    lensPdfOutline: string[];
    shieldMapFlow: string[];
    disclosureRules: string[];
    buyerSafeLanguage: string[];
  };
  findings: AuditSampleFindingCard[];
  packages: AuditSamplePackage[];
  requestConsole: {
    title: string;
    body: string;
    requiredInputs: string[];
  };
  releaseGate: {
    noCertifiedSafe: true;
    noExploitInstructions: true;
    noCustody: true;
    noSeedPhrase: true;
    noInvestmentAdvice: true;
    passivePublicReviewDefault: true;
  };
};

const copy = {
  pl: {
    hero: {
      eyebrow: "Velmère Audit Verification Report",
      title: "Przykładowy raport, który pokazuje klientowi co realnie dostaje.",
      subtitle:
        "Audit Watch nie kopiuje cudzych audytów. Velmère sprawdza, czy publiczny raport pasuje do adresu kontraktu, zakresu, świeżości źródeł i widocznych ryzyk.",
      primaryCta: "Zobacz sample report",
      secondaryCta: "Wróć do formularza",
    },
    verdict: {
      label: "Needs Evidence",
      body: "Raport audytu istnieje, ale pokrycie dowodów pozostaje ograniczone, dopóki adres, scope, commit i ewentualne zmiany po audycie nie zostaną potwierdzone publicznymi źródłami.",
    },
    sections: {
      executiveSummary: [
        "Velmère widzi publiczny audit claim, ale nie traktuje go jako gwarancji bezpieczeństwa.",
        "Najpierw sprawdzamy, czy raport dotyczy tego samego kontraktu, chaina, wersji i scope.",
        "Jeśli projekt zmienił proxy/admin/kontrakt po audycie, status może spaść do Changed After Audit albo Scope Mismatch.",
        "Wysokie ryzyka trafiają do responsible disclosure, nie do publicznego exploita.",
      ],
      lensPdfOutline: [
        "Cover + request ID + review boundary",
        "Executive summary dla człowieka",
        "Audit claim status + source freshness",
        "Findings table: severity, evidence, recommendation",
        "Disclosure / redaction appendix",
      ],
      shieldMapFlow: [
        "Audit report → scope",
        "Scope → deployed contract",
        "Contract → verified source",
        "Source → admin/proxy control",
        "Evidence gaps → evidence coverage",
        "Verdict → safe badge language",
      ],
      disclosureRules: [
        "Brak custody i brak seed phrase.",
        "Brak porad inwestycyjnych i brak gwarancji bezpieczeństwa.",
        "Aktywne testy tylko po pisemnej zgodzie albo w bug bounty scope.",
        "Potencjalne high/critical findings są redagowane przed publikacją.",
      ],
      buyerSafeLanguage: ["Velmère Audit Checked", "Evidence Checked", "Pre-Audit Review", "Needs Evidence", "Changed After Audit"],
    },
    requestConsole: {
      title: "Co klient musi wkleić",
      body: "Im więcej wymaganych publicznych dowodów jest faktycznie dołączonych, tym pełniejsze pokrycie raportu. Braki danych nie są ukrywane — obniżają pokrycie dowodów.",
      requiredInputs: ["Adres kontraktu", "Chain", "Publiczny raport audytu", "Strona projektu", "Docs/GitHub", "Kontakt disclosure"],
    },
  },
  en: {
    hero: {
      eyebrow: "Velmère Audit Verification Report",
      title: "A sample report that shows clients what they actually receive.",
      subtitle:
        "Audit Watch does not copy third-party audits. Velmère checks whether a public report matches the deployed contract, scope, source freshness and visible risk evidence.",
      primaryCta: "View sample report",
      secondaryCta: "Back to intake",
    },
    verdict: {
      label: "Needs Evidence",
      body: "A public audit claim exists, but evidence coverage stays limited until address, scope, commit and post-audit changes are verified with public sources.",
    },
    sections: {
      executiveSummary: [
        "Velmère sees a public audit claim but never treats it as a guarantee of safety.",
        "First we check whether the report matches the same contract, chain, version and scope.",
        "If proxy/admin/contract state changed after the audit, the status can fall to Changed After Audit or Scope Mismatch.",
        "High-risk findings route to responsible disclosure, not public exploit detail.",
      ],
      lensPdfOutline: [
        "Cover + request ID + review boundary",
        "Human-readable executive summary",
        "Audit claim status + source freshness",
        "Findings table: severity, evidence, recommendation",
        "Disclosure / redaction appendix",
      ],
      shieldMapFlow: [
        "Audit report → scope",
        "Scope → deployed contract",
        "Contract → verified source",
        "Source → admin/proxy control",
        "Evidence gaps → evidence coverage",
        "Verdict → safe badge language",
      ],
      disclosureRules: [
        "No custody and no seed phrases.",
        "No investment advice and no guarantee of safety.",
        "Active testing only with written permission or bug bounty scope.",
        "Potential high/critical findings are redacted before public release.",
      ],
      buyerSafeLanguage: ["Velmère Audit Checked", "Evidence Checked", "Pre-Audit Review", "Needs Evidence", "Changed After Audit"],
    },
    requestConsole: {
      title: "What the client submits",
      body: "More required public evidence means a more complete report. Missing data is not hidden — it lowers evidence coverage.",
      requiredInputs: ["Contract address", "Chain", "Public audit report", "Project website", "Docs/GitHub", "Disclosure contact"],
    },
  },
  de: {
    hero: {
      eyebrow: "Velmère Audit Verification Report",
      title: "Ein Beispielreport, der zeigt, was Kunden wirklich erhalten.",
      subtitle:
        "Audit Watch kopiert keine fremden Audits. Velmère prüft, ob ein öffentlicher Report zu Contract, Scope, Source Freshness und sichtbarer Risiko-Evidenz passt.",
      primaryCta: "Sample Report ansehen",
      secondaryCta: "Zurück zum Intake",
    },
    verdict: {
      label: "Needs Evidence",
      body: "Ein öffentlicher Audit Claim existiert, aber die Evidenzabdeckung bleibt begrenzt, bis Adresse, Scope, Commit und Änderungen nach dem Audit mit öffentlichen Quellen bestätigt sind.",
    },
    sections: {
      executiveSummary: [
        "Velmère sieht einen öffentlichen Audit Claim, behandelt ihn aber nie als Sicherheitsgarantie.",
        "Zuerst prüfen wir, ob Report, Contract, Chain, Version und Scope zusammenpassen.",
        "Wenn Proxy/Admin/Contract nach dem Audit geändert wurden, kann der Status auf Changed After Audit oder Scope Mismatch fallen.",
        "High-Risk Findings gehen in Responsible Disclosure, nicht in öffentliche Exploit-Details.",
      ],
      lensPdfOutline: [
        "Cover + Request ID + Review Boundary",
        "Executive Summary für Menschen",
        "Audit Claim Status + Source Freshness",
        "Finding Table: Severity, Evidence, Recommendation",
        "Disclosure / Redaction Appendix",
      ],
      shieldMapFlow: [
        "Audit report → scope",
        "Scope → deployed contract",
        "Contract → verified source",
        "Source → admin/proxy control",
        "Evidence gaps → evidence coverage",
        "Verdict → safe badge language",
      ],
      disclosureRules: [
        "Kein Custody und keine Seed Phrases.",
        "Keine Anlageberatung und keine Sicherheitsgarantie.",
        "Aktive Tests nur mit schriftlicher Erlaubnis oder Bug-Bounty-Scope.",
        "Potenzielle High/Critical Findings werden vor Veröffentlichung redigiert.",
      ],
      buyerSafeLanguage: ["Velmère Audit Checked", "Evidence Checked", "Pre-Audit Review", "Needs Evidence", "Changed After Audit"],
    },
    requestConsole: {
      title: "Was Kunden einreichen",
      body: "Mehr erforderliche öffentliche Evidenz bedeutet einen vollständigeren Report. Fehlende Daten werden nicht versteckt — sie senken die Evidenzabdeckung.",
      requiredInputs: ["Contract address", "Chain", "Public audit report", "Project website", "Docs/GitHub", "Disclosure Kontakt"],
    },
  },
} satisfies Record<AuditSampleLocale, {
  hero: AuditSampleReport["hero"];
  verdict: { label: string; body: string };
  sections: AuditSampleReport["sections"];
  requestConsole: AuditSampleReport["requestConsole"];
}>;

const packages: AuditSamplePackage[] = [
  {
    id: "free_scan",
    label: "Free Scan",
    eyebrow: "Entry",
    body: "Passive public metadata intake with explicit evidence coverage and missing-evidence guidance.",
    cta: "Start free scan",
    deliverables: ["request ID", "visible evidence gaps", "safe badge warning", "upgrade path"],
    boundary: "automated preview only",
  },
  {
    id: "basic_review",
    label: "Basic Review",
    eyebrow: "PDF",
    body: "Audit claim check with Lens PDF outline, findings table and public-source status.",
    cta: "Request basic review",
    deliverables: ["PDF report", "severity table", "source freshness", "no-custody disclaimer"],
    boundary: "no active testing",
  },
  {
    id: "pro_review",
    label: "Pro Review",
    eyebrow: "Evidence graph",
    body: "Adds Shield Map graph, admin/proxy checks, scope mismatch review and disclosure planning.",
    cta: "Request pro review",
    deliverables: ["evidence graph", "admin-control notes", "scope mismatch review", "evidence coverage"],
    boundary: "manual-assisted passive review",
  },
  {
    id: "advanced_review",
    label: "Advanced Review",
    eyebrow: "Manual-assisted",
    body: "Manual checklist and private responsible-disclosure routing for high-risk evidence.",
    cta: "Request advanced review",
    deliverables: ["reviewer notes", "redaction plan", "private disclosure route", "client-ready packet"],
    boundary: "written permission required for active tests",
  },
];

function resolveLocale(locale: string): AuditSampleLocale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

function sampleInputFor(level: AuditReviewLevel = "basic_review"): AuditReviewSubmission {
  return {
    projectName: "Velmère sample token",
    contractAddress: "0x0000000000000000000000000000000000000000",
    chain: "ethereum",
    auditUrl: "https://example.com/public-audit.pdf",
    website: "https://example.com",
    docsUrl: "https://docs.example.com",
    githubUrl: "https://github.com/example/project",
    bountyScope: "passive review only until client authorization is signed",
    contactEmail: "security@example.com",
    reviewLevel: level,
  };
}

function toneForFindings(findings: AuditReviewFinding[]): AuditSampleTone {
  if (findings.some((finding) => finding.severity === "critical" || finding.severity === "high")) return "danger";
  if (findings.some((finding) => finding.severity === "medium")) return "warn";
  return "neutral";
}

function evidenceCoverageForPreview(preview: AuditReviewPreview): number {
  const totalSteps = preview.steps.length;
  const readySteps = preview.steps.filter((step) => step.state === "ready").length;
  // Coverage measures attached/ready review evidence only. Finding severity is a separate risk axis
  // and must never lower or raise evidence coverage.
  return totalSteps > 0 ? Math.round((readySteps / totalSteps) * 100) : 0;
}

function findingCards(preview: AuditReviewPreview): AuditSampleFindingCard[] {
  return preview.findings.map((finding): AuditSampleFindingCard => {
    const sensitive = finding.severity === "high" || finding.severity === "critical";
    return {
      ...finding,
      publicSummary: sensitive
        ? "Public report shows the risk class and recommendation, while details stay private until disclosure."
        : "This finding can be shown publicly as evidence language, not as a safety guarantee.",
      privateHandling: sensitive ? "responsible_disclosure_first" : finding.severity === "medium" ? "redact_before_publication" : "public_ok",
      lensAnchor: `lens:${finding.id}`,
      mapAnchor: `shield-map:${finding.id}`,
    };
  });
}

export function buildAuditSampleReport(locale: string, level: AuditReviewLevel = "basic_review"): AuditSampleReport {
  const safeLocale = resolveLocale(locale);
  const sampleInput = sampleInputFor(level);
  const preview = buildAuditVerificationPreview(sampleInput);
  const localized = copy[safeLocale];

  return {
    passId: PASS1574_AUDIT_SAMPLE_REPORT_ID,
    taskCount: PASS1574_AUDIT_SAMPLE_REPORT_TASKS,
    locale: safeLocale,
    hero: localized.hero,
    sampleInput,
    preview,
    reportId: preview.requestId,
    verdict: {
      label: localized.verdict.label,
      tone: toneForFindings(preview.findings),
      evidenceCoverage: evidenceCoverageForPreview(preview),
      confidence: evidenceCoverageForPreview(preview),
      body: localized.verdict.body,
    },
    sections: localized.sections,
    findings: findingCards(preview),
    packages,
    requestConsole: localized.requestConsole,
    releaseGate: {
      noCertifiedSafe: true,
      noExploitInstructions: true,
      noCustody: true,
      noSeedPhrase: true,
      noInvestmentAdvice: true,
      passivePublicReviewDefault: true,
    },
  };
}
