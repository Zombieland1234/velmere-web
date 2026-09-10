export const PASS1854_AUDIT_PAGE_BENCHMARK_ID = "audit-page-benchmark-standard" as const;
export const PASS1854_AUDIT_PAGE_BENCHMARK_TASKS = 64 as const;

export type AuditBenchmarkLocale = "pl" | "en" | "de";
export type AuditBenchmarkTone = "gold" | "cyan" | "emerald" | "amber" | "rose" | "neutral";

export type AuditBenchmarkReference = {
  id: string;
  name: string;
  pattern: string;
  velmereAdaptation: string;
  tone: AuditBenchmarkTone;
};

export type AuditBenchmarkPipelineStep = {
  id: string;
  label: string;
  body: string;
  proof: string;
};

export type AuditBenchmarkMetric = {
  id: string;
  label: string;
  value: string;
  body: string;
  tone: AuditBenchmarkTone;
};

export type AuditBenchmarkPage = {
  passId: typeof PASS1854_AUDIT_PAGE_BENCHMARK_ID;
  taskCount: typeof PASS1854_AUDIT_PAGE_BENCHMARK_TASKS;
  locale: AuditBenchmarkLocale;
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  sourceTitle: string;
  sourceBody: string;
  pipelineTitle: string;
  pipelineBody: string;
  scorecardTitle: string;
  scorecardBody: string;
  reportTitle: string;
  reportBody: string;
  boundaryTitle: string;
  references: AuditBenchmarkReference[];
  pipeline: AuditBenchmarkPipelineStep[];
  metrics: AuditBenchmarkMetric[];
  reportSections: string[];
  boundaries: string[];
  releaseGate: {
    adaptsEliteAuditPagePatterns: true;
    hasHeroTrustCard: true;
    hasBenchmarkReferences: true;
    hasPipeline: true;
    hasScorecard: true;
    hasReportOutline: true;
    hasRequestReviewCta: true;
    noCopiedBranding: true;
    noFakeClientLogos: true;
    noCertifiedSafe: true;
    noGuaranteedSecurity: true;
    noInvestmentAdvice: true;
  };
};

