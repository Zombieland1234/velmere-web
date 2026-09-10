import {
  buildAuditPaidTierPreview,
  validateAuditPaidTierPreview,
  type AuditPaidPreviewLocale,
  type AuditPaidPreviewTier,
  type AuditPaidTierPreview,
} from "@/lib/security/audit-tier-preview";
import { buildCustomerSafeMinimalPdf } from "@/lib/security/pro-audit-pdf/customer-safe-renderer";

export const PASS36_R44P22_AUDIT_TIER_PREVIEW_PDF_ID =
  "velmere.pass36.a102r44p22.redacted-tier-preview-pdf.v1" as const;

const LABELS = {
  pl: {
    title: "VELMERE — PODGLĄD",
    subtitle: "Zredagowany podgląd struktury. To nie jest pełny raport.",
    included: "W BASIC",
    additional: "DODATKOWE SEKCJE",
    workflow: "SPOSÓB PRACY",
    provenance: "POCHODZENIE DANYCH",
    unavailable: "NIEDOSTĘPNE DANE",
    limits: "OGRANICZENIA",
    next: "NASTĘPNY BEZPIECZNY KROK",
    previewOnly: "Tylko podgląd",
    fullContent: "Pełna treść dołączona",
    criticalWithheld: "Szczegóły krytyczne ukryte",
    beta: "Kontrolowana beta na zaproszenie",
    notForSale: "Produkt nie jest obecnie sprzedawany",
    yes: "tak",
    no: "nie",
    withheldFooter: "PREVIEW — PEŁNE USTALENIA, KOD, LOKALIZACJE I SZCZEGÓŁY WYKORZYSTANIA UKRYTE",
    integrityLabel: "Integralność dokumentu zweryfikowana przez Velmère",
    footer: "PREVIEW | To nie jest pełny audyt | Brak gwarancji bezpieczeństwa | Brak płatnego dostępu",
  },
  en: {
    title: "VELMERE — PREVIEW",
    subtitle: "Redacted structure preview. This is not the full report.",
    included: "IN BASIC",
    additional: "ADDITIONAL SECTIONS",
    workflow: "WORKFLOW",
    provenance: "DATA PROVENANCE",
    unavailable: "UNAVAILABLE DATA",
    limits: "LIMITATIONS",
    next: "NEXT SAFE STEP",
    previewOnly: "Preview only",
    fullContent: "Full content included",
    criticalWithheld: "Critical details withheld",
    beta: "Invitation-only controlled beta",
    notForSale: "The product is not currently sold",
    yes: "yes",
    no: "no",
    withheldFooter: "PREVIEW — FULL FINDINGS, CODE, LOCATIONS AND EXPLOIT DETAILS WITHHELD",
    integrityLabel: "Document integrity verified by Velmère",
    footer: "PREVIEW | Not a full audit | No security guarantee | No paid entitlement granted",
  },
  de: {
    title: "VELMERE — VORSCHAU",
    subtitle: "Redigierte Strukturvorschau. Dies ist nicht der vollständige Bericht.",
    included: "IN BASIC",
    additional: "ZUSÄTZLICHE ABSCHNITTE",
    workflow: "ARBEITSABLAUF",
    provenance: "DATENHERKUNFT",
    unavailable: "NICHT VERFÜGBARE DATEN",
    limits: "EINSCHRÄNKUNGEN",
    next: "NÄCHSTER SICHERER SCHRITT",
    previewOnly: "Nur Vorschau",
    fullContent: "Vollständiger Inhalt enthalten",
    criticalWithheld: "Kritische Details zurückgehalten",
    beta: "Kontrollierte Beta nur auf Einladung",
    notForSale: "Das Produkt wird derzeit nicht verkauft",
    yes: "ja",
    no: "nein",
    withheldFooter: "PREVIEW — VOLLSTÄNDIGE BEFUNDE, QUELLCODE, FUNDSTELLEN UND EINZELHEITEN ZUR AUSNUTZUNG ZURÜCKGEHALTEN",
    integrityLabel: "Dokumentintegrität durch Velmère verifiziert",
    footer: "PREVIEW | Kein vollständiges Audit | Keine Sicherheitsgarantie | Keine bezahlte Berechtigung",
  },
} as const;

