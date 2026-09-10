import { canonicalJson } from "../security/canonical-json";
import { buildMarketImpactCustomerTruth } from "./market-impact-customer-truth";
import type { VlmCustomerLocale, VlmReportContextDepth } from "../product/vlm-standalone-customer-truth";
import { sha256Hex } from "../security/cryptographic-digest";
import { canonicalProviderFamily, distinctProviderFamilies } from "./provider-family-identity";
import {
  scaleMarketDepth,
  shockMarketSpread,
  simulateMarketExecution,
} from "./market-impact-simulation";
import type {
  MarketImpactDepthBand,
  MarketImpactEvidenceStatus,
  MarketImpactNormalizedLevel,
  MarketImpactPolicy,
  MarketImpactResult,
  MarketImpactScenarioResult,
  MarketImpactVenueSnapshot,
  MarketImpactVenueSummary,
} from "./market-impact-types";

const DEFAULT_POLICY: MarketImpactPolicy = {
  notionalUsdGrid: [1_000, 5_000, 10_000, 25_000, 50_000, 100_000],
  maxAgeMs: 2 * 60_000,
  maximumQuoteRateAgeMs: 2 * 60_000,
  maximumStableQuoteDeviationBps: 1_000,
  minimumVenueCount: 2,
  minimumProviderFamilies: 2,
  minimumFillRatio: 0.95,
  maximumCrossVenueMidDivergenceBps: 150,
  maximumSpreadBps: 250,
  allowStaging: true,
  allowFixture: false,
  maximumLevelsPerSide: 200,
};

function round(value: number, digits = 8): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeAssetKey(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "").slice(0, 120);
}

function normalizeVenueId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, "-").slice(0, 120);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

function statusAllowed(status: MarketImpactEvidenceStatus, policy: MarketImpactPolicy): boolean {
  if (status === "verified_live") return true;
  if (status === "verified_staging") return policy.allowStaging;
  return policy.allowFixture;
}

function normalizedPolicy(input?: Partial<MarketImpactPolicy>): MarketImpactPolicy {
  const merged = { ...DEFAULT_POLICY, ...(input ?? {}) };
  const notionalUsdGrid = Array.from(
    new Set(
      merged.notionalUsdGrid
        .filter((value) => Number.isFinite(value) && value > 0)
        .map((value) => Math.round(value * 100) / 100),
    ),
  ).sort((a, b) => a - b).slice(0, 24);
  if (notionalUsdGrid.length === 0) notionalUsdGrid.push(...DEFAULT_POLICY.notionalUsdGrid);
  return {
    ...merged,
    notionalUsdGrid,
    maxAgeMs: Math.max(1_000, Math.min(60 * 60_000, Math.trunc(merged.maxAgeMs))),
    maximumQuoteRateAgeMs: Math.max(1_000, Math.min(60 * 60_000, Math.trunc(merged.maximumQuoteRateAgeMs))),
    maximumStableQuoteDeviationBps: Math.max(1, Math.min(5_000, merged.maximumStableQuoteDeviationBps)),
    minimumVenueCount: Math.max(1, Math.min(8, Math.trunc(merged.minimumVenueCount))),
    minimumProviderFamilies: Math.max(1, Math.min(8, Math.trunc(merged.minimumProviderFamilies))),
    minimumFillRatio: Math.max(0.5, Math.min(1, merged.minimumFillRatio)),
    maximumCrossVenueMidDivergenceBps: Math.max(1, Math.min(10_000, merged.maximumCrossVenueMidDivergenceBps)),
    maximumSpreadBps: Math.max(1, Math.min(10_000, merged.maximumSpreadBps)),
    maximumLevelsPerSide: Math.max(5, Math.min(1_000, Math.trunc(merged.maximumLevelsPerSide))),
  };
}

function sourceDigest(snapshot: MarketImpactVenueSnapshot): string {
  const supplied = snapshot.sourceDigest?.trim().toLowerCase() ?? "";
  if (/^(?:sha256:)?[a-f0-9]{64}$/.test(supplied)) {
    return supplied.startsWith("sha256:") ? supplied.slice(7) : supplied;
  }
  return sha256Hex(canonicalJson({ ...snapshot, sourceDigest: undefined }));
}

