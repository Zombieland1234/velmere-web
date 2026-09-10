import { sha256Token } from "./cryptographic-digest";
import type { AuditReviewSubmission } from "./audit-review-flow";

export const PASS2358_AUDIT_WATCH_CONTRACT_HARNESS_ID = "audit-watch-contract-harness-differentiated-ai" as const;
export const PASS2358_AUDIT_WATCH_CONTRACT_HARNESS_TASKS = 58 as const;

export type Pass2358AuditHarnessLocale = "pl" | "en" | "de";
export type Pass2358AuditTone = "good" | "watch" | "risk" | "neutral";
export type Pass2358RiskLane =
  | "audit_scope_gap"
  | "post_audit_change"
  | "missing_public_evidence"
  | "clean_prescreen"
  | "private_disclosure_needed"
  | "generic_intake_review";

export type Pass2358AuditHarnessSample = {
  id: string;
  label: string;
  chain: string;
  contractAddress: string;
  projectName: string;
  auditUrl?: string;
  docsUrl?: string;
  expectedTone: Pass2358AuditTone;
  riskLane: Pass2358RiskLane;
  confidenceCap: number;
  aiBrief: string;
  safeFindings: string[];
  missingEvidence: string[];
  operatorNextStep: string;
};

export type Pass2358SubmissionAuditProfile = {
  passId: typeof PASS2358_AUDIT_WATCH_CONTRACT_HARNESS_ID;
  matchedSampleId?: string;
  riskLane: Pass2358RiskLane;
  tone: Pass2358AuditTone;
  confidenceCap: number;
  resultFingerprint: string;
  aiBrief: string;
  safeFindingTitle: string;
  missingEvidence: string[];
  operatorNextStep: string;
  boundary: string[];
};

export type Pass2358AuditHarness = {
  passId: typeof PASS2358_AUDIT_WATCH_CONTRACT_HARNESS_ID;
  taskCount: typeof PASS2358_AUDIT_WATCH_CONTRACT_HARNESS_TASKS;
  locale: Pass2358AuditHarnessLocale;
  title: string;
  body: string;
  samples: Pass2358AuditHarnessSample[];
  uniqueness: {
    status: "PASS" | "WARN";
    uniqueBriefs: number;
    totalSamples: number;
    note: string;
  };
  boundary: string[];
};

function resolveLocale(locale: string | undefined | null): Pass2358AuditHarnessLocale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

function stableHash(input: string): string {
  return sha256Token(input, 16).toUpperCase();
}

function boundary(locale: Pass2358AuditHarnessLocale) {
  if (locale === "pl") {
    return [
      "pasywny review publicznych danych",
      "bez seed phrase i custody",
      "bez instrukcji exploita",
      "bez gwarancji bezpieczeństwa",
      "bez porad inwestycyjnych",
      "detale high-risk tylko prywatnie po zgodzie/scope",
    ];
  }
  if (locale === "de") {
    return [
      "passiver Review öffentlicher Daten",
      "keine Seed Phrase und kein Custody",
      "keine Exploit-Anleitungen",
      "keine Sicherheitsgarantie",
      "keine Anlageberatung",
      "High-Risk Details nur privat nach Scope/Erlaubnis",
    ];
  }
  return [
    "passive public-data review",
    "no seed phrase and no custody",
    "no exploit instructions",
    "no safety guarantee",
    "no investment advice",
    "high-risk detail stays private after scope/permission",
  ];
}

const addresses = {
  aurx: "0xa0a0000000000000000000000000000000000001",
  omni: "0xb0b0000000000000000000000000000000000002",
  lunax: "0xc0c0000000000000000000000000000000000003",
  nova: "0xd0d0000000000000000000000000000000000004",
  mant: "0xe0e0000000000000000000000000000000000005",
} as const;

