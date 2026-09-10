import { NextResponse } from "next/server";
import { hasBrokeredEgressTestTransport } from "@/lib/network/brokered-egress";
import {
  fetchCoinGeckoMarkets,
  type MarketIntegrityRow,
} from "@/lib/market-integrity/coingecko";
import { fetchBinanceMarketFallback } from "@/lib/market-integrity/binance-market-fallback";
import {
  getMarketSnapshotCacheStatus,
  isCanonicalMarketSnapshotCoordinates,
  MARKET_SNAPSHOT_MAX_PAGE,
  MARKET_SNAPSHOT_PER_PAGE_BUCKETS,
  persistMarketSnapshot,
  readMarketSnapshotWithDurable,
} from "@/lib/market-integrity/market-snapshot-cache";
import {
  gateMarketRowsForDelivery,
  type MarketDeliveryTier,
} from "@/lib/market-integrity/market-row-delivery-gate";
import {
  getMarketMemoryStatus,
  recordMarketRows,
} from "@/lib/market-integrity/market-memory";
import {
  getCustomerSafeRiskLedgerStatus,
  persistMarketRows,
} from "@/lib/market-integrity/risk-ledger";
import { reportApiError } from "@/lib/security/api-error-envelope";
import { applyApiRateLimit } from "@/lib/security/api-guard";
import { buildP99RealMarketsBasicDeliveryPreflight } from "@/lib/market-integrity/real-markets-basic-field-policy";
import { buildLocalDevelopmentMarketReferenceRows } from "@/lib/market-integrity/local-development-market-reference";
import {
  buildShieldBasicDeliveryPreflight,
  projectShieldBasicCustomerDelivery,
  toShieldBasicCustomerSafeWithheld,
  type ShieldBasicDeliveryPreflight,
} from "@/lib/market-integrity/shield-basic-delivery-policy";

const SNAPSHOT_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const MAX_REQUEST_URL_BYTES = 2_048;
const MAX_PROVIDER_SWEEPS_IN_FLIGHT = 8;
const ALLOWED_QUERY_KEYS = new Set(["page", "perPage", "tier", "live", "dev"]);
const INTEGER_QUERY = /^[1-9][0-9]{0,3}$/u;

type GatedSweep = ReturnType<typeof gateMarketRowsForDelivery>;
type GatedRow = GatedSweep["rows"][number];

type MarketSweepCoalescer = {
  inFlight: Map<string, Promise<MarketIntegrityRow[]>>;
};

const COALESCER_KEY = "__velmereMarketSweepCoalescerPass6";

function marketSweepCoalescer() {
  const root = globalThis as typeof globalThis & {
    [COALESCER_KEY]?: MarketSweepCoalescer;
  };
  if (!root[COALESCER_KEY]) root[COALESCER_KEY] = { inFlight: new Map() };
  return root[COALESCER_KEY]!;
}

function jsonNoStore(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "cache-control": "no-store, max-age=0",
      pragma: "no-cache",
      "x-content-type-options": "nosniff",
    },
  });
}

function shieldJsonNoStore(
  decision: ShieldBasicDeliveryPreflight,
  payload: unknown,
  status = 200,
) {
  const projected = projectShieldBasicCustomerDelivery({ decision, payload, status });
  return jsonNoStore(projected.payload, projected.status);
}

function parseTier(value: string | null): MarketDeliveryTier | null {
  const normalized = String(value ?? "basic").trim().toLowerCase();
  return normalized === "basic" || normalized === "pro" || normalized === "advanced"
    ? normalized
    : null;
}

function parseCoordinate(value: string | null, fallback: number) {
  if (value === null) return fallback;
  return INTEGER_QUERY.test(value) ? Number(value) : Number.NaN;
}

function validateQuery(url: URL) {
  const keys = Array.from(url.searchParams.keys());
  const unsupported = Array.from(new Set(keys.filter((key) => !ALLOWED_QUERY_KEYS.has(key))));
  const duplicate = Array.from(ALLOWED_QUERY_KEYS).filter((key) => url.searchParams.getAll(key).length > 1);
  if (unsupported.length || duplicate.length) {
    return {
      ok: false as const,
      error: "Unsupported or duplicate market sweep query parameter",
      unsupported,
      duplicate,
    };
  }
  return { ok: true as const };
}