function normalizeSide(
  levels: MarketImpactVenueSnapshot["bids"],
  side: "bid" | "ask",
  snapshot: MarketImpactVenueSnapshot,
  maximumLevels: number,
  quoteToUsdRate: number,
): MarketImpactNormalizedLevel[] {
  const venueId = normalizeVenueId(snapshot.venueId);
  const providerFamily = canonicalProviderFamily(snapshot.providerFamily);
  const feeBps = Number.isFinite(snapshot.feeBps)
    ? Math.max(0, Math.min(250, Number(snapshot.feeBps)))
    : 0;
  const normalized = levels
    .slice(0, maximumLevels)
    .filter((level) => Number.isFinite(level.price) && level.price > 0 && Number.isFinite(level.baseQuantity) && level.baseQuantity > 0)
    .map((level) => ({
      venueId,
      providerFamily,
      price: level.price * quoteToUsdRate,
      baseQuantity: level.baseQuantity,
      quoteNotional: level.price * quoteToUsdRate * level.baseQuantity,
      feeBps,
    }));
  normalized.sort((a, b) => side === "bid" ? b.price - a.price : a.price - b.price);
  return normalized;
}

type NormalizedVenue = {
  snapshot: MarketImpactVenueSnapshot;
  summary: MarketImpactVenueSummary;
  bids: MarketImpactNormalizedLevel[];
  asks: MarketImpactNormalizedLevel[];
};

