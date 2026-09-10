import type { AuditReviewLevel, AuditReviewPreview, AuditReviewSubmission } from "./audit-review-flow";
import { auditTierFromReviewLevel, getAuditTierContract } from "./audit-tier-contract";
import { auditCommercialTruth } from "./audit-commercial-sku-truth";
import { buildPass2358AuditHarness, type Pass2358AuditHarness } from "./audit-watch-contract-harness";

import { sha256Token } from "@/lib/security/cryptographic-digest";
export const PASS2023_VLM_AUDIT_PRODUCT_ID = "vlm-audit-product-account-messages" as const;
export const PASS2023_VLM_AUDIT_PRODUCT_TASKS = 96 as const;

export type VlmAuditLocale = "pl" | "en" | "de";
export type VlmAuditPackageId = "basic_audit" | "pro_audit" | "advanced_audit" | "advanced_human_review";
export type VlmAuditMessageStatus = "received" | "queued" | "payment_pending" | "human_review" | "analysis_queue" | "ready" | "needs_evidence";
export type VlmAuditFindingVisibility = "public_summary" | "client_only" | "redacted_until_disclosure";
export type VlmAuditSignalTone = "good" | "watch" | "risk" | "neutral";

export type VlmAuditPackage = {
  id: VlmAuditPackageId;
  label: string;
  price: string | null;
  headline: string;
  body: string;
  delivery: string;
  cta: string;
  reviewLevel: AuditReviewLevel;
  humanReviewed: boolean;
  requiresPayment: boolean;
  deliverables: string[];
  boundaries: string[];
  commercialMode: "free_automated_informational_prescreen" | "paid_automated_informational_analysis" | "paid_human_reviewed_service";
  saleDecision:
    | "PILOT_ONLY_FREE_LIMITED_PRESCREEN"
    | "INVITATION_ONLY_CONTROLLED_BETA"
    | "NOT_FOR_SALE"
    | "BLOCKED_HUMAN_REVIEW_CLAIM"
    | "BLOCKED_CERTIFICATION_CLAIM"
    | "BLOCKED_PERSONALISED_ADVICE";
  issuedBy: "Velmère Security";
  generatedBy: "Velmère Security Engine";
  humanReviewClaimAllowed: boolean;
};

export type VlmAuditPreviewProject = {
  id: string;
  asset: string;
  chain: string;
  publicAudit: string;
  vlmStatus: string;
  tone: VlmAuditSignalTone;
  visibility: VlmAuditFindingVisibility;
  summary: string;
  safeDetail: string;
};

export type VlmAuditAccountMessage = {
  id: string;
  title: string;
  body: string;
  status: VlmAuditMessageStatus;
  packageLabel: string;
  requestId: string;
  createdAt: string;
  eta: string;
  accountRoute: string;
  nextSteps: string[];
};

export type VlmAuditProductPage = {
  passId: typeof PASS2023_VLM_AUDIT_PRODUCT_ID;
  taskCount: typeof PASS2023_VLM_AUDIT_PRODUCT_TASKS;
  locale: VlmAuditLocale;
  eyebrow: string;
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  searchHelper: string;
  submitBasic: string;
  submitAdvanced: string;
  accountMessageTitle: string;
  accountMessageBody: string;
  priceExplanationTitle: string;
  priceExplanationBody: string;
  humanReviewTitle: string;
  humanReviewBody: string;
  tableTitle: string;
  tableBody: string;
  safetyBoundary: string;
  packages: VlmAuditPackage[];
  previewProjects: VlmAuditPreviewProject[];
  scorecard: { label: string; status: string; percent: number | null; note: string }[];
  auditHarness: Pass2358AuditHarness;
  forbiddenClaims: string[];
  approvedClaims: string[];
};

function resolveLocale(locale: string): VlmAuditLocale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

const approvedClaims = [
  "AI-assisted security review",
  "automated evidence-bound advanced report",
  "issued by Velmère Security",
  "document integrity verified by Velmère",
  "evidence checked",
  "pre-audit intelligence",
  "no custody",
  "no seed phrase",
  "no investment advice",
];

const forbiddenClaims = [
  "certified safe",
  "no risk",
  "guaranteed secure",
  "approved investment",
  "better than every top audit firm",
  "send seed phrase",
  "public exploit instructions",
];