const copy = {
  pl: {
    eyebrow: "PASS1854 audit-page benchmark",
    title: "Strona audytów jak top security firmy — tylko w stylu Velmère.",
    subtitle:
      "Velmère bierze najlepsze wzorce: mocny hero, jasny scope, widoczna metodologia, raporty publiczne, scorecard i request review. Nie kopiujemy marek ani claimów — robimy własny, premium Audit Watch.",
    primaryCta: "Request review",
    secondaryCta: "Zobacz benchmark",
    sourceTitle: "Co bierzemy z najlepszych stron",
    sourceBody:
      "Najlepsze strony audytowe nie są przeładowane. Mają jedno zdanie wartości, dowody kompetencji, proces, publiczne raporty, jasny CTA i bezpieczny język odpowiedzialności.",
    pipelineTitle: "Velmère review pipeline",
    pipelineBody:
      "Użytkownik od razu rozumie drogę: submit → scope → evidence → findings → public/private report. To daje poczucie klasy i kontroli, bez fałszywej certyfikacji.",
    scorecardTitle: "Security scorecard bez fake statystyk",
    scorecardBody:
      "Nie pokazujemy zmyślonych klientów ani miliardów. Pokazujemy realne stany: scope match, source freshness, admin control, disclosure lane i confidence cap.",
    reportTitle: "Raport, który wygląda jak produkt",
    reportBody:
      "Publiczny raport ma być czytelny dla founderów i zwykłych użytkowników: executive summary, findings, evidence map, redactions i rekomendacje.",
    boundaryTitle: "Granice, które chronią markę",
  },
  en: {
    eyebrow: "PASS1854 audit-page benchmark",
    title: "An audit page like top security firms — rebuilt in Velmère style.",
    subtitle:
      "Velmère adapts the best patterns: strong hero, clear scope, visible methodology, public reports, scorecard and request-review CTA. We do not copy brands or unsafe claims — we build our own premium Audit Watch.",
    primaryCta: "Request review",
    secondaryCta: "View benchmark",
    sourceTitle: "What we take from the best pages",
    sourceBody:
      "The best audit pages are not noisy. They use one clear value line, competence proof, process, public reports, a clean CTA and careful responsibility language.",
    pipelineTitle: "Velmère review pipeline",
    pipelineBody:
      "The user immediately understands the journey: submit → scope → evidence → findings → public/private report. It feels premium and controlled without pretending to certify safety.",
    scorecardTitle: "Security scorecard without fake statistics",
    scorecardBody:
      "We do not show invented clients or inflated volume. We show real states: scope match, source freshness, admin control, disclosure lane and confidence cap.",
    reportTitle: "A report that feels like a product",
    reportBody:
      "The public report should be readable for founders and users: executive summary, findings, evidence map, redactions and recommendations.",
    boundaryTitle: "Boundaries that protect the brand",
  },
  de: {
    eyebrow: "PASS1854 audit-page benchmark",
    title: "Eine Audit-Seite wie Top-Security-Firmen — im Velmère Stil.",
    subtitle:
      "Velmère übernimmt die besten Patterns: starkes Hero, klarer Scope, sichtbare Methodik, öffentliche Reports, Scorecard und Request-Review CTA. Keine kopierten Marken und keine riskanten Claims.",
    primaryCta: "Review anfragen",
    secondaryCta: "Benchmark ansehen",
    sourceTitle: "Was wir von den besten Seiten übernehmen",
    sourceBody:
      "Die besten Audit-Seiten sind nicht laut. Sie haben eine klare Value Line, Kompetenzbelege, Prozess, öffentliche Reports, saubere CTA und vorsichtige Verantwortungssprache.",
    pipelineTitle: "Velmère Review Pipeline",
    pipelineBody:
      "Der Nutzer versteht sofort: Submit → Scope → Evidence → Findings → Public/Private Report. Premium und kontrolliert, ohne Sicherheit zu zertifizieren.",
    scorecardTitle: "Security Scorecard ohne Fake-Statistiken",
    scorecardBody:
      "Wir zeigen keine erfundenen Kunden oder aufgeblasenen Volumen. Wir zeigen reale Zustände: Scope Match, Source Freshness, Admin Control, Disclosure Lane und Confidence Cap.",
    reportTitle: "Ein Report, der wie ein Produkt wirkt",
    reportBody:
      "Der öffentliche Report muss für Founder und Nutzer lesbar sein: Executive Summary, Findings, Evidence Map, Redactions und Empfehlungen.",
    boundaryTitle: "Grenzen, die die Marke schützen",
  },
} satisfies Record<AuditBenchmarkLocale, Omit<AuditBenchmarkPage, "passId" | "taskCount" | "locale" | "references" | "pipeline" | "metrics" | "reportSections" | "boundaries" | "releaseGate">>;

const referenceCopy = {
  pl: [
    ["openzeppelin", "OpenZeppelin", "Institutional hero, audyty architektury i kodu, nacisk na review przez doświadczonych researcherów.", "Velmère adaptuje: mocny hero + scope + review boundary + report CTA.", "gold"],
    ["trailofbits", "Trail of Bits", "Proces i outcome: security engineering, custom tools, remediation i research-first positioning.", "Velmère adaptuje: pipeline + operator actions + evidence/remediation lane.", "cyan"],
    ["certik", "CertiK / Skynet style", "Leaderboard, scorecard, statusy i publiczny widok projektu zamiast samej strony sprzedażowej.", "Velmère adaptuje: Audit Watch scorecard + public report/status pages.", "emerald"],
    ["consensys", "Consensys Diligence", "Ethereum focus, AI-assisted review język i public audits library.", "Velmère adaptuje: AI-assisted + manual QA boundary + sample report library.", "amber"],
  ],
  en: [
    ["openzeppelin", "OpenZeppelin", "Institutional hero, architecture/code review and experienced researcher positioning.", "Velmère adapts: strong hero + scope + review boundary + report CTA.", "gold"],
    ["trailofbits", "Trail of Bits", "Process and outcomes: security engineering, custom tools, remediation and research-first positioning.", "Velmère adapts: pipeline + operator actions + evidence/remediation lane.", "cyan"],
    ["certik", "CertiK / Skynet style", "Leaderboard, scorecard, statuses and public project view rather than only sales copy.", "Velmère adapts: Audit Watch scorecard + public report/status pages.", "emerald"],
    ["consensys", "Consensys Diligence", "Ethereum focus, AI-assisted review language and a public audits library.", "Velmère adapts: AI-assisted + manual QA boundary + sample report library.", "amber"],
  ],
  de: [
    ["openzeppelin", "OpenZeppelin", "Institutionelles Hero, Architektur-/Code-Review und erfahrene Researcher-Positionierung.", "Velmère adaptiert: starkes Hero + Scope + Review Boundary + Report CTA.", "gold"],
    ["trailofbits", "Trail of Bits", "Prozess und Outcomes: Security Engineering, Custom Tools, Remediation und Research-first Positioning.", "Velmère adaptiert: Pipeline + Operator Actions + Evidence/Remediation Lane.", "cyan"],
    ["certik", "CertiK / Skynet style", "Leaderboard, Scorecard, Status und öffentliche Projektansicht statt nur Sales Copy.", "Velmère adaptiert: Audit Watch Scorecard + Public Report/Status Pages.", "emerald"],
    ["consensys", "Consensys Diligence", "Ethereum-Fokus, AI-assisted Review Sprache und Public Audits Library.", "Velmère adaptiert: AI-assisted + Manual QA Boundary + Sample Report Library.", "amber"],
  ],
} satisfies Record<AuditBenchmarkLocale, [string, string, string, string, AuditBenchmarkTone][]>;

