import { canonicalJson } from "../security/canonical-json";
import { sha256Hex } from "../security/cryptographic-digest";
import { readJsonResponseBounded, VELMERE_FETCH_TIMEOUTS } from "../network/fetch-with-deadline";
import { brokeredEgressFetch } from "../network/brokered-egress";
import { verifyMarketAssetBinding, type MarketAssetBindingArtifact, type MarketAssetBindingPayload } from "./market-asset-binding";
import {
  parseBinanceOrderBook,
  parseMexcOrderBook,
  parseCoinbaseOrderBook,
  parseKrakenOrderBook,
} from "./market-impact-provider-adapters";
import type {
  MarketImpactQuoteRateEvidence,
  MarketImpactVenueSnapshot,
} from "./market-impact-types";
import { createProviderReliabilityControlPlane, type ProviderReliabilityReceipt } from "./provider-reliability-control-plane";
import { createProviderReliabilitySharedAttemptHooks } from "./provider-reliability-shared-state";
import type {
  WhaleCapabilityReceipt,
  WhaleHolderSnapshot,
  WhaleTransferEvent,
} from "./whale-watch-types";
import {
  canonicalWhaleEventId,
  deduplicateCanonicalWhaleTransfers,
} from "./whale-watch-onchain-event-identity";

export const PASS4798_SERVER_PROVIDER_RUNTIME_ID = "pass4798-server-owned-market-intelligence-v1";

export type ServerProviderState = "ok" | "failed" | "blocked" | "not_configured";
export type ServerProviderCacheState = "miss" | "hit" | "shared_inflight";
export type EvidenceMode = "server_owned" | "trusted_ingress";

export interface ServerProviderReceipt {
  capability: "order_book" | "quote_conversion" | "holder_distribution" | "transfer_history";
  providerFamily: string;
  endpointId: string;
  state: ServerProviderState;
  observedAt: string;
  latencyMs: number;
  recordCount: number;
  sourceDigest: string | null;
  errorCode: string | null;
  reliability: {
    state: ProviderReliabilityReceipt["state"];
    failureKind: ProviderReliabilityReceipt["failureKind"];
    circuitState: ProviderReliabilityReceipt["circuitState"];
    attemptCount: number;
    sharedExecution: boolean;
    evidenceEligible: boolean;
    quotaRemaining: number;
    quotaResetAtMs: number;
    schemaFingerprint: string | null;
    schemaState: ProviderReliabilityReceipt["schemaState"];
    distributedState: ProviderReliabilityReceipt["distributedState"];
    blockers: string[];
  } | null;
}

export interface ServerOwnedBindingSummary {
  state: "canonical_symbol" | "verified_signed_binding" | "required" | "invalid";
  chainId: string | null;
  tokenAddress: string | null;
  tokenSymbol: string;
  quoteAsset: "USD" | "USDT" | "USDC";
  venueMarkets: MarketAssetBindingPayload["venueMarkets"];
  artifactDigest: string | null;
  error: string | null;
}

export interface ServerOwnedMarketEvidence {
  schemaVersion: "velmere.server-owned-market-evidence.v1";
  assetKey: string;
  generatedAt: string;
  cacheState: ServerProviderCacheState;
  binding: ServerOwnedBindingSummary;
  snapshots: MarketImpactVenueSnapshot[];
  receipts: ServerProviderReceipt[];
  blockers: string[];
  integrity: { algorithm: "sha256"; digest: string };
}

export interface ServerOwnedWhaleEvidence {
  schemaVersion: "velmere.server-owned-whale-evidence.v1";
  assetKey: string;
  generatedAt: string;
  cacheState: ServerProviderCacheState;
  binding: ServerOwnedBindingSummary;
  totalSupply: number | null;
  priceUsd: number | null;
  holders: WhaleHolderSnapshot[];
  transfers: WhaleTransferEvent[];
  capabilityReceipts: WhaleCapabilityReceipt[];
  providerReceipts: ServerProviderReceipt[];
  blockers: string[];
  integrity: { algorithm: "sha256"; digest: string };
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type ProviderOptions = {
  now?: Date;
  fetchImpl?: FetchLike;
  bindingArtifact?: MarketAssetBindingArtifact | null;
  bindingSecret?: string;
  bypassCache?: boolean;
};

type WhaleProviderOptions = ProviderOptions & {
  fallbackPriceUsd?: number | null;
};

type CanonicalMarkets = {
  tokenSymbol: string;
  binance?: string;
  mexc?: string;
  coinbase?: string;
  kraken?: string;
};

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MARKET_CACHE_TTL_MS = 10_000;
const WHALE_CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 128;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const CANONICAL_MARKETS: Record<string, CanonicalMarkets> = {
  BTC: { tokenSymbol: "BTC", binance: "BTCUSDT", mexc: "BTCUSDT", coinbase: "BTC-USD", kraken: "XBTUSD" },
  ETH: { tokenSymbol: "ETH", binance: "ETHUSDT", mexc: "ETHUSDT", coinbase: "ETH-USD", kraken: "ETHUSD" },
  SOL: { tokenSymbol: "SOL", binance: "SOLUSDT", mexc: "SOLUSDT", coinbase: "SOL-USD", kraken: "SOLUSD" },
  BNB: { tokenSymbol: "BNB", binance: "BNBUSDT", mexc: "BNBUSDT" },
  XRP: { tokenSymbol: "XRP", binance: "XRPUSDT", mexc: "XRPUSDT", coinbase: "XRP-USD", kraken: "XRPUSD" },
  ADA: { tokenSymbol: "ADA", binance: "ADAUSDT", mexc: "ADAUSDT", coinbase: "ADA-USD", kraken: "ADAUSD" },
  DOGE: { tokenSymbol: "DOGE", binance: "DOGEUSDT", mexc: "DOGEUSDT", coinbase: "DOGE-USD", kraken: "XDGUSD" },
  LINK: { tokenSymbol: "LINK", binance: "LINKUSDT", mexc: "LINKUSDT", coinbase: "LINK-USD", kraken: "LINKUSD" },
  AVAX: { tokenSymbol: "AVAX", binance: "AVAXUSDT", mexc: "AVAXUSDT", coinbase: "AVAX-USD", kraken: "AVAXUSD" },
  DOT: { tokenSymbol: "DOT", binance: "DOTUSDT", mexc: "DOTUSDT", coinbase: "DOT-USD", kraken: "DOTUSD" },
  LTC: { tokenSymbol: "LTC", binance: "LTCUSDT", mexc: "LTCUSDT", coinbase: "LTC-USD", kraken: "LTCUSD" },
  BCH: { tokenSymbol: "BCH", binance: "BCHUSDT", mexc: "BCHUSDT", coinbase: "BCH-USD", kraken: "BCHUSD" },
  XLM: { tokenSymbol: "XLM", binance: "XLMUSDT", mexc: "XLMUSDT", coinbase: "XLM-USD", kraken: "XLMUSD" },
  UNI: { tokenSymbol: "UNI", binance: "UNIUSDT", mexc: "UNIUSDT", coinbase: "UNI-USD", kraken: "UNIUSD" },
  ATOM: { tokenSymbol: "ATOM", binance: "ATOMUSDT", mexc: "ATOMUSDT", coinbase: "ATOM-USD", kraken: "ATOMUSD" },
  NEAR: { tokenSymbol: "NEAR", binance: "NEARUSDT", mexc: "NEARUSDT", coinbase: "NEAR-USD", kraken: "NEARUSD" },
  AAVE: { tokenSymbol: "AAVE", binance: "AAVEUSDT", mexc: "AAVEUSDT", coinbase: "AAVE-USD", kraken: "AAVEUSD" },
  ETC: { tokenSymbol: "ETC", binance: "ETCUSDT", mexc: "ETCUSDT", coinbase: "ETC-USD", kraken: "ETCUSD" },
};

const providerSharedHooks = createProviderReliabilitySharedAttemptHooks();
const serverOwnedProviderReliability = createProviderReliabilityControlPlane({
  beforeAttempt: providerSharedHooks.beforeAttempt,
  afterAttempt: providerSharedHooks.afterAttempt,
});

const marketCache = new Map<string, { expiresAt: number; value: ServerOwnedMarketEvidence }>();
const marketInflight = new Map<string, Promise<ServerOwnedMarketEvidence>>();
const whaleCache = new Map<string, { expiresAt: number; value: ServerOwnedWhaleEvidence }>();
const whaleInflight = new Map<string, Promise<ServerOwnedWhaleEvidence>>();

function cleanAssetKey(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "").slice(0, 120);
}