const packagesByLocale = {
  pl: [
    {
      id: "basic_audit",
      label: "Velmère Basic Audit",
      price: null,
      headline: "Audyt przy użyciu technologii VLM.",
      body: "Darmowy, technologiczny pre-audit: VLM Brain sprawdza widoczne ryzyka, publiczny audyt, braki dowodów, scope, źródła i podstawowe sygnały kontraktu.",
      delivery: "Wiadomość na koncie klienta w ciągu 24h.",
      cta: "Basic prescreen — po finalnym reteście",
      reviewLevel: "basic_review",
      humanReviewed: false,
      requiresPayment: false,
      deliverables: ["risk snapshot", "audit claim check", "missing evidence", "public-source confidence", "account message"],
      boundaries: ["technologia VLM", "bez exploita", "bez gwarancji bezpieczeństwa", "bez porad inwestycyjnych"],
      commercialMode: "free_automated_informational_prescreen",
      saleDecision: "PILOT_ONLY_FREE_LIMITED_PRESCREEN",
      issuedBy: "Velmère Security",
      generatedBy: "Velmère Security Engine",
      humanReviewClaimAllowed: false,
    },
    {
      id: "advanced_audit",
      label: "Velmère Advanced Audit",
      price: null,
      headline: "Najszersza automatyczna analiza informacyjna Velmère.",
      body: "Pakiet Advanced rozszerza Pro o konsensus między narzędziami, różnicę artefaktów kompilatora, porównanie ryzyko-remediacja, rejestr sprzeczności, priorytetyzację napraw, retesty oraz podpis integralności dokumentu Velmère Security.",
      delivery: "Automatyczny raport evidence-bound trafia do konta po przejściu bramek danych i entitlementu.",
      cta: "Advanced — niedostępny",
      reviewLevel: "advanced_review",
      humanReviewed: false,
      requiresPayment: false,
      deliverables: ["advanced automated report", "cross-tool consensus", "compiler artifact diff", "risk-to-control remediation delta", "blind adjudication packet", "prioritised remediation and retests", "Velmère document integrity seal"],
      boundaries: ["automated informational analysis", "bez human-review claim", "bez niezależnej certyfikacji", "bez gwarancji bezpieczeństwa"],
      commercialMode: "paid_automated_informational_analysis",
      saleDecision: "NOT_FOR_SALE",
      issuedBy: "Velmère Security",
      generatedBy: "Velmère Security Engine",
      humanReviewClaimAllowed: false,
    },
    {
      id: "pro_audit",
      label: "Velmère Pro Audit",
      price: null,
      headline: "Głębszy raport automatyczny + PDF evidence trace.",
      body: "Pakiet Pro: więcej źródeł, evidence trace, PDF, source freshness, provider conflict i pełniejsza lista braków. W produkcji wymaga entitlement; w podglądzie pokazuje zakres raportu.",
      delivery: "Podgląd zakresu w UI; pełny raport produkcyjnie po koncie/entitlement.",
      cta: "Pro — beta tylko na zaproszenie",
      reviewLevel: "pro_review",
      humanReviewed: false,
      requiresPayment: false,
      deliverables: ["PDF evidence trace", "source quorum", "provider conflict", "freshness warning", "missing evidence"],
      boundaries: ["preview boundary", "bez aktywnego pentestu", "no guarantee", "no investment advice"],
      commercialMode: "paid_automated_informational_analysis",
      saleDecision: "INVITATION_ONLY_CONTROLLED_BETA",
      issuedBy: "Velmère Security",
      generatedBy: "Velmère Security Engine",
      humanReviewClaimAllowed: false,
    },
  ],
  en: [
    {
      id: "basic_audit",
      label: "Velmère Basic Audit",
      price: null,
      headline: "Audit powered by VLM technology.",
      body: "A free technology-driven pre-audit: VLM Brain checks visible risks, public audit claims, missing evidence, scope, sources and basic contract signals.",
      delivery: "Message delivered to the client account within 24h.",
      cta: "Basic prescreen — after final retest",
      reviewLevel: "basic_review",
      humanReviewed: false,
      requiresPayment: false,
      deliverables: ["risk snapshot", "audit claim check", "missing evidence", "public-source confidence", "account message"],
      boundaries: ["VLM technology", "no exploit detail", "no safety guarantee", "no investment advice"],
      commercialMode: "free_automated_informational_prescreen",
      saleDecision: "PILOT_ONLY_FREE_LIMITED_PRESCREEN",
      issuedBy: "Velmère Security",
      generatedBy: "Velmère Security Engine",
      humanReviewClaimAllowed: false,
    },
    {
      id: "advanced_audit",
      label: "Velmère Advanced Audit",
      price: null,
      headline: "Velmère's deepest automated informational analysis.",
      body: "Advanced extends Pro with cross-tool consensus, compiler-artifact diff, risk-to-control remediation delta, a contradiction register, prioritised remediation, retests and a Velmère Security document-integrity seal.",
      delivery: "The automated evidence-bound report is delivered to the account after data and entitlement gates pass.",
      cta: "Advanced — not for sale",
      reviewLevel: "advanced_review",
      humanReviewed: false,
      requiresPayment: false,
      deliverables: ["advanced automated report", "cross-tool consensus", "compiler artifact diff", "risk-to-control remediation delta", "blind adjudication packet", "prioritised remediation and retests", "Velmère document integrity seal"],
      boundaries: ["automated informational analysis", "no human-review claim", "no independent certification", "no safety guarantee"],
      commercialMode: "paid_automated_informational_analysis",
      saleDecision: "NOT_FOR_SALE",
      issuedBy: "Velmère Security",
      generatedBy: "Velmère Security Engine",
      humanReviewClaimAllowed: false,
    },
    {
      id: "pro_audit",
      label: "Velmère Pro Audit",
      price: null,
      headline: "Deeper automated report + PDF evidence trace.",
      body: "Pro package: more sources, evidence trace, PDF, source freshness, provider conflict and a deeper missing-evidence list. Production requires entitlement; preview shows report scope.",
      delivery: "UI scope preview; production delivery uses account/entitlement.",
      cta: "Pro — invitation-only beta",
      reviewLevel: "pro_review",
      humanReviewed: false,
      requiresPayment: false,
      deliverables: ["PDF evidence trace", "source quorum", "provider conflict", "freshness warning", "missing evidence"],
      boundaries: ["preview boundary", "no active pentest", "no guarantee", "no investment advice"],
      commercialMode: "paid_automated_informational_analysis",
      saleDecision: "INVITATION_ONLY_CONTROLLED_BETA",
      issuedBy: "Velmère Security",
      generatedBy: "Velmère Security Engine",
      humanReviewClaimAllowed: false,
    },
  ],
  de: [
    {
      id: "basic_audit",
      label: "Velmère Basic Audit",
      price: null,
      headline: "Audit mit VLM Technologie.",
      body: "Ein kostenloser technologiegestützter Pre-Audit: VLM Brain prüft sichtbare Risiken, öffentliche Audit Claims, Missing Evidence, Scope, Quellen und Basis-Contract-Signale.",
      delivery: "Nachricht im Kundenkonto innerhalb von 24h.",
      cta: "Basic-Prescreen — nach finalem Retest",
      reviewLevel: "basic_review",
      humanReviewed: false,
      requiresPayment: false,
      deliverables: ["risk snapshot", "audit claim check", "missing evidence", "public-source confidence", "account message"],
      boundaries: ["VLM technology", "keine Exploit-Details", "keine Sicherheitsgarantie", "keine Anlageberatung"],
      commercialMode: "free_automated_informational_prescreen",
      saleDecision: "PILOT_ONLY_FREE_LIMITED_PRESCREEN",
      issuedBy: "Velmère Security",
      generatedBy: "Velmère Security Engine",
      humanReviewClaimAllowed: false,
    },
    {
      id: "advanced_audit",
      label: "Velmère Advanced Audit",
      price: null,
      headline: "Die tiefste automatisierte Informationsanalyse von Velmère.",
      body: "Advanced erweitert Pro um werkzeugübergreifenden Konsens, Compiler-Artefakt-Differenz, Risiko-Abhilfe-Vergleich, ein Widerspruchsregister, priorisierte Maßnahmen, Retests und ein Velmère-Security-Dokumentintegritätssiegel.",
      delivery: "Der automatisierte evidenzgebundene Report wird nach bestandenen Daten- und Entitlement-Gates ins Konto geliefert.",
      cta: "Advanced — nicht verfügbar",
      reviewLevel: "advanced_review",
      humanReviewed: false,
      requiresPayment: false,
      deliverables: ["advanced automated report", "cross-tool consensus", "compiler artifact diff", "risk-to-control remediation delta", "blind adjudication packet", "prioritised remediation and retests", "Velmère document integrity seal"],
      boundaries: ["automated informational analysis", "kein Human-Review-Claim", "keine unabhängige Zertifizierung", "keine Sicherheitsgarantie"],
      commercialMode: "paid_automated_informational_analysis",
      saleDecision: "NOT_FOR_SALE",
      issuedBy: "Velmère Security",
      generatedBy: "Velmère Security Engine",
      humanReviewClaimAllowed: false,
    },
    {
      id: "pro_audit",
      label: "Velmère Pro Audit",
      price: null,
      headline: "Tieferer automatisierter Report + PDF Evidence Trace.",
      body: "Pro Paket: mehr Quellen, Evidence Trace, PDF, Source Freshness, Provider Conflict und tiefere Missing-Evidence Liste. Produktion erfordert Entitlement; Preview zeigt den Report-Scope.",
      delivery: "UI Scope Preview; Produktion nutzt Konto/Entitlement.",
      cta: "Pro — Beta nur auf Einladung",
      reviewLevel: "pro_review",
      humanReviewed: false,
      requiresPayment: false,
      deliverables: ["PDF evidence trace", "source quorum", "provider conflict", "freshness warning", "missing evidence"],
      boundaries: ["preview boundary", "kein aktiver Pentest", "keine Garantie", "keine Anlageberatung"],
      commercialMode: "paid_automated_informational_analysis",
      saleDecision: "INVITATION_ONLY_CONTROLLED_BETA",
      issuedBy: "Velmère Security",
      generatedBy: "Velmère Security Engine",
      humanReviewClaimAllowed: false,
    },
  ],
} satisfies Record<VlmAuditLocale, VlmAuditPackage[]>;

