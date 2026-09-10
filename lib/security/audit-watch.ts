export const PASS1494_AUDIT_WATCH_ID = "pass1494-security-review-desk-audit-watch" as const;
export const PASS1494_AUDIT_WATCH_TASKS = 72 as const;

export type AuditWatchLocale = "pl" | "en" | "de";
export type AuditWatchStatus =
  | "audit_verified"
  | "audit_outdated"
  | "scope_mismatch"
  | "changed_after_audit"
  | "needs_evidence"
  | "high_admin_control"
  | "responsible_disclosure";

export type AuditWatchMode = {
  id: string;
  title: string;
  eyebrow: string;
  body: string;
  checks: string[];
};

export type AuditWatchStatusCopy = {
  id: AuditWatchStatus;
  label: string;
  tone: "good" | "warn" | "danger" | "neutral";
  body: string;
};

export type AuditWatchSubmission = {
  contractAddress?: string;
  auditUrl?: string;
  website?: string;
  chain?: string;
};

export type AuditWatchAssessment = {
  passId: typeof PASS1494_AUDIT_WATCH_ID;
  mode: "passive_public_review";
  verdict: "needs_evidence" | "ready_for_manual_review";
  confidenceCap: number;
  statuses: AuditWatchStatus[];
  missingEvidence: string[];
  nextSteps: string[];
  boundaries: string[];
};