function normalizeVenue(args: {
  snapshot: MarketImpactVenueSnapshot;
  expectedAssetKey: string;
  nowMs: number;
  policy: MarketImpactPolicy;
}): { venue?: NormalizedVenue; reason?: string } {
  const snapshot = args.snapshot;
  const venueId = normalizeVenueId(snapshot.venueId);
  if (!venueId) return { reason: "missing_venue_id" };
  const providerFamily = canonicalProviderFamily(snapshot.providerFamily);
  if (!providerFamily) return { reason: "missing_provider_family" };
  if (normalizeAssetKey(snapshot.assetKey) !== args.expectedAssetKey) return { reason: "asset_key_mismatch" };
  if (!statusAllowed(snapshot.status, args.policy)) return { reason: `evidence_status_not_allowed:${snapshot.status}` };
  const observedMs = Date.parse(snapshot.observedAt);
  if (!Number.isFinite(observedMs)) return { reason: "invalid_observed_at" };
  if (observedMs > args.nowMs + 60_000) return { reason: "future_dated_snapshot" };
  if (args.nowMs - observedMs > args.policy.maxAgeMs) return { reason: "stale_snapshot" };

  let quoteToUsdRate = 1;
  let quoteRateObservedAt: string | null = null;
  let quoteRateStatus: MarketImpactEvidenceStatus | null = null;
  let quoteRateProviderFamily: string | null = null;
  let quoteRateSourceDigest: string | null = null;
  if (snapshot.quoteCurrency !== "USD") {
    const quoteEvidence = snapshot.quoteToUsd;
    if (!quoteEvidence) return { reason: "quote_conversion_evidence_missing" };
    if (!statusAllowed(quoteEvidence.status, args.policy)) return { reason: `quote_conversion_status_not_allowed:${quoteEvidence.status}` };
    const quoteObservedMs = Date.parse(quoteEvidence.observedAt);
    if (!Number.isFinite(quoteObservedMs)) return { reason: "quote_conversion_observed_at_invalid" };
    if (quoteObservedMs > args.nowMs + 60_000) return { reason: "quote_conversion_future_dated" };
    if (args.nowMs - quoteObservedMs > args.policy.maximumQuoteRateAgeMs) return { reason: "quote_conversion_stale" };
    if (!Number.isFinite(quoteEvidence.usdRate) || quoteEvidence.usdRate <= 0) return { reason: "quote_conversion_rate_invalid" };
    const deviationBps = Math.abs(quoteEvidence.usdRate - 1) * 10_000;
    if (deviationBps > args.policy.maximumStableQuoteDeviationBps) return { reason: "quote_conversion_deviation_above_policy" };
    if (!/^(?:sha256:)?[a-f0-9]{64}$/i.test(quoteEvidence.sourceDigest.trim())) return { reason: "quote_conversion_digest_invalid" };
    const family = canonicalProviderFamily(quoteEvidence.providerFamily);
    if (!family) return { reason: "quote_conversion_provider_missing" };
    quoteToUsdRate = quoteEvidence.usdRate;
    quoteRateObservedAt = new Date(quoteObservedMs).toISOString();
    quoteRateStatus = quoteEvidence.status;
    quoteRateProviderFamily = family;
    quoteRateSourceDigest = quoteEvidence.sourceDigest.trim().toLowerCase().replace(/^sha256:/, "");
  }

  const bids = normalizeSide(snapshot.bids, "bid", snapshot, args.policy.maximumLevelsPerSide, quoteToUsdRate);
  const asks = normalizeSide(snapshot.asks, "ask", snapshot, args.policy.maximumLevelsPerSide, quoteToUsdRate);
  if (bids.length === 0 || asks.length === 0) return { reason: "empty_order_book_side" };
  const bestBid = bids[0].price;
  const bestAsk = asks[0].price;
  if (bestBid >= bestAsk) return { reason: "crossed_or_locked_order_book" };
  const midPrice = (bestBid + bestAsk) / 2;
  const spreadBps = ((bestAsk - bestBid) / midPrice) * 10_000;
  if (spreadBps > args.policy.maximumSpreadBps) return { reason: "spread_above_policy" };

  return {
    venue: {
      snapshot,
      bids,
      asks,
      summary: {
        venueId,
        providerFamily,
        observedAt: new Date(observedMs).toISOString(),
        status: snapshot.status,
        quoteCurrency: snapshot.quoteCurrency,
        quoteToUsdRate: round(quoteToUsdRate, 10),
        quoteRateObservedAt,
        quoteRateStatus,
        quoteRateProviderFamily,
        quoteRateSourceDigest,
        bestBid: round(bestBid),
        bestAsk: round(bestAsk),
        midPrice: round(midPrice),
        spreadBps: round(spreadBps, 4),
        bidDepthUsd: round(bids.reduce((sum, level) => sum + level.quoteNotional, 0), 4),
        askDepthUsd: round(asks.reduce((sum, level) => sum + level.quoteNotional, 0), 4),
        sourceDigest: sourceDigest(snapshot),
      },
    },
  };
}

function deduplicateVenueSnapshots(snapshots: MarketImpactVenueSnapshot[]) {
  const selected = new Map<string, MarketImpactVenueSnapshot>();
  const duplicates: Array<{ venueId: string; reason: string }> = [];
  for (const snapshot of snapshots) {
    const venueId = normalizeVenueId(snapshot.venueId);
    if (!venueId) continue;
    const existing = selected.get(venueId);
    if (!existing) {
      selected.set(venueId, snapshot);
      continue;
    }
    const existingTime = Date.parse(existing.observedAt);
    const candidateTime = Date.parse(snapshot.observedAt);
    const candidateWins = Number.isFinite(candidateTime) && (!Number.isFinite(existingTime) || candidateTime > existingTime);
    if (candidateWins) selected.set(venueId, snapshot);
    duplicates.push({ venueId, reason: "duplicate_venue_snapshot_deduplicated" });
  }
  return { snapshots: Array.from(selected.values()), duplicates };
}

function depthBands(
  bids: MarketImpactNormalizedLevel[],
  asks: MarketImpactNormalizedLevel[],
  referenceMidPrice: number,
): MarketImpactDepthBand[] {
  return [10, 25, 50, 100, 250].map((bandBps) => {
    const bidFloor = referenceMidPrice * (1 - bandBps / 10_000);
    const askCeiling = referenceMidPrice * (1 + bandBps / 10_000);
    return {
      bandBps,
      bidDepthUsd: round(
        bids.filter((level) => level.price >= bidFloor).reduce((sum, level) => sum + level.quoteNotional, 0),
        4,
      ),
      askDepthUsd: round(
        asks.filter((level) => level.price <= askCeiling).reduce((sum, level) => sum + level.quoteNotional, 0),
        4,
      ),
    };
  });
}