const previewProjectsByLocale = {
  pl: [
    ["AURX", "Ethereum", "Public audit found", "Additional review points", "watch", "Publiczny audyt istnieje, ale VLM oznacza możliwe braki w zakresie proxy/admin.", "Szczegóły techniczne ukryte do walidacji i responsible disclosure."],
    ["OMNI", "BSC", "Audit badge found", "Scope mismatch", "risk", "Badge audytu nie wystarcza, jeżeli deployment lub moduły po audycie nie pasują do raportu.", "Pokazujemy klasę ryzyka, nie instrukcję wykorzystania."],
    ["LUNA-X", "Arbitrum", "No public audit confirmed", "Needs evidence", "neutral", "Nie znaleziono wystarczającego publicznego śladu audytu dla pełnego confidence.", "Basic może wskazać missing data, Advanced wymaga źródeł."],
    ["NOVA", "Base", "Public audit found", "Clean pre-screen", "good", "Nie wykryto krytycznego sygnału w publicznym pre-screenie, ale to nie jest gwarancja bezpieczeństwa.", "Confidence zostaje ograniczony przez dostępność danych."],
    ["MANT", "Polygon", "Audit found", "Disclosure pending", "risk", "VLM oznacza obszar wymagający prywatnej weryfikacji przed publikacją szczegółów.", "Najpierw kontakt/scope, potem ewentualny publiczny status."],
  ],
  en: [
    ["AURX", "Ethereum", "Public audit found", "Additional review points", "watch", "A public audit exists, but VLM flags possible proxy/admin coverage gaps.", "Technical detail stays hidden until validation and responsible disclosure."],
    ["OMNI", "BSC", "Audit badge found", "Scope mismatch", "risk", "An audit badge is not enough if deployment or later modules do not match the report.", "We show the risk class, not exploit instructions."],
    ["LUNA-X", "Arbitrum", "No public audit confirmed", "Needs evidence", "neutral", "No sufficient public audit trail was found for full confidence.", "Basic can show missing data; Advanced requires source evidence."],
    ["NOVA", "Base", "Public audit found", "Clean pre-screen", "good", "No critical signal was detected in the public pre-screen, but this is not a safety guarantee.", "Confidence remains capped by data availability."],
    ["MANT", "Polygon", "Audit found", "Disclosure pending", "risk", "VLM flags an area that requires private verification before public detail.", "Contact/scope first, then possible public status."],
  ],
  de: [
    ["AURX", "Ethereum", "Public audit found", "Additional review points", "watch", "Ein öffentlicher Audit existiert, aber VLM markiert mögliche Proxy/Admin Scope Gaps.", "Technische Details bleiben bis Validierung und Responsible Disclosure verborgen."],
    ["OMNI", "BSC", "Audit badge found", "Scope mismatch", "risk", "Ein Audit Badge reicht nicht, wenn Deployment oder spätere Module nicht zum Report passen.", "Wir zeigen die Risikoklasse, nicht die Exploit-Anleitung."],
    ["LUNA-X", "Arbitrum", "No public audit confirmed", "Needs evidence", "neutral", "Kein ausreichender öffentlicher Audit-Trail für volles Confidence gefunden.", "Basic zeigt Missing Data; Advanced braucht Source Evidence."],
    ["NOVA", "Base", "Public audit found", "Clean pre-screen", "good", "Kein kritisches Signal im öffentlichen Pre-Screen erkannt, aber keine Sicherheitsgarantie.", "Confidence bleibt durch Datenverfügbarkeit begrenzt."],
    ["MANT", "Polygon", "Audit found", "Disclosure pending", "risk", "VLM markiert einen Bereich, der private Verifikation vor öffentlichen Details braucht.", "Erst Kontakt/Scope, dann möglicher Public Status."],
  ],
} satisfies Record<VlmAuditLocale, readonly (readonly [string, string, string, string, VlmAuditSignalTone, string, string])[]>;