const localeCopy = {
  pl: {
    eyebrow: "Velmère Audit Watch",
    title: "Sprawdzamy, czy znaczek audited naprawdę coś znaczy.",
    subtitle:
      "Velmère Security Review Desk weryfikuje publiczne audyty, kontrakty i deklaracje projektów bez custody, bez seed phrase i bez porad inwestycyjnych.",
    ctaPrimary: "Sprawdź publiczny audyt",
    ctaSecondary: "Zobacz metodologię",
    heroBadges: ["Audit claim check", "Source freshness", "Scope mismatch", "No exploit disclosure"],
    deskTitle: "Security Review Desk",
    deskBody:
      "To nie jest regulator ani gwarancja bezpieczeństwa. To evidence-based review: raport audytu, adres kontraktu, scope, timestamp, role admina, zmiany po audycie i braki dowodowe trafiają do jednego werdyktu.",
    methodTitle: "Metodologia Velmère",
    methodBody:
      "Najpierw dowód, potem ocena. Każdy claim musi mieć źródło, zakres, datę i status. Jeśli brakuje danych, confidence jest ograniczane zamiast sztucznie podbijane.",
    submitTitle: "Audit intake",
    submitBody:
      "Wklej adres kontraktu, link do publicznego raportu, stronę projektu i chain. Velmère przygotuje pasywny review packet do dalszej ręcznej weryfikacji.",
    boundariesTitle: "Granice prawne i bezpieczeństwa",
    disclosureTitle: "Responsible disclosure mode",
    disclosureBody:
      "Jeśli review wskazuje wysokie ryzyko, Velmère pokazuje klasę problemu i rekomendację, ale nie publikuje instrukcji wykorzystania luki. Najpierw kontakt z właścicielem projektu lub bug bounty scope.",
    pdfHook: "PDF evidence report",
    pdfHookBody: "Lens może wyeksportować cover, executive summary, statusy, dowody, scope gaps i disclaimer.",
    mapHook: "Shield Map hook",
    mapHookBody: "Mapa pokazuje relację: audit report → deployed contract → verified source → role/admin risk → verdict.",
    badgeTitle: "Bezpieczne badge",
    badgeBody: "Velmère Audit Checked / Evidence Checked / Pre-Audit Review. Nigdy: Certified Safe, No Risk, Approved Investment.",
    sampleReportTitle: "Przykładowy wynik",
    modes: [
      {
        id: "public-contract-review",
        eyebrow: "Mode 01",
        title: "Public Contract Review",
        body: "Pasywna analiza zweryfikowanego source code i publicznych danych kontraktu.",
        checks: ["owner/admin roles", "mint/burn/tax logic", "proxy upgradeability", "blacklist/pausable flags"],
      },
      {
        id: "audit-claim-check",
        eyebrow: "Mode 02",
        title: "Audit Claim Check",
        body: "Czy publiczny audyt pasuje do aktualnego adresu, wersji, scope i deklaracji projektu.",
        checks: ["report date", "contract address", "commit/scope", "resolved findings evidence"],
      },
      {
        id: "authorized-vulnerability-review",
        eyebrow: "Mode 03",
        title: "Authorized Vulnerability Review",
        body: "Głębsza analiza wyłącznie na zlecenie klienta albo w zakresie bug bounty/safe harbor.",
        checks: ["written permission", "scope boundary", "no DoS", "responsible disclosure path"],
      },
    ],
    statuses: [
      { id: "audit_verified", label: "Audit Verified", tone: "good", body: "Raport istnieje, pasuje do adresu/scope i ma podstawowy ślad dowodowy." },
      { id: "audit_outdated", label: "Audit Outdated", tone: "warn", body: "Raport może być stary albo projekt zmienił kontrakt po audycie." },
      { id: "scope_mismatch", label: "Scope Mismatch", tone: "warn", body: "Projekt pokazuje badge, ale audyt obejmował tylko część systemu." },
      { id: "changed_after_audit", label: "Changed After Audit", tone: "danger", body: "Kontrakt, proxy, role albo deployment mogły zmienić się po raporcie." },
      { id: "needs_evidence", label: "Needs Evidence", tone: "neutral", body: "Nie da się potwierdzić kluczowego claimu bez dodatkowego źródła." },
      { id: "high_admin_control", label: "High Admin Control", tone: "danger", body: "Role owner/admin nadal mogą wpływać na działanie projektu." },
      { id: "responsible_disclosure", label: "Responsible Disclosure", tone: "warn", body: "Wysokie ryzyko kierujemy do prywatnego zgłoszenia, nie do publicznego exploita." },
    ],
    boundaries: [
      "No custody — Velmère nie przechowuje środków.",
      "No seed phrase — nigdy nie prosimy o seed/private key.",
      "No investment advice — raport nie mówi kup/sprzedaj.",
      "No guarantee of safety — review nie zastępuje pełnego manualnego audytu.",
      "No unauthorized testing — aktywne testy tylko za zgodą albo w bug bounty scope.",
    ],
    intakeFields: ["Contract address", "Chain", "Public audit report URL", "Project website", "Docs / GitHub", "Bug bounty scope"],
    sampleFindings: [
      ["Audit scope", "Raport obejmuje token, ale nie staking dashboard ani future proxy modules."],
      ["Freshness", "Deployment wymaga sprawdzenia, czy adres i commit są zgodne z raportem."],
      ["Admin control", "Jeśli proxy admin pozostaje aktywny, confidence zostaje ograniczony."],
      ["Marketing claim", "Audited badge nie może oznaczać gwarancji bezpieczeństwa albo rekomendacji inwestycyjnej."],
    ],
  },
  en: {
    eyebrow: "Velmère Audit Watch",
    title: "We check whether an audited badge really means anything.",
    subtitle:
      "Velmère Security Review Desk verifies public audits, contracts and project claims without custody, seed phrases or investment advice.",
    ctaPrimary: "Check a public audit",
    ctaSecondary: "View methodology",
    heroBadges: ["Audit claim check", "Source freshness", "Scope mismatch", "No exploit disclosure"],
    deskTitle: "Security Review Desk",
    deskBody:
      "This is not a regulator and not a guarantee of safety. It is an evidence-based review: audit report, contract address, scope, timestamp, admin roles, post-audit changes and evidence gaps are brought into one verdict.",
    methodTitle: "Velmère methodology",
    methodBody:
      "Evidence first, judgement second. Every claim needs a source, scope, date and status. If data is missing, confidence is capped instead of inflated.",
    submitTitle: "Audit intake",
    submitBody:
      "Paste a contract address, public audit report, project website and chain. Velmère creates a passive review packet for further manual verification.",
    boundariesTitle: "Legal and safety boundaries",
    disclosureTitle: "Responsible disclosure mode",
    disclosureBody:
      "If a review indicates high risk, Velmère shows the issue class and recommendation but does not publish exploit instructions. The first step is project contact or bug bounty scope.",
    pdfHook: "PDF evidence report",
    pdfHookBody: "Lens can export cover, executive summary, statuses, evidence, scope gaps and disclaimer.",
    mapHook: "Shield Map hook",
    mapHookBody: "The map shows: audit report → deployed contract → verified source → role/admin risk → verdict.",
    badgeTitle: "Safe badge language",
    badgeBody: "Velmère Audit Checked / Evidence Checked / Pre-Audit Review. Never: Certified Safe, No Risk, Approved Investment.",
    sampleReportTitle: "Sample result",
    modes: [
      {
        id: "public-contract-review",
        eyebrow: "Mode 01",
        title: "Public Contract Review",
        body: "Passive review of verified source code and public contract data.",
        checks: ["owner/admin roles", "mint/burn/tax logic", "proxy upgradeability", "blacklist/pausable flags"],
      },
      {
        id: "audit-claim-check",
        eyebrow: "Mode 02",
        title: "Audit Claim Check",
        body: "Whether a public audit matches the current address, version, scope and project claims.",
        checks: ["report date", "contract address", "commit/scope", "resolved findings evidence"],
      },
      {
        id: "authorized-vulnerability-review",
        eyebrow: "Mode 03",
        title: "Authorized Vulnerability Review",
        body: "Deeper review only for client-authorized work or bug bounty/safe harbor scope.",
        checks: ["written permission", "scope boundary", "no DoS", "responsible disclosure path"],
      },
    ],
    statuses: [
      { id: "audit_verified", label: "Audit Verified", tone: "good", body: "The report exists, matches address/scope and has a basic evidence trail." },
      { id: "audit_outdated", label: "Audit Outdated", tone: "warn", body: "The report may be old or the project changed contracts after the audit." },
      { id: "scope_mismatch", label: "Scope Mismatch", tone: "warn", body: "The project shows an audit badge but the audit covered only part of the system." },
      { id: "changed_after_audit", label: "Changed After Audit", tone: "danger", body: "Contract, proxy, roles or deployment may have changed after the report." },
      { id: "needs_evidence", label: "Needs Evidence", tone: "neutral", body: "A key claim cannot be confirmed without another source." },
      { id: "high_admin_control", label: "High Admin Control", tone: "danger", body: "Owner/admin roles may still influence project behavior." },
      { id: "responsible_disclosure", label: "Responsible Disclosure", tone: "warn", body: "High-risk findings route to private disclosure, not public exploit detail." },
    ],
    boundaries: [
      "No custody — Velmère never holds assets.",
      "No seed phrase — Velmère never asks for seed phrases or private keys.",
      "No investment advice — the report does not say buy or sell.",
      "No guarantee of safety — the review is not a replacement for a full manual audit.",
      "No unauthorized testing — active testing requires permission or bug bounty scope.",
    ],
    intakeFields: ["Contract address", "Chain", "Public audit report URL", "Project website", "Docs / GitHub", "Bug bounty scope"],
    sampleFindings: [
      ["Audit scope", "The report covers the token but not the staking dashboard or future proxy modules."],
      ["Freshness", "Deployment needs verification that address and commit match the report."],
      ["Admin control", "If proxy admin remains active, confidence is capped."],
      ["Marketing claim", "An audited badge cannot mean a safety guarantee or investment recommendation."],
    ],
  },
  de: {
    eyebrow: "Velmère Audit Watch",
    title: "Wir prüfen, ob ein audited Badge wirklich etwas bedeutet.",
    subtitle:
      "Velmère Security Review Desk verifiziert öffentliche Audits, Contracts und Projekt-Claims ohne Custody, Seed Phrases oder Anlageberatung.",
    ctaPrimary: "Öffentliches Audit prüfen",
    ctaSecondary: "Methodik ansehen",
    heroBadges: ["Audit Claim Check", "Source Freshness", "Scope Mismatch", "No Exploit Disclosure"],
    deskTitle: "Security Review Desk",
    deskBody:
      "Das ist kein Regulator und keine Sicherheitsgarantie. Es ist ein evidenzbasierter Review: Audit-Report, Contract-Adresse, Scope, Timestamp, Admin-Rollen, Änderungen nach dem Audit und Evidenzlücken werden in ein Urteil geführt.",
    methodTitle: "Velmère Methodik",
    methodBody:
      "Erst Evidenz, dann Bewertung. Jeder Claim braucht Quelle, Scope, Datum und Status. Wenn Daten fehlen, wird Confidence begrenzt statt aufgeblasen.",
    submitTitle: "Audit Intake",
    submitBody:
      "Contract-Adresse, öffentlichen Audit-Report, Projektseite und Chain einfügen. Velmère erstellt ein passives Review Packet zur weiteren manuellen Prüfung.",
    boundariesTitle: "Rechtliche und Security-Grenzen",
    disclosureTitle: "Responsible Disclosure Mode",
    disclosureBody:
      "Wenn ein Review hohes Risiko zeigt, nennt Velmère Problemklasse und Empfehlung, aber keine Exploit-Anleitung. Der erste Schritt ist Projektkontakt oder Bug-Bounty-Scope.",
    pdfHook: "PDF Evidence Report",
    pdfHookBody: "Lens kann Cover, Executive Summary, Status, Evidenz, Scope Gaps und Disclaimer exportieren.",
    mapHook: "Shield Map Hook",
    mapHookBody: "Die Map zeigt: Audit Report → Deployed Contract → Verified Source → Role/Admin Risk → Verdict.",
    badgeTitle: "Sichere Badge-Sprache",
    badgeBody: "Velmère Audit Checked / Evidence Checked / Pre-Audit Review. Nie: Certified Safe, No Risk, Approved Investment.",
    sampleReportTitle: "Beispiel-Ergebnis",
    modes: [
      {
        id: "public-contract-review",
        eyebrow: "Mode 01",
        title: "Public Contract Review",
        body: "Passive Analyse von verified source code und öffentlichen Contract-Daten.",
        checks: ["owner/admin roles", "mint/burn/tax logic", "proxy upgradeability", "blacklist/pausable flags"],
      },
      {
        id: "audit-claim-check",
        eyebrow: "Mode 02",
        title: "Audit Claim Check",
        body: "Ob ein öffentlicher Audit zur aktuellen Adresse, Version, Scope und Projekt-Claims passt.",
        checks: ["report date", "contract address", "commit/scope", "resolved findings evidence"],
      },
      {
        id: "authorized-vulnerability-review",
        eyebrow: "Mode 03",
        title: "Authorized Vulnerability Review",
        body: "Tieferer Review nur bei Kundenauftrag oder Bug-Bounty/Safe-Harbor-Scope.",
        checks: ["written permission", "scope boundary", "no DoS", "responsible disclosure path"],
      },
    ],
    statuses: [
      { id: "audit_verified", label: "Audit Verified", tone: "good", body: "Der Report existiert, passt zu Adresse/Scope und hat eine Evidenzspur." },
      { id: "audit_outdated", label: "Audit Outdated", tone: "warn", body: "Der Report kann alt sein oder das Projekt hat Contracts nach dem Audit geändert." },
      { id: "scope_mismatch", label: "Scope Mismatch", tone: "warn", body: "Das Projekt zeigt ein Audit Badge, aber der Audit deckte nur einen Teil des Systems ab." },
      { id: "changed_after_audit", label: "Changed After Audit", tone: "danger", body: "Contract, Proxy, Rollen oder Deployment könnten nach dem Report geändert worden sein." },
      { id: "needs_evidence", label: "Needs Evidence", tone: "neutral", body: "Ein zentraler Claim lässt sich ohne weitere Quelle nicht bestätigen." },
      { id: "high_admin_control", label: "High Admin Control", tone: "danger", body: "Owner/Admin-Rollen können das Projektverhalten weiter beeinflussen." },
      { id: "responsible_disclosure", label: "Responsible Disclosure", tone: "warn", body: "High-risk Findings gehen in private Disclosure, nicht in öffentliche Exploit-Details." },
    ],
    boundaries: [
      "No custody — Velmère verwahrt keine Assets.",
      "No seed phrase — Velmère fragt nie nach Seed Phrase oder Private Key.",
      "No investment advice — der Report sagt nicht buy oder sell.",
      "No guarantee of safety — der Review ersetzt keinen vollständigen manuellen Audit.",
      "No unauthorized testing — aktive Tests nur mit Erlaubnis oder Bug-Bounty-Scope.",
    ],
    intakeFields: ["Contract address", "Chain", "Public audit report URL", "Project website", "Docs / GitHub", "Bug bounty scope"],
    sampleFindings: [
      ["Audit scope", "Der Report deckt den Token ab, aber nicht Staking Dashboard oder spätere Proxy-Module."],
      ["Freshness", "Deployment muss prüfen, ob Adresse und Commit zum Report passen."],
      ["Admin control", "Wenn Proxy Admin aktiv bleibt, wird Confidence begrenzt."],
      ["Marketing claim", "Ein audited Badge darf keine Sicherheitsgarantie oder Anlageempfehlung bedeuten."],
    ],
  },
} satisfies Record<AuditWatchLocale, {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  heroBadges: string[];
  deskTitle: string;
  deskBody: string;
  methodTitle: string;
  methodBody: string;
  submitTitle: string;
  submitBody: string;
  boundariesTitle: string;
  disclosureTitle: string;
  disclosureBody: string;
  pdfHook: string;
  pdfHookBody: string;
  mapHook: string;
  mapHookBody: string;
  badgeTitle: string;
  badgeBody: string;
  sampleReportTitle: string;
  modes: AuditWatchMode[];
  statuses: AuditWatchStatusCopy[];
  boundaries: string[];
  intakeFields: string[];
  sampleFindings: string[][];
}>;

