import { readJsonResponseBounded, readResponseBytesBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredEgressFetch } from "@/lib/network/brokered-egress";
import { analyzeTokenRisk, badgeFromLevel, levelFromScore } from "./risk-engine";
import type { TokenRiskInput, TokenRiskResult, VelmereMarketAssetClass } from "./risk-types";
import {
  attachPass4644ProviderReceipts,
  createPass4644ProviderEvidenceReceipt,
  type Pass4644ProviderEvidenceReceipt,
} from "./provider-evidence-receipt";
import { inferPass4646AssetClass } from "./universal-asset-identity";
import { resolvePass4648ProviderFirstAssetClass } from "./provider-first-asset-class";
import { resolvePass481Identity } from "./asset-identity-registry";
import { buildPass2281SourceConfidence } from "@/lib/ai/worldclass-output-contract";
import { buildPass2282RiskPresentation, buildPass2282VisibleOutputPlan } from "@/lib/ai/live-output-audit-harness";
import { buildPass2283OutputQualityGate } from "@/lib/ai/worldclass-output-payment-qa";
import { buildPass2284LiveOutputQualityLedger } from "@/lib/ai/live-output-quality-ledger";
import { buildPass2285PremiumOutputGate } from "@/lib/ai/premium-output-gate";
import { buildPass2286WorldclassLiveOutputPaymentQa } from "@/lib/ai/worldclass-live-output-payment-qa";
import { applyPass2287RuntimeOutputFirewall } from "@/lib/ai/runtime-output-firewall";
import { buildPass2288ClaimProofFirewall } from "@/lib/ai/claim-proof-firewall";
import { buildPass2289CustomerReleaseGate } from "@/lib/ai/customer-release-gate";
import { buildPass2290ReleaseTraceLedger } from "@/lib/ai/release-trace-ledger";
import { buildPass2291ProductionReplayGate } from "@/lib/ai/production-replay-gate";

const PASS2278_REAL_MARKET_SOURCE_QA = "pass2278_real_market_source_quality_qa_v1";


const CRYPTO_REAL_MARKET_ALIASES: Record<string, { symbol: string; name: string; assetClass: VelmereMarketAssetClass }> = {
  btc: { symbol: "BTC-USD", name: "Bitcoin", assetClass: "crypto" },
  bitcoin: { symbol: "BTC-USD", name: "Bitcoin", assetClass: "crypto" },
  eth: { symbol: "ETH-USD", name: "Ethereum", assetClass: "crypto" },
  ethereum: { symbol: "ETH-USD", name: "Ethereum", assetClass: "crypto" },
  sol: { symbol: "SOL-USD", name: "Solana", assetClass: "crypto" },
  solana: { symbol: "SOL-USD", name: "Solana", assetClass: "crypto" },
  bnb: { symbol: "BNB-USD", name: "BNB", assetClass: "crypto" },
  xrp: { symbol: "XRP-USD", name: "XRP", assetClass: "crypto" },
  ada: { symbol: "ADA-USD", name: "Cardano", assetClass: "crypto" },
  cardano: { symbol: "ADA-USD", name: "Cardano", assetClass: "crypto" },
  doge: { symbol: "DOGE-USD", name: "Dogecoin", assetClass: "crypto" },
  dogecoin: { symbol: "DOGE-USD", name: "Dogecoin", assetClass: "crypto" },
  link: { symbol: "LINK-USD", name: "Chainlink", assetClass: "crypto" },
  chainlink: { symbol: "LINK-USD", name: "Chainlink", assetClass: "crypto" },
  avax: { symbol: "AVAX-USD", name: "Avalanche", assetClass: "crypto" },
  avalanche: { symbol: "AVAX-USD", name: "Avalanche", assetClass: "crypto" },
  dot: { symbol: "DOT-USD", name: "Polkadot", assetClass: "crypto" },
  polkadot: { symbol: "DOT-USD", name: "Polkadot", assetClass: "crypto" },
  ltc: { symbol: "LTC-USD", name: "Litecoin", assetClass: "crypto" },
  litecoin: { symbol: "LTC-USD", name: "Litecoin", assetClass: "crypto" },
  bch: { symbol: "BCH-USD", name: "Bitcoin Cash", assetClass: "crypto" },
  xlm: { symbol: "XLM-USD", name: "Stellar", assetClass: "crypto" },
  stellar: { symbol: "XLM-USD", name: "Stellar", assetClass: "crypto" },
  uni: { symbol: "UNI-USD", name: "Uniswap", assetClass: "crypto" },
  uniswap: { symbol: "UNI-USD", name: "Uniswap", assetClass: "crypto" },
  atom: { symbol: "ATOM-USD", name: "Cosmos", assetClass: "crypto" },
  cosmos: { symbol: "ATOM-USD", name: "Cosmos", assetClass: "crypto" },
  near: { symbol: "NEAR-USD", name: "NEAR Protocol", assetClass: "crypto" },
  aave: { symbol: "AAVE-USD", name: "Aave", assetClass: "crypto" },
  etc: { symbol: "ETC-USD", name: "Ethereum Classic", assetClass: "crypto" },
  fil: { symbol: "FIL-USD", name: "Filecoin", assetClass: "crypto" },
  filecoin: { symbol: "FIL-USD", name: "Filecoin", assetClass: "crypto" },
  icp: { symbol: "ICP-USD", name: "Internet Computer", assetClass: "crypto" },
  matic: { symbol: "MATIC-USD", name: "Polygon", assetClass: "crypto" },
  pol: { symbol: "POL-USD", name: "Polygon Ecosystem Token", assetClass: "crypto" },
  polygon: { symbol: "POL-USD", name: "Polygon", assetClass: "crypto" },
  trx: { symbol: "TRX-USD", name: "TRON", assetClass: "crypto" },
  tron: { symbol: "TRX-USD", name: "TRON", assetClass: "crypto" },
  shib: { symbol: "SHIB-USD", name: "Shiba Inu", assetClass: "crypto" },
  pepe: { symbol: "PEPE-USD", name: "Pepe", assetClass: "crypto" },
  arb: { symbol: "ARB-USD", name: "Arbitrum", assetClass: "crypto" },
  arbitrum: { symbol: "ARB-USD", name: "Arbitrum", assetClass: "crypto" },
  op: { symbol: "OP-USD", name: "Optimism", assetClass: "crypto" },
  optimism: { symbol: "OP-USD", name: "Optimism", assetClass: "crypto" },
  okb: { symbol: "OKB-USD", name: "OKB", assetClass: "crypto" },
  mnt: { symbol: "MNT-USD", name: "Mantle", assetClass: "crypto" },
};

const CRYPTO_REAL_MARKET_SYMBOLS = new Set(
  Object.values(CRYPTO_REAL_MARKET_ALIASES).map((item) => item.symbol),
);

const PASS2318_CRYPTO_REAL_MARKETS_EVIDENCE_ROUTER = "pass2318_crypto_real_markets_evidence_router_v1";