const pipelineCopy = {
  pl: [
    ["submit", "Submit", "Projekt wkleja kontrakt, publiczny audit URL, stronę, docs i disclosure contact.", "Nie prosimy o seed phrase ani custody."],
    ["scope", "Scope match", "Velmère sprawdza, czy audyt dotyczy tego samego adresu, chaina, commita i modułów.", "Status: verified / mismatch / outdated."],
    ["evidence", "Evidence graph", "Źródła idą do Lens PDF i Shield Map: report → contract → source → admin controls.", "Każdy wniosek ma anchor dowodowy."],
    ["findings", "Finding triage", "Wyniki dostają severity, confidence cap i rekomendację bez publikowania exploitów.", "High risk idzie private disclosure."],
    ["report", "Report + badge", "Klient dostaje public status, export, PDF outline i bezpieczne badge language.", "Velmère Audit Checked, nie Certified Safe."],
  ],
  en: [
    ["submit", "Submit", "The project submits contract, public audit URL, website, docs and disclosure contact.", "No seed phrase and no custody."],
    ["scope", "Scope match", "Velmère checks whether the audit matches the same address, chain, commit and modules.", "Status: verified / mismatch / outdated."],
    ["evidence", "Evidence graph", "Sources flow into Lens PDF and Shield Map: report → contract → source → admin controls.", "Every conclusion has an evidence anchor."],
    ["findings", "Finding triage", "Findings get severity, confidence cap and recommendation without public exploit detail.", "High risk routes to private disclosure."],
    ["report", "Report + badge", "The client receives public status, export, PDF outline and safe badge language.", "Velmère Audit Checked, not Certified Safe."],
  ],
  de: [
    ["submit", "Submit", "Das Projekt sendet Contract, Public Audit URL, Website, Docs und Disclosure Contact.", "Keine Seed Phrase und kein Custody."],
    ["scope", "Scope Match", "Velmère prüft, ob Audit, Adresse, Chain, Commit und Module zusammenpassen.", "Status: verified / mismatch / outdated."],
    ["evidence", "Evidence Graph", "Quellen fließen in Lens PDF und Shield Map: Report → Contract → Source → Admin Controls.", "Jede Schlussfolgerung hat Evidence Anchor."],
    ["findings", "Finding Triage", "Findings erhalten Severity, Confidence Cap und Empfehlung ohne öffentliche Exploit-Details.", "High Risk geht in private Disclosure."],
    ["report", "Report + Badge", "Der Kunde erhält Public Status, Export, PDF Outline und sichere Badge Language.", "Velmère Audit Checked, nicht Certified Safe."],
  ],
} satisfies Record<AuditBenchmarkLocale, [string, string, string, string][]>;

