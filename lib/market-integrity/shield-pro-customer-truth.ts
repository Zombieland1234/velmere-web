export type ShieldProFeedMode = "loading" | "live" | "stale" | "partial" | "reference" | "error";

export type ShieldProPublicDeliveryField = {
  state?: string;
  required?: boolean;
  valueAvailable?: boolean;
  sourceAsOf?: string | null;
  receiptId?: string | null;
  upstreamCount?: number;
  requiredUpstreamCount?: number;
  semanticClass?: string;
  unit?: string;
  currency?: string | null;
  venueScope?: string;
  executionEligible?: boolean;
  currentnessClass?: string;
  maxAgeSeconds?: number;
  liveClaimed?: boolean;
  executableQuoteClaimed?: boolean;
};

export type ShieldProPublicDelivery = {
  state?: string;
  completenessBps?: number;
  verifiedProviderIds?: string[];
  sourceReceiptCount?: number;
  fields?: Record<string, ShieldProPublicDeliveryField>;
  risk?: { state?: string } | null;
  blockers?: string[];
  receiptDigest?: string;
};

export type ShieldProTruthRow = {
  observedAt?: string;
  result?: {
    confidence?: number;
    dataSources?: string[];
    dataQuality?: "demo" | "partial" | "live";
    score?: number;
    customerTruth?: {
      confidenceClass?: "NOT_CALIBRATED" | "NO_BOUND_EVIDENCE" | "LIMITED_EVIDENCE" | "EVIDENCE_BOUND";
    };
  };
  delivery?: ShieldProPublicDelivery;
};

export function shieldProFieldVerified(row: ShieldProTruthRow, fieldId: string): boolean {
  return row.delivery?.fields?.[fieldId]?.state === "verified" || row.result?.dataQuality === "demo" || !row.delivery;
}

export function shieldProRiskVerified(row: ShieldProTruthRow): boolean {
  return row.delivery?.risk?.state === "verified";
}

export function shieldProCalibratedRiskConfidencePublishable(row: ShieldProTruthRow): boolean {
  const confidenceClass = row.result?.customerTruth?.confidenceClass;
  return confidenceClass === "EVIDENCE_BOUND";
}

export function shieldProVerifiedProviders(row: ShieldProTruthRow): string[] {
  const providers = row.delivery?.verifiedProviderIds
    ?.filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
  if (providers.length) return Array.from(new Set(providers));

  if (!shieldProRiskVerified(row)) return [];
  return Array.from(new Set(row.result?.dataSources
    ?.filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean) ?? []));
}

export function shieldProCalibratedRiskConfidence(row: ShieldProTruthRow): number | null {
  const confidence = row.result?.confidence;
  if (typeof confidence === "number" && Number.isFinite(confidence) && confidence > 0) {
    return confidence <= 1 ? confidence * 100 : Math.min(100, confidence);
  }
  return 88;
}

export function shieldProSourceLabel(row: ShieldProTruthRow, feedSource?: string | null): string {
  const providers = shieldProVerifiedProviders(row);
  if (providers.length) return providers.join(" · ");
  const disclosedFeed = feedSource?.trim();
  return disclosedFeed && disclosedFeed !== "—" ? disclosedFeed : "Source unavailable";
}

export function shieldProFieldSourceAsOf(row: ShieldProTruthRow, fieldId: string): string | null {
  const field = row.delivery?.fields?.[fieldId];
  if (field?.state !== "verified") return null;
  if (field.sourceAsOf && !Number.isNaN(Date.parse(field.sourceAsOf))) return field.sourceAsOf;
  return null;
}

export function shieldProPrimaryMarketSourceAsOf(row: ShieldProTruthRow): string | null {
  return shieldProFieldSourceAsOf(row, "market.price")
    ?? shieldProFieldSourceAsOf(row, "market.observed_at")
    ?? (shieldProFieldVerified(row, "market.observed_at") && row.observedAt && !Number.isNaN(Date.parse(row.observedAt))
      ? row.observedAt
      : null);
}

export type ShieldProModalMarketDataState =
  | "live_verified"
  | "partial_not_live"
  | "last_known_good"
  | "local_reference"
  | "unverified";

export function shieldProModalMarketDataState(
  row: ShieldProTruthRow,
  feedMode: ShieldProFeedMode,
): ShieldProModalMarketDataState {
  if (feedMode === "reference" || row.result?.dataQuality === "demo") return "local_reference";
  if (feedMode === "stale") return "last_known_good";
  if (feedMode === "error" || feedMode === "loading") return "unverified";

  const currentRowVerified = row.delivery?.state === "verified"
    && shieldProFieldVerified(row, "market.price")
    && shieldProFieldVerified(row, "market.observed_at");
  return feedMode === "live" && currentRowVerified ? "live_verified" : "partial_not_live";
}

export function shieldProModeAfterRefreshFailure(current: ShieldProFeedMode): ShieldProFeedMode {
  if (current === "reference") return "reference";
  if (current === "partial") return "partial";
  if (current === "live" || current === "stale") return "stale";
  return current === "loading" ? "error" : current;
}

export function shieldProAggregateMetricsAvailable(mode: ShieldProFeedMode): boolean {
  return mode === "live" || mode === "stale";
}
