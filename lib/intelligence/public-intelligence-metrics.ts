export type IntelligenceProofStatus = "engineered" | "source_bound" | "pending_live_verification";

export type PublicIntelligenceMetric = {
  id: string;
  label: Record<"en" | "pl" | "de", string>;
  value: Record<"en" | "pl" | "de", string>;
  status: IntelligenceProofStatus;
  receiptId: string;
  publishedAt: string;
  classification: "public_methodology" | "public_commercial_policy" | "public_runtime_boundary";
};

/**
 * Customer-safe manifest. It intentionally publishes no accuracy, customer,
 * deployment or performance figures that are not backed by a public receipt.
 */
export const PUBLIC_INTELLIGENCE_METRICS: PublicIntelligenceMetric[] = [
  {
    id: "risk-lane-contract",
    label: { en: "Risk lane contract", pl: "Kontrakt torów ryzyka", de: "Vertrag der Risikobahnen" },
    value: { en: "Eight asset-aware lanes", pl: "Osiem torów zależnych od aktywa", de: "Acht asset-spezifische Bahnen" },
    status: "engineered",
    receiptId: "public-methodology-risk-lanes-v1",
    publishedAt: "2026-07-16",
    classification: "public_methodology",
  },
  {
    id: "tier-policy",
    label: { en: "Commercial tier policy", pl: "Polityka poziomów", de: "Kommerzielle Tier-Policy" },
    value: { en: "Canonical server policy", pl: "Kanoniczna polityka serwerowa", de: "Kanonische Server-Policy" },
    status: "source_bound",
    receiptId: "public-tier-policy-v1",
    publishedAt: "2026-07-16",
    classification: "public_commercial_policy",
  },
  {
    id: "locale-contract",
    label: { en: "Localized route contract", pl: "Kontrakt tras językowych", de: "Lokalisierter Routenvertrag" },
    value: { en: "EN · PL · DE", pl: "EN · PL · DE", de: "EN · PL · DE" },
    status: "engineered",
    receiptId: "public-intelligence-locales-v1",
    publishedAt: "2026-07-16",
    classification: "public_methodology",
  },
  {
    id: "live-verification",
    label: { en: "Live production verification", pl: "Weryfikacja produkcyjna live", de: "Live-Produktionsverifizierung" },
    value: { en: "Not asserted", pl: "Niepotwierdzona", de: "Nicht behauptet" },
    status: "pending_live_verification",
    receiptId: "public-live-proof-pending-v1",
    publishedAt: "2026-07-16",
    classification: "public_runtime_boundary",
  },
];