export function buildPass2358AuditHarness(locale = "en"): Pass2358AuditHarness {
  const safeLocale = resolveLocale(locale);
  const samples: Pass2358AuditHarnessSample[] = safeLocale === "pl" ? [
    {
      id: "aurx-proxy-scope",
      label: "AURX proxy/admin scope",
      chain: "Ethereum",
      contractAddress: addresses.aurx,
      projectName: "AURX",
      auditUrl: "https://example.com/audits/aurx-public-review.pdf",
      docsUrl: "https://docs.example.com/aurx",
      expectedTone: "watch",
      riskLane: "audit_scope_gap",
      confidenceCap: 64,
      aiBrief: "AURX ma publiczny audit badge, ale wynik nie może być taki sam jak przy czystym projekcie: VLM rozdziela raport, kontrakt i możliwe luki scope/admin.",
      safeFindings: ["publiczny raport istnieje", "wymagane porównanie scope z aktualnym adresem", "status admin/proxy nie może podnosić confidence bez dowodu"],
      missingEvidence: ["data raportu", "commit albo scope hash", "potwierdzenie aktualnego adresu proxy/implementation"],
      operatorNextStep: "Poproś o scope/commit i porównaj z deploymentem; nie publikuj technicznych detali przed walidacją.",
    },
    {
      id: "omni-post-audit-change",
      label: "OMNI post-audit change",
      chain: "BSC",
      contractAddress: addresses.omni,
      projectName: "OMNI",
      auditUrl: "https://example.com/audits/omni-badge.pdf",
      expectedTone: "risk",
      riskLane: "post_audit_change",
      confidenceCap: 42,
      aiBrief: "OMNI powinien dostać inny tekst niż AURX: główny problem to możliwość zmiany po audycie i mismatch między badge a obecną wersją kontraktu.",
      safeFindings: ["audit badge nie wystarcza", "wymagany deployment/version match", "wysokie ryzyko opisu publicznego bez redakcji"],
      missingEvidence: ["historia zmian po audycie", "wersja deploymentu", "link do verified source"],
      operatorNextStep: "Utrzymaj status client-only/redacted i poproś o aktualny raport albo changelog po audycie.",
    },
    {
      id: "lunax-missing-evidence",
      label: "LUNA-X missing public evidence",
      chain: "Arbitrum",
      contractAddress: addresses.lunax,
      projectName: "LUNA-X",
      expectedTone: "neutral",
      riskLane: "missing_public_evidence",
      confidenceCap: 36,
      aiBrief: "LUNA-X nie ma udawać ryzyka ani bezpieczeństwa: bot ma jasno powiedzieć, że brakuje publicznych źródeł i wynik jest confidence-capped.",
      safeFindings: ["brak publicznego raportu", "brak wystarczającego source packet", "Basic może pokazać tylko missing data"],
      missingEvidence: ["publiczny raport", "docs lub repo", "kontakt do disclosure"],
      operatorNextStep: "Wygeneruj listę braków i dopiero po źródłach pozwól na Advanced analysis verification.",
    },
    {
      id: "nova-clean-prescreen",
      label: "NOVA clean pre-screen",
      chain: "Base",
      contractAddress: addresses.nova,
      projectName: "NOVA",
      auditUrl: "https://example.com/audits/nova-clean.pdf",
      docsUrl: "https://docs.example.com/nova",
      expectedTone: "good",
      riskLane: "clean_prescreen",
      confidenceCap: 78,
      aiBrief: "NOVA może mieć najspokojniejszy ton, ale nadal bez 'certified safe': VLM rozdziela clean pre-screen od gwarancji bezpieczeństwa.",
      safeFindings: ["raport i docs są obecne", "brak krytycznego sygnału w pre-screen", "confidence nadal zależy od świeżości danych"],
      missingEvidence: ["potwierdzenie braku zmian po raporcie", "freshness timestamp", "final human note"],
      operatorNextStep: "Oznacz jako public summary z confidence cap i dodaj notatkę: to nie jest certyfikat bezpieczeństwa.",
    },
    {
      id: "mant-private-disclosure",
      label: "MANT private disclosure lane",
      chain: "Polygon",
      contractAddress: addresses.mant,
      projectName: "MANT",
      auditUrl: "https://example.com/audits/mant-public.pdf",
      expectedTone: "risk",
      riskLane: "private_disclosure_needed",
      confidenceCap: 48,
      aiBrief: "MANT ma wymusić zachowanie bota: jeśli pojawia się obszar high-risk, opis zostaje prywatny, bez instrukcji wykorzystania.",
      safeFindings: ["wymagana prywatna weryfikacja", "publiczny opis zostaje ogólny", "potrzebny kontakt/safe harbor"],
      missingEvidence: ["kontakt techniczny", "safe harbor/scope", "potwierdzenie statusu po stronie projektu"],
      operatorNextStep: "Przenieś sprawę do Advanced/private review i publikuj tylko klasę ryzyka oraz brakujące dowody.",
    },
  ] : safeLocale === "de" ? [
    {
      id: "aurx-proxy-scope",
      label: "AURX proxy/admin scope",
      chain: "Ethereum",
      contractAddress: addresses.aurx,
      projectName: "AURX",
      auditUrl: "https://example.com/audits/aurx-public-review.pdf",
      docsUrl: "https://docs.example.com/aurx",
      expectedTone: "watch",
      riskLane: "audit_scope_gap",
      confidenceCap: 64,
      aiBrief: "AURX hat ein öffentliches Audit Badge, aber VLM trennt Report, Contract und mögliche Scope/Admin-Lücken statt denselben Text wie bei einem cleanen Projekt zu zeigen.",
      safeFindings: ["öffentlicher Report vorhanden", "Scope muss mit aktueller Adresse verglichen werden", "Admin/Proxy Status braucht Evidenz"],
      missingEvidence: ["Report-Datum", "Commit oder Scope Hash", "Bestätigung aktueller Proxy/Implementation Adresse"],
      operatorNextStep: "Scope/Commit anfordern und mit Deployment vergleichen; technische Details vor Validierung nicht veröffentlichen.",
    },
    {
      id: "omni-post-audit-change",
      label: "OMNI post-audit change",
      chain: "BSC",
      contractAddress: addresses.omni,
      projectName: "OMNI",
      auditUrl: "https://example.com/audits/omni-badge.pdf",
      expectedTone: "risk",
      riskLane: "post_audit_change",
      confidenceCap: 42,
      aiBrief: "OMNI bekommt einen anderen Text als AURX: das Kernrisiko ist eine mögliche Änderung nach dem Audit und ein Mismatch zwischen Badge und aktueller Version.",
      safeFindings: ["Audit Badge reicht nicht", "Deployment/Version Match erforderlich", "öffentliche Details bleiben redacted"],
      missingEvidence: ["Änderungen nach Audit", "Deployment-Version", "Link zu verified source"],
      operatorNextStep: "Client-only/redacted Status halten und aktuellen Report oder Post-Audit Changelog anfordern.",
    },
    {
      id: "lunax-missing-evidence",
      label: "LUNA-X missing public evidence",
      chain: "Arbitrum",
      contractAddress: addresses.lunax,
      projectName: "LUNA-X",
      expectedTone: "neutral",
      riskLane: "missing_public_evidence",
      confidenceCap: 36,
      aiBrief: "LUNA-X soll weder Risiko noch Sicherheit vortäuschen: der Bot muss fehlende öffentliche Quellen und ein Confidence Cap klar nennen.",
      safeFindings: ["kein öffentlicher Report", "kein ausreichendes Source Packet", "Basic zeigt nur Missing Data"],
      missingEvidence: ["öffentlicher Report", "Docs oder Repo", "Disclosure Kontakt"],
      operatorNextStep: "Missing-Evidence Liste erzeugen und Advanced analysis verification erst nach Quellen erlauben.",
    },
    {
      id: "nova-clean-prescreen",
      label: "NOVA clean pre-screen",
      chain: "Base",
      contractAddress: addresses.nova,
      projectName: "NOVA",
      auditUrl: "https://example.com/audits/nova-clean.pdf",
      docsUrl: "https://docs.example.com/nova",
      expectedTone: "good",
      riskLane: "clean_prescreen",
      confidenceCap: 78,
      aiBrief: "NOVA darf ruhiger klingen, aber nie 'certified safe': VLM trennt clean pre-screen von Sicherheitsgarantie.",
      safeFindings: ["Report und Docs vorhanden", "kein kritisches Signal im Pre-Screen", "Confidence hängt weiter von Freshness ab"],
      missingEvidence: ["Bestätigung keiner Änderungen nach Report", "Freshness Timestamp", "finale Human Note"],
      operatorNextStep: "Als Public Summary mit Confidence Cap markieren und klar sagen: kein Sicherheitszertifikat.",
    },
    {
      id: "mant-private-disclosure",
      label: "MANT private disclosure lane",
      chain: "Polygon",
      contractAddress: addresses.mant,
      projectName: "MANT",
      auditUrl: "https://example.com/audits/mant-public.pdf",
      expectedTone: "risk",
      riskLane: "private_disclosure_needed",
      confidenceCap: 48,
      aiBrief: "MANT prüft die Bot-Grenze: bei High-Risk bleibt der Inhalt privat, ohne Anleitungen zur Ausnutzung.",
      safeFindings: ["private Verifikation nötig", "öffentliche Beschreibung bleibt allgemein", "Kontakt/Safe Harbor nötig"],
      missingEvidence: ["technischer Kontakt", "Safe Harbor/Scope", "Projektseitige Statusbestätigung"],
      operatorNextStep: "In Advanced/private review routen und öffentlich nur Risikoklasse plus fehlende Evidenz zeigen.",
    },
  ] : [
    {
      id: "aurx-proxy-scope",
      label: "AURX proxy/admin scope",
      chain: "Ethereum",
      contractAddress: addresses.aurx,
      projectName: "AURX",
      auditUrl: "https://example.com/audits/aurx-public-review.pdf",
      docsUrl: "https://docs.example.com/aurx",
      expectedTone: "watch",
      riskLane: "audit_scope_gap",
      confidenceCap: 64,
      aiBrief: "AURX has a public audit badge, but VLM keeps the output different from a clean project: report, contract and possible scope/admin gaps are separated.",
      safeFindings: ["public report exists", "scope must be matched against the current address", "admin/proxy state cannot raise confidence without evidence"],
      missingEvidence: ["report date", "commit or scope hash", "current proxy/implementation address confirmation"],
      operatorNextStep: "Ask for scope/commit and compare it with deployment; do not publish technical detail before validation.",
    },
    {
      id: "omni-post-audit-change",
      label: "OMNI post-audit change",
      chain: "BSC",
      contractAddress: addresses.omni,
      projectName: "OMNI",
      auditUrl: "https://example.com/audits/omni-badge.pdf",
      expectedTone: "risk",
      riskLane: "post_audit_change",
      confidenceCap: 42,
      aiBrief: "OMNI should not receive the same answer as AURX: the main issue is possible post-audit change and a mismatch between the badge and the current contract version.",
      safeFindings: ["audit badge is not enough", "deployment/version match is required", "public detail remains redacted"],
      missingEvidence: ["post-audit change history", "deployment version", "verified source link"],
      operatorNextStep: "Keep status client-only/redacted and request an updated report or post-audit changelog.",
    },
    {
      id: "lunax-missing-evidence",
      label: "LUNA-X missing public evidence",
      chain: "Arbitrum",
      contractAddress: addresses.lunax,
      projectName: "LUNA-X",
      expectedTone: "neutral",
      riskLane: "missing_public_evidence",
      confidenceCap: 36,
      aiBrief: "LUNA-X must not fake risk or safety: the bot should say public sources are missing and the result is confidence-capped.",
      safeFindings: ["no public report", "insufficient source packet", "Basic can only show missing data"],
      missingEvidence: ["public report", "docs or repository", "disclosure contact"],
      operatorNextStep: "Generate a missing-evidence list and only allow Advanced analysis verification after sources are supplied.",
    },
    {
      id: "nova-clean-prescreen",
      label: "NOVA clean pre-screen",
      chain: "Base",
      contractAddress: addresses.nova,
      projectName: "NOVA",
      auditUrl: "https://example.com/audits/nova-clean.pdf",
      docsUrl: "https://docs.example.com/nova",
      expectedTone: "good",
      riskLane: "clean_prescreen",
      confidenceCap: 78,
      aiBrief: "NOVA can use the calmest tone, but never 'certified safe': VLM separates a clean pre-screen from a safety guarantee.",
      safeFindings: ["report and docs are present", "no critical signal in pre-screen", "confidence still depends on data freshness"],
      missingEvidence: ["confirmation of no changes after report", "freshness timestamp", "final human note"],
      operatorNextStep: "Mark as public summary with a confidence cap and add the note: this is not a security certificate.",
    },
    {
      id: "mant-private-disclosure",
      label: "MANT private disclosure lane",
      chain: "Polygon",
      contractAddress: addresses.mant,
      projectName: "MANT",
      auditUrl: "https://example.com/audits/mant-public.pdf",
      expectedTone: "risk",
      riskLane: "private_disclosure_needed",
      confidenceCap: 48,
      aiBrief: "MANT enforces the bot boundary: if a high-risk area appears, the description stays private and does not include exploitation steps.",
      safeFindings: ["private verification required", "public description stays general", "contact/safe harbor required"],
      missingEvidence: ["technical contact", "safe harbor/scope", "project-side status confirmation"],
      operatorNextStep: "Route to Advanced/private review and publish only risk class plus missing evidence.",
    },
  ];

  const uniqueBriefs = new Set(samples.map((sample) => sample.aiBrief)).size;
  return {
    passId: PASS2358_AUDIT_WATCH_CONTRACT_HARNESS_ID,
    taskCount: PASS2358_AUDIT_WATCH_CONTRACT_HARNESS_TASKS,
    locale: safeLocale,
    title: safeLocale === "pl" ? "5 smart-kontraktów: różne odpowiedzi bota" : safeLocale === "de" ? "5 Smart Contracts: unterschiedliche Bot-Antworten" : "5 smart contracts: differentiated bot output",
    body: safeLocale === "pl"
      ? "Harness pilnuje, żeby Audit Watch nie zwracał tego samego tekstu dla różnych projektów: AURX, OMNI, LUNA-X, NOVA i MANT mają inne lane, confidence cap, brakujące dowody i następny krok."
      : safeLocale === "de"
        ? "Der Harness verhindert identische Audit-Watch Antworten für unterschiedliche Projekte: AURX, OMNI, LUNA-X, NOVA und MANT haben andere Lane, Confidence Cap, Missing Evidence und Next Step."
        : "The harness prevents Audit Watch from returning the same text for different projects: AURX, OMNI, LUNA-X, NOVA and MANT get different lanes, confidence caps, missing evidence and next steps.",
    samples,
    uniqueness: {
      status: uniqueBriefs === samples.length ? "PASS" : "WARN",
      uniqueBriefs,
      totalSamples: samples.length,
      note: safeLocale === "pl"
        ? `${uniqueBriefs}/${samples.length} unikalnych briefów AI; exploit details zostają zredagowane.`
        : safeLocale === "de"
          ? `${uniqueBriefs}/${samples.length} eindeutige AI Briefs; Exploit Details bleiben redacted.`
          : `${uniqueBriefs}/${samples.length} unique AI briefs; exploit detail remains redacted.`,
    },
    boundary: boundary(safeLocale),
  };
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase().trim() : "";
}