function cleanError(error: unknown) {
  const message = error instanceof Error ? error.message : "provider_failed";
  return message.toLowerCase().replace(/[^a-z0-9_:-]+/g, "_").slice(0, 120) || "provider_failed";
}

function finitePositive(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(String(value ?? ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function finiteNonNegative(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(String(value ?? ""));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function safeIso(value: unknown) {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function digestPayload(value: unknown) {
  return sha256Hex(canonicalJson(value));
}

function marketUnsigned(value: ServerOwnedMarketEvidence): Omit<ServerOwnedMarketEvidence, "integrity"> {
  return {
    schemaVersion: value.schemaVersion,
    assetKey: value.assetKey,
    generatedAt: value.generatedAt,
    cacheState: value.cacheState,
    binding: value.binding,
    snapshots: value.snapshots,
    receipts: value.receipts,
    blockers: value.blockers,
  };
}

function whaleUnsigned(value: ServerOwnedWhaleEvidence): Omit<ServerOwnedWhaleEvidence, "integrity"> {
  return {
    schemaVersion: value.schemaVersion,
    assetKey: value.assetKey,
    generatedAt: value.generatedAt,
    cacheState: value.cacheState,
    binding: value.binding,
    totalSupply: value.totalSupply,
    priceUsd: value.priceUsd,
    holders: value.holders,
    transfers: value.transfers,
    capabilityReceipts: value.capabilityReceipts,
    providerReceipts: value.providerReceipts,
    blockers: value.blockers,
  };
}

function signMarket(value: Omit<ServerOwnedMarketEvidence, "integrity">): ServerOwnedMarketEvidence {
  return { ...value, integrity: { algorithm: "sha256", digest: digestPayload(value) } };
}

function signWhale(value: Omit<ServerOwnedWhaleEvidence, "integrity">): ServerOwnedWhaleEvidence {
  return { ...value, integrity: { algorithm: "sha256", digest: digestPayload(value) } };
}

export function verifyServerOwnedMarketEvidenceIntegrity(value: ServerOwnedMarketEvidence): boolean {
  return /^[a-f0-9]{64}$/.test(value.integrity.digest) && value.integrity.digest === digestPayload(marketUnsigned(value));
}

export function verifyServerOwnedWhaleEvidenceIntegrity(value: ServerOwnedWhaleEvidence): boolean {
  return /^[a-f0-9]{64}$/.test(value.integrity.digest) && value.integrity.digest === digestPayload(whaleUnsigned(value));
}

function trimCache<T>(cache: Map<string, T>) {
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

function cloneMarketWithCacheState(value: ServerOwnedMarketEvidence, cacheState: ServerProviderCacheState) {
  return signMarket({ ...marketUnsigned(value), cacheState });
}

function cloneWhaleWithCacheState(value: ServerOwnedWhaleEvidence, cacheState: ServerProviderCacheState) {
  return signWhale({ ...whaleUnsigned(value), cacheState });
}

function defaultFetch(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof input !== "string" && !(input instanceof URL)) throw new Error("market_intelligence_request_object_forbidden");
  return brokeredEgressFetch(input, init, {
    profile: "market_intelligence",
    operation: "market_intelligence_provider",
    timeoutMs: VELMERE_FETCH_TIMEOUTS.provider,
  });
}

type ReliableJsonFetchResult = { payload: unknown; receipt: ProviderReliabilityReceipt };

class ReliableProviderFetchError extends Error {
  readonly receipt: ProviderReliabilityReceipt;
  constructor(receipt: ProviderReliabilityReceipt) {
    super(`provider_reliability_${receipt.failureKind ?? receipt.state}`);
    this.name = "ReliableProviderFetchError";
    this.receipt = receipt;
  }
}

function reliabilityProjection(receipt: ProviderReliabilityReceipt | null | undefined): ServerProviderReceipt["reliability"] {
  if (!receipt) return null;
  return {
    state: receipt.state,
    failureKind: receipt.failureKind,
    circuitState: receipt.circuitState,
    attemptCount: receipt.attemptCount,
    sharedExecution: receipt.sharedExecution,
    evidenceEligible: receipt.evidenceEligible,
    quotaRemaining: receipt.quota.remaining,
    quotaResetAtMs: receipt.quota.resetAtMs,
    schemaFingerprint: receipt.schemaFingerprint,
    schemaState: receipt.schemaState,
    distributedState: receipt.distributedState ? { ...receipt.distributedState, quota: { ...receipt.distributedState.quota }, blockers: [...receipt.distributedState.blockers] } : null,
    blockers: [...receipt.blockers],
  };
}

function reliabilityFromError(error: unknown) {
  return error instanceof ReliableProviderFetchError ? error.receipt : null;
}

function providerStateFromError(error: unknown): ServerProviderState {
  const reliability = reliabilityFromError(error);
  return reliability?.state === "blocked" ? "blocked" : "failed";
}

async function reliableJsonFetch(args: {
  fetchImpl: FetchLike;
  url: URL;
  providerId: string;
  endpointId: string;
  cacheKey: string;
  init?: RequestInit;
  schemaProjection?: (payload: unknown) => unknown;
  quotaLimit?: number;
}): Promise<ReliableJsonFetchResult> {
  const result = await serverOwnedProviderReliability.execute({
    providerId: args.providerId,
    endpointId: args.endpointId,
    cacheKey: args.cacheKey,
    validate: (value) => value !== null && typeof value === "object",
    schemaProjection: args.schemaProjection,
    policy: {
      freshTtlMs: 5_000,
      staleTtlMs: 120_000,
      timeoutMs: VELMERE_FETCH_TIMEOUTS.provider,
      maxAttempts: 3,
      retryBaseDelayMs: 80,
      retryMaxDelayMs: 750,
      failureThreshold: 3,
      cooldownMs: 20_000,
      quotaLimit: args.quotaLimit ?? 120,
      quotaWindowMs: 60_000,
      allowStaleOnFailure: true,
      rejectSchemaDrift: true,
    },
    execute: async (signal) => {
      const response = await args.fetchImpl(args.url, {
        ...args.init,
        signal,
        headers: {
          accept: "application/json",
          "user-agent": "Velmere-Market-Intelligence/1.0",
          ...(args.init?.headers ?? {}),
        },
        cache: "no-store",
      });
      if (!response.ok) throw Object.assign(new Error(`provider_http_${response.status}`), { status: response.status });
      return readJsonResponseBounded<unknown>(response, MAX_RESPONSE_BYTES);
    },
  });
  if (!result.ok || result.value === null || !result.receipt.evidenceEligible) throw new ReliableProviderFetchError(result.receipt);
  return { payload: result.value, receipt: result.receipt };
}

function bindingSummary(args: {
  assetKey: string;
  artifact?: MarketAssetBindingArtifact | null;
  secret?: string;
  now: Date;
}): ServerOwnedBindingSummary {
  const assetKey = cleanAssetKey(args.assetKey);
  if (args.artifact) {
    const secret = args.secret?.trim() ?? "";
    if (secret.length < 32) {
      return {
        state: "invalid", chainId: null, tokenAddress: null, tokenSymbol: assetKey,
        quoteAsset: "USD", venueMarkets: {}, artifactDigest: null,
        error: "market_asset_binding_secret_missing",
      };
    }
    const verdict = verifyMarketAssetBinding({
      artifact: args.artifact,
      secret,
      now: args.now,
      expected: { tokenSymbol: assetKey },
    });
    if (!verdict.ok) {
      return {
        state: "invalid", chainId: null, tokenAddress: null, tokenSymbol: assetKey,
        quoteAsset: "USD", venueMarkets: {}, artifactDigest: null, error: verdict.error,
      };
    }
    return {
      state: "verified_signed_binding",
      chainId: verdict.artifact.payload.chainId,
      tokenAddress: verdict.artifact.payload.tokenAddress,
      tokenSymbol: verdict.artifact.payload.tokenSymbol,
      quoteAsset: verdict.artifact.payload.quoteAsset,
      venueMarkets: verdict.artifact.payload.venueMarkets,
      artifactDigest: verdict.artifact.payloadDigest,
      error: null,
    };
  }
  const canonical = CANONICAL_MARKETS[assetKey] ?? CANONICAL_MARKETS[assetKey.split(/[-_/]/)[0]];
  if (!canonical) {
    return {
      state: "required", chainId: null, tokenAddress: null, tokenSymbol: assetKey,
      quoteAsset: "USD", venueMarkets: {}, artifactDigest: null,
      error: "signed_market_asset_binding_required",
    };
  }
  return {
    state: "canonical_symbol",
    chainId: null,
    tokenAddress: null,
    tokenSymbol: canonical.tokenSymbol,
    quoteAsset: "USD",
    venueMarkets: { binance: canonical.binance, mexc: canonical.mexc, coinbase: canonical.coinbase, kraken: canonical.kraken },
    artifactDigest: null,
    error: null,
  };
}

function providerReceipt(args: Omit<ServerProviderReceipt, "sourceDigest" | "errorCode" | "reliability"> & { sourceDigest?: string | null; errorCode?: string | null; reliability?: ProviderReliabilityReceipt | null }): ServerProviderReceipt {
  return {
    ...args,
    sourceDigest: args.sourceDigest ?? null,
    errorCode: args.errorCode ?? null,
    reliability: reliabilityProjection(args.reliability),
  };
}

async function fetchUsdtUsdRate(fetchImpl: FetchLike, nowIso: string): Promise<{ evidence: MarketImpactQuoteRateEvidence | null; receipt: ServerProviderReceipt }> {
  const started = Date.now();
  try {
    const url = new URL("https://api.exchange.coinbase.com/products/USDT-USD/ticker");
    const fetched = await reliableJsonFetch({
      fetchImpl, url, providerId: "coinbase", endpointId: "coinbase_usdt_usd_ticker", cacheKey: "USDT-USD",
      schemaProjection: (payload) => ({ price: typeof (payload as { price?: unknown })?.price }),
    });
    const payload = fetched.payload;
    const price = finitePositive((payload as { price?: unknown })?.price);
    if (!price) throw new Error("quote_conversion_price_missing");
    const sourceDigest = digestPayload({ providerFamily: "coinbase", pair: "USDT-USD", observedAt: nowIso, payload });
    return {
      evidence: { usdRate: price, observedAt: nowIso, status: "verified_live", providerFamily: "coinbase", sourceDigest },
      receipt: providerReceipt({ capability: "quote_conversion", providerFamily: "coinbase", endpointId: "coinbase_usdt_usd_ticker", state: "ok", observedAt: nowIso, latencyMs: Date.now() - started, recordCount: 1, sourceDigest, reliability: fetched.receipt }),
    };
  } catch (error) {
    return {
      evidence: null,
      receipt: providerReceipt({ capability: "quote_conversion", providerFamily: "coinbase", endpointId: "coinbase_usdt_usd_ticker", state: providerStateFromError(error), observedAt: nowIso, latencyMs: Date.now() - started, recordCount: 0, errorCode: cleanError(error), reliability: reliabilityFromError(error) }),
    };
  }
}

async function fetchOrderBooks(args: {
  assetKey: string;
  binding: ServerOwnedBindingSummary;
  now: Date;
  fetchImpl: FetchLike;
}): Promise<{ snapshots: MarketImpactVenueSnapshot[]; receipts: ServerProviderReceipt[]; blockers: string[] }> {
  const nowIso = args.now.toISOString();
  const snapshots: MarketImpactVenueSnapshot[] = [];
  const receipts: ServerProviderReceipt[] = [];
  const blockers = new Set<string>();
  const tasks: Array<Promise<void>> = [];

  const binanceMarket = args.binding.venueMarkets.binance;
  if (binanceMarket) {
    tasks.push((async () => {
      const started = Date.now();
      try {
        const url = new URL("https://api.binance.com/api/v3/depth");
        url.searchParams.set("symbol", binanceMarket);
        url.searchParams.set("limit", "100");
        const fetched = await reliableJsonFetch({
          fetchImpl: args.fetchImpl, url, providerId: "binance", endpointId: "binance_spot_depth", cacheKey: binanceMarket,
          schemaProjection: (payload) => ({ bids: Array.isArray((payload as { bids?: unknown })?.bids), asks: Array.isArray((payload as { asks?: unknown })?.asks), lastUpdateId: typeof (payload as { lastUpdateId?: unknown })?.lastUpdateId }),
        });
        const payload = fetched.payload;
        const snapshot = parseBinanceOrderBook({ payload, assetKey: args.assetKey, observedAt: nowIso, status: "verified_live", marketId: binanceMarket });
        const quote = await fetchUsdtUsdRate(args.fetchImpl, nowIso);
        receipts.push(quote.receipt);
        if (quote.evidence) snapshot.quoteToUsd = quote.evidence;
        else blockers.add("binance_usdt_usd_conversion_unavailable");
        snapshots.push(snapshot);
        receipts.push(providerReceipt({ capability: "order_book", providerFamily: "binance", endpointId: "binance_spot_depth", state: "ok", observedAt: nowIso, latencyMs: Date.now() - started, recordCount: snapshot.bids.length + snapshot.asks.length, sourceDigest: snapshot.sourceDigest ?? null, reliability: fetched.receipt }));
      } catch (error) {
        receipts.push(providerReceipt({ capability: "order_book", providerFamily: "binance", endpointId: "binance_spot_depth", state: providerStateFromError(error), observedAt: nowIso, latencyMs: Date.now() - started, recordCount: 0, errorCode: cleanError(error), reliability: reliabilityFromError(error) }));
        blockers.add("binance_order_book_unavailable");
      }
    })());
  }

  const mexcMarket = args.binding.venueMarkets.mexc;
  if (mexcMarket) {
    tasks.push((async () => {
      const started = Date.now();
      try {
        const url = new URL("https://api.mexc.com/api/v3/depth");
        url.searchParams.set("symbol", mexcMarket);
        url.searchParams.set("limit", "100");
        const fetched = await reliableJsonFetch({
          fetchImpl: args.fetchImpl, url, providerId: "mexc", endpointId: "mexc_spot_depth", cacheKey: mexcMarket,
          schemaProjection: (payload) => ({ bids: Array.isArray((payload as { bids?: unknown })?.bids), asks: Array.isArray((payload as { asks?: unknown })?.asks), lastUpdateId: typeof (payload as { lastUpdateId?: unknown })?.lastUpdateId }),
        });
        const payload = fetched.payload;
        const snapshot = parseMexcOrderBook({ payload, assetKey: args.assetKey, observedAt: nowIso, status: "verified_live", marketId: mexcMarket });
        const quote = await fetchUsdtUsdRate(args.fetchImpl, nowIso);
        receipts.push(quote.receipt);
        if (quote.evidence) snapshot.quoteToUsd = quote.evidence;
        else blockers.add("mexc_usdt_usd_conversion_unavailable");
        snapshots.push(snapshot);
        receipts.push(providerReceipt({ capability: "order_book", providerFamily: "mexc", endpointId: "mexc_spot_depth", state: "ok", observedAt: nowIso, latencyMs: Date.now() - started, recordCount: snapshot.bids.length + snapshot.asks.length, sourceDigest: snapshot.sourceDigest ?? null, reliability: fetched.receipt }));
      } catch (error) {
        receipts.push(providerReceipt({ capability: "order_book", providerFamily: "mexc", endpointId: "mexc_spot_depth", state: providerStateFromError(error), observedAt: nowIso, latencyMs: Date.now() - started, recordCount: 0, errorCode: cleanError(error), reliability: reliabilityFromError(error) }));
        blockers.add("mexc_order_book_unavailable");
      }
    })());
  }

  const coinbaseProduct = args.binding.venueMarkets.coinbase;
  if (coinbaseProduct) {
    tasks.push((async () => {
      const started = Date.now();
      try {
        const url = new URL(`https://api.exchange.coinbase.com/products/${encodeURIComponent(coinbaseProduct)}/book`);
        url.searchParams.set("level", "2");
        const fetched = await reliableJsonFetch({
          fetchImpl: args.fetchImpl, url, providerId: "coinbase", endpointId: "coinbase_exchange_book_l2", cacheKey: coinbaseProduct,
          schemaProjection: (payload) => ({ bids: Array.isArray((payload as { bids?: unknown })?.bids), asks: Array.isArray((payload as { asks?: unknown })?.asks), sequence: typeof (payload as { sequence?: unknown })?.sequence }),
        });
        const payload = fetched.payload;
        const snapshot = parseCoinbaseOrderBook({ payload, assetKey: args.assetKey, observedAt: nowIso, status: "verified_live", productId: coinbaseProduct });
        snapshots.push(snapshot);
        receipts.push(providerReceipt({ capability: "order_book", providerFamily: "coinbase", endpointId: "coinbase_exchange_book_l2", state: "ok", observedAt: nowIso, latencyMs: Date.now() - started, recordCount: snapshot.bids.length + snapshot.asks.length, sourceDigest: snapshot.sourceDigest ?? null, reliability: fetched.receipt }));
      } catch (error) {
        receipts.push(providerReceipt({ capability: "order_book", providerFamily: "coinbase", endpointId: "coinbase_exchange_book_l2", state: providerStateFromError(error), observedAt: nowIso, latencyMs: Date.now() - started, recordCount: 0, errorCode: cleanError(error), reliability: reliabilityFromError(error) }));
        blockers.add("coinbase_order_book_unavailable");
      }
    })());
  }

  const krakenPair = args.binding.venueMarkets.kraken;
  if (krakenPair) {
    tasks.push((async () => {
      const started = Date.now();
      try {
        const url = new URL("https://api.kraken.com/0/public/Depth");
        url.searchParams.set("pair", krakenPair);
        url.searchParams.set("count", "100");
        const fetched = await reliableJsonFetch({
          fetchImpl: args.fetchImpl, url, providerId: "kraken", endpointId: "kraken_spot_depth", cacheKey: krakenPair,
          schemaProjection: (payload) => ({ error: Array.isArray((payload as { error?: unknown })?.error), result: Boolean((payload as { result?: unknown })?.result && typeof (payload as { result?: unknown }).result === "object") }),
        });
        const payload = fetched.payload;
        const snapshot = parseKrakenOrderBook({ payload, assetKey: args.assetKey, observedAt: nowIso, status: "verified_live", pairId: krakenPair });
        snapshots.push(snapshot);
        receipts.push(providerReceipt({ capability: "order_book", providerFamily: "kraken", endpointId: "kraken_spot_depth", state: "ok", observedAt: nowIso, latencyMs: Date.now() - started, recordCount: snapshot.bids.length + snapshot.asks.length, sourceDigest: snapshot.sourceDigest ?? null, reliability: fetched.receipt }));
      } catch (error) {
        receipts.push(providerReceipt({ capability: "order_book", providerFamily: "kraken", endpointId: "kraken_spot_depth", state: providerStateFromError(error), observedAt: nowIso, latencyMs: Date.now() - started, recordCount: 0, errorCode: cleanError(error), reliability: reliabilityFromError(error) }));
        blockers.add("kraken_order_book_unavailable");
      }
    })());
  }

  await Promise.all(tasks);
  if (tasks.length === 0) blockers.add("venue_market_mapping_unavailable");
  if (snapshots.length < 2) blockers.add("independent_order_book_coverage_below_threshold");
  return {
    snapshots: snapshots.sort((left, right) => left.providerFamily.localeCompare(right.providerFamily)),
    receipts: receipts.sort((left, right) => `${left.capability}:${left.providerFamily}`.localeCompare(`${right.capability}:${right.providerFamily}`)),
    blockers: Array.from(blockers).sort(),
  };
}

export async function fetchServerOwnedMarketImpactEvidence(args: { assetKey: string } & ProviderOptions): Promise<ServerOwnedMarketEvidence> {
  const now = args.now ?? new Date();
  const assetKey = cleanAssetKey(args.assetKey);
  const binding = bindingSummary({ assetKey, artifact: args.bindingArtifact, secret: args.bindingSecret, now });
  const cacheKey = digestPayload({ assetKey, binding: binding.artifactDigest ?? binding.venueMarkets });
  const cached = marketCache.get(cacheKey);
  if (!args.bypassCache && cached && cached.expiresAt > now.getTime()) return cloneMarketWithCacheState(cached.value, "hit");
  const existing = marketInflight.get(cacheKey);
  if (!args.bypassCache && existing) return cloneMarketWithCacheState(await existing, "shared_inflight");

  const operation = (async () => {
    if (binding.state === "required" || binding.state === "invalid") {
      return signMarket({
        schemaVersion: "velmere.server-owned-market-evidence.v1",
        assetKey,
        generatedAt: now.toISOString(),
        cacheState: "miss",
        binding,
        snapshots: [],
        receipts: [],
        blockers: [binding.error ?? "market_asset_binding_invalid"],
      });
    }
    const result = await fetchOrderBooks({ assetKey, binding, now, fetchImpl: args.fetchImpl ?? defaultFetch });
    return signMarket({
      schemaVersion: "velmere.server-owned-market-evidence.v1",
      assetKey,
      generatedAt: now.toISOString(),
      cacheState: "miss",
      binding,
      snapshots: result.snapshots,
      receipts: result.receipts,
      blockers: result.blockers,
    });
  })();

  marketInflight.set(cacheKey, operation);
  try {
    const result = await operation;
    marketCache.set(cacheKey, { expiresAt: now.getTime() + MARKET_CACHE_TTL_MS, value: result });
    trimCache(marketCache);
    return result;
  } finally {
    marketInflight.delete(cacheKey);
  }
}

function scaledIntegerToNumber(value: unknown, decimals: number): number | null {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const boundedDecimals = Math.max(0, Math.min(36, Math.trunc(decimals)));
  const padded = raw.padStart(boundedDecimals + 1, "0");
  const whole = boundedDecimals === 0 ? padded : padded.slice(0, -boundedDecimals);
  const fraction = boundedDecimals === 0 ? "" : padded.slice(-boundedDecimals).replace(/0+$/, "");
  return finiteNonNegative(fraction ? `${whole}.${fraction}` : whole);
}

function strictTokenDecimals(value: unknown): number | null {
  const parsed = nonNegativeSafeInteger(value);
  return parsed !== null && parsed <= 36 ? parsed : null;
}

function nonNegativeSafeInteger(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
  const raw = String(value ?? "").trim().toLowerCase();
  if (!/^(?:0x[a-f0-9]+|[0-9]+)$/u.test(raw)) return null;
  try {
    const parsed = BigInt(raw);
    return parsed <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(parsed) : null;
  } catch {
    return null;
  }
}

/** Etherscan `token/topholders` reports display-token units, not base-unit integers. */
export function parseEtherscanTopHolderQuantity(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (raw.length === 0 || raw.length > 160 || !/^[0-9]+(?:\.[0-9]+)?$/u.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function rawContractAmount(value: unknown, decimals: number): number | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (/^0x[a-f0-9]+$/u.test(raw)) {
    try {
      return scaledIntegerToNumber(BigInt(raw).toString(10), decimals);
    } catch {
      return null;
    }
  }
  return scaledIntegerToNumber(raw, decimals);
}

function alchemyLogIndex(value: unknown, txHash: string): number | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  const prefix = `${txHash}:log:`;
  if (!normalized.startsWith(prefix)) return null;
  return nonNegativeSafeInteger(normalized.slice(prefix.length));
}

function etherscanApiKey() {
  return process.env.ETHERSCAN_API_KEY?.trim() ?? "";
}

function etherscanChainId(chainId: string | null) {
  if (!chainId?.startsWith("eip155:")) return null;
  const value = chainId.slice("eip155:".length);
  return /^\d+$/.test(value) ? value : null;
}

function allowlistedAlchemyUrl(chainId: string | null): URL | null {
  const envName = chainId === "eip155:1"
    ? "ALCHEMY_ETH_RPC_URL"
    : chainId === "eip155:8453"
      ? "ALCHEMY_BASE_RPC_URL"
      : chainId === "eip155:42161"
        ? "ALCHEMY_ARBITRUM_RPC_URL"
        : chainId === "eip155:10"
          ? "ALCHEMY_OPTIMISM_RPC_URL"
          : chainId === "eip155:137"
            ? "ALCHEMY_POLYGON_RPC_URL"
            : null;
  if (!envName) return null;
  const raw = process.env[envName]?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !(url.hostname === "g.alchemy.com" || url.hostname.endsWith(".g.alchemy.com"))) return null;
    return url;
  } catch {
    return null;
  }
}

async function fetchEtherscanTokenEvidence(args: {
  binding: ServerOwnedBindingSummary;
  now: Date;
  fetchImpl: FetchLike;
}): Promise<{
  totalSupply: number | null;
  priceUsd: number | null;
  holders: WhaleHolderSnapshot[];
  capabilityReceipts: WhaleCapabilityReceipt[];
  providerReceipts: ServerProviderReceipt[];
  blockers: string[];
}> {
  const providerReceipts: ServerProviderReceipt[] = [];
  const capabilityReceipts: WhaleCapabilityReceipt[] = [];
  const blockers = new Set<string>();
  const nowIso = args.now.toISOString();
  const key = etherscanApiKey();
  const chainId = etherscanChainId(args.binding.chainId);
  const address = args.binding.tokenAddress;
  if (!key || !chainId || !address) {
    providerReceipts.push(providerReceipt({ capability: "holder_distribution", providerFamily: "etherscan", endpointId: "etherscan_v2_token_holders", state: "not_configured", observedAt: nowIso, latencyMs: 0, recordCount: 0, errorCode: "etherscan_configuration_missing" }));
    blockers.add("holder_distribution_provider_not_configured");
    return { totalSupply: null, priceUsd: null, holders: [], capabilityReceipts, providerReceipts, blockers: Array.from(blockers) };
  }

  let totalSupply: number | null = null;
  let priceUsd: number | null = null;
  const infoStarted = Date.now();
  try {
    const url = new URL("https://api.etherscan.io/v2/api");
    url.searchParams.set("chainid", chainId);
    url.searchParams.set("module", "token");
    url.searchParams.set("action", "tokeninfo");
    url.searchParams.set("contractaddress", address);
    url.searchParams.set("apikey", key);
    const fetched = await reliableJsonFetch({
      fetchImpl: args.fetchImpl, url, providerId: "etherscan", endpointId: "etherscan_v2_token_info", cacheKey: `${chainId}:${address}`, quotaLimit: 30,
      schemaProjection: (payload) => ({ status: typeof (payload as { status?: unknown })?.status, result: Array.isArray((payload as { result?: unknown })?.result) }),
    });
    const payload = fetched.payload;
    const root = payload as { status?: unknown; result?: unknown };
    const row = Array.isArray(root.result) ? root.result[0] as Record<string, unknown> | undefined : undefined;
    if (!row) throw new Error("etherscan_tokeninfo_missing");
    const decimals = strictTokenDecimals(row.divisor);
    if (decimals === null) throw new Error("etherscan_tokeninfo_decimals_invalid");
    totalSupply = scaledIntegerToNumber(row.totalSupply, decimals);
    if (totalSupply === null || totalSupply <= 0) throw new Error("etherscan_tokeninfo_supply_invalid");
    priceUsd = finitePositive(row.tokenPriceUSD);
    const sourceDigest = digestPayload({ providerFamily: "etherscan", capability: "token_info", observedAt: nowIso, payload });
    providerReceipts.push(providerReceipt({ capability: "holder_distribution", providerFamily: "etherscan", endpointId: "etherscan_v2_token_info", state: "ok", observedAt: nowIso, latencyMs: Date.now() - infoStarted, recordCount: 1, sourceDigest, reliability: fetched.receipt }));
  } catch (error) {
    providerReceipts.push(providerReceipt({ capability: "holder_distribution", providerFamily: "etherscan", endpointId: "etherscan_v2_token_info", state: providerStateFromError(error), observedAt: nowIso, latencyMs: Date.now() - infoStarted, recordCount: 0, errorCode: cleanError(error), reliability: reliabilityFromError(error) }));
    blockers.add("token_supply_or_price_unavailable");
  }

  const holdersStarted = Date.now();
  try {
    const url = new URL("https://api.etherscan.io/v2/api");
    url.searchParams.set("chainid", chainId);
    url.searchParams.set("module", "token");
    url.searchParams.set("action", "topholders");
    url.searchParams.set("contractaddress", address);
    url.searchParams.set("offset", "100");
    url.searchParams.set("apikey", key);
    const fetched = await reliableJsonFetch({
      fetchImpl: args.fetchImpl, url, providerId: "etherscan", endpointId: "etherscan_v2_token_holders", cacheKey: `${chainId}:${address}`, quotaLimit: 30,
      schemaProjection: (payload) => ({ result: Array.isArray((payload as { result?: unknown })?.result) }),
    });
    const payload = fetched.payload;
    const root = payload as { result?: unknown };
    if (!Array.isArray(root.result)) throw new Error("etherscan_topholders_missing");
    const sourceDigest = digestPayload({ providerFamily: "etherscan", capability: "holder_distribution", observedAt: nowIso, payload });
    const holders = root.result.slice(0, 100).flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const holderId = typeof row.TokenHolderAddress === "string" ? row.TokenHolderAddress.trim().toLowerCase() : "";
      const balance = parseEtherscanTopHolderQuantity(row.TokenHolderQuantity);
      if (!/^0x[a-f0-9]{40}$/.test(holderId) || balance === null || balance <= 0) return [];
      const category = holderId === ZERO_ADDRESS ? "burn" as const : "unknown" as const;
      return [{ holderId, balance, category, labelVerified: false, observedAt: nowIso, providerFamily: "etherscan", status: "verified_live" as const, sourceDigest }];
    });
    providerReceipts.push(providerReceipt({ capability: "holder_distribution", providerFamily: "etherscan", endpointId: "etherscan_v2_token_holders", state: "ok", observedAt: nowIso, latencyMs: Date.now() - holdersStarted, recordCount: holders.length, sourceDigest, reliability: fetched.receipt }));
    capabilityReceipts.push({ capability: "holder_distribution", providerFamily: "etherscan", observedAt: nowIso, status: "verified_live", recordCount: holders.length, coverageComplete: false, sourceDigest });
    if (holders.length === 0) blockers.add("holder_distribution_empty");
    return { totalSupply, priceUsd, holders, capabilityReceipts, providerReceipts, blockers: Array.from(blockers).sort() };
  } catch (error) {
    providerReceipts.push(providerReceipt({ capability: "holder_distribution", providerFamily: "etherscan", endpointId: "etherscan_v2_token_holders", state: providerStateFromError(error), observedAt: nowIso, latencyMs: Date.now() - holdersStarted, recordCount: 0, errorCode: cleanError(error), reliability: reliabilityFromError(error) }));
    blockers.add("holder_distribution_unavailable");
    return { totalSupply, priceUsd, holders: [], capabilityReceipts, providerReceipts, blockers: Array.from(blockers).sort() };
  }
}


async function fetchEtherscanTransfers(args: {
  binding: ServerOwnedBindingSummary;
  now: Date;
  fetchImpl: FetchLike;
  priceUsd: number | null;
}): Promise<{
  transfers: WhaleTransferEvent[];
  capabilityReceipts: WhaleCapabilityReceipt[];
  providerReceipts: ServerProviderReceipt[];
  blockers: string[];
}> {
  const nowIso = args.now.toISOString();
  const key = etherscanApiKey();
  const chainId = etherscanChainId(args.binding.chainId);
  const address = args.binding.tokenAddress;
  if (!key || !chainId || !address) {
    return {
      transfers: [], capabilityReceipts: [], blockers: ["etherscan_transfer_history_not_configured"],
      providerReceipts: [providerReceipt({ capability: "transfer_history", providerFamily: "etherscan", endpointId: "etherscan_v2_token_transfers", state: "not_configured", observedAt: nowIso, latencyMs: 0, recordCount: 0, errorCode: "etherscan_configuration_missing" })],
    };
  }
  const started = Date.now();
  try {
    const url = new URL("https://api.etherscan.io/v2/api");
    url.searchParams.set("chainid", chainId);
    url.searchParams.set("module", "account");
    url.searchParams.set("action", "tokentx");
    url.searchParams.set("contractaddress", address);
    url.searchParams.set("page", "1");
    url.searchParams.set("offset", "200");
    url.searchParams.set("sort", "desc");
    url.searchParams.set("apikey", key);
    const fetched = await reliableJsonFetch({
      fetchImpl: args.fetchImpl, url, providerId: "etherscan", endpointId: "etherscan_v2_token_transfers", cacheKey: `${chainId}:${address}`, quotaLimit: 30,
      schemaProjection: (payload) => ({ result: Array.isArray((payload as { result?: unknown })?.result) }),
    });
    const payload = fetched.payload;
    const rows = (payload as { result?: unknown })?.result;
    if (!Array.isArray(rows)) throw new Error("etherscan_tokentx_missing");
    const sourceDigest = digestPayload({ providerFamily: "etherscan", capability: "transfer_history", observedAt: nowIso, payload });
    const rowBlockers = new Set<string>();
    const transfers = rows.slice(0, 200).flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const from = typeof row.from === "string" ? row.from.trim().toLowerCase() : undefined;
      const to = typeof row.to === "string" ? row.to.trim().toLowerCase() : undefined;
      const tokenDecimals = strictTokenDecimals(row.tokenDecimal);
      const amountBase = tokenDecimals === null ? null : scaledIntegerToNumber(row.value, tokenDecimals);
      const hash = typeof row.hash === "string" ? row.hash.trim().toLowerCase() : "";
      const contractAddress = typeof row.contractAddress === "string" ? row.contractAddress.trim().toLowerCase() : "";
      const logIndex = nonNegativeSafeInteger(row.logIndex);
      const blockNumber = nonNegativeSafeInteger(row.blockNumber);
      const blockHash = typeof row.blockHash === "string" ? row.blockHash.trim().toLowerCase() : "";
      const confirmations = nonNegativeSafeInteger(row.confirmations);
      const timestampSeconds = finiteNonNegative(row.timeStamp);
      const timestampMs = timestampSeconds === null ? Number.NaN : timestampSeconds * 1000;
      const observedAt = Number.isFinite(timestampMs) && timestampMs <= 8_640_000_000_000_000
        ? new Date(timestampMs).toISOString()
        : "";
      if (
        !amountBase || tokenDecimals === null || !/^0x[a-f0-9]{64}$/u.test(hash) ||
        contractAddress !== address || logIndex === null || blockNumber === null ||
        !/^0x[a-f0-9]{64}$/u.test(blockHash) || confirmations === null || !observedAt
      ) {
        rowBlockers.add("etherscan_transfer_canonical_identity_invalid");
        return [];
      }
      const kind = from === ZERO_ADDRESS ? "mint" as const : to === ZERO_ADDRESS ? "burn" as const : "transfer" as const;
      const identity = { chainId: args.binding.chainId!, contractAddress, txHash: hash, logIndex };
      return [{
        eventId: canonicalWhaleEventId(identity),
        ...identity,
        blockNumber,
        blockHash,
        confirmations,
        finality: confirmations > 0 ? "confirmed" as const : "unconfirmed" as const,
        reorgState: confirmations > 0 ? "canonical" as const : "unresolved" as const,
        tokenDecimals,
        observedAt,
        amountBase,
        amountUsd: args.priceUsd ? amountBase * args.priceUsd : undefined,
        fromHolderId: from,
        toHolderId: to,
        fromCategory: from === ZERO_ADDRESS ? "burn" as const : "unknown" as const,
        toCategory: to === ZERO_ADDRESS ? "burn" as const : "unknown" as const,
        kind,
        providerFamily: "etherscan",
        providerFamilies: ["etherscan"],
        status: "verified_live" as const,
        sourceDigest,
        sourceDigests: [sourceDigest],
      }];
    });
    const receipt: WhaleCapabilityReceipt = { capability: "transfer_history", providerFamily: "etherscan", observedAt: nowIso, status: "verified_live", recordCount: transfers.length, coverageComplete: false, sourceDigest };
    return {
      transfers,
      capabilityReceipts: transfers.length > 0 ? [receipt] : [],
      providerReceipts: [providerReceipt({ capability: "transfer_history", providerFamily: "etherscan", endpointId: "etherscan_v2_token_transfers", state: "ok", observedAt: nowIso, latencyMs: Date.now() - started, recordCount: transfers.length, sourceDigest, reliability: fetched.receipt })],
      blockers: Array.from(new Set([
        ...(transfers.length > 0 ? [] : ["etherscan_transfer_history_empty"]),
        ...rowBlockers,
      ])).sort(),
    };
  } catch (error) {
    return {
      transfers: [], capabilityReceipts: [], blockers: ["etherscan_transfer_history_unavailable"],
      providerReceipts: [providerReceipt({ capability: "transfer_history", providerFamily: "etherscan", endpointId: "etherscan_v2_token_transfers", state: providerStateFromError(error), observedAt: nowIso, latencyMs: Date.now() - started, recordCount: 0, errorCode: cleanError(error), reliability: reliabilityFromError(error) })],
    };
  }
}