const copy = {
  pl: {
    eyebrow: "Velmère Audit",
    title: "Czysty audyt technologiczny z wiadomością na koncie.",
    subtitle: "Wklej kontrakt, token albo publiczny raport. Basic jest darmowym prescreenem, Pro i Advanced są automatycznymi analizami informacyjnymi o rosnącej głębokości dowodów.",
    searchPlaceholder: "Wklej adres kontraktu, nazwę tokena albo link do publicznego audytu…",
    searchHelper: "Bez seed phrase, bez custody, bez publicznych instrukcji exploita. Wynik trafia do konta klienta.",
    submitBasic: "Basic Audit — Free",
    submitAdvanced: "Advanced — niedostępny",
    accountMessageTitle: "Wiadomość na koncie klienta",
    accountMessageBody: "Po wysłaniu zgłoszenia klient dostaje status w koncie. Basic uruchamia prescreen, a Pro i Advanced przechodzą automatyczne bramki danych, entitlementu i raportu.",
    priceExplanationTitle: "Co Advanced dodaje ponad Pro?",
    priceExplanationBody: "Advanced jest automatyczną analizą informacyjną: dodaje cztery warstwy dowodowe ponad Pro — konsensus między narzędziami, różnicę artefaktów kompilatora, surową różnicę outputów ryzyko-kontrola oraz lokalną reprodukcję wdrożonego bytecode’u — i kompletny neutralny bundle do przyszłej niezależnej adjudykacji. Nie zawiera manual QA ani niezależnej certyfikacji.",
    humanReviewTitle: "Automatyzacja + granica prawdy",
    humanReviewBody: "VLM Brain znajduje sygnały, Shadow Brain je podważa, a Evidence Quorum ocenia źródła. Podpis Velmère potwierdza wystawcę i integralność dokumentu, nie review człowieka ani bezpieczeństwo celu.",
    tableTitle: "VLM Brain: przykładowe 5 projektów",
    tableBody: "Tabela pokazuje, że sam znaczek audited nie wystarcza. VLM może oznaczyć braki scope, stare dane albo obszar do prywatnej weryfikacji bez publikowania exploita.",
    safetyBoundary: "Velmère Audit nie jest gwarancją bezpieczeństwa, certyfikacją regulacyjną ani poradą inwestycyjną.",
  },
  en: {
    eyebrow: "Velmère Audit",
    title: "Clean technology audit with account delivery.",
    subtitle: "Paste a contract, token or public audit report. Basic is a free prescreen; Pro and Advanced are automated informational analyses with increasing evidence depth.",
    searchPlaceholder: "Paste contract address, token name or public audit link…",
    searchHelper: "No seed phrase, no custody, no public exploit instructions. The result is delivered to the client account.",
    submitBasic: "Basic Audit — Free",
    submitAdvanced: "Advanced — not for sale",
    accountMessageTitle: "Client account message",
    accountMessageBody: "After submission, the client receives an account status. Basic starts a prescreen; Pro and Advanced pass automated data, entitlement and report gates.",
    priceExplanationTitle: "What does Advanced add over Pro?",
    priceExplanationBody: "Advanced is an automated informational analysis. It adds four evidence layers over Pro — cross-tool consensus, compiler-artifact diff, raw risk-to-control tool-output delta and local deployed-bytecode reproduction — plus a complete neutral-source bundle for future independent adjudication. It does not include manual QA or independent certification.",
    humanReviewTitle: "Automation + truth boundary",
    humanReviewBody: "VLM Brain finds signals, Shadow Brain challenges them and Evidence Quorum scores sources. The Velmère issuer mark verifies document origin and integrity, not manual QA or target safety.",
    tableTitle: "VLM Brain: sample 5 projects",
    tableBody: "The table shows that an audited badge is not enough. VLM can flag scope gaps, stale evidence or private verification areas without publishing exploit detail.",
    safetyBoundary: "Velmère Audit is not a safety guarantee, regulatory certification or investment advice.",
  },
  de: {
    eyebrow: "Velmère Audit",
    title: "Cleaner Technologie-Audit mit Konto-Lieferung.",
    subtitle: "Contract, Token oder öffentlichen Audit Report einfügen. Basic ist ein kostenloser Prescreen; Pro und Advanced sind automatisierte Informationsanalysen mit wachsender Evidenztiefe.",
    searchPlaceholder: "Contract address, Token Name oder Public Audit Link einfügen…",
    searchHelper: "Keine Seed Phrase, kein Custody, keine öffentlichen Exploit-Anleitungen. Das Ergebnis kommt ins Kundenkonto.",
    submitBasic: "Basic Audit — Free",
    submitAdvanced: "Advanced — nicht verfügbar",
    accountMessageTitle: "Kundennachricht im Konto",
    accountMessageBody: "Nach Absenden erhält der Kunde einen Kontostatus. Basic startet den Prescreen; Pro und Advanced durchlaufen automatisierte Daten-, Entitlement- und Report-Gates.",
    priceExplanationTitle: "Was fügt Advanced gegenüber Pro hinzu?",
    priceExplanationBody: "Advanced ist eine automatisierte Informationsanalyse. Sie ergänzt vier Evidenzschichten über Pro hinaus — werkzeugübergreifenden Konsens, Compiler-Artefakt-Differenz, rohe Risiko-Kontroll-Tooloutput-Differenz und lokale Reproduktion des bereitgestellten Bytecodes — sowie ein vollständiges neutrales Bundle für eine spätere unabhängige Adjudikation. Manual QA und unabhängige Zertifizierung sind nicht enthalten.",
    humanReviewTitle: "Automatisierung + Wahrheitsgrenze",
    humanReviewBody: "VLM Brain findet Signale, Shadow Brain prüft dagegen und Evidence Quorum bewertet Quellen. Die Velmère-Ausstellerkennzeichnung bestätigt Ursprung und Integrität des Dokuments, nicht Manual QA oder Zielsicherheit.",
    tableTitle: "VLM Brain: 5 Beispielprojekte",
    tableBody: "Die Tabelle zeigt: ein Audit Badge reicht nicht. VLM kann Scope Gaps, veraltete Evidenz oder private Verifikationsbereiche markieren, ohne Exploit-Details zu veröffentlichen.",
    safetyBoundary: "Velmère Audit ist keine Sicherheitsgarantie, regulatorische Zertifizierung oder Anlageberatung.",
  },
} satisfies Record<VlmAuditLocale, Omit<VlmAuditProductPage, "passId" | "taskCount" | "locale" | "packages" | "previewProjects" | "scorecard" | "auditHarness" | "forbiddenClaims" | "approvedClaims">>;