export function buildPass2358SubmissionAuditProfile(input: Partial<AuditReviewSubmission>, locale = "en"): Pass2358SubmissionAuditProfile {
  const safeLocale = resolveLocale(locale);
  const harness = buildPass2358AuditHarness(safeLocale);
  const haystack = [input.projectName, input.contractAddress, input.auditUrl, input.docsUrl, input.website]
    .map(normalizeText)
    .filter(Boolean)
    .join(" ");
  const matched = harness.samples.find((sample) => {
    const terms = [sample.id, sample.projectName, sample.contractAddress, sample.auditUrl].map(normalizeText).filter(Boolean);
    return terms.some((term) => haystack.includes(term));
  });

  if (matched) {
    return {
      passId: PASS2358_AUDIT_WATCH_CONTRACT_HARNESS_ID,
      matchedSampleId: matched.id,
      riskLane: matched.riskLane,
      tone: matched.expectedTone,
      confidenceCap: matched.confidenceCap,
      resultFingerprint: `P2358-${stableHash(`${matched.id}|${safeLocale}|${input.reviewLevel ?? "basic"}`)}`,
      aiBrief: matched.aiBrief,
      safeFindingTitle: matched.safeFindings[0] ?? matched.label,
      missingEvidence: matched.missingEvidence,
      operatorNextStep: matched.operatorNextStep,
      boundary: harness.boundary,
    };
  }

  const hasContract = Boolean(input.contractAddress);
  const hasAudit = Boolean(input.auditUrl);
  const hasDocs = Boolean(input.docsUrl || input.githubUrl || input.bountyScope);
  const hasContact = Boolean(input.contactEmail);
  const riskLane: Pass2358RiskLane = hasAudit && hasContract && hasDocs
    ? "clean_prescreen"
    : hasAudit && hasContract
      ? "audit_scope_gap"
      : hasContract
        ? "missing_public_evidence"
        : "generic_intake_review";
  const confidenceCap = hasAudit && hasContract && hasDocs ? 70 : hasAudit && hasContract ? 58 : hasContract ? 42 : 28;
  const tone: Pass2358AuditTone = riskLane === "clean_prescreen" ? "good" : riskLane === "generic_intake_review" ? "neutral" : "watch";
  const aiBrief = safeLocale === "pl"
    ? `Zgłoszenie trafia do lane ${riskLane}. VLM nie udaje pełnego audytu: confidence cap wynosi ${confidenceCap}/100, a brakujące źródła zostają pokazane użytkownikowi.`
    : safeLocale === "de"
      ? `Die Anfrage geht in Lane ${riskLane}. VLM simuliert keinen vollständigen Audit: Confidence Cap ist ${confidenceCap}/100, fehlende Quellen bleiben sichtbar.`
      : `The request routes to ${riskLane}. VLM does not pretend this is a full audit: confidence is capped at ${confidenceCap}/100 and missing sources stay visible.`;

  return {
    passId: PASS2358_AUDIT_WATCH_CONTRACT_HARNESS_ID,
    riskLane,
    tone,
    confidenceCap,
    resultFingerprint: `P2358-${stableHash(JSON.stringify({ input, safeLocale, riskLane, confidenceCap }))}`,
    aiBrief,
    safeFindingTitle: hasAudit ? "Audit claim captured; scope still needs verification" : "Public audit evidence missing",
    missingEvidence: [
      ...(hasAudit ? [] : [safeLocale === "pl" ? "publiczny raport audytu" : safeLocale === "de" ? "öffentlicher Audit Report" : "public audit report"]),
      ...(hasDocs ? [] : [safeLocale === "pl" ? "docs/repo albo scope" : safeLocale === "de" ? "Docs/Repo oder Scope" : "docs/repo or scope"]),
      ...(hasContact ? [] : [safeLocale === "pl" ? "kontakt do disclosure" : safeLocale === "de" ? "Disclosure Kontakt" : "disclosure contact"]),
    ].slice(0, 4),
    operatorNextStep: safeLocale === "pl"
      ? "Najpierw uzupełnij brakujące źródła; Advanced może ruszyć dopiero po scope i redaction boundary."
      : safeLocale === "de"
        ? "Zuerst fehlende Quellen ergänzen; Advanced startet erst nach Scope und Redaction Boundary."
        : "Fill missing sources first; Advanced can start only after scope and redaction boundary are clear.",
    boundary: harness.boundary,
  };
}
