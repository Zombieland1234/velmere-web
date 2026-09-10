import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";

export const PASS36_R44P22_AUDIT_TIER_PREVIEW_ID =
  "velmere.pass36.a102r44p22.server-redacted-audit-tier-preview.v1" as const;

export type AuditPaidPreviewTier = "pro" | "advanced";
export type AuditPaidPreviewLocale = "pl" | "en" | "de";

type PreviewFinding = Readonly<{
  previewFindingId: string;
  severity: "HIGH_EXAMPLE" | "MEDIUM_EXAMPLE";
  title: string;
  summary: string;
  evidenceState: "EXAMPLE_ONLY_NOT_CASE_EVIDENCE";
  sourceLocation: "WITHHELD_FROM_PREVIEW";
  exploitDetails: "WITHHELD_FROM_PREVIEW";
  remediation: string;
}>;

export type AuditPaidTierPreview = Readonly<{
  schemaVersion: typeof PASS36_R44P22_AUDIT_TIER_PREVIEW_ID;
  artifactClass: "SERVER_REDACTED_TIER_PREVIEW";
  previewOnly: true;
  tier: AuditPaidPreviewTier;
  locale: AuditPaidPreviewLocale;
  watermark: "PREVIEW";
  fullContentIncluded: false;
  hiddenFullContentPresent: false;
  criticalDetailsWithheld: true;
  publicPrice: null;
  billingModel: "NOT_PUBLISHED";
  publicCheckoutAllowed: false;
  saleEnabled: false;
  productState: "INVITATION_ONLY_CONTROLLED_BETA" | "NOT_FOR_SALE";
  humanReviewIncluded: false;
  internalQualityControl: "REQUIRED_BEFORE_CONTROLLED_BETA_DELIVERY" | "NOT_AVAILABLE_PRODUCT";
  structure: Readonly<{
    includedInBasic: readonly string[];
    additionalSections: readonly string[];
    additionalSectionCount: number;
    professionalWorkflow: readonly string[];
  }>;
  severityOverview: Readonly<{
    purpose: "STRUCTURE_EXAMPLE_NOT_REPORT_RESULT";
    levelsShown: readonly ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"];
    countsWithheld: true;
  }>;
  exampleFinding: PreviewFinding;
  valueDelta: readonly string[];
  provenanceClasses: readonly string[];
  unavailableData: readonly string[];
  limitations: readonly string[];
  guaranteesNotProvided: readonly string[];
  safeNextStep: string;
  policyVersion: "R44P22_PREVIEW_POLICY_2026_08_06";
  previewDigest: string;
}>;