export function resolveAuditWatchLocale(locale: string): AuditWatchLocale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

export function buildAuditWatchPage(locale: string) {
  const safeLocale = resolveAuditWatchLocale(locale);
  return {
    ...localeCopy[safeLocale],
    locale: safeLocale,
    passId: PASS1494_AUDIT_WATCH_ID,
    taskCount: PASS1494_AUDIT_WATCH_TASKS,
    reviewModes: localeCopy[safeLocale].modes,
    statusMatrix: localeCopy[safeLocale].statuses,
    legalBoundaryCount: localeCopy[safeLocale].boundaries.length,
  };
}

export function buildAuditWatchAssessment(input: AuditWatchSubmission): AuditWatchAssessment {
  const missingEvidence: string[] = [];
  if (!input.contractAddress) missingEvidence.push("contract-address");
  if (!input.auditUrl) missingEvidence.push("public-audit-report-url");
  if (!input.website) missingEvidence.push("project-website");
  if (!input.chain) missingEvidence.push("chain");

  const statuses: AuditWatchStatus[] = missingEvidence.length
    ? ["needs_evidence", "responsible_disclosure"]
    : ["audit_verified", "needs_evidence", "responsible_disclosure"];

  return {
    passId: PASS1494_AUDIT_WATCH_ID,
    mode: "passive_public_review",
    verdict: missingEvidence.length ? "needs_evidence" : "ready_for_manual_review",
    confidenceCap: missingEvidence.length ? 54 : 78,
    statuses,
    missingEvidence,
    nextSteps: [
      "Confirm report scope against deployed contract address.",
      "Check whether proxy/admin roles changed after the audit date.",
      "Route high-risk findings to responsible disclosure before public detail.",
      "Generate a Lens PDF only after redaction and no-exploit boundary checks.",
    ],
    boundaries: [
      "passive-public-data-only",
      "no-custody",
      "no-seed-phrase",
      "no-investment-advice",
      "no-unauthorized-active-testing",
      "no-exploit-instructions",
    ],
  };
}