const metricsCopy = {
  pl: [
    ["scope", "Scope match", "pending", "Czy raport pasuje do wdrożonego kontraktu i modułów.", "amber"],
    ["freshness", "Source freshness", "required", "Data audytu, commit i zmiany po audycie.", "cyan"],
    ["admin", "Admin control", "visible", "Owner, proxy, roles, mint/tax/blacklist controls.", "gold"],
    ["disclosure", "Disclosure lane", "private", "High risk przed publikacją idzie do odpowiedzialnego zgłoszenia.", "rose"],
    ["confidence", "Confidence cap", "bounded", "Braki dowodów obniżają wynik zamiast znikać z raportu.", "emerald"],
  ],
  en: [
    ["scope", "Scope match", "pending", "Whether the report matches deployed contracts and modules.", "amber"],
    ["freshness", "Source freshness", "required", "Audit date, commit and post-audit changes.", "cyan"],
    ["admin", "Admin control", "visible", "Owner, proxy, roles, mint/tax/blacklist controls.", "gold"],
    ["disclosure", "Disclosure lane", "private", "High risk routes to responsible disclosure before publication.", "rose"],
    ["confidence", "Confidence cap", "bounded", "Evidence gaps lower the score instead of disappearing from the report.", "emerald"],
  ],
  de: [
    ["scope", "Scope Match", "pending", "Ob der Report zu deployed Contracts und Modulen passt.", "amber"],
    ["freshness", "Source Freshness", "required", "Audit-Datum, Commit und Änderungen nach Audit.", "cyan"],
    ["admin", "Admin Control", "visible", "Owner, Proxy, Rollen, Mint/Tax/Blacklist Controls.", "gold"],
    ["disclosure", "Disclosure Lane", "private", "High Risk geht vor Veröffentlichung in Responsible Disclosure.", "rose"],
    ["confidence", "Confidence Cap", "bounded", "Evidence Gaps senken den Score statt aus dem Report zu verschwinden.", "emerald"],
  ],
} satisfies Record<AuditBenchmarkLocale, [string, string, string, string, AuditBenchmarkTone][]>;

const reportSections = {
  pl: ["Hero + one-line value", "Benchmark source pattern", "Request review CTA", "Scope + evidence pipeline", "Scorecard", "Findings table", "Public report + PDF export", "Responsible disclosure boundary"],
  en: ["Hero + one-line value", "Benchmark source pattern", "Request review CTA", "Scope + evidence pipeline", "Scorecard", "Findings table", "Public report + PDF export", "Responsible disclosure boundary"],
  de: ["Hero + one-line value", "Benchmark source pattern", "Request review CTA", "Scope + evidence pipeline", "Scorecard", "Findings table", "Public report + PDF export", "Responsible disclosure boundary"],
} satisfies Record<AuditBenchmarkLocale, string[]>;

const boundaries = {
  pl: ["Nie kopiujemy cudzych brandów ani layoutu pixel-perfect.", "Nie pokazujemy fake klientów ani zmyślonych statystyk.", "Nie używamy Certified Safe / No Risk / Approved Investment.", "Aktywne testy tylko z autoryzacją lub bug bounty scope."],
  en: ["We do not copy third-party brands or pixel-perfect layouts.", "We do not show fake clients or invented statistics.", "We do not use Certified Safe / No Risk / Approved Investment.", "Active testing only with authorization or bug bounty scope."],
  de: ["Wir kopieren keine fremden Marken oder Pixel-perfect Layouts.", "Wir zeigen keine Fake-Kunden oder erfundene Statistiken.", "Wir nutzen nicht Certified Safe / No Risk / Approved Investment.", "Aktive Tests nur mit Autorisierung oder Bug-Bounty Scope."],
} satisfies Record<AuditBenchmarkLocale, string[]>;

function resolveLocale(locale: string): AuditBenchmarkLocale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

export function buildAuditBenchmarkPage(locale: string): AuditBenchmarkPage {
  const safeLocale = resolveLocale(locale);
  return {
    passId: PASS1854_AUDIT_PAGE_BENCHMARK_ID,
    taskCount: PASS1854_AUDIT_PAGE_BENCHMARK_TASKS,
    locale: safeLocale,
    ...copy[safeLocale],
    references: referenceCopy[safeLocale].map(([id, name, pattern, velmereAdaptation, tone]) => ({ id, name, pattern, velmereAdaptation, tone })),
    pipeline: pipelineCopy[safeLocale].map(([id, label, body, proof]) => ({ id, label, body, proof })),
    metrics: metricsCopy[safeLocale].map(([id, label, value, body, tone]) => ({ id, label, value, body, tone })),
    reportSections: reportSections[safeLocale],
    boundaries: boundaries[safeLocale],
    releaseGate: {
      adaptsEliteAuditPagePatterns: true,
      hasHeroTrustCard: true,
      hasBenchmarkReferences: true,
      hasPipeline: true,
      hasScorecard: true,
      hasReportOutline: true,
      hasRequestReviewCta: true,
      noCopiedBranding: true,
      noFakeClientLogos: true,
      noCertifiedSafe: true,
      noGuaranteedSecurity: true,
      noInvestmentAdvice: true,
    },
  };
}