const COPY = {
  pl: {
    basic: [
      "Automatyczna analiza wstępna i jasne ograniczenia",
      "Podsumowanie ryzyka bez gwarancji bezpieczeństwa",
      "Lista dowodów oraz brakujących informacji",
    ],
    proSections: [
      "Rozszerzony rejestr ustaleń i pochodzenia dowodów",
      "Zgodność narzędzi oraz rejestr sprzeczności",
      "Plan naprawczy i kontrola jakości przed dostarczeniem w becie",
      "Dodatek techniczny z wiązaniem artefaktów",
    ],
    advancedSections: [
      "Porównanie wersji kontraktu i układu pamięci",
      "Rozszerzone pakiety dowodowe i historia zmian",
      "Pakiet do niezależnego rozstrzygnięcia",
      "Praca zespołowa, ponowny audyt i podpisana autentyczność — stan docelowy",
    ],
    workflowsPro: ["Eksport raportu", "Rejestr brakujących dowodów", "Kontrolowany ponowny audyt"],
    workflowsAdvanced: ["Porównania wielu wersji", "Pakiet do niezależnego rozstrzygnięcia", "Praca zespołowa — jeszcze zablokowana"],
    exampleTitle: "Przykładowa kontrola uprawnień wymaga weryfikacji",
    exampleSummary: "To zredagowany przykład struktury ustalenia. Nie pochodzi z raportu klienta i nie ujawnia kodu, adresu ani szczegółów wykorzystania.",
    remediation: "Zweryfikuj kontrolę dostępu i dołącz test negatywny przed ponowną analizą.",
    safeNext: "Użyj darmowego Basic albo poproś o zaproszenie do kontrolowanej bety Pro. Advanced nie jest obecnie sprzedawany.",
    limits: [
      "Podgląd nie jest wynikiem audytu konkretnego projektu.",
      "Pełne ustalenia, kod, lokalizacje i szczegóły krytyczne są trwale usunięte.",
      "Pewność ustalenia nie jest kalibrowanym prawdopodobieństwem.",
      "Brak ustalenia nie oznacza bezpieczeństwa kontraktu.",
    ],
    noGuarantees: ["Brak gwarancji bezpieczeństwa", "Brak certyfikacji", "Brak gwarancji wyniku inwestycyjnego"],
    unavailable: [
      "Niezatwierdzone pola dostawcy danych są ukryte.",
      "Niezależne rozstrzygnięcie nie jest częścią tego podglądu.",
      "Głębokość rynku w czasie rzeczywistym jest niedostępna bez dowodu zatwierdzonych praw.",
    ],
  },
  en: {
    basic: [
      "Automated prescreen with explicit limitations",
      "Risk summary without a safety guarantee",
      "Evidence and missing-proof register",
    ],
    proSections: [
      "Expanded findings and provenance register",
      "Cross-tool consensus and contradiction register",
      "Remediation plan and quality control before beta delivery",
      "Technical appendix with artifact binding",
    ],
    advancedSections: [
      "Contract-version and storage-layout comparison",
      "Expanded evidence packs and change history",
      "Independent-adjudication preparation bundle",
      "Team workflow, re-audit and signed authenticity — target state",
    ],
    workflowsPro: ["Report export", "Missing-proof register", "Controlled re-audit"],
    workflowsAdvanced: ["Multi-version comparison", "Adjudication bundle", "Team workflow — still blocked"],
    exampleTitle: "Example privileged-control check requires verification",
    exampleSummary: "This is a redacted structural example. It is not taken from a customer report and contains no code, target or exploit detail.",
    remediation: "Verify the access-control boundary and add a negative test before re-analysis.",
    safeNext: "Use free Basic or request an invitation to the controlled Pro beta. Advanced is not currently sold.",
    limits: [
      "The preview is not an audit result for a specific project.",
      "Full findings, code, locations and critical details are permanently removed.",
      "Finding confidence is not a calibrated probability.",
      "No finding does not mean the contract is safe.",
    ],
    noGuarantees: ["No security guarantee", "No certification", "No investment-outcome guarantee"],
    unavailable: [
      "Unapproved provider fields are withheld.",
      "Independent adjudication is not included in this preview.",
      "Real-time market depth is unavailable unless rights-approved evidence exists.",
    ],
  },
  de: {
    basic: [
      "Automatische Vorprüfung mit klaren Grenzen",
      "Risikozusammenfassung ohne Sicherheitsgarantie",
      "Nachweise und Register fehlender Belege",
    ],
    proSections: [
      "Erweitertes Befund- und Herkunftsregister",
      "Werkzeugkonsens und Widerspruchsregister",
      "Abhilfeplan und Qualitätskontrolle vor Beta-Auslieferung",
      "Technischer Anhang mit Artefaktbindung",
    ],
    advancedSections: [
      "Vergleich von Vertragsversionen und Speicherlayout",
      "Erweiterte Nachweispakete und Änderungshistorie",
      "Vorbereitungspaket für eine unabhängige Beurteilung",
      "Teamarbeit, erneute Prüfung und signierte Echtheit — Zielzustand",
    ],
    workflowsPro: ["Berichtsexport", "Register fehlender Belege", "Kontrollierte erneute Prüfung"],
    workflowsAdvanced: ["Mehrversionsvergleich", "Paket zur unabhängigen Entscheidung", "Teamarbeit — noch blockiert"],
    exampleTitle: "Beispielhafte Berechtigungskontrolle erfordert Prüfung",
    exampleSummary: "Dies ist ein redigiertes Strukturbeispiel. Es stammt nicht aus einem Kundenbericht und enthält keinen Code, kein Ziel und keine Einzelheiten zur Ausnutzung.",
    remediation: "Berechtigungsgrenze prüfen und vor der erneuten Analyse einen Negativtest ergänzen.",
    safeNext: "Kostenloses Basic verwenden oder eine Einladung zur kontrollierten Pro-Beta anfordern. Advanced wird derzeit nicht verkauft.",
    limits: [
      "Die Vorschau ist kein Audit-Ergebnis für ein bestimmtes Projekt.",
      "Vollständige Befunde, Code, Fundstellen und kritische Details wurden dauerhaft entfernt.",
      "Die Befundsicherheit ist keine kalibrierte Wahrscheinlichkeit.",
      "Kein Befund bedeutet nicht, dass der Vertrag sicher ist.",
    ],
    noGuarantees: ["Keine Sicherheitsgarantie", "Keine Zertifizierung", "Keine Garantie eines Anlageergebnisses"],
    unavailable: [
      "Nicht genehmigte Felder externer Datenanbieter werden zurückgehalten.",
      "Eine unabhängige Entscheidung ist in dieser Vorschau nicht enthalten.",
      "Echtzeit-Markttiefe ist ohne Nachweis genehmigter Nutzungsrechte nicht verfügbar.",
    ],
  },
} as const;

