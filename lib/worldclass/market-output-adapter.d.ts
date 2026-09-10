export type WorldclassMarketSurface = "shield" | "real_markets";
export type WorldclassMarketTier = "basic" | "pro" | "advanced";
export type WorldclassMarketLocale = "pl" | "en" | "de";
export type WorldclassMarketSource = {
  sourceId: string;
  providerId: string;
  family: string;
  canonicalIdentity: string;
  observedAt: string;
  licenseStatus: "verified" | "display_only" | "restricted" | "unknown" | string;
  payloadSha256?: string;
  providerRights?: {
    publicDisplayAllowed?: boolean;
    customerDeliveryAllowed?: boolean;
    commercialUseAllowed?: boolean;
    paidTierAllowed?: boolean;
    blockers?: string[];
    rightsMode?: "customer_delivery" | "synthetic_fixture";
    customerDecisionReceiptSha256?: string | null;
    paidDecisionReceiptSha256?: string | null;
    matrixSha256?: string | null;
    decisionSha256?: string | null;
  };
  values: Record<string, string | number | boolean | null>;
};
export type WorldclassMarketEvidencePacket = {
  schemaVersion: string;
  caseId: string;
  surface: WorldclassMarketSurface;
  asOf: string;
  asset: {
    canonicalIdentity: string;
    symbol: string;
    name: string;
    assetClass: string;
    venue?: string;
    currency?: string;
  };
  sources: WorldclassMarketSource[];
  provenanceReceiptSha256?: string;
};
export function buildWorldclassMarketOutput(args: {
  matrixRow: Record<string, unknown>;
  corpusCase: Record<string, unknown>;
  evidencePacket: WorldclassMarketEvidencePacket;
  sourceSha256: string;
  corpusSha256: string;
  entitlementStatus?: "verified" | "unverified";
  rightsMode?: "customer_delivery" | "synthetic_fixture";
  policy?: Record<string, unknown>;
}): Record<string, unknown>;
export function buildMarketAdapterEvidenceReceipt(packet: WorldclassMarketEvidencePacket): string;
export function marketAdapterPolicyDefaults(): Record<string, unknown>;