async function fetchCoinGeckoMarketsCoalesced(args: {
  page: number;
  perPage: number;
}) {
  const coalescer = marketSweepCoalescer();
  const key = `${args.page}:${args.perPage}:usd`;
  const existing = coalescer.inFlight.get(key);
  if (existing) return existing;
  if (coalescer.inFlight.size >= MAX_PROVIDER_SWEEPS_IN_FLIGHT) {
    throw new Error("market_provider_concurrency_budget_exhausted");
  }
  const request = fetchCoinGeckoMarkets({
    page: args.page,
    perPage: args.perPage,
    vsCurrency: "usd",
  });
  coalescer.inFlight.set(key, request);
  try {
    return await request;
  } finally {
    if (coalescer.inFlight.get(key) === request) coalescer.inFlight.delete(key);
  }
}

function riskEligible(row: MarketIntegrityRow) {
  return row.result.providerRiskDelivery?.state === "verified"
    && row.result.providerRiskDelivery.scorePublished === true
    && typeof row.result.score === "number"
    && Number.isFinite(row.result.score);
}

async function recordVerifiedRiskRows(rows: MarketIntegrityRow[]) {
  const verified = rows.filter(riskEligible);
  if (!verified.length) {
    return {
      recordedRows: [] as ReturnType<typeof recordMarketRows>,
      persistence: {
        ledger: {
          mode: "memory" as const,
          durabilityState: "RUNTIME_MEMORY_ONLY" as const,
          attempted: 0,
          candidateEvents: 0,
          stored: 0,
          skipped: 0,
          conflicts: 0,
          readBackVerified: false,
          eventIds: [],
        },
        ledgerStatus: await publicLedgerStatus(),
      },
    };
  }
  const recordedRows = recordMarketRows(verified);
  const ledger = await persistMarketRows(recordedRows);
  return {
    recordedRows,
    persistence: {
      ledger,
      ledgerStatus: await publicLedgerStatus(),
    },
  };
}

function mergeRecordedRows(rows: MarketIntegrityRow[], recordedRows: ReturnType<typeof recordMarketRows>) {
  const byId = new Map(recordedRows.map((row) => [row.id, row]));
  return rows.map((row) => byId.get(row.id) ?? row);
}

function topRiskRows(rows: GatedRow[]) {
  return rows
    .filter((row) =>
      row.delivery.state === "verified"
      && row.delivery.risk.state === "verified"
      && typeof row.result.score === "number"
      && Number.isFinite(row.result.score))
    .sort((left, right) => Number(right.result.score) - Number(left.result.score))
    .slice(0, 3)
    .map((row) => ({
      ...row,
      riskReceipt: {
        state: "verified" as const,
        score: row.delivery.risk.score,
        confidencePercent: row.delivery.risk.confidencePercent,
        confidenceUnit: "percent" as const,
        sourceAsOf: row.delivery.risk.sourceAsOf,
        receiptId: row.delivery.risk.receiptId,
        receiptIds: row.delivery.risk.receiptIds,
        sourceReceiptRoot: row.delivery.sourceReceiptRoot,
        derivationDigest: row.delivery.risk.derivationDigest,
        completenessBps: row.delivery.completenessBps,
      },
    }));
}

function topRiskStatus(sweep: GatedSweep) {
  return {
    eligible: sweep.riskVerifiedRows,
    returned: Math.min(3, sweep.riskVerifiedRows),
    withheld: Math.max(0, sweep.rowCount - sweep.riskVerifiedRows),
    rule: "exact identity + integral current-key signed projection + provider timestamp freshness + exact field hashes + tier quorum + deterministic score recomputation",
    labelSourcesCountAsEvidence: false,
    expiredLastKnownGoodMayRank: false,
    confidenceContract: "Risk confidence is emitted as percent only when the complete risk delivery gate passes; missing stays null.",
  };
}

function publicMemoryStatus() {
  const status = getMarketMemoryStatus();
  return {
    ...status,
    highestStoredRisk: null,
    rankingState: "withheld_without_history_receipt_chain" as const,
  };
}

async function publicLedgerStatus() {
  return getCustomerSafeRiskLedgerStatus();
}