const SAFE_PROVENANCE_CLASSES = Object.freeze([
  "VELMERE_OWNED_ANALYSIS",
  "PUBLIC_BLOCKCHAIN_DIRECT",
  "VELMERE_DERIVED",
  "USER_SUPPLIED_HASH_BOUND",
  "EXTERNAL_PROVIDER_FIELD_MAY_BE_WITHHELD",
  "SIMULATION_EXPLICIT",
]);

const FORBIDDEN_KEY_PATTERN = /(?:report|case|account|entitlement|token|sourcecode|source_code|target|contractaddress|receipt|snapshot|privatepayload|criticaldetail|exploitstep)/iu;
const FORBIDDEN_VALUE_PATTERN = /(?:0x[a-f0-9]{40}|vlm_pdf_|bearer\s+[a-z0-9._~+/=-]{8,}|-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----|(?:^|[/\\])(?:src|contracts?|fixtures?)[/\\]|line\s+\d+|function\s+[a-z_$][\w$]*\s*\()/iu;

function unsafePreviewPath(value: unknown, path: string[] = []): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const unsafe = unsafePreviewPath(value[index], [...path, String(index)]);
      if (unsafe) return unsafe;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEY_PATTERN.test(key) && ![
        "criticalDetailsWithheld",
        "exploitDetails",
      ].includes(key)) return [...path, key].join(".");
      const unsafe = unsafePreviewPath(child, [...path, key]);
      if (unsafe) return unsafe;
    }
    return null;
  }
  if (typeof value === "string" && FORBIDDEN_VALUE_PATTERN.test(value)) return path.join(".");
  return null;
}

