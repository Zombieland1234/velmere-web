import type {
  MarketImpactEvidenceStatus,
  MarketImpactLevelInput,
  MarketImpactQuoteRateEvidence,
  MarketImpactVenueSnapshot,
} from "./market-impact-types";

const DIGEST = /^(?:sha256:)?[a-f0-9]{64}$/i;
const EVIDENCE_STATUSES = new Set<MarketImpactEvidenceStatus>([
  "verified_live",
  "verified_staging",
  "verified_fixture",
]);
const QUOTE_CURRENCIES = new Set<MarketImpactVenueSnapshot["quoteCurrency"]>([
  "USD",
  "USDT",
  "USDC",
]);

function cleanText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/[<>\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
  return clean || null;
}

export function normalizeMarketImpactAssetKey(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toUpperCase().replace(/\s+/g, "").slice(0, 120)
    : "";
}

function canonicalIso(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 64) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  const normalized = new Date(milliseconds).toISOString();
  return normalized === value ? normalized : null;
}

function evidenceStatus(value: unknown, forced?: MarketImpactEvidenceStatus): MarketImpactEvidenceStatus | null {
  if (forced) return forced;
  return typeof value === "string" && EVIDENCE_STATUSES.has(value as MarketImpactEvidenceStatus)
    ? value as MarketImpactEvidenceStatus
    : null;
}

function level(value: unknown): MarketImpactLevelInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.price !== "number" || !Number.isFinite(row.price) || row.price <= 0) return null;
  if (typeof row.baseQuantity !== "number" || !Number.isFinite(row.baseQuantity) || row.baseQuantity <= 0) return null;
  return { price: row.price, baseQuantity: row.baseQuantity };
}

function levels(value: unknown): MarketImpactLevelInput[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 250) return null;
  const normalized = value.map(level);
  return normalized.every((row): row is MarketImpactLevelInput => Boolean(row)) ? normalized : null;
}

function quoteRate(
  value: unknown,
  forcedStatus?: MarketImpactEvidenceStatus,
): MarketImpactQuoteRateEvidence | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const observedAt = canonicalIso(row.observedAt);
  const status = evidenceStatus(row.status, forcedStatus);
  const providerFamily = cleanText(row.providerFamily, 120);
  const sourceDigest = cleanText(row.sourceDigest, 80)?.toLowerCase() ?? null;
  if (
    typeof row.usdRate !== "number"
    || !Number.isFinite(row.usdRate)
    || row.usdRate <= 0
    || !observedAt
    || !status
    || !providerFamily
    || !sourceDigest
    || !DIGEST.test(sourceDigest)
  ) return null;
  return {
    usdRate: row.usdRate,
    observedAt,
    status,
    providerFamily,
    sourceDigest: sourceDigest.startsWith("sha256:") ? sourceDigest : `sha256:${sourceDigest}`,
  };
}

export function normalizeMarketImpactSnapshots(
  value: unknown,
  options: {
    expectedAssetKey?: string;
    forceEvidenceStatus?: MarketImpactEvidenceStatus;
  } = {},
): MarketImpactVenueSnapshot[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) return null;
  const expectedAssetKey = options.expectedAssetKey
    ? normalizeMarketImpactAssetKey(options.expectedAssetKey)
    : "";
  const normalized: MarketImpactVenueSnapshot[] = [];

  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const row = candidate as Record<string, unknown>;
    const venueId = cleanText(row.venueId, 120);
    const providerFamily = cleanText(row.providerFamily, 120);
    const assetKey = normalizeMarketImpactAssetKey(row.assetKey);
    const observedAt = canonicalIso(row.observedAt);
    const status = evidenceStatus(row.status, options.forceEvidenceStatus);
    const quoteCurrency = typeof row.quoteCurrency === "string" && QUOTE_CURRENCIES.has(row.quoteCurrency as MarketImpactVenueSnapshot["quoteCurrency"])
      ? row.quoteCurrency as MarketImpactVenueSnapshot["quoteCurrency"]
      : null;
    const bids = levels(row.bids);
    const asks = levels(row.asks);
    if (
      !venueId
      || !providerFamily
      || !assetKey
      || (expectedAssetKey && assetKey !== expectedAssetKey)
      || !observedAt
      || !status
      || !quoteCurrency
      || !bids
      || !asks
    ) return null;

    const feeBps = row.feeBps === undefined
      ? undefined
      : typeof row.feeBps === "number" && Number.isFinite(row.feeBps) && row.feeBps >= 0 && row.feeBps <= 250
        ? row.feeBps
        : null;
    if (feeBps === null) return null;

    const sourceDigest = row.sourceDigest === undefined
      ? undefined
      : cleanText(row.sourceDigest, 80)?.toLowerCase() ?? null;
    if (sourceDigest === null || (sourceDigest !== undefined && !DIGEST.test(sourceDigest))) return null;

    const normalizedQuote = quoteCurrency === "USD"
      ? undefined
      : quoteRate(row.quoteToUsd, options.forceEvidenceStatus);
    if (quoteCurrency !== "USD" && !normalizedQuote) return null;
    if (quoteCurrency === "USD" && row.quoteToUsd !== undefined) {
      const supplied = quoteRate(row.quoteToUsd, options.forceEvidenceStatus);
      if (!supplied) return null;
    }

    normalized.push({
      venueId,
      providerFamily,
      assetKey,
      quoteCurrency,
      observedAt,
      status,
      ...(feeBps === undefined ? {} : { feeBps }),
      ...(normalizedQuote ? { quoteToUsd: normalizedQuote } : {}),
      bids,
      asks,
      ...(sourceDigest === undefined ? {} : {
        sourceDigest: sourceDigest.startsWith("sha256:") ? sourceDigest : `sha256:${sourceDigest}`,
      }),
    });
  }

  return normalized;
}