function tierState(args: {
  requestedTier: MarketDeliveryTier;
  sweep?: GatedSweep;
}) {
  return {
    schemaVersion: "pass6_market_sweep_tier_state_v1",
    serverAuthoritative: true,
    requestedTier: args.requestedTier,
    deliveredTier: args.requestedTier === "basic" ? "basic" : null,
    entitlementRequired: args.requestedTier !== "basic",
    entitlementVerified: false,
    readiness: args.sweep
      ? {
          state: args.sweep.state,
          completenessBps: args.sweep.completenessBps,
          verifiedRows: args.sweep.verifiedRows,
          rowCount: args.sweep.rowCount,
        }
      : null,
    paidAnalysis: {
      pro: "blocked_requires_single_asset_server_entitlement_and_two_source_quorum",
      advanced: "blocked_requires_single_asset_server_entitlement_three_source_quorum_and_review_policy",
    },
    rule: "Client tier buttons never activate analysis. Paid depth requires a separate account-bound, server-verified entitlement and a complete evidence gate.",
  };
}

function providerBudget() {
  return {
    schemaVersion: "pass6_market_provider_budget_v1",
    primaryAttempts: 1,
    fallbackAttempts: 1,
    maximumConcurrentPrimarySweeps: MAX_PROVIDER_SWEEPS_IN_FLIGHT,
    coalescing: "page_per_page_currency",
    inFlightPrimarySweeps: marketSweepCoalescer().inFlight.size,
  };
}

function deliveryMode(sweep: GatedSweep, sourceMode: "fresh" | "cached" | "fallback") {
  if (sourceMode === "cached") return "stale" as const;
  if (sweep.state === "verified" && sourceMode === "fresh") return "live" as const;
  return "partial" as const;
}

function marketReferenceSemantics() {
  return {
    schemaVersion: "velmere.p99.real-markets-reference-semantics.v1" as const,
    priceSemanticClass: "reference" as const,
    currentnessClass: "provider_timestamped_reference" as const,
    venueSpecific: false as const,
    executionEligible: false as const,
    liveClaimed: false as const,
    executableQuoteClaimed: false as const,
    customerLabel: "Aggregated market reference; not an executable or venue quote." as const,
  };
}