export function validateAuditPaidTierPreview(value: AuditPaidTierPreview) {
  if (value.schemaVersion !== PASS36_R44P22_AUDIT_TIER_PREVIEW_ID) throw new Error("preview_schema_invalid");
  if (value.tier !== "pro" && value.tier !== "advanced") throw new Error("preview_tier_invalid");
  if (value.locale !== "pl" && value.locale !== "en" && value.locale !== "de") throw new Error("preview_locale_invalid");
  if (!value.previewOnly || value.fullContentIncluded || value.hiddenFullContentPresent || !value.criticalDetailsWithheld) {
    throw new Error("preview_truth_boundary_invalid");
  }
  if (value.watermark !== "PREVIEW" || value.publicPrice !== null || value.publicCheckoutAllowed || value.saleEnabled) {
    throw new Error("preview_commercial_truth_invalid");
  }
  const { previewDigest: _previewDigest, ...unsigned } = value;
  const expectedDigest = sha256Digest(canonicalJson(unsigned));
  if (value.previewDigest !== expectedDigest) throw new Error("preview_digest_invalid");
  const serialized = canonicalJson(value);
  if (Buffer.byteLength(serialized, "utf8") > 64 * 1024) throw new Error("preview_too_large");
  const unsafe = unsafePreviewPath(value);
  if (unsafe) throw new Error(`preview_contains_forbidden_material:${unsafe}`);
  return value;
}

export function buildAuditPaidTierPreview(args: {
  tier: AuditPaidPreviewTier;
  locale: AuditPaidPreviewLocale;
}): AuditPaidTierPreview {
  const copy = COPY[args.locale];
  const advanced = args.tier === "advanced";
  const additionalSections = advanced
    ? [...copy.proSections, ...copy.advancedSections]
    : [...copy.proSections];
  const unsigned = {
    schemaVersion: PASS36_R44P22_AUDIT_TIER_PREVIEW_ID,
    artifactClass: "SERVER_REDACTED_TIER_PREVIEW" as const,
    previewOnly: true as const,
    tier: args.tier,
    locale: args.locale,
    watermark: "PREVIEW" as const,
    fullContentIncluded: false as const,
    hiddenFullContentPresent: false as const,
    criticalDetailsWithheld: true as const,
    publicPrice: null,
    billingModel: "NOT_PUBLISHED" as const,
    publicCheckoutAllowed: false as const,
    saleEnabled: false as const,
    productState: advanced ? "NOT_FOR_SALE" as const : "INVITATION_ONLY_CONTROLLED_BETA" as const,
    humanReviewIncluded: false as const,
    internalQualityControl: advanced
      ? "NOT_AVAILABLE_PRODUCT" as const
      : "REQUIRED_BEFORE_CONTROLLED_BETA_DELIVERY" as const,
    structure: {
      includedInBasic: [...copy.basic],
      additionalSections,
      additionalSectionCount: additionalSections.length,
      professionalWorkflow: advanced ? [...copy.workflowsAdvanced] : [...copy.workflowsPro],
    },
    severityOverview: {
      purpose: "STRUCTURE_EXAMPLE_NOT_REPORT_RESULT" as const,
      levelsShown: ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"] as const,
      countsWithheld: true as const,
    },
    exampleFinding: {
      previewFindingId: `example-${args.tier}-redacted`,
      severity: advanced ? "HIGH_EXAMPLE" as const : "MEDIUM_EXAMPLE" as const,
      title: copy.exampleTitle,
      summary: copy.exampleSummary,
      evidenceState: "EXAMPLE_ONLY_NOT_CASE_EVIDENCE" as const,
      sourceLocation: "WITHHELD_FROM_PREVIEW" as const,
      exploitDetails: "WITHHELD_FROM_PREVIEW" as const,
      remediation: copy.remediation,
    },
    valueDelta: advanced ? [...copy.advancedSections] : [...copy.proSections],
    provenanceClasses: [...SAFE_PROVENANCE_CLASSES],
    unavailableData: [...copy.unavailable],
    limitations: [...copy.limits],
    guaranteesNotProvided: [...copy.noGuarantees],
    safeNextStep: copy.safeNext,
    policyVersion: "R44P22_PREVIEW_POLICY_2026_08_06" as const,
  };
  const preview = Object.freeze({
    ...unsigned,
    previewDigest: sha256Digest(canonicalJson(unsigned)),
  }) as AuditPaidTierPreview;
  return validateAuditPaidTierPreview(preview);
}