const PROVENANCE_LABELS = {
  pl: { VELMERE_OWNED_ANALYSIS: "Analiza własna Velmère", PUBLIC_BLOCKCHAIN_DIRECT: "Dane bezpośrednio z blockchaina", VELMERE_DERIVED: "Wyliczenie Velmère", USER_SUPPLIED_HASH_BOUND: "Dane użytkownika związane hashem", EXTERNAL_PROVIDER_FIELD_MAY_BE_WITHHELD: "Pole dostawcy danych może być ukryte", SIMULATION_EXPLICIT: "Jawnie oznaczona symulacja" },
  en: { VELMERE_OWNED_ANALYSIS: "Velmère-owned analysis", PUBLIC_BLOCKCHAIN_DIRECT: "Direct blockchain data", VELMERE_DERIVED: "Velmère-derived calculation", USER_SUPPLIED_HASH_BOUND: "Hash-bound user-supplied data", EXTERNAL_PROVIDER_FIELD_MAY_BE_WITHHELD: "Provider field may be withheld", SIMULATION_EXPLICIT: "Explicitly labelled simulation" },
  de: { VELMERE_OWNED_ANALYSIS: "Velmère-eigene Analyse", PUBLIC_BLOCKCHAIN_DIRECT: "Direkte Blockchain-Daten", VELMERE_DERIVED: "Von Velmère berechneter Wert", USER_SUPPLIED_HASH_BOUND: "Hash-gebundene Nutzerdaten", EXTERNAL_PROVIDER_FIELD_MAY_BE_WITHHELD: "Feld des Datenanbieters kann zurückgehalten werden", SIMULATION_EXPLICIT: "Explizit gekennzeichnete Simulation" },
} as const;

function previewLines(preview: AuditPaidTierPreview) {
  const labels = LABELS[preview.locale];
  return [
    "PREVIEW — PREVIEW — PREVIEW",
    `${preview.tier.toUpperCase()} | ${preview.productState === "INVITATION_ONLY_CONTROLLED_BETA" ? labels.beta : labels.notForSale}`,
    `${labels.previewOnly}: ${preview.previewOnly ? labels.yes : labels.no}`,
    `${labels.fullContent}: ${preview.fullContentIncluded ? labels.yes : labels.no}`,
    `${labels.criticalWithheld}: ${preview.criticalDetailsWithheld ? labels.yes : labels.no}`,
    "",
    labels.included,
    ...preview.structure.includedInBasic.map((row) => `- ${row}`),
    "",
    `${labels.additional} (${preview.structure.additionalSectionCount})`,
    ...preview.structure.additionalSections.map((row) => `- ${row}`),
    "",
    labels.workflow,
    ...preview.structure.professionalWorkflow.map((row) => `- ${row}`),
    "",
    labels.provenance,
    ...preview.provenanceClasses.map((row) => `- ${PROVENANCE_LABELS[preview.locale][row as keyof typeof PROVENANCE_LABELS[typeof preview.locale]] ?? row}`),
    "",
    labels.unavailable,
    ...preview.unavailableData.map((row) => `- ${row}`),
    "",
    labels.limits,
    ...preview.limitations.map((row) => `- ${row}`),
    "",
    labels.next,
    preview.safeNextStep,
    "",
    labels.withheldFooter,
  ];
}

export function buildAuditPaidTierPreviewPdf(args: {
  tier: AuditPaidPreviewTier;
  locale: AuditPaidPreviewLocale;
}) {
  const preview = validateAuditPaidTierPreview(buildAuditPaidTierPreview(args));
  const labels = LABELS[args.locale];
  const pdf = buildCustomerSafeMinimalPdf(previewLines(preview), {
    title: `${labels.title} · ${args.tier.toUpperCase()}`,
    subtitle: labels.subtitle,
    footer: labels.footer,
    integrityLabel: labels.integrityLabel,
    issuer: "Velmere Security",
    generator: PASS36_R44P22_AUDIT_TIER_PREVIEW_PDF_ID,
    maxLines: 160,
    documentId: `velmere-${args.tier}-preview-r44p22`,
    generatedAt: "2026-08-06T00:00:00.000Z",
    locale: args.locale,
    classification: "customer_safe",
  });
  return { preview, pdf };
}