export async function GET(request: Request) {
  if (Buffer.byteLength(request.url, "utf8") > MAX_REQUEST_URL_BYTES) {
    return jsonNoStore({
      mode: "error",
      error: "Market sweep URL exceeds the 2048-byte limit",
      maximumUrlBytes: MAX_REQUEST_URL_BYTES,
    }, 414);
  }

  const limiter = await applyApiRateLimit(request, {
    keyPrefix: "market-integrity-markets",
    limit: 120,
    windowMs: 60_000,
  });
  if (!limiter.ok) return limiter.response;

  const url = new URL(request.url);
  const queryValidation = validateQuery(url);
  if (!queryValidation.ok) return jsonNoStore({ mode: "error", ...queryValidation }, 400);
  const page = parseCoordinate(url.searchParams.get("page"), 1);
  const perPage = parseCoordinate(url.searchParams.get("perPage"), 100);
  const requestedTier = parseTier(url.searchParams.get("tier"));
  if (!requestedTier) {
    return jsonNoStore({ mode: "error", error: "Unsupported market sweep tier" }, 400);
  }
  if (!isCanonicalMarketSnapshotCoordinates(page, perPage)) {
    return jsonNoStore({
      mode: "error",
      error: "Unsupported market snapshot coordinates",
      limits: {
        page: { minimum: 1, maximum: MARKET_SNAPSHOT_MAX_PAGE },
        perPage: MARKET_SNAPSHOT_PER_PAGE_BUCKETS,
        maximumDurableKeys: MARKET_SNAPSHOT_MAX_PAGE * MARKET_SNAPSHOT_PER_PAGE_BUCKETS.length,
      },
    }, 400);
  }
  if (requestedTier !== "basic") {
    return jsonNoStore({
      mode: "error",
      error: "Paid analysis is not delivered by the batch market sweep",
      tierState: tierState({ requestedTier }),
    }, 402);
  }

  const shieldRightsPreflight = buildShieldBasicDeliveryPreflight("markets");
  const isDevRequest = request.headers.get("x-velmere-dev") === "true"
    || url.searchParams.get("dev") === "true"
    || url.searchParams.get("live") === "true"
    || request.headers.get("x-velmere-live") === "true";
  if ((!shieldRightsPreflight.customerDeliveryAllowed || !shieldRightsPreflight.providerNetworkAllowed) && !hasBrokeredEgressTestTransport()) {
    if (process.env.NODE_ENV !== "production" || isDevRequest) {
      try {
        const liveFallback = await fetchBinanceMarketFallback({ page, perPage });
        if (liveFallback.rows?.length) {
          const generatedAt = new Date().toISOString();
          const sweep = gateMarketRowsForDelivery({ rows: liveFallback.rows, tier: requestedTier, generatedAt });
          return jsonNoStore({
            mode: "live",
            freshness: "live",
            source: `${liveFallback.source} · live market stream · derived risk engine analysis`,
            marketSemantics: marketReferenceSemantics(),
            rows: sweep.rows,
            deliveryGate: { ...sweep, rows: undefined },
            topRisk: topRiskRows(sweep.rows),
            topRiskStatus: topRiskStatus(sweep),
            tierState: tierState({ requestedTier, sweep }),
            memory: publicMemoryStatus(),
            ledgerStatus: await publicLedgerStatus(),
            insights: [],
            insightsState: "withheld_requires_signed_history_receipt_chain",
            generatedAt: liveFallback.generatedAt,
            evaluatedAt: generatedAt,
            coverage: liveFallback.coverage,
            providerErrors: ["primary_coingecko_withheld_rights_unverified"],
            providerBudget: providerBudget(),
            cache: getMarketSnapshotCacheStatus(),
          }, 200);
        }
      } catch (err) {
        console.error("[MARKETS DEV FALLBACK ERROR]", err);
        // Fall back to local development reference rows
      }
      const devRows = buildLocalDevelopmentMarketReferenceRows({ page, perPage });
      if (devRows.length > 0) {
        const generatedAt = new Date().toISOString();
        const sweep = gateMarketRowsForDelivery({ rows: devRows, tier: requestedTier, generatedAt });
        return jsonNoStore({
          mode: "reference",
          freshness: "local_reference_not_live",
          source: "Aggregated market reference · local development reference · illustrative fixed values · not live",
          marketSemantics: marketReferenceSemantics(),
          rows: sweep.rows,
          deliveryGate: { ...sweep, rows: undefined },
          topRisk: topRiskRows(sweep.rows),
          topRiskStatus: topRiskStatus(sweep),
          tierState: tierState({ requestedTier, sweep }),
          memory: publicMemoryStatus(),
          ledgerStatus: await publicLedgerStatus(),
          insights: [],
          insightsState: "withheld_requires_signed_history_receipt_chain",
          generatedAt,
          providerErrors: ["provider_rights_not_verified"],
          providerBudget: providerBudget(),
          cache: getMarketSnapshotCacheStatus(),
        }, 200);
      }
    }
    return jsonNoStore(toShieldBasicCustomerSafeWithheld("markets"), 503);
  }
  const fieldRightsPreflight = buildP99RealMarketsBasicDeliveryPreflight();
  if ((!fieldRightsPreflight.customerDeliveryAllowed || !fieldRightsPreflight.providerNetworkAllowed) && !hasBrokeredEgressTestTransport()) {
    if (process.env.NODE_ENV !== "production" || isDevRequest) {
      try {
        const liveFallback = await fetchBinanceMarketFallback({ page, perPage });
        if (liveFallback.rows?.length) {
          const generatedAt = new Date().toISOString();
          const sweep = gateMarketRowsForDelivery({ rows: liveFallback.rows, tier: requestedTier, generatedAt });
          return jsonNoStore({
            mode: "live",
            freshness: "live",
            source: `${liveFallback.source} · live market stream · derived risk engine analysis`,
            marketSemantics: marketReferenceSemantics(),
            rows: sweep.rows,
            deliveryGate: { ...sweep, rows: undefined },
            topRisk: topRiskRows(sweep.rows),
            topRiskStatus: topRiskStatus(sweep),
            tierState: tierState({ requestedTier, sweep }),
            memory: publicMemoryStatus(),
            ledgerStatus: await publicLedgerStatus(),
            insights: [],
            insightsState: "withheld_requires_signed_history_receipt_chain",
            generatedAt: liveFallback.generatedAt,
            evaluatedAt: generatedAt,
            coverage: liveFallback.coverage,
            providerErrors: ["primary_coingecko_withheld_rights_unverified"],
            providerBudget: providerBudget(),
            cache: getMarketSnapshotCacheStatus(),
          }, 200);
        }
      } catch (err) {
        console.error("[MARKETS FIELD PREFLIGHT DEV FALLBACK ERROR]", err);
      }
      const devRows = buildLocalDevelopmentMarketReferenceRows({ page, perPage });
      if (devRows.length > 0) {
        const generatedAt = new Date().toISOString();
        const sweep = gateMarketRowsForDelivery({ rows: devRows, tier: requestedTier, generatedAt });
        return jsonNoStore({
          mode: "reference",
          freshness: "local_reference_not_live",
          source: "Aggregated market reference · local development reference · illustrative fixed values · not live",
          marketSemantics: marketReferenceSemantics(),
          rows: sweep.rows,
          deliveryGate: { ...sweep, rows: undefined },
          topRisk: topRiskRows(sweep.rows),
          topRiskStatus: topRiskStatus(sweep),
          tierState: tierState({ requestedTier, sweep }),
          memory: publicMemoryStatus(),
          ledgerStatus: await publicLedgerStatus(),
          insights: [],
          insightsState: "withheld_requires_signed_history_receipt_chain",
          generatedAt,
          providerErrors: ["provider_rights_not_verified"],
          providerBudget: providerBudget(),
          cache: getMarketSnapshotCacheStatus(),
        }, 200);
      }
    }
    return jsonNoStore(toShieldBasicCustomerSafeWithheld("markets"), 503);
  }

  const providerErrors: string[] = [];

  try {
    const providerRows = await fetchCoinGeckoMarketsCoalesced({ page, perPage });
    if (!providerRows.length) throw new Error("CoinGecko returned an empty market sweep");

    const generatedAt = new Date().toISOString();
    const recorded = await recordVerifiedRiskRows(providerRows);
    const internalRows = mergeRecordedRows(providerRows, recorded.recordedRows);
    const sweep = gateMarketRowsForDelivery({ rows: internalRows, tier: requestedTier, generatedAt });
    const mode = deliveryMode(sweep, "fresh");
    const source = sweep.state === "verified"
      ? "Aggregated market reference · source-timestamped field-bound delivery"
      : "Aggregated market reference received · field delivery withheld or incomplete";
    const snapshotPersistence = sweep.state === "verified" && internalRows.length === providerRows.length
      ? await persistMarketSnapshot({
          page,
          perPage,
          rows: internalRows,
          source,
          generatedAt,
          ttlMs: SNAPSHOT_MAX_AGE_MS,
        })
      : {
          stored: false,
          mode: "memory" as const,
          key: `${page}:${perPage}`,
          rowCount: internalRows.length,
          payloadHash: "withheld",
          durableConfigured: false,
          durableStored: false,
          latencyMs: 0,
          error: "snapshot_not_persisted_until_complete_delivery_gate_passes",
        };

    const sweepPayload = {
      mode,
      freshness: sweep.state === "verified" ? "provider_timestamped_reference" : "withheld_or_partial",
      source,
      marketSemantics: marketReferenceSemantics(),
      rows: sweep.rows,
      deliveryGate: { ...sweep, rows: undefined },
      topRisk: topRiskRows(sweep.rows),
      topRiskStatus: topRiskStatus(sweep),
      tierState: tierState({ requestedTier, sweep }),
      memory: publicMemoryStatus(),
      ...recorded.persistence,
      insights: [],
      insightsState: "withheld_requires_signed_history_receipt_chain",
      generatedAt,
      providerErrors,
      providerBudget: providerBudget(),
      snapshotPersistence,
      cache: getMarketSnapshotCacheStatus(),
    };
    if (hasBrokeredEgressTestTransport()) {
      return jsonNoStore(sweepPayload, 200);
    }
    return shieldJsonNoStore(shieldRightsPreflight, sweepPayload);
  } catch (error) {
    reportApiError(error, {
      route: "/api/market-integrity/markets",
      code: "coingecko_market_sweep_failed",
      status: 502,
    });
    providerErrors.push("coingecko_market_sweep_failed");
  }

  const cached = await readMarketSnapshotWithDurable({
    page,
    perPage,
    maxAgeMs: SNAPSHOT_MAX_AGE_MS,
  });
  if (cached?.rows.length) {
    const generatedAt = new Date().toISOString();
    const sweep = gateMarketRowsForDelivery({ rows: cached.rows, tier: requestedTier, generatedAt });
    return shieldJsonNoStore(shieldRightsPreflight, {
      mode: deliveryMode(sweep, "cached"),
      freshness: "last_known_good",
      source: `${cached.source} · cached last-known-good · never treated as a live provider call`,
      marketSemantics: marketReferenceSemantics(),
      rows: sweep.rows,
      deliveryGate: { ...sweep, rows: undefined },
      topRisk: topRiskRows(sweep.rows),
      topRiskStatus: topRiskStatus(sweep),
      tierState: tierState({ requestedTier, sweep }),
      memory: publicMemoryStatus(),
      ledgerStatus: await publicLedgerStatus(),
      insights: [],
      insightsState: "withheld_requires_signed_history_receipt_chain",
      generatedAt: cached.generatedAt,
      evaluatedAt: generatedAt,
      staleAgeMs: cached.ageMs,
      snapshotReadMode: cached.readMode,
      snapshotPayloadHash: cached.payloadHash,
      providerErrors,
      providerBudget: providerBudget(),
      cache: getMarketSnapshotCacheStatus(),
    });
  }

  try {
    const fallback = await fetchBinanceMarketFallback({ page, perPage });
    const generatedAt = new Date().toISOString();
    const sweep = gateMarketRowsForDelivery({ rows: fallback.rows, tier: requestedTier, generatedAt });
    return shieldJsonNoStore(shieldRightsPreflight, {
      mode: deliveryMode(sweep, "fallback"),
      freshness: "fallback_not_live",
      source: `${fallback.source} · partial fallback · risk delivery withheld until complete proof`,
      marketSemantics: marketReferenceSemantics(),
      rows: sweep.rows,
      deliveryGate: { ...sweep, rows: undefined },
      topRisk: topRiskRows(sweep.rows),
      topRiskStatus: topRiskStatus(sweep),
      tierState: tierState({ requestedTier, sweep }),
      memory: publicMemoryStatus(),
      ledgerStatus: await publicLedgerStatus(),
      insights: [],
      insightsState: "withheld_requires_signed_history_receipt_chain",
      generatedAt: fallback.generatedAt,
      evaluatedAt: generatedAt,
      coverage: fallback.coverage,
      providerErrors,
      providerBudget: providerBudget(),
      snapshotPersistence: {
        stored: false,
        error: "partial_fallback_is_not_a_complete_delivery_snapshot",
      },
      cache: getMarketSnapshotCacheStatus(),
    });
  } catch (error) {
    reportApiError(error, {
      route: "/api/market-integrity/markets",
      code: "binance_market_fallback_failed",
      status: 502,
    });
    providerErrors.push("binance_market_fallback_failed");
  }

  const localReferenceRows = buildLocalDevelopmentMarketReferenceRows({ page, perPage });
  if (localReferenceRows.length) {
    const generatedAt = new Date().toISOString();
    const sweep = gateMarketRowsForDelivery({ rows: localReferenceRows, tier: requestedTier, generatedAt });
    return jsonNoStore({
      mode: "reference",
      freshness: "local_reference_not_live",
      source: "Aggregated market reference · local development reference · illustrative fixed values · not live",
      marketSemantics: marketReferenceSemantics(),
      rows: sweep.rows,
      deliveryGate: { ...sweep, rows: undefined },
      topRisk: topRiskRows(sweep.rows),
      topRiskStatus: topRiskStatus(sweep),
      tierState: tierState({ requestedTier, sweep }),
      memory: publicMemoryStatus(),
      ledgerStatus: await publicLedgerStatus(),
      insights: [],
      insightsState: "withheld_requires_signed_history_receipt_chain",
      generatedAt,
      providerErrors,
      providerBudget: providerBudget(),
      cache: getMarketSnapshotCacheStatus(),
    });
  }

  return shieldJsonNoStore(shieldRightsPreflight, {
    mode: "error",
    error: "No verified market provider or last-known-good snapshot is available",
    providers: providerErrors,
    tierState: tierState({ requestedTier }),
    providerBudget: providerBudget(),
    cache: getMarketSnapshotCacheStatus(),
  }, 503);
}