function scenario(args: {
  id: MarketImpactScenarioResult["id"];
  label: string;
  depthMultiplier: number;
  spreadMultiplier: number;
  removedVenueId: string | null;
  bids: MarketImpactNormalizedLevel[];
  asks: MarketImpactNormalizedLevel[];
  referenceMidPrice: number;
  largestNotional: number;
}): MarketImpactScenarioResult {
  let bids = args.bids;
  let asks = args.asks;
  if (args.removedVenueId) {
    bids = bids.filter((level) => level.venueId !== args.removedVenueId);
    asks = asks.filter((level) => level.venueId !== args.removedVenueId);
  }
  bids = scaleMarketDepth(bids, args.depthMultiplier);
  asks = scaleMarketDepth(asks, args.depthMultiplier);
  if (args.spreadMultiplier > 1) {
    const shocked = shockMarketSpread({
      bids,
      asks,
      referenceMidPrice: args.referenceMidPrice,
      spreadMultiplier: args.spreadMultiplier,
    });
    bids = shocked.bids;
    asks = shocked.asks;
  }
  return {
    id: args.id,
    label: args.label,
    depthMultiplier: args.depthMultiplier,
    removedVenueId: args.removedVenueId,
    spreadMultiplier: args.spreadMultiplier,
    largestBuy: simulateMarketExecution({
      side: "buy",
      requestedNotionalUsd: args.largestNotional,
      referenceMidPrice: args.referenceMidPrice,
      levels: asks,
    }),
    largestSell: simulateMarketExecution({
      side: "sell",
      requestedNotionalUsd: args.largestNotional,
      referenceMidPrice: args.referenceMidPrice,
      levels: bids,
    }),
  };
}

function unavailableResult(args: {
  assetKey: string;
  generatedAt: string;
  excludedVenues: Array<{ venueId: string; reason: string }>;
  blockers: string[];
  locale?: VlmCustomerLocale;
  reportContextDepth?: VlmReportContextDepth;
  evidenceOrigin?: "provider" | "user_supplied";
}): MarketImpactResult {
  const core = {
    schemaVersion: "velmere.market-impact.v1" as const,
    assetKey: args.assetKey,
    generatedAt: args.generatedAt,
    evidenceStatus: "unavailable" as const,
    advancedReady: false,
    providerFamilies: [],
    venues: [],
    excludedVenues: args.excludedVenues,
    referenceMidPrice: null,
    crossVenueMidDivergenceBps: null,
    depthBands: [],
    executions: [],
    scenarios: [],
    missingEvidence: args.blockers,
    blockers: args.blockers,
  };
  const customerTruth = buildMarketImpactCustomerTruth({
    locale: args.locale,
    reportContextDepth: args.reportContextDepth,
    evidenceStatus: core.evidenceStatus,
    venues: core.venues,
    executions: core.executions,
    providerFamilies: core.providerFamilies,
    blockers: core.blockers,
    excludedVenues: core.excludedVenues,
    evidenceOrigin: args.evidenceOrigin,
  });
  const digestCore = { ...core, customerTruth };
  return { ...digestCore, evidenceDigest: sha256Hex(canonicalJson(digestCore)) };
}