function mergeTransferEvidence(...sources: Array<{
  transfers: WhaleTransferEvent[];
  capabilityReceipts: WhaleCapabilityReceipt[];
  providerReceipts: ServerProviderReceipt[];
  blockers: string[];
}>) {
  const deduplicated = deduplicateCanonicalWhaleTransfers(sources.flatMap((source) => source.transfers));
  const transfers = deduplicated.transfers.slice(0, 400);
  const capabilityReceipts = sources.flatMap((source) => source.capabilityReceipts);
  const providerReceipts = sources.flatMap((source) => source.providerReceipts);
  return {
    transfers,
    capabilityReceipts,
    providerReceipts,
    blockers: Array.from(new Set([
      ...sources.flatMap((source) => source.blockers),
      ...deduplicated.blockers,
      ...(transfers.length > 0 ? [] : ["canonical_transfer_history_unavailable"]),
    ])).sort(),
  };
}

async function fetchAlchemyTransfers(args: {
  binding: ServerOwnedBindingSummary;
  now: Date;
  fetchImpl: FetchLike;
  priceUsd: number | null;
}): Promise<{
  transfers: WhaleTransferEvent[];
  capabilityReceipts: WhaleCapabilityReceipt[];
  providerReceipts: ServerProviderReceipt[];
  blockers: string[];
}> {
  const nowIso = args.now.toISOString();
  const endpoint = allowlistedAlchemyUrl(args.binding.chainId);
  if (!endpoint || !args.binding.tokenAddress) {
    return {
      transfers: [], capabilityReceipts: [], blockers: ["transfer_history_provider_not_configured"],
      providerReceipts: [providerReceipt({ capability: "transfer_history", providerFamily: "alchemy", endpointId: "alchemy_asset_transfers", state: "not_configured", observedAt: nowIso, latencyMs: 0, recordCount: 0, errorCode: "alchemy_configuration_missing_or_not_allowlisted" })],
    };
  }
  const started = Date.now();
  try {
    const requestBody = {
      jsonrpc: "2.0",
      id: 1,
      method: "alchemy_getAssetTransfers",
      params: [{
        fromBlock: "0x0",
        toBlock: "latest",
        contractAddresses: [args.binding.tokenAddress],
        category: ["erc20"],
        withMetadata: true,
        excludeZeroValue: true,
        maxCount: "0xc8",
        order: "desc",
      }],
    };
    const fetched = await reliableJsonFetch({
      fetchImpl: args.fetchImpl, url: endpoint, providerId: "alchemy", endpointId: "alchemy_asset_transfers", cacheKey: `${args.binding.chainId}:${args.binding.tokenAddress}`, quotaLimit: 60,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      },
      schemaProjection: (payload) => ({ result: { transfers: Array.isArray((payload as { result?: { transfers?: unknown } })?.result?.transfers) } }),
    });
    const payload = fetched.payload;
    const rows = (payload as { result?: { transfers?: unknown } })?.result?.transfers;
    if (!Array.isArray(rows)) throw new Error("alchemy_transfers_missing");
    const sourceDigest = digestPayload({ providerFamily: "alchemy", capability: "transfer_history", observedAt: nowIso, payload });
    const rowBlockers = new Set<string>();
    const transfers = rows.slice(0, 200).flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const from = typeof row.from === "string" ? row.from.trim().toLowerCase() : undefined;
      const to = typeof row.to === "string" ? row.to.trim().toLowerCase() : undefined;
      const rawContract = row.rawContract && typeof row.rawContract === "object" && !Array.isArray(row.rawContract)
        ? row.rawContract as Record<string, unknown>
        : null;
      const contractAddress = typeof rawContract?.address === "string" ? rawContract.address.trim().toLowerCase() : "";
      const tokenDecimals = strictTokenDecimals(rawContract?.decimal);
      const rawAmountBase = tokenDecimals === null ? null : rawContractAmount(rawContract?.value, tokenDecimals);
      const displayAmountBase = finitePositive(row.value);
      const amountBase = rawAmountBase ?? displayAmountBase;
      const hash = typeof row.hash === "string" ? row.hash.trim().toLowerCase() : "";
      const logIndex = alchemyLogIndex(row.uniqueId, hash);
      const blockNumber = nonNegativeSafeInteger(row.blockNum);
      const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata as Record<string, unknown>
        : null;
      const blockHashValue = row.blockHash ?? metadata?.blockHash;
      const blockHash = typeof blockHashValue === "string" ? blockHashValue.trim().toLowerCase() : "";
      const confirmations = nonNegativeSafeInteger(row.confirmations ?? metadata?.confirmations);
      const observedAt = safeIso(metadata?.blockTimestamp);
      const rawDisplayConflict = rawAmountBase !== null && displayAmountBase !== null &&
        Math.abs(rawAmountBase - displayAmountBase) > Math.max(1e-12, Math.abs(rawAmountBase) * 1e-9);
      const observedAtInvalid = observedAt === null;
      if (
        !amountBase || rawDisplayConflict || tokenDecimals === null || contractAddress !== args.binding.tokenAddress ||
        !/^0x[a-f0-9]{64}$/u.test(hash) || logIndex === null || blockNumber === null ||
        !/^0x[a-f0-9]{64}$/u.test(blockHash) || confirmations === null || observedAtInvalid
      ) {
        rowBlockers.add(rawDisplayConflict
          ? "alchemy_transfer_decimal_conflict"
          : observedAtInvalid
            ? "alchemy_transfer_observed_at_invalid"
            : "alchemy_transfer_canonical_identity_invalid");
        return [];
      }
      const kind = from === ZERO_ADDRESS ? "mint" as const : to === ZERO_ADDRESS ? "burn" as const : "transfer" as const;
      const identity = { chainId: args.binding.chainId!, contractAddress, txHash: hash, logIndex };
      const explicitlyReorged = row.removed === true;
      return [{
        eventId: canonicalWhaleEventId(identity),
        ...identity,
        blockNumber,
        blockHash,
        confirmations,
        finality: confirmations > 0 ? (row.finalized === true ? "finalized" as const : "confirmed" as const) : "unconfirmed" as const,
        reorgState: explicitlyReorged ? "reorged" as const : confirmations > 0 ? "canonical" as const : "unresolved" as const,
        tokenDecimals,
        observedAt,
        amountBase,
        amountUsd: args.priceUsd ? amountBase * args.priceUsd : undefined,
        fromHolderId: from,
        toHolderId: to,
        fromCategory: from === ZERO_ADDRESS ? "burn" as const : "unknown" as const,
        toCategory: to === ZERO_ADDRESS ? "burn" as const : "unknown" as const,
        kind,
        providerFamily: "alchemy",
        providerFamilies: ["alchemy"],
        status: "verified_live" as const,
        sourceDigest,
        sourceDigests: [sourceDigest],
      }];
    });
    const receipt: WhaleCapabilityReceipt = { capability: "transfer_history", providerFamily: "alchemy", observedAt: nowIso, status: "verified_live", recordCount: transfers.length, coverageComplete: false, sourceDigest };
    return {
      transfers,
      capabilityReceipts: [receipt],
      providerReceipts: [providerReceipt({ capability: "transfer_history", providerFamily: "alchemy", endpointId: "alchemy_asset_transfers", state: "ok", observedAt: nowIso, latencyMs: Date.now() - started, recordCount: transfers.length, sourceDigest, reliability: fetched.receipt })],
      blockers: Array.from(new Set([
        ...(transfers.length > 0 ? [] : ["transfer_history_empty"]),
        ...rowBlockers,
      ])).sort(),
    };
  } catch (error) {
    return {
      transfers: [], capabilityReceipts: [], blockers: ["transfer_history_unavailable"],
      providerReceipts: [providerReceipt({ capability: "transfer_history", providerFamily: "alchemy", endpointId: "alchemy_asset_transfers", state: providerStateFromError(error), observedAt: nowIso, latencyMs: Date.now() - started, recordCount: 0, errorCode: cleanError(error), reliability: reliabilityFromError(error) })],
    };
  }
}