function previewProjects(locale: VlmAuditLocale): VlmAuditPreviewProject[] {
  return previewProjectsByLocale[locale].map(([asset, chain, publicAudit, vlmStatus, tone, summary, safeDetail]) => ({
    id: `${asset.toLowerCase()}-${chain.toLowerCase()}`,
    asset,
    chain,
    publicAudit,
    vlmStatus,
    tone,
    visibility: tone === "risk" ? "redacted_until_disclosure" : tone === "watch" ? "client_only" : "public_summary",
    summary,
    safeDetail,
  }));
}

export function buildVlmAuditProductPage(locale = "en"): VlmAuditProductPage {
  const safeLocale = resolveLocale(locale);
  const scorecardByLocale: Record<VlmAuditLocale, { label: string; status: string; percent: number | null; note: string }[]> = {
    pl: [
      { label: "Basic — status dowodów", status: "NOT_CALIBRATED", percent: null, note: "Średnia 0,52 findingu i 1,42 rodziny dowodów; darmowy prescreen, bez numerycznej pewności i bez claimu realnego audytu." },
      { label: "Pro — status dowodów", status: "NOT_CALIBRATED", percent: null, note: "Cztery oficjalne rodziny narzędzi, pełna tabela dowodów i mapa napraw; beta tylko na zaproszenie z manualnym QA, bez publicznej sprzedaży." },
      { label: "Advanced — status dowodów", status: "NOT_CALIBRATED", percent: null, note: "Advanced ma dodatkowe warstwy analizy, ale pozostaje NOT_FOR_SALE do niezależnej adjudykacji, realnego korpusu i wyników klientów." },
      { label: "PDF — techniczne QA", status: "MEASURED", percent: 100, note: "150/150 dokumentów, 700/700 stron, 0 aktywnej zawartości i 4418/4418 powiązań tool→tier→PDF." },
      { label: "Browser — lokalny fixture", status: "MEASURED", percent: 100, note: "57/57 scenariuszy i 29 screenshotów bez błędów; to nie jest dowód aktualnych danych providerów." },
      { label: "Aktualne dane providerów", status: "MEASURED", percent: 0, note: "Shield 0/318, Shield Pro/Map 0/318 i Real Markets 0/583 z pełnym real-evidence credit." },
      { label: "Dowód klienta", status: "MEASURED", percent: 0, note: "0/50 real customer PDF i 0/2 kohort; publiczna sprzedaż Pro/Advanced pozostaje zablokowana." },
    ],
    en: [
      { label: "Basic — evidence status", status: "NOT_CALIBRATED", percent: null, note: "Average 0.52 findings and 1.42 evidence families; a free prescreen with no numeric certainty and no real-audit claim." },
      { label: "Pro — evidence status", status: "NOT_CALIBRATED", percent: null, note: "Four official tool families, full evidence table and remediation map; invitation-only beta with mandatory manual QA, not open public sale." },
      { label: "Advanced — evidence status", status: "NOT_CALIBRATED", percent: null, note: "Advanced has additional analysis layers but remains NOT_FOR_SALE until independent adjudication, a real corpus and customer outcomes exist." },
      { label: "PDF — technical QA", status: "MEASURED", percent: 100, note: "150/150 documents, 700/700 pages, zero active content and 4418/4418 tool→tier→PDF bindings." },
      { label: "Browser — local fixture", status: "MEASURED", percent: 100, note: "57/57 scenarios and 29 screenshots without errors; this is not current-provider evidence." },
      { label: "Current provider evidence", status: "MEASURED", percent: 0, note: "Shield 0/318, Shield Pro/Map 0/318 and Real Markets 0/583 with complete real-evidence credit." },
      { label: "Customer proof", status: "MEASURED", percent: 0, note: "0/50 real customer PDFs and 0/2 cohorts; open Pro/Advanced sale remains blocked." },
    ],
    de: [
      { label: "Basic — Evidenzstatus", status: "NOT_CALIBRATED", percent: null, note: "Durchschnittlich 0,52 Findings und 1,42 Evidenzfamilien; kostenloser Prescreen ohne numerische Sicherheit und ohne Real-Audit-Claim." },
      { label: "Pro — Evidenzstatus", status: "NOT_CALIBRATED", percent: null, note: "Vier offizielle Tool-Familien, vollständige Evidenztabelle und Maßnahmenkarte; Beta nur auf Einladung mit verpflichtendem manuellem QA, kein offener Verkauf." },
      { label: "Advanced — Evidenzstatus", status: "NOT_CALIBRATED", percent: null, note: "Advanced enthält zusätzliche Analyseschichten, bleibt aber bis zu unabhängiger Adjudikation, realem Korpus und Kundenergebnissen NOT_FOR_SALE." },
      { label: "PDF — technisches QA", status: "MEASURED", percent: 100, note: "150/150 Dokumente, 700/700 Seiten, keine aktiven Inhalte und 4418/4418 Tool→Tier→PDF-Bindungen." },
      { label: "Browser — lokales Fixture", status: "MEASURED", percent: 100, note: "57/57 Szenarien und 29 Screenshots ohne Fehler; kein Nachweis aktueller Providerdaten." },
      { label: "Aktuelle Provider-Evidenz", status: "MEASURED", percent: 0, note: "Shield 0/318, Shield Pro/Map 0/318 und Real Markets 0/583 mit vollständigem Real-Evidence-Credit." },
      { label: "Kundennachweis", status: "MEASURED", percent: 0, note: "0/50 echte Kunden-PDFs und 0/2 Kohorten; offener Pro/Advanced-Verkauf bleibt blockiert." },
    ],
  };
  const scorecard = scorecardByLocale[safeLocale];

  return {
    passId: PASS2023_VLM_AUDIT_PRODUCT_ID,
    taskCount: PASS2023_VLM_AUDIT_PRODUCT_TASKS,
    locale: safeLocale,
    ...copy[safeLocale],
    packages: [...packagesByLocale[safeLocale]]
      .map((pkg) => {
        const tier = auditTierFromReviewLevel(pkg.reviewLevel);
        const contract = getAuditTierContract(tier);
        return {
          ...pkg,
          id: contract.packageId,
          price: contract.price?.label ?? null,
          humanReviewed: contract.humanReviewRequired,
          requiresPayment: contract.publicCheckoutAllowed === true && contract.entitlementRequired,
          commercialMode: contract.commercialMode,
          saleDecision: auditCommercialTruth(tier).decision,
          issuedBy: auditCommercialTruth(tier).issuedBy,
          generatedBy: auditCommercialTruth(tier).generatedBy,
          humanReviewClaimAllowed: contract.humanReviewClaimAllowed,
        } satisfies VlmAuditPackage;
      })
      .sort((left, right) => {
        const order: VlmAuditPackageId[] = ["basic_audit", "pro_audit", "advanced_audit", "advanced_human_review"];
        return order.indexOf(left.id) - order.indexOf(right.id);
      }),
    previewProjects: previewProjects(safeLocale),
    scorecard,
    auditHarness: buildPass2358AuditHarness(safeLocale),
    forbiddenClaims,
    approvedClaims,
  };
}