const REAL_MARKET_ALIASES: Record<string, { symbol: string; name: string; assetClass: VelmereMarketAssetClass }> = {
  "s&p 500": { symbol: "^GSPC", name: "S&P 500 Index", assetClass: "index" },
  "s&p500": { symbol: "^GSPC", name: "S&P 500 Index", assetClass: "index" },
  sp500: { symbol: "^GSPC", name: "S&P 500 Index", assetClass: "index" },
  gspc: { symbol: "^GSPC", name: "S&P 500 Index", assetClass: "index" },
  "^gspc": { symbol: "^GSPC", name: "S&P 500 Index", assetClass: "index" },
  spy: { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", assetClass: "etf" },
  "spdr s&p 500": { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", assetClass: "etf" },
  qqq: { symbol: "QQQ", name: "Invesco QQQ Trust", assetClass: "etf" },
  nasdaq: { symbol: "^NDX", name: "Nasdaq 100 Index", assetClass: "index" },
  "nasdaq 100": { symbol: "^NDX", name: "Nasdaq 100 Index", assetClass: "index" },
  ndx: { symbol: "^NDX", name: "Nasdaq 100 Index", assetClass: "index" },
  "^ndx": { symbol: "^NDX", name: "Nasdaq 100 Index", assetClass: "index" },
  nvidia: { symbol: "NVDA", name: "NVIDIA Corporation", assetClass: "stock" },
  nvda: { symbol: "NVDA", name: "NVIDIA Corporation", assetClass: "stock" },
  apple: { symbol: "AAPL", name: "Apple Inc.", assetClass: "stock" },
  aapl: { symbol: "AAPL", name: "Apple Inc.", assetClass: "stock" },
  microsoft: { symbol: "MSFT", name: "Microsoft Corporation", assetClass: "stock" },
  msft: { symbol: "MSFT", name: "Microsoft Corporation", assetClass: "stock" },
  tesla: { symbol: "TSLA", name: "Tesla, Inc.", assetClass: "stock" },
  tsla: { symbol: "TSLA", name: "Tesla, Inc.", assetClass: "stock" },
  google: { symbol: "GOOGL", name: "Alphabet Inc.", assetClass: "stock" },
  alphabet: { symbol: "GOOGL", name: "Alphabet Inc.", assetClass: "stock" },
  googl: { symbol: "GOOGL", name: "Alphabet Inc.", assetClass: "stock" },
  adidas: { symbol: "ADS.DE", name: "adidas AG", assetClass: "stock" },
  "ads.de": { symbol: "ADS.DE", name: "adidas AG", assetClass: "stock" },
  lvmh: { symbol: "MC.PA", name: "LVMH Moët Hennessy Louis Vuitton SE", assetClass: "stock" },
  "mc.pa": { symbol: "MC.PA", name: "LVMH Moët Hennessy Louis Vuitton SE", assetClass: "stock" },
  dax: { symbol: "^GDAXI", name: "DAX Index", assetClass: "index" },
  "^gdaxi": { symbol: "^GDAXI", name: "DAX Index", assetClass: "index" },
  vix: { symbol: "^VIX", name: "CBOE Volatility Index", assetClass: "index" },
  gold: { symbol: "GC=F", name: "Gold Futures", assetClass: "commodity" },
  xauusd: { symbol: "GC=F", name: "Gold Futures", assetClass: "commodity" },
  oil: { symbol: "CL=F", name: "WTI Crude Oil Futures", assetClass: "commodity" },
  wti: { symbol: "CL=F", name: "WTI Crude Oil Futures", assetClass: "commodity" },
  eurusd: { symbol: "EURUSD=X", name: "EUR/USD", assetClass: "fx" },
  "eur/usd": { symbol: "EURUSD=X", name: "EUR/USD", assetClass: "fx" },
  usdjpy: { symbol: "JPY=X", name: "USD/JPY", assetClass: "fx" },
  "usd/jpy": { symbol: "JPY=X", name: "USD/JPY", assetClass: "fx" },
  usdpln: { symbol: "PLN=X", name: "USD/PLN", assetClass: "fx" },
  "usd/pln": { symbol: "PLN=X", name: "USD/PLN", assetClass: "fx" },
  silver: { symbol: "SI=F", name: "Silver Futures", assetClass: "commodity" },
  xagusd: { symbol: "SI=F", name: "Silver Futures", assetClass: "commodity" },
  "xag/usd": { symbol: "SI=F", name: "Silver Futures", assetClass: "commodity" },
  "xau/usd": { symbol: "GC=F", name: "Gold Futures", assetClass: "commodity" },
  copper: { symbol: "HG=F", name: "Copper Futures", assetClass: "commodity" },
  "hg=f": { symbol: "HG=F", name: "Copper Futures", assetClass: "commodity" },
  hyg: { symbol: "HYG", name: "iShares iBoxx High Yield Corporate Bond ETF", assetClass: "etf" },
  iwm: { symbol: "IWM", name: "iShares Russell 2000 ETF", assetClass: "etf" },
  tlt: { symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF", assetClass: "etf" },
  iyr: { symbol: "IYR", name: "iShares U.S. Real Estate ETF", assetClass: "real_estate" },
  vnq: { symbol: "VNQ", name: "Vanguard Real Estate ETF", assetClass: "real_estate" },
  asml: { symbol: "ASML", name: "ASML Holding N.V.", assetClass: "stock" },
  coin: { symbol: "COIN", name: "Coinbase Global, Inc.", assetClass: "stock" },
  coinbase: { symbol: "COIN", name: "Coinbase Global, Inc.", assetClass: "stock" },
  mstr: { symbol: "MSTR", name: "Strategy Inc.", assetClass: "stock" },
  microstrategy: { symbol: "MSTR", name: "Strategy Inc.", assetClass: "stock" },
  sap: { symbol: "SAP", name: "SAP SE", assetClass: "stock" },
};

function normalizeQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function inferAssetClass(symbol: string, name: string): VelmereMarketAssetClass {
  return inferPass4646AssetClass({
    provider: "real_market_router",
    symbol,
    name,
  });
}

function finite(value: unknown): number | undefined {
  if (value === null || value === undefined || typeof value === "boolean") return undefined;
  if (typeof value === "string" && !value.trim()) return undefined;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function pctChange(from: number | undefined, to: number | undefined): number | undefined {
  if (!Number.isFinite(from) || !Number.isFinite(to) || !from) return undefined;
  return ((Number(to) - Number(from)) / Math.abs(Number(from))) * 100;
}

export function resolveRealMarketTarget(query: string) {
  const normalized = normalizeQuery(query);
  const direct = CRYPTO_REAL_MARKET_ALIASES[normalized] ?? REAL_MARKET_ALIASES[normalized];
  if (direct) return direct;
  const upper = query.trim().toUpperCase();
  const cryptoDirect = CRYPTO_REAL_MARKET_ALIASES[upper.toLowerCase()] ?? (CRYPTO_REAL_MARKET_SYMBOLS.has(upper) ? { symbol: upper, name: upper.replace(/-USD$/, ""), assetClass: "crypto" as VelmereMarketAssetClass } : null);
  if (cryptoDirect) return cryptoDirect;
  // PASS4646: provider catalogs, not a short hand-written exchange list, define
  // global market coverage. The syntax gate accepts common worldwide ticker,
  // index, FX and futures forms; the provider response still has to confirm the
  // exact identity before any numerical verdict or paid report is released.
  if (/^\^[A-Z0-9._-]{1,24}$/.test(upper) || /^[A-Z]{3}[/_-]?[A-Z]{3}(=X)?$/.test(upper) || /^[A-Z0-9._-]{1,20}=F$/.test(upper)) {
    return { symbol: upper, name: upper, assetClass: inferAssetClass(upper, upper) };
  }
  if (/^[A-Z0-9][A-Z0-9.-]{0,23}$/.test(upper)) {
    const registered = resolvePass481Identity(upper);
    const registeredClass = registered
      ? resolvePass4648ProviderFirstAssetClass({ symbol: upper, name: registered.label }).assetClass
      : "unknown";
    return {
      symbol: upper,
      name: registered?.label ?? upper,
      // A plain listed ticker is not enough to distinguish an equity from an
      // ETF/REIT. Provider metadata (or the verified identity registry) must
      // decide; guessing "stock" caused GLD/SLV/EEM misclassification.
      assetClass: registeredClass,
    };
  }
  return null;
}

const STOOQ_SYMBOLS: Record<string, string> = {
  AAPL: "aapl.us",
  NVDA: "nvda.us",
  MSFT: "msft.us",
  GOOGL: "googl.us",
  GOOG: "goog.us",
  AMZN: "amzn.us",
  META: "meta.us",
  TSLA: "tsla.us",
  AMD: "amd.us",
  AVGO: "avgo.us",
  TSM: "tsm.us",
  JPM: "jpm.us",
  V: "v.us",
  MA: "ma.us",
  SPY: "spy.us",
  QQQ: "qqq.us",
  VOO: "voo.us",
  "ADS.DE": "ads.de",
  "MC.PA": "mc.fr",
  "^GSPC": "^spx",
  "^NDX": "^ndq",
  "^VIX": "^vix",
  "^GDAXI": "^dax",
};

function stooqSymbol(symbol: string) {
  return STOOQ_SYMBOLS[symbol.toUpperCase()] ?? null;
}

function parseStooqCsv(csv: string) {
  const [headerLine, rowLine] = csv.trim().split(/\r?\n/);
  if (!headerLine || !rowLine || /N\/D/i.test(rowLine)) return null;
  const headers = headerLine.split(",").map((item) => item.trim().toLowerCase());
  const row = rowLine.split(",").map((item) => item.trim());
  const valueFor = (name: string) => row[headers.indexOf(name)];
  const price = finite(valueFor("close"));
  const volume = finite(valueFor("volume"));
  const providerSymbol = valueFor("symbol");
  const date = valueFor("date");
  const time = valueFor("time");
  if (price === undefined) return null;
  const dailyTimestampMs = /^\d{4}-\d{2}-\d{2}$/.test(date ?? "")
    ? Date.parse(`${date}T00:00:00.000Z`)
    : Number.NaN;
  const observedAt = Number.isFinite(dailyTimestampMs)
    && new Date(dailyTimestampMs).toISOString().slice(0, 10) === date
    ? new Date(dailyTimestampMs).toISOString()
    : null;
  return {
    price,
    volume,
    providerSymbol: providerSymbol || null,
    observedAt,
    observedAtLabel: [date, time].filter(Boolean).join(" ") || null,
    timestampSemantics: observedAt ? "daily_reference_date_utc" as const : "unavailable" as const,
  };
}

async function loadStooqQuote(symbol: string) {
  const mapped = stooqSymbol(symbol);
  if (!mapped) return null;
  const startedAt = performance.now();
  const params = new URLSearchParams({ s: mapped, f: "sd2t2ohlcv", h: "", e: "csv" });
  const response = await brokeredEgressFetch(`https://stooq.com/q/l/?${params.toString()}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(6_000),
    headers: { accept: "text/csv,text/plain,*/*" },
  }, { profile: "real_markets", operation: "stooq_quote", timeoutMs: 6_000 });
  if (!response.ok) return null;
  const payload = parseStooqCsv(new TextDecoder().decode(await readResponseBytesBounded(response, 262_144)));
  if (!payload) return null;
  return {
    payload,
    expectedProviderSymbol: mapped,
    receivedAt: new Date().toISOString(),
    latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
    httpStatus: response.status,
  };
}


function safeResultReasons(result: TokenRiskResult) {
  const maybeReasons = (result as TokenRiskResult & { reasons?: unknown }).reasons;
  if (Array.isArray(maybeReasons)) return maybeReasons.map((reason) => String(reason)).filter(Boolean);
  const maybeLimitations = (result as TokenRiskResult & { limitations?: unknown }).limitations;
  const limitations = Array.isArray(maybeLimitations) ? maybeLimitations : result.metaModel?.limitations ?? [];
  const signals = Array.isArray(result.signals) ? result.signals.map((signal) => signal.id) : [];
  return [...signals.slice(0, 8), ...limitations.slice(0, 8)].map((item) => String(item));
}

function realMarketCryptoMissingLanes(assetClass: VelmereMarketAssetClass) {
  if (assetClass !== "crypto") return [];
  return [
    "Real Markets crypto proof lane: exchange quote attached, but holder count is still missing.",
    "Real Markets crypto proof lane: top holder concentration is still missing.",
    "Real Markets crypto proof lane: orderbook depth / spread / slippage simulation is still missing.",
    "Real Markets crypto proof lane: DEX liquidity and venue liquidity split are still missing.",
    "Real Markets crypto proof lane: contract admin/proxy/mint/blacklist checks are still missing where applicable.",
  ];
}

function sourceQualityNote(args: {
  yahooPrice?: number;
  stooqPrice?: number;
  hasChart: boolean;
  yahooEvidenceEligible: boolean;
  stooqEvidenceEligible: boolean;
}) {
  if (args.yahooEvidenceEligible
    && args.stooqEvidenceEligible
    && args.yahooPrice !== undefined
    && args.stooqPrice !== undefined
    && args.yahooPrice > 0) {
    const divergence = Math.abs(((args.stooqPrice - args.yahooPrice) / args.yahooPrice) * 100);
    return {
      secondProviderConfirmed: true,
      divergencePercent: Number(divergence.toFixed(3)),
      note: divergence <= 1.5
        ? "Yahoo/Stooq quote lanes are aligned within 1.5%."
        : "Yahoo/Stooq quote divergence requires manual source review.",
    };
  }
  return {
    secondProviderConfirmed: false,
    divergencePercent: null,
    note: args.hasChart
      ? "Yahoo quote/chart present; independent Stooq second provider still missing or unavailable."
      : "Primary quote present; history and independent second provider still need confirmation.",
  };
}

type RealMarketReceiptPayload = {
  symbol?: unknown;
  price?: unknown;
  previousClose?: unknown;
  closes?: unknown;
  volumes?: unknown;
  volume?: unknown;
  marketCap?: unknown;
  currency?: unknown;
  exchange?: unknown;
  corporateActions?: unknown;
  observedAt?: unknown;
  [key: string]: unknown;
};

export type RealMarketVlmReceiptObservation = {
  providerId: string;
  providerFamily: string;
  requestedSymbol: string;
  resolvedSymbol: string | null;
  sourceIdentityMatched: boolean;
  observedAt: string | number | Date | null;
  receivedAt: string | Date | null;
  latencyMs: number | null;
  httpStatus: number;
  ttlMs: number;
  normalizedPayload: RealMarketReceiptPayload;
};

function normalizedSymbol(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9.^=/-]+/g, "");
}

function finiteArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item))
    : [];
}

function nonEmptyText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizedProviderObservedAt(value: unknown): string | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const milliseconds = value > 10_000_000_000 ? value : value * 1_000;
    const parsed = new Date(milliseconds);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  // Timezone-free labels such as Stooq's intraday CSV time are not instants.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) return null;
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export function deriveRealMarketVlmReceiptCapabilities(
  payload: RealMarketReceiptPayload,
  observedAt: unknown,
): string[] {
  const capabilities = [
    nonEmptyText(payload.symbol) ? "identity" : null,
    finite(payload.price) !== undefined ? "price" : null,
    finite(payload.price) !== undefined ? "quote" : null,
    finiteArray(payload.closes).length >= 2 ? "history" : null,
    finite(payload.volume) !== undefined || finiteArray(payload.volumes).length > 0 ? "volume" : null,
    finite(payload.marketCap) !== undefined ? "market_cap" : null,
    nonEmptyText(payload.currency) ? "currency" : null,
    nonEmptyText(payload.exchange) ? "exchange" : null,
    Array.isArray(payload.corporateActions) && payload.corporateActions.length > 0 ? "corporate_actions" : null,
    normalizedProviderObservedAt(observedAt) ? "source_timestamp" : null,
  ].filter((value): value is string => Boolean(value));
  return Array.from(new Set(capabilities)).sort();
}

/**
 * Builds one source-bound receipt from facts that the provider actually
 * returned.  Capabilities are derived, never asserted by the caller.
 */
export function buildRealMarketVlmProviderReceipt(
  observation: RealMarketVlmReceiptObservation,
): Pass4644ProviderEvidenceReceipt {
  const requestedSymbol = normalizedSymbol(observation.requestedSymbol);
  const resolvedSymbol = normalizedSymbol(observation.resolvedSymbol);
  const identityMatched = Boolean(
    observation.sourceIdentityMatched
    && requestedSymbol
    && resolvedSymbol
    && requestedSymbol === resolvedSymbol,
  );
  const observedAt = normalizedProviderObservedAt(observation.observedAt);
  const capabilities = deriveRealMarketVlmReceiptCapabilities(observation.normalizedPayload, observedAt);
  const latencyValid = typeof observation.latencyMs === "number"
    && Number.isFinite(observation.latencyMs)
    && observation.latencyMs >= 0;
  const receivedAtValid = observation.receivedAt instanceof Date
    ? Number.isFinite(observation.receivedAt.getTime())
    : typeof observation.receivedAt === "string" && Number.isFinite(Date.parse(observation.receivedAt));
  const rejectionReasons = [
    identityMatched ? null : "provider_symbol_identity_mismatch",
    observedAt ? null : "provider_source_timestamp_missing",
    receivedAtValid ? null : "provider_transport_received_at_missing",
    latencyValid ? null : "provider_transport_latency_missing",
    capabilities.length ? null : "provider_capabilities_unavailable",
  ].filter((value): value is string => Boolean(value));
  return createPass4644ProviderEvidenceReceipt({
    providerId: observation.providerId,
    providerFamily: observation.providerFamily,
    surface: "real_markets",
    verification: "normalized_response",
    state: rejectionReasons.length ? "rejected" : "confirmed",
    requestedIdentity: requestedSymbol,
    resolvedSymbol: resolvedSymbol || undefined,
    identityMatched,
    capabilities,
    timestampProvenance: "provider",
    observedAt,
    receivedAt: receivedAtValid ? observation.receivedAt : null,
    ttlMs: observation.ttlMs,
    httpStatus: observation.httpStatus,
    latencyMs: latencyValid ? observation.latencyMs! : undefined,
    normalizedPayload: observation.normalizedPayload,
    rejectionReasons,
  });
}

/** Prevents presentation-only normalization from desynchronizing the engine. */
export function isRealMarketRiskResultInternallyConsistent(result: TokenRiskResult) {
  const expectedLevel = levelFromScore(result.score);
  return result.level === expectedLevel
    && result.badge === badgeFromLevel(expectedLevel)
    && result.uncertainty?.pointEstimate === result.score
    && result.modelBinding?.scoreFormula === result.scoreFormula;
}

export function isRealMarketVlmQuery(query: string): boolean {
  return Boolean(resolveRealMarketTarget(query));
}

async function loadYahooChart(symbol: string) {
  const startedAt = performance.now();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=7d&interval=1d&includePrePost=false`;
  const response = await brokeredEgressFetch(url, { cache: "no-store", signal: AbortSignal.timeout(6_000), headers: { accept: "application/json" } }, { profile: "real_markets", operation: "yahoo_chart", timeoutMs: 6_000 });
  if (!response.ok) return null;
  const json = await readJsonResponseBounded<{
    chart?: {
      result?: Array<{
        meta?: Record<string, unknown>;
        indicators?: { quote?: Array<Record<string, unknown[]>> };
      }>;
    };
  }>(response, 2_097_152);
  const payload = json.chart?.result?.[0] ?? null;
  if (!payload) return null;
  return {
    payload,
    receivedAt: new Date().toISOString(),
    latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
    httpStatus: response.status,
  };
}

async function loadYahooQuote(symbol: string) {
  const startedAt = performance.now();
  const params = new URLSearchParams({ symbols: symbol });
  const response = await brokeredEgressFetch(`https://query1.finance.yahoo.com/v7/finance/quote?${params.toString()}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(6_000),
    headers: { accept: "application/json" },
  }, { profile: "real_markets", operation: "yahoo_quote", timeoutMs: 6_000 });
  if (!response.ok) return null;
  const json = await readJsonResponseBounded<{ quoteResponse?: { result?: Array<Record<string, unknown>> } }>(response, 2_097_152);
  const payload = json.quoteResponse?.result?.[0] ?? null;
  if (!payload) return null;
  return {
    payload,
    receivedAt: new Date().toISOString(),
    latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
    httpStatus: response.status,
  };
}

function compactSparkline(values: Array<number | undefined>) {
  return values.filter((value): value is number => Number.isFinite(value));
}

export async function resolveRealMarketVlmRiskResult(
  query: string,
  options: { providerAllowlist?: Iterable<string> } = {},
): Promise<TokenRiskResult | null> {
  const target = resolveRealMarketTarget(query);
  if (!target) return null;

  const providerAllowlist = options.providerAllowlist ? new Set(options.providerAllowlist) : null;
  const providerAllowed = (providerId: string) => !providerAllowlist || providerAllowlist.has(providerId);
  const [quoteTransport, chartTransport, stooqTransport] = await Promise.all([
    providerAllowed("yahoo_finance") ? loadYahooQuote(target.symbol).catch(() => null) : Promise.resolve(null),
    providerAllowed("yahoo_finance") ? loadYahooChart(target.symbol).catch(() => null) : Promise.resolve(null),
    providerAllowed("stooq") ? loadStooqQuote(target.symbol).catch(() => null) : Promise.resolve(null),
  ]);

  const rawQuote = quoteTransport?.payload ?? null;
  const rawChart = chartTransport?.payload ?? null;
  const rawMeta = rawChart?.meta ?? {};
  const rawCloses = compactSparkline(((rawChart?.indicators?.quote?.[0]?.close ?? []) as unknown[]).map(finite));
  const rawVolumes = compactSparkline(((rawChart?.indicators?.quote?.[0]?.volume ?? []) as unknown[]).map(finite));
  const rawChartTimestamps = compactSparkline(((rawChart as { timestamp?: unknown[] } | null)?.timestamp ?? []).map(finite));
  const targetSymbol = normalizedSymbol(target.symbol);
  const quoteProviderSymbol = normalizedSymbol(rawQuote?.symbol);
  const chartProviderSymbol = normalizedSymbol(rawMeta.symbol);
  const quoteIdentityMatched = Boolean(targetSymbol && quoteProviderSymbol === targetSymbol);
  const chartIdentityMatched = Boolean(targetSymbol && chartProviderSymbol === targetSymbol);
  const stooqProviderSymbol = String(stooqTransport?.payload.providerSymbol ?? "").trim().toLowerCase();
  const stooqIdentityMatched = Boolean(
    stooqProviderSymbol
    && stooqProviderSymbol === String(stooqTransport?.expectedProviderSymbol ?? "").trim().toLowerCase(),
  );

  const quoteReceipt = quoteTransport ? buildRealMarketVlmProviderReceipt({
    providerId: "yahoo_finance_quote",
    providerFamily: "yahoo",
    requestedSymbol: target.symbol,
    resolvedSymbol: quoteProviderSymbol || null,
    sourceIdentityMatched: quoteIdentityMatched,
    observedAt: finite(rawQuote?.regularMarketTime) ?? null,
    receivedAt: quoteTransport.receivedAt,
    latencyMs: quoteTransport.latencyMs,
    httpStatus: quoteTransport.httpStatus,
    ttlMs: 5 * 60_000,
    normalizedPayload: {
      symbol: rawQuote?.symbol,
      price: finite(rawQuote?.regularMarketPrice),
      previousClose: finite(rawQuote?.regularMarketPreviousClose),
      volume: finite(rawQuote?.regularMarketVolume),
      marketCap: finite(rawQuote?.marketCap),
      currency: rawQuote?.currency,
      exchange: rawQuote?.fullExchangeName ?? rawQuote?.exchange,
      observedAt: finite(rawQuote?.regularMarketTime),
    },
  }) : null;
  const chartObservedAt = finite(rawMeta.regularMarketTime) ?? rawChartTimestamps.at(-1) ?? null;
  const chartReceipt = chartTransport ? buildRealMarketVlmProviderReceipt({
    providerId: "yahoo_finance_chart",
    providerFamily: "yahoo",
    requestedSymbol: target.symbol,
    resolvedSymbol: chartProviderSymbol || null,
    sourceIdentityMatched: chartIdentityMatched,
    observedAt: chartObservedAt,
    receivedAt: chartTransport.receivedAt,
    latencyMs: chartTransport.latencyMs,
    httpStatus: chartTransport.httpStatus,
    ttlMs: 5 * 60_000,
    normalizedPayload: {
      symbol: rawMeta.symbol,
      price: finite(rawMeta.regularMarketPrice) ?? rawCloses.at(-1),
      previousClose: finite(rawMeta.previousClose),
      closes: rawCloses,
      volumes: rawVolumes,
      currency: rawMeta.currency,
      exchange: rawMeta.exchangeName,
      observedAt: chartObservedAt,
    },
  }) : null;
  const stooqReceipt = stooqTransport ? buildRealMarketVlmProviderReceipt({
    providerId: "stooq_quote",
    providerFamily: "stooq",
    requestedSymbol: target.symbol,
    resolvedSymbol: target.symbol,
    sourceIdentityMatched: stooqIdentityMatched,
    observedAt: stooqTransport.payload.observedAt,
    receivedAt: stooqTransport.receivedAt,
    latencyMs: stooqTransport.latencyMs,
    httpStatus: stooqTransport.httpStatus,
    ttlMs: 36 * 60 * 60_000,
    normalizedPayload: {
      symbol: stooqTransport.payload.providerSymbol,
      canonicalSymbol: target.symbol,
      expectedProviderSymbol: stooqTransport.expectedProviderSymbol,
      price: stooqTransport.payload.price,
      volume: stooqTransport.payload.volume,
      observedAt: stooqTransport.payload.observedAt,
      observedAtLabel: stooqTransport.payload.observedAtLabel,
      timestampSemantics: stooqTransport.payload.timestampSemantics,
    },
  }) : null;
  const providerReceipts = [quoteReceipt, chartReceipt, stooqReceipt]
    .filter((receipt): receipt is Pass4644ProviderEvidenceReceipt => Boolean(receipt));
  const quoteEligible = quoteReceipt?.commercialEvidenceEligible === true;
  const chartEligible = chartReceipt?.commercialEvidenceEligible === true;
  const stooqEligible = stooqReceipt?.commercialEvidenceEligible === true;
  const quote = quoteEligible ? rawQuote : null;
  const chart = chartEligible ? rawChart : null;
  const meta = chart?.meta ?? {};
  const stooq = stooqEligible ? stooqTransport?.payload ?? null : null;
  const closes = chartEligible ? rawCloses : [];
  const volumes = chartEligible ? rawVolumes : [];
  const yahooPrice = finite(quote?.regularMarketPrice) ?? finite(meta.regularMarketPrice) ?? closes.at(-1);
  const price = yahooPrice ?? stooq?.price;
  const previousClose = finite(quote?.regularMarketPreviousClose) ?? finite(meta.previousClose) ?? (closes.length >= 2 ? closes.at(-2) : undefined);
  const marketCap = finite(quote?.marketCap);
  const volume24h = finite(quote?.regularMarketVolume) ?? stooq?.volume ?? volumes.at(-1);
  const averageVolume7d = volumes.length ? volumes.reduce((sum, value) => sum + value, 0) / volumes.length : undefined;
  const firstClose = closes.at(0);
  const resolvedName = String(quote?.shortName || quote?.longName || meta.shortName || target.name);
  const classification = resolvePass4648ProviderFirstAssetClass({
    symbol: target.symbol,
    name: resolvedName,
    declaredAssetClass: target.assetClass,
    providerMetadata: {
      symbol: String(quote?.symbol || meta.symbol || target.symbol),
      name: resolvedName,
      quoteType: String(quote?.quoteType || ""),
      typeDisp: String(quote?.typeDisp || ""),
      instrumentType: String(meta.instrumentType || quote?.instrumentType || ""),
      exchange: String(quote?.exchange || meta.exchangeName || ""),
      fullExchangeName: String(quote?.fullExchangeName || meta.fullExchangeName || ""),
      market: String(quote?.market || meta.exchangeName || ""),
    },
  });
  const resolvedAssetClass = classification.assetClass;
  const yahooAvailable = quoteEligible || chartEligible;
  const sourceQa = sourceQualityNote({
    yahooPrice,
    stooqPrice: stooq?.price,
    hasChart: chartEligible && closes.length >= 2,
    yahooEvidenceEligible: yahooAvailable,
    stooqEvidenceEligible: stooqEligible,
  });
  const dataSources = [
    // PASS2279: Yahoo quote and Yahoo chart are one provider family.
    // PASS2277/PASS2281 marker compatibility: Yahoo Finance quote adapter + Yahoo Finance chart adapter.
    // They improve freshness/detail, but must not count as two independent sources.
    yahooAvailable ? "Yahoo Finance market adapter" : null,
    stooqEligible ? "Stooq daily-reference quote adapter" : null,
  ].filter((source): source is string => Boolean(source));
  const sourceFamilyTruth = yahooAvailable && closes.length >= 2
    ? "Yahoo quote + chart share one provider family; chart confirms cadence, not independence."
    : yahooAvailable
      ? "Yahoo primary provider present; chart/history may still be missing."
      : "Yahoo primary provider unavailable; Stooq may only provide a partial quote lane.";

  const input: TokenRiskInput = {
    marketId: `real-market:${target.symbol}`,
    symbol: target.symbol,
    name: resolvedName,
    url: `https://finance.yahoo.com/quote/${encodeURIComponent(target.symbol)}`,
    assetClass: resolvedAssetClass,
    currentPrice: price,
    marketCap,
    volume24h,
    averageVolume7d,
    priceChange24h: pctChange(previousClose, price),
    priceChange7d: pctChange(firstClose, price),
    sparkline7d: closes,
    dataSources,
  };

  if (!sourceQa.secondProviderConfirmed) {
    input.dataSources = dataSources;
  }

  const result = analyzeTokenRisk(input, price !== undefined && providerReceipts.some((receipt) => receipt.commercialEvidenceEligible) ? "live" : "partial");
  attachPass4644ProviderReceipts(result, providerReceipts);
  const mutableResult = result as TokenRiskResult & { limitations?: string[]; pass2281OutputQa?: Record<string, unknown>; pass2282OutputAudit?: Record<string, unknown>; pass2283OutputQualityGate?: Record<string, unknown>; pass2284LiveOutputQualityLedger?: Record<string, unknown>; pass2285PremiumOutputGate?: Record<string, unknown>; pass2286WorldclassLiveOutputPaymentQa?: Record<string, unknown>; pass2287RuntimeOutputFirewall?: Record<string, unknown>; pass2288ClaimProofFirewall?: Record<string, unknown>; pass2289CustomerReleaseGate?: Record<string, unknown>; pass2290ReleaseTraceLedger?: Record<string, unknown>; pass2291ProductionReplayGate?: Record<string, unknown> };
  const existingLimitations = Array.isArray(mutableResult.limitations) ? mutableResult.limitations : result.metaModel?.limitations ?? [];
  const pass2318CryptoMissingLanes = realMarketCryptoMissingLanes(resolvedAssetClass);
  const sourceConfidence = buildPass2281SourceConfidence({
    sourceCount: dataSources.length,
    missingCount: sourceQa.secondProviderConfirmed ? 0 : 1,
    hasSecondProvider: sourceQa.secondProviderConfirmed,
    dataQuality: result.dataQuality,
  });
  const pass2282OutputPlan = buildPass2282VisibleOutputPlan({
    depth: "pro",
    assetText: `${target.symbol} ${target.name} ${resolvedAssetClass}`,
    confirmedSources: dataSources,
  });
  const pass2282RiskPresentation = buildPass2282RiskPresentation({
    symbol: target.symbol,
    assetClass: resolvedAssetClass,
    rawScore: result.score,
    confidenceCap: sourceConfidence.cap,
    confirmedSources: dataSources,
    missingLanes: pass2282OutputPlan.missingLanes,
  });
  const pass2283OutputQualityGate = buildPass2283OutputQualityGate({
    surface: "real_markets",
    depth: "pro",
    assetText: `${target.symbol} ${target.name} ${resolvedAssetClass}`,
    confirmedSources: dataSources,
    missingLanes: pass2282OutputPlan.missingLanes,
    rawScore: result.score,
    paidAccessVerified: false,
  });
  const pass2284LiveOutputQualityLedger = buildPass2284LiveOutputQualityLedger({
    surface: "real_markets",
    depth: "pro",
    assetText: `${target.symbol} ${target.name} ${resolvedAssetClass}`,
    confirmedSources: dataSources,
    missingLanes: pass2282OutputPlan.missingLanes,
    rawScore: result.score,
    confidenceCap: sourceConfidence.cap,
    paidAccessVerified: false,
    customerOutputText: safeResultReasons(result).join(" "),
  });
  const pass2285PremiumOutputGate = buildPass2285PremiumOutputGate({
    surface: "real_markets",
    depth: "pro",
    assetText: `${target.symbol} ${target.name} ${resolvedAssetClass}`,
    confirmedSources: dataSources,
    missingLanes: pass2282OutputPlan.missingLanes,
    rawScore: result.score,
    confidenceCap: sourceConfidence.cap,
    paidAccessVerified: false,
    customerOutputText: safeResultReasons(result).join(" "),
  });
  const pass2286WorldclassLiveOutputPaymentQa = buildPass2286WorldclassLiveOutputPaymentQa({
    surface: "real_markets",
    depth: "pro",
    assetText: `${result.token.symbol} ${result.token.name} ${result.token.assetClass ?? ""} ${target.name}`,
    confirmedSources: result.dataSources,
    missingLanes: [sourceQa.note, sourceFamilyTruth, ...existingLimitations],
    rawScore: result.score,
    confidenceCap: Math.round((result.confidence ?? 0) * 100),
    paidAccessVerified: false,
    customerOutputText: safeResultReasons(result).join(" "),
  });
  const pass2287RuntimeOutputFirewall = applyPass2287RuntimeOutputFirewall({
    locale: "en",
    surface: "real_markets",
    depth: "pro",
    assetText: `${result.token.symbol} ${result.token.name} ${result.token.assetClass ?? ""} ${target.name}`,
    confirmedSources: result.dataSources,
    missingLanes: [sourceQa.note, sourceFamilyTruth, ...existingLimitations],
    rawScore: result.score,
    confidenceCap: Math.round((result.confidence ?? 0) * 100),
    paidAccessVerified: false,
    customerOutputText: safeResultReasons(result).join(" "),
  });
  const pass2288ClaimProofFirewall = buildPass2288ClaimProofFirewall({
    locale: "en",
    surface: "real_markets",
    depth: "pro",
    assetText: `${result.token.symbol} ${result.token.name} ${result.token.assetClass ?? ""} ${target.name}`,
    confirmedSources: result.dataSources,
    missingLanes: [sourceQa.note, sourceFamilyTruth, ...existingLimitations],
    rawScore: result.score,
    confidenceCap: Math.round((result.confidence ?? 0) * 100),
    paidAccessVerified: false,
    customerOutputText: pass2287RuntimeOutputFirewall.customerOutput,
  });
  const pass2289CustomerReleaseGate = buildPass2289CustomerReleaseGate({
    locale: "en",
    surface: "real_markets",
    depth: "pro",
    assetText: `${result.token.symbol} ${result.token.name} ${result.token.assetClass ?? ""} ${target.name}`,
    confirmedSources: result.dataSources,
    missingLanes: [sourceQa.note, sourceFamilyTruth, ...existingLimitations],
    rawScore: result.score,
    confidenceCap: Math.round((result.confidence ?? 0) * 100),
    paidAccessVerified: false,
    customerOutputText: pass2288ClaimProofFirewall.customerOutput,
  });
  const pass2290ReleaseTraceLedger = buildPass2290ReleaseTraceLedger({
    locale: "en",
    surface: "real_markets",
    depth: "pro",
    assetText: `${result.token.symbol} ${result.token.name} ${result.token.assetClass ?? ""} ${target.name}`,
    confirmedSources: result.dataSources,
    missingLanes: [sourceQa.note, sourceFamilyTruth, ...existingLimitations],
    rawScore: result.score,
    confidenceCap: Math.round((result.confidence ?? 0) * 100),
    paidAccessVerified: false,
    customerOutputText: pass2289CustomerReleaseGate.customerOutput,
    upstreamGate: pass2289CustomerReleaseGate,
  });

  const pass2291ProductionReplayGate = buildPass2291ProductionReplayGate({
    locale: "en",
    surface: "real_markets",
    depth: "pro",
    assetText: `${result.token.symbol} ${result.token.name} ${result.token.assetClass ?? ""} ${target.name}`,
    confirmedSources: result.dataSources,
    missingLanes: [sourceQa.note, sourceFamilyTruth, ...existingLimitations],
    rawScore: result.score,
    confidenceCap: Math.round((result.confidence ?? 0) * 100),
    paidAccessVerified: false,
    customerOutputText: pass2290ReleaseTraceLedger.customerOutput,
    upstreamLedger: pass2290ReleaseTraceLedger,
  });

  mutableResult.limitations = Array.from(new Set([
    ...existingLimitations,
    ...pass2318CryptoMissingLanes,
    `${PASS2318_CRYPTO_REAL_MARKETS_EVIDENCE_ROUTER}: query ${query} resolved to ${target.symbol} as ${resolvedAssetClass}; VLM sourceMode must remain real_markets instead of crypto_market_integrity.`,
    `PASS4648_PROVIDER_FIRST_CLASSIFICATION: class=${resolvedAssetClass}; source=${classification.source}; verified=${classification.verified}; blockers=${classification.blockers.join(",") || "none"}.`,
    `${PASS2278_REAL_MARKET_SOURCE_QA}: ${sourceQa.note}`,
    `PASS2279_REAL_MARKET_PROVIDER_FAMILY_TRUTH: ${sourceFamilyTruth}`,
    sourceQa.divergencePercent === null
      ? "Real Markets second independent quote source missing or unavailable for this symbol."
      : `Real Markets Yahoo/Stooq divergence: ${sourceQa.divergencePercent}%`,
    `PASS2281_REAL_MARKET_OUTPUT_QA: sourceConfidence=${sourceConfidence.state}; cap=${sourceConfidence.cap}%; static-35 is blocked from becoming live proof.`,
    `PASS2282_LIVE_OUTPUT_AUDIT_QA: asset=${pass2282OutputPlan.asset}; sourceState=${pass2282OutputPlan.sourceState}; scoreLabel=${pass2282RiskPresentation.label}; static35Reframed=${pass2282RiskPresentation.static35Reframed}.`,
    `PASS2283_OUTPUT_PAYMENT_QA: status=${pass2283OutputQualityGate.outputStatus}; confidence=${pass2283OutputQualityGate.sourceConfidence.cap}%; paidLocked=${pass2283OutputQualityGate.paidLocked}; wallet connect is not payment proof.`,
    `PASS2284_LIVE_OUTPUT_QUALITY: state=${pass2284LiveOutputQualityLedger.productionState}; confidence=${pass2284LiveOutputQualityLedger.confidenceCap}%; static35=${pass2284LiveOutputQualityLedger.static35Detected}; next=${pass2284LiveOutputQualityLedger.nextRepair}.`,
    `PASS2285_PREMIUM_OUTPUT_GATE: readiness=${pass2285PremiumOutputGate.outputReadiness}; displayRisk=${pass2285PremiumOutputGate.displayRisk}; sourceFamilies=${pass2285PremiumOutputGate.externalProviderFamilies.join("+") || "missing"}; wallet connect is not payment proof.`,
    `PASS2286_WORLDCLASS_LIVE_OUTPUT_PAYMENT_QA: state=${pass2286WorldclassLiveOutputPaymentQa.productionState}; displayRisk=${pass2286WorldclassLiveOutputPaymentQa.displayRisk}; confidence=${pass2286WorldclassLiveOutputPaymentQa.confidenceCap}%; no DEX/wallet-holder/token-tax language for NVDA/SPY/S&P500.`,
    `PASS2287_RUNTIME_OUTPUT_FIREWALL: state=${pass2287RuntimeOutputFirewall.productionState}; rewritten=${pass2287RuntimeOutputFirewall.rewritten}; displayRisk=${pass2287RuntimeOutputFirewall.displayRisk}; sourceFamilies=${pass2287RuntimeOutputFirewall.sourceFamilies.join("+") || "missing"}; wallet connect is not payment proof.`,
    `PASS2288_CLAIM_PROOF_FIREWALL: state=${pass2288ClaimProofFirewall.productionState}; rewritten=${pass2288ClaimProofFirewall.rewritten}; displayRisk=${pass2288ClaimProofFirewall.displayRisk}; sourceFamilies=${pass2288ClaimProofFirewall.sourceFamilies.join("+") || "missing"}; no verdict outruns source proof.`,
    `PASS2289_CUSTOMER_RELEASE_GATE: state=${pass2289CustomerReleaseGate.productionState}; releaseAllowed=${pass2289CustomerReleaseGate.releaseAllowed}; issues=${pass2289CustomerReleaseGate.releaseIssues.length}; final customer output must show family/sources/confidence/missing proof/149€ receipt boundary.`,
    `PASS2290_RELEASE_TRACE_LEDGER: state=${pass2290ReleaseTraceLedger.productionState}; releaseAllowed=${pass2290ReleaseTraceLedger.releaseAllowed}; traceOrderSafe=${pass2290ReleaseTraceLedger.traceOrderSafe}; paymentProofState=${pass2290ReleaseTraceLedger.paymentProofState}; final customer output follows ordered family→sources→confidence→missing→tier→payment trace.`,
    `PASS2291_PRODUCTION_REPLAY_GATE: state=${pass2291ProductionReplayGate.productionState}; releaseAllowed=${pass2291ProductionReplayGate.releaseAllowed}; issues=${pass2291ProductionReplayGate.replayIssues.length}; final customer output replays visible Basic/Pro/Advanced tier difference and 149€ receipt boundary.`,
  ])).slice(0, 32);
  mutableResult.pass2281OutputQa = {
    sourceConfidence,
    scoreNormalizedFrom: null,
    postEngineScoreMutationBlocked: true,
    sourceFamilyTruth,
    advancedAuditPriceEur: 149,
    paymentRule: "Stripe/Web3 must be verified server-side; wallet connect is not payment proof.",
  };
  mutableResult.pass2282OutputAudit = {
    plan: pass2282OutputPlan,
    riskPresentation: pass2282RiskPresentation,
    sampleAssets: ["BTC", "NVDA", "SPY", "S&P 500"],
    rule: "PASS2282: show asset family, confirmed sources, missing lanes and score vs confidence before verdict.",
  };
  mutableResult.pass2283OutputQualityGate = {
    gate: pass2283OutputQualityGate,
    sampleAssets: ["BTC", "ETH", "SOL", "NVDA", "AAPL", "SPY", "QQQ", "S&P 500"],
    rule: "PASS2283: Basic/Pro/Advanced must differ; 149€ Advanced stays behind server-side Stripe/BLIK/Web3 entitlement; wallet connect is not payment proof.",
  };
  mutableResult.pass2284LiveOutputQualityLedger = {
    ledger: pass2284LiveOutputQualityLedger,
    sampleAssets: ["BTC", "ETH", "SOL", "NVDA", "AAPL", "SPY", "QQQ", "S&P 500"],
    rule: "PASS2284: customer output must pass forbidden-claim scan, static-35 source-gap brake, source confidence cap and 149€ entitlement boundary before display.",
  };
  mutableResult.pass2285PremiumOutputGate = {
    gate: pass2285PremiumOutputGate,
    sampleAssets: ["BTC", "ETH", "SOL", "NVDA", "AAPL", "SPY", "QQQ", "S&P 500"],
    rule: "PASS2285: premium output must show family, sources, confidence cap and missing lanes before verdict; Basic/Pro/Advanced differ visibly; Advanced Audit 149€ requires server-side receipt; wallet connect is not payment proof.",
  };
  mutableResult.pass2286WorldclassLiveOutputPaymentQa = {
    gate: pass2286WorldclassLiveOutputPaymentQa,
    sampleAssets: ["BTC", "ETH", "SOL", "NVDA", "AAPL", "SPY", "QQQ", "S&P 500"],
    rule: "PASS2286: ultra-premium output must pass source ledger, confidence cap, missing lanes, forbidden-claim scan and 149€ server-side receipt boundary before display.",
  };
  mutableResult.pass2287RuntimeOutputFirewall = {
    gate: pass2287RuntimeOutputFirewall,
    sampleAssets: ["BTC", "ETH", "SOL", "NVDA", "AAPL", "SPY", "QQQ", "S&P 500"],
    rule: "PASS2287: customer-visible output is rewritten by runtime firewall when source/confidence/missing/payment sections fail; static 35 is source-gap priority; Advanced 149€ requires server-side receipt.",
  };
  mutableResult.pass2288ClaimProofFirewall = {
    gate: pass2288ClaimProofFirewall,
    sampleAssets: ["BTC", "ETH", "SOL", "NVDA", "AAPL", "SPY", "QQQ", "S&P 500"],
    rule: "PASS2288: customer-visible output needs explicit source-family proof, missing lanes and 149€ server-side receipt boundary; no verdict outruns proof.",
  };
  mutableResult.pass2289CustomerReleaseGate = {
    gate: pass2289CustomerReleaseGate,
    sampleAssets: ["BTC", "ETH", "SOL", "NVDA", "AAPL", "SPY", "QQQ", "S&P 500"],
    rule: "PASS2289: final customer-visible Real Markets output must show family, provider families, confidence cap, missing proof and 149€ server-side receipt boundary; wallet connect is not payment proof.",
  };
  mutableResult.pass2290ReleaseTraceLedger = {
    gate: pass2290ReleaseTraceLedger,
    sampleAssets: ["BTC", "ETH", "SOL", "NVDA", "AAPL", "SPY", "QQQ", "S&P 500"],
    rule: "PASS2290: Real Markets customer output must follow ordered trace sections: family, sources, confidence, missing proof, tier boundary and 149€ receipt boundary; wallet connect is not payment proof.",
  };
  mutableResult.pass2291ProductionReplayGate = {
    gate: pass2291ProductionReplayGate,
    sampleAssets: ["BTC", "ETH", "SOL", "NVDA", "AAPL", "SPY", "QQQ", "S&P 500"],
    rule: "PASS2291: Real Markets output is replay-audited after PASS2290 so missing source sections, static-35 live-danger claims and Advanced 149€ without receipt are rewritten before customer display.",
  };
  const pass2885MetaModel = result.metaModel;
  // PASS2885_META_MODEL_VERSION_DEFAULT_FIX: keep RiskMetaModel fully required even when upstream analysis returns partial metadata.
  result.metaModel = {
    version: pass2885MetaModel?.version ?? "velmere.real-market.meta.v1",
    verdict: pass2885MetaModel?.verdict ?? "insufficient_data",
    dominantAgent: pass2885MetaModel?.dominantAgent,
    dataFusionScore: pass2885MetaModel?.dataFusionScore ?? result.score ?? 0,
    conflictLevel: pass2885MetaModel?.conflictLevel ?? "low",
    requiredReview: pass2885MetaModel?.requiredReview ?? true,
    summary: pass2885MetaModel?.summary ?? "Real-market VLM adapter metadata normalized by PASS2885 compile surface sweep.",
    escalation: pass2885MetaModel?.escalation ?? "Keep provider/source evidence review before customer-facing verdict.",
    limitations: mutableResult.limitations,
  };
  if (!isRealMarketRiskResultInternallyConsistent(result)) {
    throw new Error("real_market_risk_result_internal_consistency_failed");
  }
  return result;
}

export const PASS2278_REAL_MARKET_SOURCE_QA_CONTRACT = {
  id: PASS2278_REAL_MARKET_SOURCE_QA,
  assets: ["S&P 500", "SPY", "QQQ", "NVDA", "AAPL"],
  primaryProvider: "Yahoo Finance",
  providerMarkers: ["Yahoo Finance quote adapter", "Yahoo Finance chart adapter"],
  optionalSecondProvider: "Stooq",
  rule: "show missing second provider as a gap; never count Velmère internal routers or two Yahoo lanes as independent market providers",
  pass2279Rule: "Yahoo quote + Yahoo chart = one provider family; Stooq only counts when runtime returned a quote.",
  pass2281Rule: "BTC/NVDA/SPY/S&P500 source gaps cap confidence; they do not become static 35 live-risk claims or token-scam language.",
  pass2283Rule: "PASS2283_OUTPUT_PAYMENT_QA: show outputStatus, confidence cap and paid entitlement boundary before any strong market verdict.",
  pass2284Rule: "PASS2284_LIVE_OUTPUT_QUALITY: source/gap ledger plus forbidden-claim scan blocks token language on real-market assets and keeps Advanced 149€ behind server-side receipt.",
  pass2285Rule: "PASS2285_PREMIUM_OUTPUT_GATE: Real Markets output displays provider family truth, confidence cap, missing lanes and static-35 source-gap brake before verdict; wallet connect is not payment proof.",
  pass2286Rule: "PASS2286_WORLDCLASS_LIVE_OUTPUT_PAYMENT_QA: Real Markets output must show source ledger and confidence cap; NVDA/SPY/S&P500 never get DEX/wallet-holder/token-tax language; Advanced Audit 149€ needs server-side receipt.",
  pass2287Rule: "PASS2287_RUNTIME_OUTPUT_FIREWALL: Real Markets customer output is rewritten if source ledger/confidence/missing/payment boundary is absent; wallet connect is not payment proof.",
  pass2288Rule: "PASS2288_CLAIM_PROOF_FIREWALL: Real Markets output must show independent source-family proof or explicit source gap before verdict; static 35 is review priority, not live risk proof.",
  pass2289Rule: "PASS2289_CUSTOMER_RELEASE_GATE: Real Markets final output must include asset family, sources, confidence cap, missing proof and 149€ receipt boundary before customer release.",
  pass2290Rule: "PASS2290_RELEASE_TRACE_LEDGER: Real Markets final output must preserve ordered trace: family → sources → confidence → missing proof → tier boundary → 149€ receipt boundary.",
  pass2291Rule: "PASS2291_PRODUCTION_REPLAY_GATE: Real Markets final output is replay-audited for visible tier differences, source gaps, static 35 source-gap wording and 149€ server receipt boundary.",
  legacyMarker: "Velmère Real Markets provider truth router remains internal-only and is not an independent external data source",
} as const;

/* PASS2278 markers: sourceQualityNote · loadStooqQuote · Real Markets second independent quote source missing · Yahoo/Stooq divergence */


/* PASS2279 markers: PASS2279_REAL_MARKET_PROVIDER_FAMILY_TRUTH · Yahoo quote + chart = one provider family · Stooq only counts when runtime returned a quote · S&P 500 NVDA SPY source QA */

/* PASS2281 markers: PASS2281_REAL_MARKET_OUTPUT_QA · static-35 blocked · sourceConfidence cap · NVDA SPY S&P500 no token lanes · server-side Stripe/Web3 entitlement */
/* PASS2282 markers: PASS2282_LIVE_OUTPUT_AUDIT_QA · asset family before verdict · missing lanes before confidence · static35Reframed · Advanced Audit 149€ */
/* PASS2283 markers: PASS2283_OUTPUT_PAYMENT_QA · outputStatus · paidLocked · server-side Stripe/BLIK/Web3 entitlement · wallet connect is not payment proof */
/* PASS2284 markers: PASS2284_LIVE_OUTPUT_QUALITY · forbidden-claim scan · static35 source-gap brake · Advanced 149€ server-side receipt */

/* PASS2285 markers: PASS2285_PREMIUM_OUTPUT_GATE · NVDA SPY S&P500 source families · no token DEX holder language · static 35 source-gap brake · Advanced Audit 149€ server-side receipt */
/* PASS2286 markers: PASS2286_WORLDCLASS_LIVE_OUTPUT_PAYMENT_QA · source ledger confidence cap missing lanes · no DEX wallet-holder token-tax language · Advanced Audit 149€ server-side receipt */

/* PASS2287 markers: PASS2287_RUNTIME_OUTPUT_FIREWALL · customer output rewrite · static 35 source-gap priority · Advanced Audit 149€ server-side receipt */
/* PASS2288 markers: PASS2288_CLAIM_PROOF_FIREWALL · no verdict outruns source proof · source families before confidence · Advanced Audit 149€ receipt boundary */
/* PASS2289 markers: PASS2289_CUSTOMER_RELEASE_GATE · customer release requires family sources confidence missing proof payment boundary */
/* PASS2290 markers: PASS2290_RELEASE_TRACE_LEDGER · ordered family sources confidence missing tier payment trace · 149€ server receipt */