export async function fetchServerOwnedWhaleEvidence(args: { assetKey: string } & WhaleProviderOptions): Promise<ServerOwnedWhaleEvidence> {
  const now = args.now ?? new Date();
  const assetKey = cleanAssetKey(args.assetKey);
  const binding = bindingSummary({ assetKey, artifact: args.bindingArtifact, secret: args.bindingSecret, now });
  const cacheKey = digestPayload({ assetKey, binding: binding.artifactDigest ?? binding.tokenAddress, fallbackPriceUsd: args.fallbackPriceUsd ?? null });
  const cached = whaleCache.get(cacheKey);
  if (!args.bypassCache && cached && cached.expiresAt > now.getTime()) return cloneWhaleWithCacheState(cached.value, "hit");
  const existing = whaleInflight.get(cacheKey);
  if (!args.bypassCache && existing) return cloneWhaleWithCacheState(await existing, "shared_inflight");

  const operation = (async () => {
    if (binding.state !== "verified_signed_binding") {
      return signWhale({
        schemaVersion: "velmere.server-owned-whale-evidence.v1",
        assetKey,
        generatedAt: now.toISOString(),
        cacheState: "miss",
        binding,
        totalSupply: null,
        priceUsd: args.fallbackPriceUsd ?? null,
        holders: [],
        transfers: [],
        capabilityReceipts: [],
        providerReceipts: [],
        blockers: [binding.error ?? "signed_market_asset_binding_required_for_whale_watch"],
      });
    }
    const fetchImpl = args.fetchImpl ?? defaultFetch;
    const holderEvidence = await fetchEtherscanTokenEvidence({ binding, now, fetchImpl });
    const priceUsd = holderEvidence.priceUsd ?? args.fallbackPriceUsd ?? null;
    const [alchemyTransfers, etherscanTransfers] = await Promise.all([
      fetchAlchemyTransfers({ binding, now, fetchImpl, priceUsd }),
      fetchEtherscanTransfers({ binding, now, fetchImpl, priceUsd }),
    ]);
    const transferEvidence = mergeTransferEvidence(alchemyTransfers, etherscanTransfers);
    const blockers = Array.from(new Set([
      ...holderEvidence.blockers,
      ...transferEvidence.blockers,
      "verified_wallet_label_registry_required",
      ...(holderEvidence.totalSupply ? [] : ["verified_total_supply_required"]),
      ...(priceUsd ? [] : ["verified_usd_price_required"]),
    ])).sort();
    return signWhale({
      schemaVersion: "velmere.server-owned-whale-evidence.v1",
      assetKey,
      generatedAt: now.toISOString(),
      cacheState: "miss",
      binding,
      totalSupply: holderEvidence.totalSupply,
      priceUsd,
      holders: holderEvidence.holders,
      transfers: transferEvidence.transfers,
      capabilityReceipts: [...holderEvidence.capabilityReceipts, ...transferEvidence.capabilityReceipts],
      providerReceipts: [...holderEvidence.providerReceipts, ...transferEvidence.providerReceipts],
      blockers,
    });
  })();

  whaleInflight.set(cacheKey, operation);
  try {
    const result = await operation;
    whaleCache.set(cacheKey, { expiresAt: now.getTime() + WHALE_CACHE_TTL_MS, value: result });
    trimCache(whaleCache);
    return result;
  } finally {
    whaleInflight.delete(cacheKey);
  }
}

export function clearServerOwnedMarketIntelligenceCachesForTests() {
  marketCache.clear();
  marketInflight.clear();
  whaleCache.clear();
  whaleInflight.clear();
  serverOwnedProviderReliability.clear();
  providerSharedHooks.clearMemoryForTests();
}