export function buildMarketImpactAnalysis(args: {
  assetKey: string;
  snapshots: MarketImpactVenueSnapshot[];
  now?: Date;
  policy?: Partial<MarketImpactPolicy>;
  locale?: VlmCustomerLocale;
  reportContextDepth?: VlmReportContextDepth;
  evidenceOrigin?: "provider" | "user_supplied";
  additionalBlockers?: readonly string[];
}): MarketImpactResult {
  const policy = normalizedPolicy(args.policy);
  const now = args.now ?? new Date();
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error("invalid_now");
  const assetKey = normalizeAssetKey(args.assetKey);
  if (!assetKey) throw new Error("missing_asset_key");
  const generatedAt = now.toISOString();
  const deduplicated = deduplicateVenueSnapshots(args.snapshots);
  const excludedVenues = [...deduplicated.duplicates];
  const normalized: NormalizedVenue[] = [];

  for (const snapshot of deduplicated.snapshots) {
    const result = normalizeVenue({ snapshot, expectedAssetKey: assetKey, nowMs, policy });
    if (result.venue) normalized.push(result.venue);
    else excludedVenues.push({ venueId: normalizeVenueId(snapshot.venueId) || "unknown", reason: result.reason ?? "invalid_snapshot" });
  }

  const normalizedAdditionalBlockers = Array.from(new Set(
    (args.additionalBlockers ?? [])
      .map((blocker) => typeof blocker === "string"
        ? blocker.trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, "_").replace(/_+/g, "_").slice(0, 180)
        : "")
      .filter(Boolean),
  ));

  if (normalized.length === 0) {
    return unavailableResult({
      assetKey,
      generatedAt,
      excludedVenues,
      blockers: ["no_valid_order_book_snapshot", ...normalizedAdditionalBlockers],
      locale: args.locale,
      reportContextDepth: args.reportContextDepth,
      evidenceOrigin: args.evidenceOrigin,
    });
  }

  const initialMedian = median(normalized.map((venue) => venue.summary.midPrice));
  if (initialMedian === null || initialMedian <= 0) {
    return unavailableResult({ assetKey, generatedAt, excludedVenues, blockers: ["reference_price_unavailable", ...normalizedAdditionalBlockers], locale: args.locale, reportContextDepth: args.reportContextDepth, evidenceOrigin: args.evidenceOrigin });
  }

  const accepted = normalized.filter((venue) => {
    const divergence = Math.abs((venue.summary.midPrice / initialMedian) - 1) * 10_000;
    if (divergence <= policy.maximumCrossVenueMidDivergenceBps) return true;
    excludedVenues.push({ venueId: venue.summary.venueId, reason: "cross_venue_price_outlier" });
    return false;
  });
  if (accepted.length === 0) {
    return unavailableResult({ assetKey, generatedAt, excludedVenues, blockers: ["all_venues_excluded_as_outliers", ...normalizedAdditionalBlockers], locale: args.locale, reportContextDepth: args.reportContextDepth, evidenceOrigin: args.evidenceOrigin });
  }

  const referenceMidPrice = median(accepted.map((venue) => venue.summary.midPrice)) ?? initialMedian;
  const mids = accepted.map((venue) => venue.summary.midPrice);
  const crossVenueMidDivergenceBps = mids.length > 1
    ? ((Math.max(...mids) - Math.min(...mids)) / referenceMidPrice) * 10_000
    : 0;
  const bids = accepted.flatMap((venue) => venue.bids).sort((a, b) => b.price - a.price || a.venueId.localeCompare(b.venueId));
  const asks = accepted.flatMap((venue) => venue.asks).sort((a, b) => a.price - b.price || a.venueId.localeCompare(b.venueId));
  const executions = policy.notionalUsdGrid.flatMap((requestedNotionalUsd) => [
    simulateMarketExecution({ side: "buy", requestedNotionalUsd, referenceMidPrice, levels: asks }),
    simulateMarketExecution({ side: "sell", requestedNotionalUsd, referenceMidPrice, levels: bids }),
  ]);

  const largestNotional = policy.notionalUsdGrid.at(-1) ?? 100_000;
  const deepestVenue = [...accepted]
    .sort((a, b) => (b.summary.bidDepthUsd + b.summary.askDepthUsd) - (a.summary.bidDepthUsd + a.summary.askDepthUsd))[0]?.summary.venueId ?? null;
  const scenarios: MarketImpactScenarioResult[] = [
    scenario({ id: "visible_depth_minus_25", label: "Visible depth reduced by 25%", depthMultiplier: 0.75, spreadMultiplier: 1, removedVenueId: null, bids, asks, referenceMidPrice, largestNotional }),
    scenario({ id: "visible_depth_minus_50", label: "Visible depth reduced by 50%", depthMultiplier: 0.5, spreadMultiplier: 1, removedVenueId: null, bids, asks, referenceMidPrice, largestNotional }),
    scenario({ id: "visible_depth_minus_75", label: "Visible depth reduced by 75%", depthMultiplier: 0.25, spreadMultiplier: 1, removedVenueId: null, bids, asks, referenceMidPrice, largestNotional }),
    scenario({ id: "deepest_venue_outage", label: "Deepest venue unavailable", depthMultiplier: 1, spreadMultiplier: 1, removedVenueId: deepestVenue, bids, asks, referenceMidPrice, largestNotional }),
    scenario({ id: "spread_x3_depth_minus_50", label: "Spread tripled with 50% visible-depth loss", depthMultiplier: 0.5, spreadMultiplier: 3, removedVenueId: null, bids, asks, referenceMidPrice, largestNotional }),
  ];

  const providerFamilies = distinctProviderFamilies(accepted.map((venue) => venue.summary.providerFamily));
  const statuses = new Set<MarketImpactEvidenceStatus>(
    accepted.flatMap((venue) => venue.summary.quoteRateStatus
      ? [venue.summary.status, venue.summary.quoteRateStatus]
      : [venue.summary.status]),
  );
  const largestBuy = executions.find((execution) => execution.side === "buy" && execution.requestedNotionalUsd === largestNotional);
  const largestSell = executions.find((execution) => execution.side === "sell" && execution.requestedNotionalUsd === largestNotional);
  const blockers: string[] = [];
  if (accepted.length < policy.minimumVenueCount) blockers.push("independent_venue_count_below_threshold");
  if (providerFamilies.length < policy.minimumProviderFamilies) blockers.push("independent_provider_family_count_below_threshold");
  if (statuses.has("verified_fixture")) blockers.push("fixture_order_book_not_eligible_for_advanced");
  if ((largestBuy?.fillRatio ?? 0) < policy.minimumFillRatio) blockers.push("largest_buy_fill_ratio_below_threshold");
  if ((largestSell?.fillRatio ?? 0) < policy.minimumFillRatio) blockers.push("largest_sell_fill_ratio_below_threshold");
  if (crossVenueMidDivergenceBps > policy.maximumCrossVenueMidDivergenceBps) blockers.push("cross_venue_mid_divergence_above_threshold");
  for (const blocker of normalizedAdditionalBlockers) {
    if (!blockers.includes(blocker)) blockers.push(blocker);
  }

  const evidenceStatus: MarketImpactResult["evidenceStatus"] = statuses.has("verified_fixture")
    ? "fixture_only"
    : statuses.has("verified_staging")
      ? "verified_staging"
      : "verified_live";
  const core = {
    schemaVersion: "velmere.market-impact.v1" as const,
    assetKey,
    generatedAt,
    evidenceStatus,
    advancedReady: blockers.length === 0,
    providerFamilies,
    venues: accepted.map((venue) => venue.summary).sort((a, b) => a.venueId.localeCompare(b.venueId)),
    excludedVenues,
    referenceMidPrice: round(referenceMidPrice),
    crossVenueMidDivergenceBps: round(crossVenueMidDivergenceBps, 4),
    depthBands: depthBands(bids, asks, referenceMidPrice),
    executions,
    scenarios,
    missingEvidence: blockers,
    blockers,
  };
  const customerTruth = buildMarketImpactCustomerTruth({
    locale: args.locale,
    reportContextDepth: args.reportContextDepth,
    evidenceStatus,
    venues: core.venues,
    executions,
    providerFamilies,
    blockers,
    excludedVenues,
    evidenceOrigin: args.evidenceOrigin,
  });
  const digestCore = { ...core, customerTruth };
  return { ...digestCore, evidenceDigest: sha256Hex(canonicalJson(digestCore)) };
}

export function verifyMarketImpactResultIntegrity(result: MarketImpactResult): boolean {
  const { evidenceDigest, ...core } = result;
  return /^[a-f0-9]{64}$/.test(evidenceDigest) && sha256Hex(canonicalJson(core)) === evidenceDigest;
}