export function packageForReviewLevel(level: AuditReviewLevel | undefined, locale = "en"): VlmAuditPackage {
  const page = buildVlmAuditProductPage(locale);
  const tier = auditTierFromReviewLevel(level);
  const packageId = getAuditTierContract(tier).packageId;
  return page.packages.find((pkg) => pkg.id === packageId) ?? page.packages[0];
}

function stableHash(input: string): string {
  return sha256Token(input, 24).toUpperCase();
}

export function buildVlmAuditAccountMessage(args: {
  locale?: string;
  submission: Partial<AuditReviewSubmission>;
  preview?: AuditReviewPreview;
  now?: Date;
}): VlmAuditAccountMessage {
  const safeLocale = resolveLocale(args.locale ?? "en");
  const pkg = packageForReviewLevel(args.submission.reviewLevel, safeLocale);
  const now = args.now ?? new Date();
  const requestId = args.preview?.requestId ?? `VLM-AUD-${now.getUTCFullYear()}-${stableHash(JSON.stringify(args.submission))}`;
  const project = args.submission.projectName || args.submission.contractAddress || (safeLocale === "pl" ? "zgłoszenie audytu" : "audit request");
  const tier = auditTierFromReviewLevel(args.submission.reviewLevel);
  const eta = tier === "advanced"
    ? (safeLocale === "pl" ? "niedostępny w publicznej dostawie" : safeLocale === "de" ? "nicht für öffentliche Bereitstellung verfügbar" : "not available for public delivery")
    : tier === "pro"
      ? (safeLocale === "pl" ? "beta tylko na zaproszenie, po wewnętrznym QA" : safeLocale === "de" ? "Beta nur auf Einladung, nach interner Qualitätsprüfung" : "invitation-only beta after internal QA")
      : (safeLocale === "pl" ? "do 24h po finalnym reteście przeglądarkowym" : safeLocale === "de" ? "innerhalb von 24h nach finalem Browser-Retest" : "within 24h after the final browser retest");

  const title = safeLocale === "pl"
    ? `${pkg.label}: ${project}`
    : safeLocale === "de"
      ? `${pkg.label}: ${project}`
      : `${pkg.label}: ${project}`;
  const body = safeLocale === "pl"
    ? `${pkg.label} został przyjęty. ${tier === "advanced" ? "Advanced nie jest dostępny w publicznej dostawie ani sprzedaży." : tier === "pro" ? "Pro działa wyłącznie jako beta na zaproszenie; publiczny checkout nie został uruchomiony." : "Wynik pojawi się jako wiadomość na koncie klienta po finalnym reteście przeglądarkowym."} Raport nie jest gwarancją bezpieczeństwa i nie zawiera publicznych instrukcji wykorzystania luk.`
    : safeLocale === "de"
      ? `${pkg.label} wurde angenommen. ${tier === "advanced" ? "Advanced ist nicht für öffentliche Bereitstellung oder Verkauf verfügbar." : tier === "pro" ? "Pro ist nur als Beta auf Einladung verfügbar; kein öffentlicher Checkout wurde gestartet." : "Das Ergebnis erscheint nach dem finalen Browser-Retest als Kontonachricht."} Der Report ist keine Sicherheitsgarantie und enthält keine öffentlichen Exploit-Anleitungen.`
      : `${pkg.label} was received. ${tier === "advanced" ? "Advanced is not available for public delivery or sale." : tier === "pro" ? "Pro is invitation-only; no public checkout was started." : "The result will appear as an account message after the final browser retest."} The report is not a safety guarantee and does not include public exploit instructions.`;

  return {
    id: `msg-${requestId.toLowerCase()}`,
    title,
    body,
    status: tier === "basic" ? "queued" : "needs_evidence",
    packageLabel: pkg.label,
    requestId,
    createdAt: now.toISOString(),
    eta,
    accountRoute: `/${safeLocale}/account?tab=messages`,
    nextSteps: tier === "advanced"
      ? ["not for sale", "independent adjudication required", "real protocol corpus required", "customer delivery remains blocked"]
      : tier === "pro"
        ? ["invitation-only admission", "mandatory internal QA", "source and ABI verification", "private beta delivery only"]
        : ["VLM technology prescreen", "evidence completeness check", "missing evidence list", "account delivery after final browser retest"],
  };
}

export function buildDefaultAuditAccountMessages(locale = "en"): VlmAuditAccountMessage[] {
  const safeLocale = resolveLocale(locale);
  return [
    buildVlmAuditAccountMessage({
      locale: safeLocale,
      now: new Date("2026-06-14T08:00:00.000Z"),
      submission: {
        projectName: safeLocale === "pl" ? "Przykładowy Basic Audit" : "Sample Basic Audit",
        chain: "ethereum",
        reviewLevel: "basic_review",
      },
    }),
    buildVlmAuditAccountMessage({
      locale: safeLocale,
      now: new Date("2026-06-14T09:30:00.000Z"),
      submission: {
        projectName: safeLocale === "pl" ? "Przykładowy Advanced Audit" : "Sample Advanced Audit",
        chain: "base",
        reviewLevel: "advanced_review",
      },
    }),
  ];
}


// PASS36 A102R44P10: public audit package data is stop-sold for Pro/Advanced and numeric tier confidence is forbidden.


/* PASS2772: product package copy keeps preview language and real paid boundaries. */


/* PASS2773: product naming moved from PreviewProject to PreviewProject for customer-facing audit accuracy. */


/* PASS2775: stale preview naming scrubbed from audit product file comments/copy. */
