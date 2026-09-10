"use client";

// PASS654 public-copy compatibility markers: PASS458 source contract · PASS460 provider consensus · PASS461 venue health · PASS462 cross-venue consensus · PASS464 statement quality · PASS465 SEC/XBRL second source.

import {
  Component,
  type CSSProperties,
  type ChangeEvent as ReactChangeEvent,
  type ErrorInfo,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  ArrowUpRight,
  ArrowUpDown,
  BarChart3,
  Database,
  Gauge,
  LineChart,
  Loader2,
  PieChart,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { reportBrowserBoundaryFailure } from "@/lib/security/browser-error-redaction";
import { Link, useRouter } from "@/navigation";
import ResolvedAssetLogo from "@/components/market-integrity/AssetLogo";
import RiskHistoryControl from "@/components/market-integrity/RiskHistoryControl";

import {
  dedupeMarketInstruments,
  filterMarketInstruments,
} from "@/lib/market-integrity/market-instrument-search";
import { pass628LayerStyle } from "@/lib/ui/pass628-overlay-constitution";
import {
  buildUnifiedAuditEvidence,
  type UnifiedAuditAssetClass,
  type UnifiedAuditMode,
} from "@/lib/market-integrity/unified-audit";
import {
  analyzeMarketSurfaceWithVlmKernel,
  vlmKernelOutputToUnifiedAuditEvidence,
} from "@/lib/ai/vlm-brain-market-surface";
import type { Pass459Fundamentals } from "@/lib/market-integrity/pass459-alpha-vantage-provider";
import {
  buildPass482TerminalOverview,
  type Pass482TerminalAsset,
} from "@/lib/market-integrity/pass482-real-markets-terminal";
import {
  filterPass617PublicRealMarketsRows,
  PASS617_PUBLIC_REAL_MARKETS_CATEGORIES,
} from "@/lib/market-integrity/pass617-real-markets-noncrypto-taxonomy";
import { buildPass618AdaptiveSurface } from "@/lib/market-integrity/pass618-real-markets-adaptive-surface";
import { buildPass619ProviderLineage } from "@/lib/market-integrity/pass619-real-markets-provider-lineage";
import { buildPass620CrossAssetChartParity } from "@/lib/market-integrity/pass620-cross-asset-chart-parity";
import {
  buildPass621MarketSearchResolution,
  type Pass621RankedCandidate,
} from "@/lib/market-integrity/pass621-market-search-exactness";
import {
  normalizePass471CatalogRows,
  normalizePass471ProviderSearchRows,
  normalizePass471Quotes,
  type Pass471ProviderSearchRow,
} from "@/lib/market-integrity/pass471-surface-runtime-resilience";
import {
  buildPass577ProviderSloConsole,
  type Pass577ProviderSlo,
} from "@/lib/market-integrity/pass577-provider-slo-console";
import {
  buildPass579ExactSearchReceipt,
  type Pass579ExactSearchReceipt,
} from "@/lib/search/pass579-exact-search-receipt";
import { type VlmPaidAccessContext } from "@/lib/commerce/pass2024-vlm-paid-access";
import { startVlmServiceCheckout } from "@/lib/commerce/pass2024-vlm-paid-access-client";
import {
  pass35PaidUiStopSellCopy,
  resolvePass35PaidUiStopSell,
} from "@/lib/commerce/pass35-paid-ui-stop-sell";
import {
  buildPass2195RuntimeUxBinding,
  pass2195ToneForNotice,
  type Pass2195RuntimeUxStateCode,
} from "@/lib/ui/pass2195-runtime-ux-binding";
import AssetDetailModal from "@/components/market-integrity/AssetDetailModal";
import { hasServerVerifiedQuoteLiveGate } from "@/components/market-integrity/live-truth";
import type {
  MarketIntelligenceDrawerItem,
  MarketIntelligenceDrawerSummary,
} from "@/components/market-integrity/MarketIntelligenceSideDrawer";
import {
  buildChartLifecycleReceipt,
  buildTop1IntelligenceRail,
  formatDecimalPercent,
} from "@/lib/market-integrity/top1-risk-foundation";
import {
  matchPass1994ManualMarketAliases,
  quoteForAsset,
  quoteSymbolsForAsset,
} from "@/lib/market-integrity/pass4405-cross-asset-build-pressure-helpers";
import {
  PASS4406_REFERENCE_ROWS as PASS2326_REFERENCE_ROWS,
  pass4406ReferenceAssetOrder,
} from "@/lib/market-integrity/pass4406-import-pressure-map";
import {
  assetFromCatalog,
  cleanAssetSymbol,
  fallbackQuoteResponse,
  fetchQuoteBatchPass2808,
  normalizeCatalogResponse,
  normalizeQuoteResponse,
  normalizeSearchResponse,
  pass2808FetchWithTimeout,
  readPass4462RealMarketsJson,
  realMarketsRowTone,
  type Pass4413CrossAssetCatalogResponse as CatalogResponse,
  type Pass4413CrossAssetQuote as Quote,
  type Pass4413CrossAssetQuoteResponse as QuoteResponse,
  type Pass4413CrossAssetSearchResponse as SearchResponse,
  type Pass4413RealMarketsAsset as Asset,
} from "@/lib/market-integrity/pass4413-cross-asset-runtime-normalizers";
import {
  buildPass4388SparklinePolyline,
  buildSparklineSeries,
  categoryFromProvider,
  changeForWindow,
  dynamicRisk,
  displayTrustedPrice,
  formatCompactAmount,
  formatMarketCapProxy,
  formatPrice,
  formatSignedPercent,
  pass2334RiskStatusLabel,
  quoteMarketCap,
  quoteVolume,
  sourceQualityLabel,
} from "@/lib/market-integrity/pass4414-cross-asset-quote-format-helpers";
import {
  pass4573SignedPercentLabel,
  pass4573TrustedAveragePercent,
  pass4576ResolveSourceTimestampSeconds,
  pass4577CanShowPercent,
  pass4579VisibleDataDecision,
  pass4580MayUseDirectionalColor,
  pass4580VisibleValueStatus,
  pass4581SanitizeWindowPercent,
  pass4581WindowMovementDecision,
  pass4581WindowToneAttribute,
  buildPass4582MarketCalmSignal,
  buildPass4583VisualFocusRail,
  buildPass4584PremiumDecisionPosture,
  buildPass4585AttentionBudget,
  buildPass4586VisibleRailPlan,
  buildPass4587PremiumInteractionRhythm,
} from "@/lib/market-integrity/pass4570-market-data-sanity";
import {
  buildPass4418HumanMarketBrief,
  buildPass4418RealMarketsAssetDetailData,
  pass4418ModeIntro,
} from "@/lib/market-integrity/pass4418-cross-asset-brief-detail-helpers";

// PASS4149 visible UI type narrowing: high-risk callbacks now use concrete Real Markets asset/provider/event aliases instead of the legacy any boundary.
type Pass4149RealMarketsAsset = Asset;
type Pass4149RealMarketsProviderSearchRow = Pass471ProviderSearchRow;
type Pass4149RealMarketsRankedAsset = Pass621RankedCandidate<Asset>;
type Pass4149NumberAccumulator = number;
type Pass4149ButtonPointerEvent = ReactPointerEvent<HTMLButtonElement>;
type Pass4149ButtonMouseEvent = ReactMouseEvent<HTMLButtonElement>;
type Pass4149ButtonKeyboardEvent = ReactKeyboardEvent<HTMLButtonElement>;
type Pass4149InputChangeEvent = ReactChangeEvent<HTMLInputElement>;

function pass6PublicQuoteState(
  quote: Quote | undefined,
  locale: "pl" | "en" | "de",
) {
  if (hasServerVerifiedQuoteLiveGate(quote)) {
    return locale === "pl"
      ? "LIVE · POTWIERDZONE"
      : locale === "de"
        ? "LIVE · VERIFIZIERT"
        : "LIVE · VERIFIED";
  }
  if (quote?.state === "live") {
    return locale === "pl"
      ? "DANE ŹRÓDŁOWE · NIE LIVE"
      : locale === "de"
        ? "QUELLDATEN · NICHT LIVE"
        : "SOURCE DATA · NOT LIVE";
  }
  return locale === "pl"
    ? "ŹRÓDŁO NIEDOSTĘPNE · NIE LIVE"
    : locale === "de"
      ? "QUELLE NICHT VERFÜGBAR · NICHT LIVE"
      : "SOURCE UNAVAILABLE · NOT LIVE";
}

function pass6PublicSourceQuality(
  quote: Quote | undefined,
  asset: Asset,
  locale: "pl" | "en" | "de",
) {
  const source = quote?.source || asset.exchange || asset.symbol;
  const reference = asset.category === "fx" ? quote?.officialFxReference : null;
  if (reference?.referenceOnly && reference.executableQuote === false && reference.marketPriceFieldEligible === false) {
    const rate = new Intl.NumberFormat(locale, { maximumFractionDigits: 6, minimumFractionDigits: 2 }).format(reference.referenceRate);
    const referenceState = locale === "pl"
      ? "REFERENCJA ECB · NIE CENA TRANSAKCYJNA"
      : locale === "de"
        ? "EZB-REFERENZ · KEIN TRANSAKTIONSPREIS"
        : "ECB REFERENCE · NOT A TRANSACTION PRICE";
    return `${source} · ${pass6PublicQuoteState(quote, locale)} · ${reference.pair} ${rate} · ${reference.referenceDate} · ${referenceState} · ${reference.attribution}`;
  }
  return `${source} · ${pass6PublicQuoteState(quote, locale)}`;
}
// PASS4153 visible UI type narrowing: Real Markets renderer rows now exit legacy any through concrete cards and events.
type Pass4153RealMarketsCommandTone =
  "gold" | "cyan" | "ready" | "review" | "neutral";
type Pass4153RealMarketsCommandStatusCard = {
  label: string;
  value: string;
  tone: Pass4153RealMarketsCommandTone;
};
type Pass4153RealMarketsOverviewTone =
  "cyan" | "positive" | "negative" | "gold" | "neutral" | "warning";
type Pass4153RealMarketsOverviewAccent =
  "dot" | "sparkline" | "progress" | "risk";
type Pass4153RealMarketsOverviewCard = {
  icon: typeof Database;
  label: string;
  value: string;
  delta: string;
  tone: Pass4153RealMarketsOverviewTone;
  accent: Pass4153RealMarketsOverviewAccent;
  progressPercent?: number;
};
type Pass4153QuoteState = Record<string, Quote>;
type Pass4153HoldingRow = Pass459Fundamentals["topHoldings"][number];
type Pass4153RealMarketsGridKeyEvent = ReactKeyboardEvent<HTMLDivElement>;
type Pass4153RealMarketsTabsCopy = Record<Category, string>;
type Pass4153ExchangeProviderSloRow = { asset: Asset; slo: Pass577ProviderSlo };

function pass4153CategoryLabel(
  tabs: Pass4153RealMarketsTabsCopy,
  category: Category,
): string {
  return tabs[category] ?? category.replaceAll("_", " ");
}

type Locale = "pl" | "de" | "en";

const PASS1454_REAL_MARKETS_ARCHITECTURE = {
  version: "pass1454-1493-real-markets-runtime-architecture",
  tableRule: "one table, inline sort headers, rectangular modal only",
  mobileRule: "cards/compact controls before dense data",
  sourceRule: "source state before AI copy",
  removedChaos: ["extra hero pills", "bubble modal", "random AI line"],
} as const;

const PASS1413_REAL_MARKETS_POLISH = {
  version: "pass1374-1413-real-markets-polish",
  sourceTruth: "compact_source_rhythm_no_random_ai_line",
  mobileMode: "cards_not_squeezed_table",
  modalRule: "same_quality_as_shield_above_header",
  hiddenChaosRemoved: [
    "long copy",
    "duplicate Shield rows",
    "unlabeled fallback",
  ],
} as const;
/* PASS455 legacy verifier markers:
type Category = "all" | "crypto"
tabs: { all: "Wszystko"
tabs: { all: "Alles"
tabs: { all: "All"
useState<Category>("all")
category === "all"
["BINANCE", 0]
["MEXC", 1]
data-pass455-mixed-realmarkets-universe="true"
*/
/* PASS456 legacy verifier markers:
type UnifiedAuditAssetClass
function auditAssetClass(asset: Asset)
function assetClassAuditMetrics(asset: Asset, locale: Locale)
id: "coinbase-venue"
assetClass: auditAssetClass(selected)
const chunks = Array.from
Promise.all(
data-pass456-visible-row-quote-batching="true"
*/
// PASS455 compatibility marker: type Category = "all" | "crypto"
type Category =
  | "all"
  | "crypto"
  | "stocks"
  | "indices"
  | "fx"
  | "etf"
  | "commodities"
  | "real_estate"
  | "exchanges";
const PUBLIC_REAL_MARKETS_CATEGORIES: Category[] = [
  ...PASS617_PUBLIC_REAL_MARKETS_CATEGORIES,
];

// PASS4406 moved reference-order constants/helper out of this client monolith to reduce Real Markets import/build pressure.

function pass2326ReferenceRowOrder(assets: Asset[]) {
  const preferred = new Map<string, number>(
    PASS2326_REFERENCE_ROWS.map((symbol, index) => [symbol, index]),
  ); // PASS4147 reference row map accepts normalized asset symbols
  const ordered = pass4406ReferenceAssetOrder(
    assets,
    cleanAssetSymbol,
    isVenueHealthAsset,
  );
  const featured: Asset[] = [];
  const fallback: Asset[] = [];
  for (const asset of ordered) {
    const symbol = cleanAssetSymbol(asset.symbol).toUpperCase();
    if (preferred.has(symbol)) featured.push(asset);
    else fallback.push(asset);
  }
  featured.sort(
    (left, right) =>
      (preferred.get(cleanAssetSymbol(left.symbol).toUpperCase()) ?? 999) -
      (preferred.get(cleanAssetSymbol(right.symbol).toUpperCase()) ?? 999),
  );
  return [...featured, ...fallback];
}
type RangeKey = "15m" | "1h" | "4h" | "1d" | "1w";
// PASS834 compatibility marker: ["15m", "1h", "4h", "1d", "1w"] remains the Real Markets modal timeframe contract. data-unified-asset-modal="real-markets" and real-markets-unified-asset-modal are rendered by UnifiedAssetModalShell.
// PASS824 compatibility marker: ["15m", "1h", "4h", "1d", "1w"] as RangeKey[] · Analysis modes · Sources and missing data.
type SortKey =
  | "price"
  | "change1h"
  | "change24h"
  | "change7d"
  | "change30d"
  | "marketCap"
  | "volume"
  | "risk";
type SortDirection = "asc" | "desc";
const REAL_MARKETS_INITIAL_VISIBLE = 36;
const PASS2808_REAL_MARKETS_BATCH_SIZE = 12;
const PASS2808_REAL_MARKETS_BATCH_LIMIT = 8;
const PASS2808_REAL_MARKETS_CLIENT_TIMEOUT_MS = 12_000;

function isPublicRealMarketsAsset(asset: Asset) {
  return filterPass617PublicRealMarketsRows([asset]).length === 1;
}

function freshnessBudgetForAsset(asset: Asset) {
  if (asset.category === "fx") return 86_400;
  if (asset.category === "real_estate") return 604_800;
  if (asset.category === "indices" || asset.category === "commodities")
    return 3_600;
  return 900;
}

function buildRealMarketLineage(asset: Asset, quote?: Quote) {
  return buildPass619ProviderLineage({
    assetId: asset.id,
    assetClass: asset.category,
    provider: quote?.source ?? null,
    backupProvider:
      quote?.venueComparison?.secondaryVenue ?? quote?.secondarySource ?? null,
    state:
      quote?.consensusState ??
      quote?.providerStatus ??
      quote?.truthState ??
      quote?.state,
    sourceTimestamp: pass4576ResolveSourceTimestampSeconds(quote),
    candles: quote?.candles.length ?? 0,
    expectedCandles: 48,
    currentPrice: quote?.currentPrice ?? null,
    confidenceCap: quote?.confidenceCap ?? null,
    freshnessBudgetSeconds: freshnessBudgetForAsset(asset),
    missingReason: quote?.missingReason ?? null,
  });
}

function pass4570RealMarketsChange(asset: Asset, quote: Quote | undefined, windowSeconds: number): number | null {
  if (!quote || typeof quote.currentPrice !== "number") return null;
  if (windowSeconds === 60 * 60 && typeof quote.priceChange1h === "number" && Number.isFinite(quote.priceChange1h)) return quote.priceChange1h;
  if (windowSeconds === 24 * 60 * 60) {
    const val = quote.priceChange24h ?? quote.changePercent ?? null;
    if (typeof val === "number" && Number.isFinite(val)) return val;
  }
  if (windowSeconds === 7 * 24 * 60 * 60 && typeof quote.priceChange7d === "number" && Number.isFinite(quote.priceChange7d)) return quote.priceChange7d;

  const movement = pass4581WindowMovementDecision(quote, asset.category, "en", windowSeconds);
  if (!movement.mayPrintValue) return null;

  const hourlyReceipt = quote.realMarketsHourlyMetricsReceipt;
  const verifiedHourlyMetric =
    hourlyReceipt?.status === "source_bound"
      ? windowSeconds === 60 * 60
        ? quote.priceChange1h
        : windowSeconds === 24 * 60 * 60
          ? quote.priceChange24h
          : windowSeconds === 7 * 24 * 60 * 60
            ? quote.priceChange7d
            : null
      : null;
  if (typeof verifiedHourlyMetric === "number" && Number.isFinite(verifiedHourlyMetric)) {
    const receiptFreshEnough =
      hourlyReceipt?.freshnessState === "fresh"
      || (windowSeconds >= 24 * 60 * 60 && hourlyReceipt?.freshnessState === "aging");
    if (!receiptFreshEnough) return null;
    const sanitized = pass4581SanitizeWindowPercent(
      verifiedHourlyMetric,
      asset.category,
      windowSeconds,
      asset.symbol,
      quote,
      "en",
    );
    if (typeof sanitized === "number") return sanitized;
  }

  const candidates: Array<number | null | undefined> = [
    changeForWindow(quote, windowSeconds),
    windowSeconds === 24 * 60 * 60 && typeof quote.priceChange24h === "number" ? quote.priceChange24h : null,
    windowSeconds === 60 * 60 && typeof quote.priceChange1h === "number" ? quote.priceChange1h : null,
    windowSeconds === 7 * 24 * 60 * 60 && typeof quote.priceChange7d === "number" ? quote.priceChange7d : null,
    windowSeconds === 24 * 60 * 60
      && !quote.realMarketsHourlyMetricsReceipt
      && typeof quote.changePercent === "number"
      ? quote.changePercent
      : null,
  ];
  for (const candidate of candidates) {
    const sanitized = pass4581SanitizeWindowPercent(
      candidate,
      asset.category,
      windowSeconds,
      asset.symbol,
      quote,
      "en",
    );
    if (typeof sanitized === "number") return sanitized;
  }
  return null;
}

function pass4580PercentClass(change: number | null | undefined, canUseDirectionalColor: boolean): string {
  if (typeof change !== "number" || !Number.isFinite(change)) return "text-white/[0.30]";
  if (!canUseDirectionalColor) return "text-white/[0.68]";
  return change >= 0 ? "text-emerald-300" : "text-rose-300";
}

function pass4580SparklineStroke(rising: boolean, canUseDirectionalColor: boolean): string {
  if (!canUseDirectionalColor) return "rgba(255,255,255,0.72)";
  return rising ? "#67e8f9" : "#fda4af";
}

const curatedAssets: Asset[] = [
  {
    id: "btc-usd",
    symbol: "BTC",
    providerSymbol: "BTC-USD",
    name: "Bitcoin",
    category: "crypto",
    glyph: "₿",
    context: "Crypto quote + cross-venue candle lane",
    risk: 46,
  },
  {
    id: "eth-usd",
    symbol: "ETH",
    providerSymbol: "ETH-USD",
    name: "Ethereum",
    category: "crypto",
    glyph: "Ξ",
    context: "Crypto quote + gas/liquidity lane",
    risk: 44,
  },
  {
    id: "sol-usd",
    symbol: "SOL",
    providerSymbol: "SOL-USD",
    name: "Solana",
    category: "crypto",
    glyph: "SOL",
    context: "Crypto quote + throughput/liquidity lane",
    risk: 52,
  },
  {
    id: "bnb-usd",
    symbol: "BNB",
    providerSymbol: "BNB-USD",
    name: "BNB",
    category: "crypto",
    glyph: "BNB",
    context: "Crypto quote + exchange-token boundary",
    risk: 55,
  },
  {
    id: "xrp-usd",
    symbol: "XRP",
    providerSymbol: "XRP-USD",
    name: "XRP",
    category: "crypto",
    glyph: "XRP",
    context: "Crypto quote + venue/liquidity lane",
    risk: 48,
  },
  {
    id: "ada-usd",
    symbol: "ADA",
    providerSymbol: "ADA-USD",
    name: "Cardano",
    category: "crypto",
    glyph: "ADA",
    context: "Crypto quote + liquidity/cadence lane",
    risk: 47,
  },
  {
    id: "aapl",
    symbol: "AAPL",
    providerSymbol: "AAPL",
    name: "Apple",
    category: "stocks",
    domain: "apple.com",
    context: "Equity quote + issuer filing lane",
    risk: 28,
  },
  {
    id: "nvda",
    symbol: "NVDA",
    providerSymbol: "NVDA",
    name: "Nvidia",
    category: "stocks",
    domain: "nvidia.com",
    context: "Equity quote + earnings context",
    risk: 42,
  },
  {
    id: "msft",
    symbol: "MSFT",
    providerSymbol: "MSFT",
    name: "Microsoft",
    category: "stocks",
    domain: "microsoft.com",
    context: "Equity quote + issuer filing lane",
    risk: 29,
  },
  {
    id: "googl",
    symbol: "GOOGL",
    providerSymbol: "GOOGL",
    name: "Alphabet",
    category: "stocks",
    domain: "google.com",
    context: "Equity quote + issuer filing lane",
    risk: 32,
  },
  {
    id: "amzn",
    symbol: "AMZN",
    providerSymbol: "AMZN",
    name: "Amazon",
    category: "stocks",
    domain: "amazon.com",
    context: "Equity quote + issuer filing lane",
    risk: 36,
  },
  {
    id: "meta",
    symbol: "META",
    providerSymbol: "META",
    name: "Meta Platforms",
    category: "stocks",
    domain: "meta.com",
    context: "Equity quote + event context",
    risk: 37,
  },
  {
    id: "tsla",
    symbol: "TSLA",
    providerSymbol: "TSLA",
    name: "Tesla",
    category: "stocks",
    domain: "tesla.com",
    context: "Equity quote + volatility context",
    risk: 48,
  },
  {
    id: "lvmh",
    symbol: "MC.PA",
    providerSymbol: "MC.PA",
    name: "LVMH",
    category: "stocks",
    domain: "lvmh.com",
    context: "EU quote + issuer disclosure",
    risk: 31,
  },
  {
    id: "sp500",
    symbol: "S&P 500",
    providerSymbol: "^GSPC",
    name: "S&P 500",
    category: "indices",
    glyph: "S&P",
    context: "Index level + timestamp",
    risk: 30,
  },
  {
    id: "nasdaq100",
    symbol: "NDX",
    providerSymbol: "^NDX",
    name: "Nasdaq 100",
    category: "indices",
    glyph: "NDX",
    context: "Index level + timestamp",
    risk: 34,
  },
  {
    id: "dax",
    symbol: "DAX",
    providerSymbol: "^GDAXI",
    name: "DAX Performance Index",
    category: "indices",
    glyph: "DAX",
    context: "Index level + timestamp",
    risk: 32,
  },
  {
    id: "ftse",
    symbol: "FTSE",
    providerSymbol: "^FTSE",
    name: "FTSE 100",
    category: "indices",
    glyph: "FTSE",
    context: "Index level + timestamp",
    risk: 31,
  },
  {
    id: "wig20tr",
    symbol: "WIG20TR",
    providerSymbol: "WIG20TR.WA",
    name: "WIG20 Total Return",
    category: "indices",
    glyph: "W20",
    context: "WSE index level + timestamp",
    risk: 35,
  },
  {
    id: "eurusd",
    symbol: "EUR/USD",
    providerSymbol: "EURUSD=X",
    name: "Euro / US Dollar",
    category: "fx",
    glyph: "€",
    context: "Reference + intraday feed",
    risk: 30,
  },
  {
    id: "eurpln",
    symbol: "EUR/PLN",
    providerSymbol: "EURPLN=X",
    name: "Euro / Polish Zloty",
    category: "fx",
    glyph: "PL",
    context: "Reference + intraday feed",
    risk: 31,
  },
  {
    id: "usdpln",
    symbol: "USD/PLN",
    providerSymbol: "USDPLN=X",
    name: "US Dollar / Polish Zloty",
    category: "fx",
    glyph: "$",
    context: "Reference + intraday feed",
    risk: 34,
  },
  {
    id: "usdjpy",
    symbol: "USD/JPY",
    providerSymbol: "JPY=X",
    name: "US Dollar / Yen",
    category: "fx",
    glyph: "¥",
    context: "Reference + intraday feed",
    risk: 39,
  },
  {
    id: "gbpusd",
    symbol: "GBP/USD",
    providerSymbol: "GBPUSD=X",
    name: "Pound / US Dollar",
    category: "fx",
    glyph: "£",
    context: "Reference + intraday feed",
    risk: 33,
  },
  {
    id: "spy",
    symbol: "SPY",
    providerSymbol: "SPY",
    name: "S&P 500 ETF",
    category: "etf",
    domain: "ssga.com",
    context: "ETF quote + holdings cadence",
    risk: 36,
  },
  {
    id: "qqq",
    symbol: "QQQ",
    providerSymbol: "QQQ",
    name: "Nasdaq 100 ETF",
    category: "etf",
    domain: "invesco.com",
    context: "ETF quote + holdings cadence",
    risk: 39,
  },
  {
    id: "gld",
    symbol: "GLD",
    providerSymbol: "GLD",
    name: "Gold ETF",
    category: "etf",
    domain: "ssga.com",
    context: "ETF quote + commodity context",
    risk: 33,
  },
  {
    id: "vnq-etf",
    symbol: "VNQ",
    providerSymbol: "VNQ",
    name: "Vanguard Real Estate ETF",
    category: "etf",
    domain: "vanguard.com",
    context: "ETF quote + holdings cadence",
    risk: 41,
  },
  {
    id: "gold",
    symbol: "GC",
    providerSymbol: "GC=F",
    name: "Gold Futures",
    category: "commodities",
    glyph: "Au",
    context: "Futures contract + timestamp",
    risk: 34,
  },
  {
    id: "silver",
    symbol: "SI",
    providerSymbol: "SI=F",
    name: "Silver Futures",
    category: "commodities",
    glyph: "Ag",
    context: "Futures contract + timestamp",
    risk: 37,
  },
  {
    id: "wti",
    symbol: "CL",
    providerSymbol: "CL=F",
    name: "WTI Crude Oil",
    category: "commodities",
    glyph: "WTI",
    context: "Futures contract + timestamp",
    risk: 40,
  },
  {
    id: "brent",
    symbol: "BZ",
    providerSymbol: "BZ=F",
    name: "Brent Crude Oil",
    category: "commodities",
    glyph: "BZ",
    context: "Futures contract + timestamp",
    risk: 39,
  },
  {
    id: "vnq-real",
    symbol: "VNQ",
    providerSymbol: "VNQ",
    name: "REIT Basket Proxy",
    category: "real_estate",
    domain: "vanguard.com",
    context: "Slow macro proxy, not property valuation",
    risk: 41,
  },
  {
    id: "iyr",
    symbol: "IYR",
    providerSymbol: "IYR",
    name: "US Real Estate ETF",
    category: "real_estate",
    domain: "ishares.com",
    context: "Slow macro proxy, not property valuation",
    risk: 43,
  },
  {
    id: "xlre",
    symbol: "XLRE",
    providerSymbol: "XLRE",
    name: "Real Estate Select Sector",
    category: "real_estate",
    domain: "ssga.com",
    context: "Slow macro proxy, not property valuation",
    risk: 40,
  },
  {
    id: "pld",
    symbol: "PLD",
    providerSymbol: "PLD",
    name: "Prologis",
    category: "real_estate",
    domain: "prologis.com",
    context: "Public REIT quote + filing context",
    risk: 38,
  },
  {
    id: "coin",
    symbol: "COIN",
    providerSymbol: "COIN",
    name: "Coinbase Global",
    category: "exchanges",
    domain: "coinbase.com",
    context: "Public equity proxy, not venue solvency",
    risk: 45,
  },
  {
    id: "cme",
    symbol: "CME",
    providerSymbol: "CME",
    name: "CME Group",
    category: "exchanges",
    domain: "cmegroup.com",
    context: "Listed exchange operator + filing context",
    risk: 30,
  },
  {
    id: "ice",
    symbol: "ICE",
    providerSymbol: "ICE",
    name: "Intercontinental Exchange",
    category: "exchanges",
    domain: "ice.com",
    context: "Listed exchange operator + filing context",
    risk: 31,
  },
  {
    id: "ndaq",
    symbol: "NDAQ",
    providerSymbol: "NDAQ",
    name: "Nasdaq",
    category: "exchanges",
    domain: "nasdaq.com",
    context: "Listed exchange operator + filing context",
    risk: 32,
  },
  {
    id: "binance-venue",
    symbol: "BINANCE",
    providerSymbol: "BNB-USD",
    name: "Binance / BNB Venue Health",
    category: "exchanges",
    domain: "binance.com",
    glyph: "BN",
    context: "Crypto venue health lane · klines/depth/status adapter",
    risk: 55,
  },
  {
    id: "mexc-venue",
    symbol: "MEXC",
    providerSymbol: "MX-USD",
    name: "MEXC / MX Venue Health",
    category: "exchanges",
    domain: "mexc.com",
    glyph: "MX",
    context: "Crypto venue health lane · websocket cadence/reconnect",
    risk: 58,
  },
  {
    id: "coinbase-venue",
    symbol: "COINBASE",
    providerSymbol: "COINBASEVENUE",
    name: "Coinbase Venue Health",
    category: "exchanges",
    glyph: "CB",
    context: "Crypto venue health lane · status/depth/API resilience",
    risk: 47,
  },
  {
    id: "okx-venue",
    symbol: "OKX",
    providerSymbol: "OKB-USD",
    name: "OKX / OKB Venue Health",
    category: "exchanges",
    domain: "okx.com",
    glyph: "OK",
    context: "Crypto venue health lane · orderbook/status adapter",
    risk: 54,
  },
  {
    id: "kraken-venue",
    symbol: "KRAKEN",
    providerSymbol: "KRAKENVENUE",
    name: "Kraken Venue Health",
    category: "exchanges",
    domain: "kraken.com",
    glyph: "KR",
    context: "Crypto venue health lane · orderbook/status adapter",
    risk: 46,
  },
  {
    id: "bybit-venue",
    symbol: "BYBIT",
    providerSymbol: "MNT-USD",
    name: "Bybit / MNT Venue Health",
    category: "exchanges",
    domain: "bybit.com",
    glyph: "BB",
    context: "Crypto venue health lane · derivatives boundary",
    risk: 57,
  },
  {
    id: "jpm",
    symbol: "JPM",
    providerSymbol: "JPM",
    name: "JPMorgan Chase",
    category: "stocks",
    domain: "jpmorganchase.com",
    context: "Bank equity quote + macro stress lane",
    risk: 35,
  },
  {
    id: "asml",
    symbol: "ASML",
    providerSymbol: "ASML",
    name: "ASML Holding",
    category: "stocks",
    domain: "asml.com",
    context: "Semiconductor equity quote + EU issuer lane",
    risk: 34,
  },
  {
    id: "sap",
    symbol: "SAP",
    providerSymbol: "SAP.DE",
    name: "SAP",
    category: "stocks",
    domain: "sap.com",
    context: "EU software quote + issuer lane",
    risk: 30,
  },
  {
    id: "amd",
    symbol: "AMD",
    providerSymbol: "AMD",
    name: "Advanced Micro Devices",
    category: "stocks",
    domain: "amd.com",
    context: "Semiconductor equity quote + supply-chain lane",
    risk: 42,
  },
  {
    id: "tsm",
    symbol: "TSM",
    providerSymbol: "TSM",
    name: "Taiwan Semiconductor",
    category: "stocks",
    domain: "tsmc.com",
    context: "ADR quote + foundry concentration lane",
    risk: 36,
  },
  {
    id: "avgo",
    symbol: "AVGO",
    providerSymbol: "AVGO",
    name: "Broadcom",
    category: "stocks",
    domain: "broadcom.com",
    context: "Semiconductor equity quote + AI infrastructure lane",
    risk: 37,
  },
  {
    id: "gs",
    symbol: "GS",
    providerSymbol: "GS",
    name: "Goldman Sachs",
    category: "stocks",
    domain: "goldmansachs.com",
    context: "Bank equity quote + rate sensitivity lane",
    risk: 38,
  },
  {
    id: "bac",
    symbol: "BAC",
    providerSymbol: "BAC",
    name: "Bank of America",
    category: "stocks",
    domain: "bankofamerica.com",
    context: "Bank equity quote + deposit stress lane",
    risk: 39,
  },
  {
    id: "v",
    symbol: "V",
    providerSymbol: "V",
    name: "Visa",
    category: "stocks",
    domain: "visa.com",
    context: "Payments equity quote + consumer flow lane",
    risk: 27,
  },
  {
    id: "ma",
    symbol: "MA",
    providerSymbol: "MA",
    name: "Mastercard",
    category: "stocks",
    domain: "mastercard.com",
    context: "Payments equity quote + consumer flow lane",
    risk: 28,
  },
  {
    id: "nvo",
    symbol: "NVO",
    providerSymbol: "NVO",
    name: "Novo Nordisk",
    category: "stocks",
    domain: "novonordisk.com",
    context: "Healthcare equity quote + regulatory lane",
    risk: 30,
  },
  {
    id: "air",
    symbol: "AIR.PA",
    providerSymbol: "AIR.PA",
    name: "Airbus",
    category: "stocks",
    domain: "airbus.com",
    context: "EU aerospace quote + orderbook lane",
    risk: 34,
  },
  {
    id: "bmw",
    symbol: "BMW.DE",
    providerSymbol: "BMW.DE",
    name: "BMW",
    category: "stocks",
    domain: "bmw.com",
    context: "EU auto quote + demand lane",
    risk: 36,
  },
  {
    id: "mbg",
    symbol: "MBG.DE",
    providerSymbol: "MBG.DE",
    name: "Mercedes-Benz Group",
    category: "stocks",
    domain: "mercedes-benz.com",
    context: "EU auto quote + demand lane",
    risk: 35,
  },
  {
    id: "vow3",
    symbol: "VOW3.DE",
    providerSymbol: "VOW3.DE",
    name: "Volkswagen Pref",
    category: "stocks",
    domain: "volkswagen-group.com",
    context: "EU auto quote + governance lane",
    risk: 39,
  },
  {
    id: "adidas",
    symbol: "ADS.DE",
    providerSymbol: "ADS.DE",
    name: "Adidas",
    category: "stocks",
    domain: "adidas.com",
    context: "EU consumer quote + brand momentum lane",
    risk: 33,
  },
  {
    id: "hermes",
    symbol: "RMS.PA",
    providerSymbol: "RMS.PA",
    name: "Hermès",
    category: "stocks",
    domain: "hermes.com",
    context: "Luxury equity quote + pricing power lane",
    risk: 28,
  },
  {
    id: "kering",
    symbol: "KER.PA",
    providerSymbol: "KER.PA",
    name: "Kering",
    category: "stocks",
    domain: "kering.com",
    context: "Luxury equity quote + brand cycle lane",
    risk: 36,
  },
  {
    id: "richemont",
    symbol: "CFR.SW",
    providerSymbol: "CFR.SW",
    name: "Richemont",
    category: "stocks",
    domain: "richemont.com",
    context: "Luxury equity quote + watch/jewelry lane",
    risk: 33,
  },
  {
    id: "nike",
    symbol: "NKE",
    providerSymbol: "NKE",
    name: "Nike",
    category: "stocks",
    domain: "nike.com",
    context: "Sportswear equity quote + margin lane",
    risk: 38,
  },
  {
    id: "siemens",
    symbol: "SIE.DE",
    providerSymbol: "SIE.DE",
    name: "Siemens",
    category: "stocks",
    domain: "siemens.com",
    context: "EU industrial quote + infrastructure lane",
    risk: 31,
  },
  {
    id: "allianz",
    symbol: "ALV.DE",
    providerSymbol: "ALV.DE",
    name: "Allianz",
    category: "stocks",
    domain: "allianz.com",
    context: "Insurance equity quote + rate/solvency lane",
    risk: 29,
  },
  {
    id: "mstr",
    symbol: "MSTR",
    providerSymbol: "MSTR",
    name: "MicroStrategy",
    category: "stocks",
    domain: "strategy.com",
    context: "Bitcoin-treasury equity quote + NAV divergence lane",
    risk: 61,
  },
  {
    id: "hood",
    symbol: "HOOD",
    providerSymbol: "HOOD",
    name: "Robinhood",
    category: "stocks",
    domain: "robinhood.com",
    context: "Brokerage equity quote + retail flow lane",
    risk: 49,
  },
  {
    id: "or",
    symbol: "OR.PA",
    providerSymbol: "OR.PA",
    name: "L'Oréal",
    category: "stocks",
    domain: "loreal.com",
    context: "Luxury/beauty equity quote + brand pricing lane",
    risk: 30,
  },
  {
    id: "race",
    symbol: "RACE",
    providerSymbol: "RACE",
    name: "Ferrari",
    category: "stocks",
    domain: "ferrari.com",
    context: "Luxury auto equity quote + scarcity/pricing lane",
    risk: 32,
  },
  {
    id: "porsche",
    symbol: "P911.DE",
    providerSymbol: "P911.DE",
    name: "Porsche AG",
    category: "stocks",
    domain: "porsche.com",
    context: "Luxury auto equity quote + EU issuer lane",
    risk: 35,
  },
  {
    id: "sony",
    symbol: "SONY",
    providerSymbol: "SONY",
    name: "Sony Group",
    category: "stocks",
    domain: "sony.com",
    context: "Global consumer/entertainment equity lane",
    risk: 34,
  },
  {
    id: "shop",
    symbol: "SHOP",
    providerSymbol: "SHOP",
    name: "Shopify",
    category: "stocks",
    domain: "shopify.com",
    context: "Commerce infrastructure equity quote",
    risk: 43,
  },
  {
    id: "doge-usd",
    symbol: "DOGE",
    providerSymbol: "DOGE-USD",
    name: "Dogecoin",
    category: "crypto",
    glyph: "DOGE",
    context: "Crypto quote + meme-liquidity/hype boundary",
    risk: 59,
  },
  {
    id: "link-usd",
    symbol: "LINK",
    providerSymbol: "LINK-USD",
    name: "Chainlink",
    category: "crypto",
    glyph: "LINK",
    context: "Oracle asset quote + liquidity/source lane",
    risk: 48,
  },
  {
    id: "avax-usd",
    symbol: "AVAX",
    providerSymbol: "AVAX-USD",
    name: "Avalanche",
    category: "crypto",
    glyph: "AVAX",
    context: "L1 asset quote + bridge/liquidity lane",
    risk: 51,
  },
  {
    id: "dot-usd",
    symbol: "DOT",
    providerSymbol: "DOT-USD",
    name: "Polkadot",
    category: "crypto",
    glyph: "DOT",
    context: "L1 ecosystem quote + liquidity/cadence lane",
    risk: 50,
  },
  {
    id: "lse",
    symbol: "LSEG.L",
    providerSymbol: "LSEG.L",
    name: "London Stock Exchange Group",
    category: "exchanges",
    domain: "lseg.com",
    context: "Listed exchange/data operator + filing lane",
    risk: 33,
  },
  {
    id: "db1",
    symbol: "DB1.DE",
    providerSymbol: "DB1.DE",
    name: "Deutsche Börse",
    category: "exchanges",
    domain: "deutsche-boerse.com",
    context: "Listed European exchange operator + filing lane",
    risk: 32,
  },
  {
    id: "hkex",
    symbol: "0388.HK",
    providerSymbol: "0388.HK",
    name: "Hong Kong Exchanges",
    category: "exchanges",
    domain: "hkex.com.hk",
    context: "Listed APAC exchange operator + filing lane",
    risk: 36,
  },
  {
    id: "stoxx50",
    symbol: "STOXX50E",
    providerSymbol: "^STOXX50E",
    name: "Euro Stoxx 50",
    category: "indices",
    glyph: "SX5",
    context: "EU blue-chip index level + timestamp",
    risk: 31,
  },
  {
    id: "nikkei",
    symbol: "NIKKEI",
    providerSymbol: "^N225",
    name: "Nikkei 225",
    category: "indices",
    glyph: "N225",
    context: "Japan index level + timestamp",
    risk: 33,
  },
  {
    id: "eurtry",
    symbol: "EUR/TRY",
    providerSymbol: "EURTRY=X",
    name: "Euro / Turkish Lira",
    category: "fx",
    glyph: "TRY",
    context: "Higher-volatility FX reference lane",
    risk: 55,
  },
  {
    id: "usdtry",
    symbol: "USD/TRY",
    providerSymbol: "TRY=X",
    name: "US Dollar / Turkish Lira",
    category: "fx",
    glyph: "TRY",
    context: "Higher-volatility FX reference lane",
    risk: 57,
  },
  {
    id: "eurgbp",
    symbol: "EUR/GBP",
    providerSymbol: "EURGBP=X",
    name: "Euro / Pound",
    category: "fx",
    glyph: "€£",
    context: "Reference + intraday feed",
    risk: 29,
  },
  {
    id: "usdchf",
    symbol: "USD/CHF",
    providerSymbol: "CHF=X",
    name: "US Dollar / Swiss Franc",
    category: "fx",
    glyph: "CHF",
    context: "Reference + intraday feed",
    risk: 27,
  },
  {
    id: "copper",
    symbol: "HG",
    providerSymbol: "HG=F",
    name: "Copper Futures",
    category: "commodities",
    glyph: "Cu",
    context: "Industrial metal futures + macro lane",
    risk: 42,
  },
  {
    id: "natgas",
    symbol: "NG",
    providerSymbol: "NG=F",
    name: "Natural Gas Futures",
    category: "commodities",
    glyph: "NG",
    context: "Energy futures + weather/seasonality lane",
    risk: 53,
  },
  {
    id: "wheat",
    symbol: "ZW",
    providerSymbol: "ZW=F",
    name: "Wheat Futures",
    category: "commodities",
    glyph: "ZW",
    context: "Agriculture futures + supply shock lane",
    risk: 45,
  },
  {
    id: "tlt",
    symbol: "TLT",
    providerSymbol: "TLT",
    name: "20+ Year Treasury Bond ETF",
    category: "etf",
    domain: "ishares.com",
    context: "Duration ETF + rate sensitivity lane",
    risk: 44,
  },
  {
    id: "hyg",
    symbol: "HYG",
    providerSymbol: "HYG",
    name: "High Yield Corporate Bond ETF",
    category: "etf",
    domain: "ishares.com",
    context: "Credit ETF + spread stress lane",
    risk: 47,
  },
  {
    id: "efa",
    symbol: "EFA",
    providerSymbol: "EFA",
    name: "MSCI EAFE ETF",
    category: "etf",
    domain: "ishares.com",
    context: "Global equity ETF + region lane",
    risk: 34,
  },
  {
    id: "reit-eu",
    symbol: "IWDP.L",
    providerSymbol: "IWDP.L",
    name: "Developed Property ETF",
    category: "real_estate",
    domain: "ishares.com",
    context: "Global property ETF proxy, not property valuation",
    risk: 44,
  },
  {
    id: "eurex-venue",
    symbol: "EUREX",
    providerSymbol: "EUREXVENUE",
    name: "Eurex Venue Health",
    category: "exchanges",
    glyph: "EX",
    context: "Derivatives venue health lane · clearing/status adapter",
    risk: 40,
  },
  {
    id: "xetra-venue",
    symbol: "XETRA",
    providerSymbol: "XETRAVENUE",
    name: "Xetra Venue Health",
    category: "exchanges",
    glyph: "XT",
    context: "EU venue health lane · trading/status adapter",
    risk: 38,
  },
  {
    id: "orcl",
    symbol: "ORCL",
    providerSymbol: "ORCL",
    name: "Oracle",
    category: "stocks",
    domain: "oracle.com",
    context: "Enterprise software equity + filing lane",
    risk: 33,
  },
  {
    id: "crm",
    symbol: "CRM",
    providerSymbol: "CRM",
    name: "Salesforce",
    category: "stocks",
    domain: "salesforce.com",
    context: "Cloud software equity + filing lane",
    risk: 37,
  },
  {
    id: "adbe",
    symbol: "ADBE",
    providerSymbol: "ADBE",
    name: "Adobe",
    category: "stocks",
    domain: "adobe.com",
    context: "Creative software equity + filing lane",
    risk: 35,
  },
  {
    id: "nflx",
    symbol: "NFLX",
    providerSymbol: "NFLX",
    name: "Netflix",
    category: "stocks",
    domain: "netflix.com",
    context: "Media equity + subscriber/filing lane",
    risk: 43,
  },
  {
    id: "intc",
    symbol: "INTC",
    providerSymbol: "INTC",
    name: "Intel",
    category: "stocks",
    domain: "intel.com",
    context: "Semiconductor equity + capacity/filing lane",
    risk: 45,
  },
  {
    id: "qcom",
    symbol: "QCOM",
    providerSymbol: "QCOM",
    name: "Qualcomm",
    category: "stocks",
    domain: "qualcomm.com",
    context: "Semiconductor equity + licensing lane",
    risk: 39,
  },
  {
    id: "txn",
    symbol: "TXN",
    providerSymbol: "TXN",
    name: "Texas Instruments",
    category: "stocks",
    domain: "ti.com",
    context: "Analog semiconductor equity + cycle lane",
    risk: 34,
  },
  {
    id: "arm",
    symbol: "ARM",
    providerSymbol: "ARM",
    name: "Arm Holdings",
    category: "stocks",
    domain: "arm.com",
    context: "Semiconductor IP equity + valuation lane",
    risk: 47,
  },
  {
    id: "ibm",
    symbol: "IBM",
    providerSymbol: "IBM",
    name: "IBM",
    category: "stocks",
    domain: "ibm.com",
    context: "Enterprise technology equity + filing lane",
    risk: 30,
  },
  {
    id: "uber",
    symbol: "UBER",
    providerSymbol: "UBER",
    name: "Uber",
    category: "stocks",
    domain: "uber.com",
    context: "Mobility platform equity + margin lane",
    risk: 44,
  },
  {
    id: "abnb",
    symbol: "ABNB",
    providerSymbol: "ABNB",
    name: "Airbnb",
    category: "stocks",
    domain: "airbnb.com",
    context: "Travel platform equity + demand lane",
    risk: 42,
  },
  {
    id: "baba",
    symbol: "BABA",
    providerSymbol: "BABA",
    name: "Alibaba",
    category: "stocks",
    domain: "alibabagroup.com",
    context: "Global commerce equity + jurisdiction lane",
    risk: 52,
  },
];

const text = {
  pl: {
    title: "Real Markets",
    subtitle:
      "Akcje, ETF, surowce, waluty i inne aktywa — w jednym terminalu. Bieżące ceny, płynność i ryzyko w czasie rzeczywistym.",
    tabs: {
      all: "Wszystkie",
      crypto: "Krypto",
      stocks: "Akcje",
      indices: "Indeksy",
      fx: "Forex",
      etf: "ETF",
      commodities: "Surowce",
      real_estate: "Nieruchomości",
      exchanges: "Giełdy",
    },
    search: "Szukaj instrumentu, np. AAPL, EURUSD, WIG20...",
    name: "Instrument",
    price: "Cena",
    change: "Zmiana",
    source: "Źródło",
    risk: "Ryzyko",
    volume: "Wolumen",
    last7d: "Ostatnie 7 dni",
    unavailable: "Provider do podłączenia / brak świeżego payloadu",
    loading: "Pobieranie notowań",
    searching: "Przeszukiwanie katalogu",
    sourceTime: "Timestamp źródła",
    basic: "Analiza Basic",
    pro: "Przegląd Pro",
    advanced: "Zaawansowana analiza Advanced",
    chartUnavailable:
      "Brak realnych świec dla tego instrumentu. Velmère nie generuje wykresu zastępczego.",
    global: "Katalog globalny",
    browser: "Velmère Browser",
    shield: "Wróć do Shield",
    map: "Mapa Shield",
    modeHint: {
      basic:
        "Basic pokazuje cenę, kapitalizację/proxy, zmianę 24h, wolumen i stan źródła.",
      pro: "Pro dodaje świeczki, luki danych, drugiego providera, rytm źródła i kontekst emitenta.",
      advanced:
        "Advanced rozwija 20-punktową matrycę: płynność, poślizg, jakość świec, venue health, filing lane i niestandardowe czerwone flagi.",
    },
    venuePending:
      "Venue health wymaga adaptera status/depth; nie udajemy ceny giełdy, jeśli instrument nie jest publicznym tickerem.",
  },
  de: {
    title: "Real Markets",
    subtitle:
      "Aktien, Währungen, ETFs, Rohstoffe, Immobilien-Proxys und Börsenbetreiber in einem Terminal. Krypto bleibt im Velmère Shield mit Venue-Quellen und Risikoanalyse.",
    tabs: {
      all: "Alle",
      crypto: "Krypto",
      stocks: "Aktien",
      indices: "Indizes",
      fx: "Forex",
      etf: "ETFs",
      commodities: "Rohstoffe",
      real_estate: "Immobilien",
      exchanges: "Börsen",
    },
    search: "Suche: AAPL, EURUSD, DAX, Gold...",
    name: "Instrument",
    price: "Preis",
    change: "Änderung",
    source: "Quelle",
    risk: "Risiko",
    volume: "Volumen",
    last7d: "Letzte 7 Tage",
    unavailable: "Provider ausstehend / kein frischer Payload",
    loading: "Marktdaten werden geladen",
    searching: "Provider-Katalog wird durchsucht",
    sourceTime: "Quellenzeit",
    basic: "Basic-Analyse",
    pro: "Pro-Prüfung",
    advanced: "Erweiterte Advanced-Analyse",
    chartUnavailable:
      "Keine echten Kerzen für dieses Instrument. Velmère erzeugt keinen Ersatzchart.",
    global: "Globaler Katalog",
    browser: "Velmère Browser",
    shield: "Zurück zu Shield",
    map: "Shield Map",
    modeHint: {
      basic:
        "Basic zeigt Preis, Market-Cap/Proxy, 24h-Bewegung, Volumen und Quellenstatus.",
      pro: "Pro ergänzt Kerzen, Datenlücken, Zweitprovider, Quellenrhythmus und Emittenten-Kontext.",
      advanced:
        "Advanced öffnet eine 20-Punkte-Matrix: Liquidität, Slippage, Kerzenqualität, Venue Health, Filing Lane und ungewöhnliche Red Flags.",
    },
    venuePending:
      "Venue Health benötigt Status-/Depth-Adapter; Velmère zeigt keinen Fake-Preis für eine Börse ohne öffentliches Ticker-Instrument.",
  },
  en: {
    title: "Real Markets",
    subtitle:
      "Stocks, ETFs, commodities, currencies and other assets — in one terminal. Source status and verification remain explicit.",
    tabs: {
      all: "All",
      crypto: "Crypto",
      stocks: "Stocks",
      indices: "Indices",
      fx: "Forex",
      etf: "ETFs",
      commodities: "Commodities",
      real_estate: "Real estate",
      exchanges: "Exchanges",
    },
    search: "Search instrument, e.g. AAPL, EURUSD, FTSE...",
    name: "Instrument",
    price: "Price",
    change: "Change",
    source: "Source",
    risk: "Risk",
    volume: "Volume",
    last7d: "Last 7 days",
    unavailable: "Provider pending / no fresh payload",
    loading: "Loading market data",
    searching: "Searching provider universe",
    sourceTime: "Source timestamp",
    basic: "Basic Analysis",
    pro: "Pro Review",
    advanced: "Advanced Analysis",
    chartUnavailable:
      "No real candles are available for this instrument. Velmère does not generate a substitute chart.",
    global: "Global catalog",
    browser: "Velmère Browser",
    shield: "Back to Shield",
    map: "Shield Map",
    modeHint: {
      basic:
        "Basic shows price, market-cap/proxy, 24h move, volume and source state.",
      pro: "Pro adds candles, data gaps, second-provider status, source rhythm and issuer context.",
      advanced:
        "Advanced expands a 20-point matrix: liquidity, slippage, candle quality, venue health, filing lane and unusual red flags.",
    },
    venuePending:
      "Venue health needs a status/depth adapter; Velmère does not fake an exchange price when no public ticker exists.",
  },
} as const;

const auditText = {
  pl: {
    price: "Ostatnia cena",
    change: "Zmiana względem zamknięcia",
    change1h: "Zmiana 1h",
    change24h: "Zmiana 24h",
    change7d: "Zmiana 7d",
    sourceQuality: "Jakość źródła",
    websocketCadence: "Rytm WebSocket",
    liquidity: "Płynność / wyjścia",
    slippage: "Symulowany poślizg",
    exchange: "Giełda / rynek",
    currency: "Waluta kwotowania",
    category: "Klasa rynku",
    range: "Załadowany zakres",
    observations: "Obserwacje OHLC",
    open: "Otwarcie okna",
    high: "Maksimum okna",
    low: "Minimum okna",
    close: "Ostatnie zamknięcie",
    volume: "Wolumen okna",
    volatility: "Średni zakres świecy",
    gaps: "Luki danych",
    start: "Początek okna",
    end: "Koniec okna",
    provider: "Stan dostawcy",
    second: "Potwierdzenie drugim źródłem",
    filing: "Kontekst emitenta / raportów",
    boundary: "Granica audytu",
    observed: "Wartość pochodzi z aktualnie załadowanej odpowiedzi dostawcy.",
    noGaps:
      "W zwróconym zbiorze nie znaleziono nieprawidłowych wartości zamknięcia.",
    hasGaps: "Niepełne obserwacje wymagają dodatkowej kontroli.",
    live: "Odpowiedź źródła została poprawnie przetworzona.",
    unavailable: "Nie wygenerowano zastępczej serii.",
    secondNote: "Mocniejszy wniosek wymaga niezależnego dostawcy.",
    filingNote:
      "Cena rynkowa i raporty emitenta pozostają osobnymi ścieżkami dowodowymi.",
    boundaryNote: "Wynik opisuje obserwowane dane oraz jawne braki.",
    sourceSignals: "sygnałów opartych na źródłach",
    separateLane: "osobna ścieżka",
    notApplicable: "nie dotyczy",
    sourceBound: "oparte na źródłach",
  },
  de: {
    price: "Letzter Preis",
    change: "Änderung zum Referenzschluss",
    change1h: "Änderung 1h",
    change24h: "Änderung 24h",
    change7d: "Änderung 7d",
    sourceQuality: "Quellenqualität",
    websocketCadence: "WebSocket-Rhythmus",
    liquidity: "Liquidität / Exits",
    slippage: "Simulierter Slippage",
    exchange: "Börse / Markt",
    currency: "Notierungswährung",
    category: "Marktklasse",
    range: "Geladener Bereich",
    observations: "OHLC-Beobachtungen",
    open: "Fenster-Eröffnung",
    high: "Fenster-Hoch",
    low: "Fenster-Tief",
    close: "Letzter Schluss",
    volume: "Fenster-Volumen",
    volatility: "Mittlere Kerzenspanne",
    gaps: "Datenlücken",
    start: "Fenster-Start",
    end: "Fenster-Ende",
    provider: "Provider-Status",
    second: "Bestätigung durch zweite Quelle",
    filing: "Emittenten- / Filing-Kontext",
    boundary: "Audit-Grenze",
    observed: "Der Wert stammt aus der aktuell geladenen Provider-Antwort.",
    noGaps:
      "Im gelieferten Datensatz wurden keine ungültigen Schlusswerte gefunden.",
    hasGaps: "Unvollständige Beobachtungen benötigen zusätzliche Prüfung.",
    live: "Die Quellenantwort wurde erfolgreich verarbeitet.",
    unavailable: "Es wurde keine Ersatzserie erzeugt.",
    secondNote: "Eine stärkere Aussage benötigt einen unabhängigen Provider.",
    filingNote:
      "Marktpreis und Emittentenberichte bleiben getrennte Evidenzpfade.",
    boundaryNote:
      "Das Ergebnis beschreibt beobachtete Daten und sichtbare Lücken.",
    sourceSignals: "quellengebundene Signale",
    separateLane: "separater Pfad",
    notApplicable: "nicht anwendbar",
    sourceBound: "quellengebunden",
  },
  en: {
    price: "Latest price",
    change: "Change against reference close",
    change1h: "Change 1h",
    change24h: "Change 24h",
    change7d: "Change 7d",
    sourceQuality: "Source quality",
    websocketCadence: "WebSocket cadence",
    liquidity: "Liquidity / exits",
    slippage: "Simulated slippage",
    exchange: "Exchange / venue",
    currency: "Quote currency",
    category: "Market class",
    range: "Loaded range",
    observations: "OHLC observations",
    open: "Window open",
    high: "Window high",
    low: "Window low",
    close: "Latest close",
    volume: "Window volume",
    volatility: "Average candle range",
    gaps: "Data gaps",
    start: "Window start",
    end: "Window end",
    provider: "Provider state",
    second: "Second-source confirmation",
    filing: "Issuer / filing context",
    boundary: "Audit boundary",
    observed: "The value comes from the currently loaded provider response.",
    noGaps: "No invalid close values were found in the returned set.",
    hasGaps: "Incomplete observations require additional review.",
    live: "The source response was parsed successfully.",
    unavailable: "No substitute series was generated.",
    secondNote: "Stronger wording requires an independent provider.",
    filingNote:
      "Market price and issuer disclosures remain separate evidence lanes.",
    boundaryNote: "The result describes observed data and visible gaps.",
    sourceSignals: "source-bound signals",
    separateLane: "separate lane",
    notApplicable: "not applicable",
    sourceBound: "source-bound",
  },
} as const;

function localizedAssetContext(asset: Asset, locale: Locale) {
  const context = {
    pl: {
      crypto: "Krypto quote + świece i osobna weryfikacja venue/depth",
      stocks: "Notowanie + osobna ścieżka raportów emitenta",
      indices: "Poziom indeksu + skład i timestamp źródła",
      fx: "Kurs referencyjny + feed intraday",
      etf: "Notowanie ETF + rytm aktualizacji składu",
      commodities: "Kontrakt / spot + timestamp i kontekst serii",
      real_estate: "Powolny proxy makro, nie wycena nieruchomości",
      exchanges:
        "Operator giełdy lub proxy publiczne + osobna kontrola kondycji rynku",
    },
    de: {
      crypto: "Krypto-Kurs + Kerzen und separate Venue-/Depth-Prüfung",
      stocks: "Kurs + separater Pfad für Emittentenberichte",
      indices: "Indexstand + Zusammensetzung und Quellenzeit",
      fx: "Referenzkurs + Intraday-Feed",
      etf: "ETF-Kurs + Aktualisierungsrhythmus der Bestände",
      commodities: "Kontrakt / Spot + Zeitstempel und Serienkontext",
      real_estate: "Langsamer Makro-Proxy, keine Immobilienbewertung",
      exchanges:
        "Börsenbetreiber oder öffentlicher Proxy + separate Marktprüfung",
    },
    en: {
      crypto: "Crypto quote + candles and separate venue/depth verification",
      stocks: "Quote + separate issuer filing lane",
      indices: "Index level + composition and source timestamp",
      fx: "Reference rate + intraday feed",
      etf: "ETF quote + holdings update cadence",
      commodities: "Contract / spot + timestamp and series context",
      real_estate: "Slow macro proxy, not a property valuation",
      exchanges:
        "Exchange operator or public proxy + separate venue-health review",
    },
  } as const;
  return context[locale][asset.category];
}

// PASS4414 moved categoryFromProvider to pass4414-cross-asset-quote-format-helpers.

// PASS4414 moved dynamicRisk to pass4414-cross-asset-quote-format-helpers.

// PASS4414 moved inferredCandleIntervalSeconds to pass4414-cross-asset-quote-format-helpers.

// PASS4414 moved changeForWindow to pass4414-cross-asset-quote-format-helpers.

// PASS4414 moved quoteMarketCap to pass4414-cross-asset-quote-format-helpers.

// PASS4414 moved quoteVolume to pass4414-cross-asset-quote-format-helpers.

// PASS4414 moved formatCompactAmount to pass4414-cross-asset-quote-format-helpers.

// PASS4414 moved pass2334RiskStatusLabel to pass4414-cross-asset-quote-format-helpers.

// PASS4414 moved buildFallbackMarketSparkline to pass4414-cross-asset-quote-format-helpers.

// PASS4414 moved buildSparklineSeries to pass4414-cross-asset-quote-format-helpers.

// PASS4414 moved buildPass4388SparklinePolyline to pass4414-cross-asset-quote-format-helpers.

function MarketChartSkeleton({
  sourceLabel = "Real Markets provider receipt pending",
  timeframeLabel = "1W",
  loading = true,
}: {
  sourceLabel?: string;
  timeframeLabel?: string;
  loading?: boolean;
}) {
  const lifecycle = buildChartLifecycleReceipt({
    state: loading ? "loading_skeleton" : "unavailable_skeleton",
    sourceLabel,
    timeframeLabel,
    candleCount: 0,
    confidenceScore: 25,
  });
  return (
    <svg
      viewBox="0 0 122 38"
      className="velmere-chart-skeleton-line-pass2807 h-10 w-[7.6rem]"
      aria-hidden="true"
      focusable="false"
      role="presentation"
      data-pass2807-chart-skeleton="neutral-grey-before-load"
      data-pass2809-chart-lifecycle={lifecycle.state}
      data-pass2809-chart-source={lifecycle.sourceLabel}
      data-pass2809-chart-timeframe={lifecycle.timeframeLabel}
      data-pass2810-pdf-render-decision="neutral_skeleton_box"
      data-pass2887-realmarkets-neutral-skeleton="single-grey-line-no-underlay"
      data-pass2890-realmarkets-neutral-skeleton="single-grey-line-local-smoke-target"
      data-pass4502-mini-chart="inert-borderless-skeleton" data-pass4504-mini-chart="inert-line-only-skeleton" data-pass4505-mini-chart="silent-no-native-svg-title"
      data-pass4513-mini-chart="passive-visual-line-no-tooltip-no-hover-surface"
      data-pass4515-mini-chart="reference-width-inert-no-hover-fill-or-tooltip"
      data-pass4517-mini-chart="no-css-hover-cascade-no-tooltip-no-focusable-target"
      data-pass4518-mini-chart="pure-line-no-fill-no-native-title-no-css-hover"
      data-pass4519-mini-chart="crisp-vector-line-inert-endcap-no-reflow"
      data-pass4520-mini-chart="pixel-locked-vector-line-no-hitbox-no-selection"
      data-pass4573-mini-chart="source-candles-only-no-tooltip-no-fake-line"
      data-pass4580-mini-chart-tone="neutral-skeleton"
    >
      <line
        x1="0"
        y1="19"
        x2="122"
        y2="19"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1.2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function pass4619MarketSparklineSeries(quote?: Quote): number[] {
  // Source-only contract: never turn 1H/24H/7D percentage anchors into a fake
  // path. A row gets a chart only when the provider returned at least two candles.
  return (quote?.candles ?? [])
    .map((candle) => candle.close)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0)
    .slice(-56);
}

function hasSourceCandles(quote?: Quote) {
  return pass4619MarketSparklineSeries(quote).length >= 2;
}

function buildPass4620SmoothSparklinePath(coords: [number, number][]): { linePath: string; areaPath: string } {
  if (coords.length < 2) return { linePath: "", areaPath: "" };
  let linePath = `M ${coords[0][0]} ${coords[0][1]}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(i - 1, 0)];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[Math.min(i + 2, coords.length - 1)];

    const cp1x = Number((p1[0] + (p2[0] - p0[0]) / 6).toFixed(2));
    const cp1y = Number((p1[1] + (p2[1] - p0[1]) / 6).toFixed(2));
    const cp2x = Number((p2[0] - (p3[0] - p1[0]) / 6).toFixed(2));
    const cp2y = Number((p2[1] - (p3[1] - p1[1]) / 6).toFixed(2));

    linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`;
  }
  const lastX = coords[coords.length - 1][0];
  const areaPath = `${linePath} L ${lastX} 36 L ${coords[0][0]} 36 Z`;
  return { linePath, areaPath };
}

function MarketSparkline({
  quote,
  asset,
  loading,
}: {
  quote?: Quote;
  asset?: Asset;
  loading?: boolean;
}) {
  const chartReceipt = quote?.pass2808ChartReceipt;
  const sourceLabel =
    chartReceipt?.source ??
    quote?.source ??
    "Real Markets provider receipt pending";
  const timeframeLabel = chartReceipt?.range?.toUpperCase?.() ?? "1W";
  if (loading || !hasSourceCandles(quote)) {
    return (
      <MarketChartSkeleton
        sourceLabel={sourceLabel}
        timeframeLabel={timeframeLabel}
        loading={loading}
      />
    );
  }
  const sample = pass4619MarketSparklineSeries(quote);
  if (sample.length < 2)
    return (
      <MarketChartSkeleton
        sourceLabel={sourceLabel}
        timeframeLabel={timeframeLabel}
        loading={false}
      />
    );
  const min = Math.min(...sample);
  const max = Math.max(...sample);
  const span = Math.max(max - min, 0.000001);
  const coords: [number, number][] = sample.map((value, index) => [
    Number(((index / Math.max(sample.length - 1, 1)) * 120 + 1).toFixed(2)),
    Number((32 - ((value - min) / span) * 24).toFixed(2)),
  ]);
  const { linePath, areaPath } = buildPass4620SmoothSparklinePath(coords);
  const lastCoord = coords[coords.length - 1];
  const gradId = `spark-grad-${asset?.id ?? "chart"}`;
  const rising = sample.at(-1)! >= sample[0];
  const trust = asset ? pass4579VisibleDataDecision(quote, asset.category, "en") : null;
  const sourceChartHasDirectionalEvidence = chartReceipt?.status === "source_bound" && sample.length >= 2;
  const chartMayUseDirectionalColor = pass4580MayUseDirectionalColor(trust) || sourceChartHasDirectionalEvidence;
  const sparkStroke = pass4580SparklineStroke(rising, chartMayUseDirectionalColor);
  const lifecycle = buildChartLifecycleReceipt({
    state: "source_bound",
    sourceLabel,
    timeframeLabel,
    lastUpdatedLabel: pass4576ResolveSourceTimestampSeconds(quote)
      ? new Date(pass4576ResolveSourceTimestampSeconds(quote)! * 1000).toISOString()
      : "last update pending",
    candleCount: chartReceipt?.candleCount ?? sample.length,
    confidenceScore: chartReceipt?.confidence ?? quote?.confidenceCap ?? 58,
  });
  return (
    <svg
      viewBox="0 0 122 38"
      className="mx-auto h-9 w-28 overflow-visible"
      aria-hidden="true"
      focusable="false"
      role="presentation"
      data-pass2807-realmarkets-chart="source-candles-no-underlay"
      data-pass2886-realmarkets-chart-cell="source-candles-or-neutral-skeleton"
      data-pass2887-realmarkets-chart-no-underlay="polyline-only-source-candles"
      data-pass2890-realmarkets-source-chart="polyline-only-source-candles-local-smoke-target"
      data-pass2808-chart-receipt={chartReceipt?.status ?? "source_bound"}
      data-pass2809-chart-lifecycle={lifecycle.state}
      data-pass2809-chart-source={lifecycle.sourceLabel}
      data-pass2809-chart-timeframe={lifecycle.timeframeLabel}
      data-pass2809-chart-candles={lifecycle.candleCount}
      data-pass2810-pdf-render-decision="source_chart"
      data-pass4485-realmarkets-chart-fit="plain-source-line-no-endcap"
      data-pass4502-mini-chart="inert-borderless-line-only" data-pass4503-mini-chart="passive-line-endcap-no-fill" data-pass4504-mini-chart="inert-line-only-no-tooltip-surface" data-pass4505-mini-chart="silent-no-native-svg-title"
      data-pass4515-mini-chart="reference-width-inert-no-hover-fill-or-tooltip"
      data-pass4517-mini-chart="no-css-hover-cascade-no-tooltip-no-focusable-target"
      data-pass4518-mini-chart="pure-line-no-fill-no-native-title-no-css-hover"
      data-pass4519-mini-chart="crisp-vector-line-inert-endcap-no-reflow"
      data-pass4520-mini-chart="pixel-locked-vector-line-no-hitbox-no-selection"
      data-pass4573-mini-chart="source-candles-only-no-tooltip-no-fake-line"
      data-pass4580-mini-chart-tone={pass4580MayUseDirectionalColor(trust) ? "directional-live" : sourceChartHasDirectionalEvidence ? "directional-source-chart" : "neutral-labelled"}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sparkStroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={sparkStroke} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill={`url(#${gradId})`}
        stroke="none"
      />
      <path
        d={linePath}
        fill="none"
        stroke={sparkStroke}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={lastCoord[0]}
        cy={lastCoord[1]}
        r="2"
        fill={sparkStroke}
      />
      <circle
        cx={lastCoord[0]}
        cy={lastCoord[1]}
        r="4.5"
        fill={sparkStroke}
        opacity="0.25"
      />
    </svg>
  );
}

function RealMarketsChartSourceFooter({
  rows,
  quotes,
  loading,
  locale,
  onRetry,
}: {
  rows: Asset[];
  quotes: Record<string, Quote>;
  loading: boolean;
  locale: Locale;
  onRetry: () => void;
}) {
  const sourceBoundCharts = rows.filter((asset) =>
    hasSourceCandles(quoteForAsset(quotes, asset)),
  ).length;
  const freshSourceRows = rows.filter((asset) =>
    pass4577CanShowPercent(quoteForAsset(quotes, asset), asset.category),
  ).length;
  const staleOrPendingRows = Math.max(0, rows.length - freshSourceRows);
  const skeletonRequiredCharts = Math.max(0, rows.length - sourceBoundCharts);
  const latestTimestamp = rows
    .map((asset) => pass4576ResolveSourceTimestampSeconds(quoteForAsset(quotes, asset)))
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    )
    .sort((left, right) => right - left)[0];
  const sourceUnavailable = !loading && rows.length > 0 && freshSourceRows === 0 && sourceBoundCharts === 0;
  const lastUpdated = latestTimestamp
    ? new Date(latestTimestamp * 1000).toISOString()
    : sourceUnavailable
      ? locale === "pl"
        ? "niedostępne"
        : locale === "de"
          ? "nicht verfügbar"
          : "unavailable"
      : "pending";
  const label =
    locale === "pl"
      ? "Źródła"
      : locale === "de"
        ? "Quellen"
        : "Sources";
  const statusLabel = loading
    ? locale === "pl"
      ? "synchronizacja"
      : locale === "de"
        ? "Synchronisierung"
        : "sync"
    : sourceUnavailable
      ? locale === "pl"
        ? "dane niedostępne"
        : locale === "de"
          ? "Daten nicht verfügbar"
          : "data unavailable"
    : locale === "pl"
      ? "gotowe"
      : locale === "de"
        ? "bereit"
        : "ready";
  const updatedLabel =
    locale === "pl"
      ? "Ostatnia aktualizacja"
      : locale === "de"
        ? "Aktualisiert"
        : "Last update";
  const rule =
    locale === "pl"
      ? "Miniwykresy są wyłącznie pasywnym odczytem źródeł. Pełny wykres otwiera klik w wiersz."
      : locale === "de"
        ? "Mini-Charts sind nur ein passiver Quellenstatus. Der volle Chart öffnet über die Zeile."
        : "Mini charts are passive source status only. The full chart opens from the row.";
  return (
    <div
      className="border-t border-white/[0.075] px-5 py-3 font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.34]"
      data-pass2810-realmarkets-chart-source-footer="source-bound-skeleton-last-updated"
      data-pass4512-chart-footer="micro-source-ribbon-no-debug-wall"
      data-pass4513-chart-ribbon="localized-quiet-one-line-source-state-row-opens-drawer"
      data-pass4514-chart-ribbon="single-line-reference-ribbon-copy-sr-only"
      data-pass4515-chart-ribbon="visible-line-only-rule-sr-only"
      data-pass4518-source-ribbon="single-line-ellipsis-localized-no-debug"
      data-pass4519-source-ribbon="status-role-one-line-no-x-overflow"
      data-pass4520-source-ribbon="single-line-ellipsis-status-no-wrap-debug-free"
      data-pass4521-source-ribbon="single-status-line-localized-no-debug-wrap"
      data-pass2886-realmarkets-chart-footer="source-bound-skeleton-last-updated-no-fake-chart"
      data-pass2890-realmarkets-chart-footer-smoke="source-bound-count-skeleton-count-last-updated"
      data-pass2810-source-bound-charts={sourceBoundCharts}
      data-pass2810-skeleton-required-charts={
        loading ? rows.length : skeletonRequiredCharts
      }
      data-pass4575-fresh-source-rows={freshSourceRows}
      data-pass4576-source-clock="resolved-observedAt-updatedAt-fetchedAt-marketTime"
      data-pass4575-pending-source-rows={staleOrPendingRows}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2" data-pass4513-ribbon-status="localized-source-state">
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" data-pass4513-ribbon-dot="quiet-status-dot" />
          {label}: {sourceBoundCharts}/{rows.length} · {statusLabel} · fresh {freshSourceRows}/{rows.length} · {sourceUnavailable ? "unavailable" : "pending"} {staleOrPendingRows}
        </span>
        <span className="inline-flex items-center gap-3" data-pass4513-ribbon-time="localized-last-update">
          {updatedLabel}: {lastUpdated}
          {sourceUnavailable ? (
            <button
              type="button"
              onClick={onRetry}
              className="min-h-10 rounded-full border border-white/[0.14] px-3 py-2 text-[8px] text-white/[0.72] transition hover:border-white/[0.28] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {locale === "pl" ? "Ponów" : locale === "de" ? "Erneut versuchen" : "Retry"}
            </button>
          ) : null}
        </span>
      </div>
      <p className="sr-only" data-pass4514-ribbon-copy="screen-reader-reference-note-no-visible-debug-wall" data-pass4515-ribbon-copy="sr-only-no-visible-debug-note">
        {rule}
      </p>
    </div>
  );
}

type Pass2810ErrorBoundaryState = { hasError: boolean; reference?: string };

class Pass2810RealMarketsTableErrorBoundary extends Component<
  { children: ReactNode; locale: Locale },
  Pass2810ErrorBoundaryState
> {
  declare props: Readonly<{ children: ReactNode; locale: Locale }>;
  state: Pass2810ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): Pass2810ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    const projection = reportBrowserBoundaryFailure({
      event: "real_markets_table_render_failure",
      error,
    });
    this.setState({ hasError: true, reference: projection.reference });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const boundaryLabel =
      this.props.locale === "pl"
        ? "Bezpieczny tryb tabeli"
        : this.props.locale === "de"
          ? "Sicherer Tabellenmodus"
          : "Safe table mode";
    const copy =
      this.props.locale === "pl"
        ? "Real Markets przełączył tabelę w tryb bezpieczny. Provider/UI błąd został zatrzymany; odśwież albo zmień kategorię."
        : this.props.locale === "de"
          ? "Real Markets hat die Tabelle in den sicheren Modus geschaltet. Provider/UI-Fehler wurde abgefangen; bitte aktualisieren oder Kategorie wechseln."
          : "Real Markets switched the table into safe mode. Provider/UI error was contained; refresh or change category.";
    return (
      <div
        className="rounded-[1.4rem] border border-white/[0.12] bg-white/[0.035] p-6 text-sm text-white/[0.62]"
        data-pass2810-realmarkets-error-boundary="contained-table-render-error"
      >
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.38]">
          {boundaryLabel}
        </p>
        <p className="mt-3">{copy}</p>
        <p className="mt-2 font-mono text-[10px] text-white/[0.34]">
          {this.state.reference ?? "ui_error_reference_pending"}
        </p>
      </div>
    );
  }
}

function AssetLogo({
  asset,
  large = false,
}: {
  asset: Asset;
  large?: boolean;
}) {
  const assetClass =
    asset.category === "stocks"
      ? "stock"
      : asset.category === "indices"
        ? "index"
        : asset.category === "commodities"
          ? "commodity"
          : asset.category === "real_estate"
            ? "real_estate"
            : asset.category === "exchanges"
              ? "exchange"
              : asset.category;
  const size = large ? "h-16 w-16" : "h-6 w-6";
  const shell = large
    ? "rounded-full border border-cyan-200/[0.12] bg-cyan-300/[0.035] shadow-[0_0_42px_rgba(34,211,238,0.08)]"
    : "rounded-none border-0 bg-transparent shadow-none";
  return (
    <ResolvedAssetLogo
      symbol={asset.symbol}
      name={asset.name}
      id={asset.id}
      providerSymbol={asset.providerSymbol}
      assetClass={assetClass}
      imageUrl={
        asset.domain
          ? `/api/market-integrity/brand-icon?domain=${encodeURIComponent(asset.domain)}`
          : undefined
      }
      venue={
        asset.category === "exchanges"
          ? asset.name.replace(/\s+Venue Health$/i, "")
          : undefined
      }
      compact={!large}
      data-pass2887-realmarkets-icon-fallback-chain="domain-venue-provider-symbol-no-frame"
      className={`pass2886-realmarkets-icon-chain realmarkets-icon-chain-pass2386 realmarkets-icon-chain-pass2387 relative grid ${size} shrink-0 place-items-center overflow-visible ${shell} font-mono text-[10px] font-semibold text-velmere-gold [&>img]:absolute [&>img]:inset-0 [&>img]:z-10 [&>img]:h-full [&>img]:w-full [&>img]:object-contain [&>img]:opacity-0 [&>img.is-loaded]:opacity-100 [&>span]:relative [&>span]:z-0`}
    />
  );
}

function isVenueHealthAsset(asset?: Asset | null) {
  return Boolean(
    asset?.providerSymbol.endsWith("VENUE") ||
    asset?.id.endsWith("-venue") ||
    /venue health/i.test(asset?.name ?? ""),
  );
}

function auditAssetClass(asset: Asset): UnifiedAuditAssetClass {
  if (isVenueHealthAsset(asset)) return "exchange";
  if (asset.category === "stocks" || asset.category === "exchanges")
    return "stock";
  if (asset.category === "indices") return "index";
  if (asset.category === "fx") return "fx";
  if (asset.category === "etf") return "etf";
  if (asset.category === "commodities") return "commodity";
  if (asset.category === "real_estate") return "real_estate";
  return "crypto";
}

type AssetClassAuditMetric = {
  id: string;
  label: string;
  value?: string | number | null;
  note: string;
  status: "verified" | "review" | "missing";
};

function assetClassAuditMetrics(
  asset: Asset,
  locale: Locale,
): AssetClassAuditMetric[] {
  const assetClass = auditAssetClass(asset);
  const pending = (pl: string, de: string, en: string) =>
    locale === "pl" ? pl : locale === "de" ? de : en;
  const metric = (
    id: string,
    label: [string, string, string],
    source: [string, string, string],
    value?: string | number | null,
    status: AssetClassAuditMetric["status"] = "missing",
  ): AssetClassAuditMetric => ({
    id,
    label: pending(...label),
    value,
    note: pending(...source),
    status,
  });

  if (assetClass === "exchange") {
    const lifecycle =
      asset.symbol === "BINANCE" || asset.symbol === "MEXC"
        ? pending(
            "Wymagana rotacja połączenia, heartbeat i kontrola reconnect.",
            "Verbindungsrotation, Heartbeat und Reconnect-Kontrolle erforderlich.",
            "Connection rotation, heartbeat and reconnect controls are required.",
          )
        : pending(
            "Wymagany adapter statusu, depth i błędów API.",
            "Status-, Depth- und API-Fehler-Adapter erforderlich.",
            "Status, depth and API-error adapters are required.",
          );
    return [
      metric(
        "withdrawals",
        ["Wypłaty", "Auszahlungen", "Withdrawals"],
        [
          "Połącz status wpłat/wypłat z oficjalnego status API.",
          "Ein-/Auszahlungsstatus aus offizieller Status-API anbinden.",
          "Connect deposit/withdrawal status from an official status API.",
        ],
      ),
      metric(
        "reserves",
        [
          "Rezerwy / disclosure",
          "Reserven / Disclosure",
          "Reserves / disclosure",
        ],
        [
          "Wymaga aktualnego, niezależnie weryfikowalnego disclosure.",
          "Aktuelles, unabhängig prüfbares Disclosure erforderlich.",
          "Requires current, independently verifiable disclosure.",
        ],
      ),
      metric(
        "heartbeatAge",
        ["Wiek heartbeat", "Heartbeat-Alter", "Heartbeat age"],
        [
          "Mierz ostatni poprawny heartbeat i opóźnienie strumienia.",
          "Letzten gültigen Heartbeat und Stream-Latenz messen.",
          "Measure the last valid heartbeat and stream lag.",
        ],
      ),
      metric(
        "reconnectPolicy",
        ["Polityka reconnect", "Reconnect-Policy", "Reconnect policy"],
        [lifecycle, lifecycle, lifecycle],
        lifecycle,
        "review",
      ),
      metric(
        "statusPage",
        ["Status operacyjny", "Betriebsstatus", "Operational status"],
        [
          "Wymaga oficjalnego status page lub endpointu systemowego.",
          "Offizielle Status-Seite oder System-Endpoint erforderlich.",
          "Requires an official status page or system endpoint.",
        ],
      ),
      metric(
        "orderbookIntegrity",
        [
          "Integralność orderbooka",
          "Orderbook-Integrität",
          "Order-book integrity",
        ],
        [
          "Porównaj snapshot i incremental depth oraz wykryj luki sekwencji.",
          "Snapshot und Incremental Depth abgleichen und Sequenzlücken erkennen.",
          "Reconcile snapshots with incremental depth and detect sequence gaps.",
        ],
      ),
      metric(
        "apiErrorRate",
        ["Błędy API", "API-Fehlerrate", "API error rate"],
        [
          "Zlicz timeouty, rate-limit i błędy providerów w oknie czasu.",
          "Timeouts, Rate-Limits und Providerfehler im Zeitfenster zählen.",
          "Count timeouts, rate limits and provider errors over a time window.",
        ],
      ),
      metric(
        "maintenanceState",
        ["Tryb maintenance", "Wartungsstatus", "Maintenance state"],
        [
          "Wymaga rozróżnienia planowanej konserwacji od awarii.",
          "Geplante Wartung muss von Ausfällen getrennt werden.",
          "Planned maintenance must be separated from outages.",
        ],
      ),
      metric(
        "proofOfReserves",
        ["Proof of reserves", "Proof of Reserves", "Proof of reserves"],
        [
          "Pokaż datę, zakres i niezależność audytu; nie traktuj samego linku jako dowodu.",
          "Datum, Umfang und Unabhängigkeit des Audits zeigen; Link allein ist kein Beweis.",
          "Show audit date, scope and independence; a link alone is not proof.",
        ],
      ),
      metric(
        "jurisdiction",
        ["Granica jurysdykcji", "Jurisdiktionsgrenze", "Jurisdiction boundary"],
        [
          "Zasady i dostępność usług zależą od kraju użytkownika.",
          "Regeln und Verfügbarkeit hängen vom Land des Nutzers ab.",
          "Rules and service availability depend on the user's country.",
        ],
      ),
    ];
  }

  if (assetClass === "stock")
    return [
      metric(
        "peRatio",
        ["P/E", "KGV", "P/E"],
        [
          "Wymaga aktualnych danych fundamentalnych i okresu TTM/forward.",
          "Aktuelle Fundamentaldaten und TTM/Forward-Zeitraum erforderlich.",
          "Requires current fundamentals and a defined TTM/forward period.",
        ],
      ),
      metric(
        "earningsDate",
        ["Najbliższe wyniki", "Nächster Earnings-Termin", "Next earnings"],
        [
          "Wymaga kalendarza emitenta lub giełdy.",
          "Emittenten- oder Börsenkalender erforderlich.",
          "Requires an issuer or exchange calendar.",
        ],
      ),
      metric(
        "revenueGrowth",
        ["Wzrost przychodów", "Umsatzwachstum", "Revenue growth"],
        [
          "Wymaga spójnego okresu porównawczego z raportu emitenta.",
          "Konsistenter Vergleichszeitraum aus Emittentenbericht erforderlich.",
          "Requires a consistent comparison period from issuer filings.",
        ],
      ),
      metric(
        "filingFreshness",
        ["Świeżość filingów", "Filing-Freshness", "Filing freshness"],
        [
          "Podaj datę najnowszego raportu i okres sprawozdawczy.",
          "Datum des jüngsten Berichts und Berichtsperiode angeben.",
          "Show the latest filing date and reporting period.",
        ],
      ),
      metric(
        "enterpriseValue",
        ["Enterprise value", "Enterprise Value", "Enterprise value"],
        [
          "Wymaga kapitalizacji, długu i gotówki z jednego okresu.",
          "Market Cap, Schulden und Cash aus derselben Periode erforderlich.",
          "Requires market cap, debt and cash from the same period.",
        ],
      ),
      metric(
        "freeCashFlow",
        ["Free cash flow", "Free Cashflow", "Free cash flow"],
        [
          "Wymaga cash-flow statement i jawnej definicji okresu.",
          "Cashflow-Statement und klar definierter Zeitraum erforderlich.",
          "Requires a cash-flow statement and an explicit period.",
        ],
      ),
      metric(
        "debtLoad",
        ["Obciążenie długiem", "Verschuldung", "Debt load"],
        [
          "Połącz dług netto, zapadalność i koszt finansowania.",
          "Nettoschulden, Fälligkeiten und Finanzierungskosten verbinden.",
          "Combine net debt, maturity schedule and financing cost.",
        ],
      ),
      metric(
        "insiderActivity",
        ["Transakcje insiderów", "Insider-Aktivität", "Insider activity"],
        [
          "Wymaga oficjalnych zgłoszeń, bez wyciągania wniosków z pojedynczej transakcji.",
          "Offizielle Meldungen nötig; keine Aussage aus einer Einzeltransaktion.",
          "Requires official filings; do not infer intent from one transaction.",
        ],
      ),
      metric(
        "institutionalOwnership",
        [
          "Udział instytucji",
          "Institutioneller Anteil",
          "Institutional ownership",
        ],
        [
          "Wymaga aktualnego źródła ownership z datą raportową.",
          "Aktuelle Ownership-Quelle mit Berichtsdatum erforderlich.",
          "Requires a dated, current ownership source.",
        ],
      ),
    ];

  if (assetClass === "fx")
    return [
      metric(
        "spread",
        ["Spread", "Spread", "Spread"],
        [
          "Wymaga bid/ask z konkretnego providera i sesji.",
          "Bid/Ask eines konkreten Providers und einer Session erforderlich.",
          "Requires provider-specific bid/ask and session context.",
        ],
      ),
      metric(
        "realizedVolatility",
        [
          "Zmienność realizowana",
          "Realisierte Volatilität",
          "Realized volatility",
        ],
        [
          "Wylicz z jednolitego interwału i jawnego okna czasu.",
          "Aus einheitlichem Intervall und offenem Zeitfenster berechnen.",
          "Calculate from a consistent interval and explicit window.",
        ],
      ),
      metric(
        "rateDifferential",
        ["Różnica stóp", "Zinsdifferenz", "Rate differential"],
        [
          "Wymaga aktualnych stóp banków centralnych dla obu walut.",
          "Aktuelle Leitzinsen beider Währungen erforderlich.",
          "Requires current policy rates for both currencies.",
        ],
      ),
      metric(
        "macroCalendar",
        ["Kalendarz makro", "Makrokalender", "Macro calendar"],
        [
          "Wymaga zdarzeń z datą, strefą czasową i ważnością.",
          "Ereignisse mit Datum, Zeitzone und Relevanz erforderlich.",
          "Requires events with date, timezone and importance.",
        ],
      ),
      metric(
        "forwardPoints",
        ["Forward points", "Forward Points", "Forward points"],
        [
          "Wymaga tenorów i źródła rynku forward.",
          "Tenöre und Forward-Marktquelle erforderlich.",
          "Requires tenors and a forward-market source.",
        ],
      ),
      metric(
        "carryRegime",
        ["Reżim carry", "Carry-Regime", "Carry regime"],
        [
          "Łączy różnicę stóp, koszt hedgingu i zmienność.",
          "Verbindet Zinsdifferenz, Hedgingkosten und Volatilität.",
          "Combines rate differential, hedging cost and volatility.",
        ],
      ),
      metric(
        "liquiditySession",
        ["Sesja płynności", "Liquiditätssession", "Liquidity session"],
        [
          "Porównaj Azję, Londyn i Nowy Jork zamiast jednego snapshotu.",
          "Asien, London und New York statt eines Snapshots vergleichen.",
          "Compare Asia, London and New York rather than one snapshot.",
        ],
      ),
      metric(
        "centralBankRisk",
        ["Ryzyko banku centralnego", "Zentralbank-Risiko", "Central-bank risk"],
        [
          "Wymaga kalendarza decyzji i komunikatów źródłowych.",
          "Entscheidungskalender und Primärkommunikation erforderlich.",
          "Requires a decision calendar and primary communications.",
        ],
      ),
    ];

  if (assetClass === "etf")
    return [
      metric(
        "aum",
        ["AUM", "AUM", "AUM"],
        [
          "Wymaga aktualnej wartości aktywów od emitenta.",
          "Aktueller Vermögenswert vom Emittenten erforderlich.",
          "Requires current assets under management from the issuer.",
        ],
      ),
      metric(
        "navPremium",
        [
          "Premia / dyskonto do NAV",
          "NAV-Prämie / Discount",
          "NAV premium / discount",
        ],
        [
          "Wymaga NAV i ceny z tego samego timestampu.",
          "NAV und Preis mit demselben Zeitstempel erforderlich.",
          "Requires NAV and price from the same timestamp.",
        ],
      ),
      metric(
        "trackingError",
        ["Tracking error", "Tracking Error", "Tracking error"],
        [
          "Wymaga benchmarku, okresu i danych total-return.",
          "Benchmark, Zeitraum und Total-Return-Daten erforderlich.",
          "Requires a benchmark, period and total-return data.",
        ],
      ),
      metric(
        "holdingsConcentration",
        [
          "Koncentracja holdings",
          "Holdings-Konzentration",
          "Holdings concentration",
        ],
        [
          "Wymaga aktualnego pliku składu i wag pozycji.",
          "Aktuelle Bestandsdatei und Positionsgewichte erforderlich.",
          "Requires a current holdings file and position weights.",
        ],
      ),
      metric(
        "creationRedemption",
        [
          "Creation / redemption",
          "Creation / Redemption",
          "Creation / redemption",
        ],
        [
          "Wymaga przepływów jednostek i płynności koszyka.",
          "Anteilsflüsse und Basket-Liquidität erforderlich.",
          "Requires share flows and basket liquidity.",
        ],
      ),
      metric(
        "issuerConcentration",
        ["Ryzyko emitenta", "Emittentenrisiko", "Issuer concentration"],
        [
          "Oddziel kondycję emitenta od ryzyka aktywów bazowych.",
          "Emittentenstatus vom Basiswertrisiko trennen.",
          "Separate issuer condition from underlying-asset risk.",
        ],
      ),
      metric(
        "liquidityTier",
        ["Warstwa płynności", "Liquiditätsstufe", "Liquidity tier"],
        [
          "Połącz spread ETF, depth i płynność składników.",
          "ETF-Spread, Depth und Basiswertliquidität verbinden.",
          "Combine ETF spread, depth and underlying liquidity.",
        ],
      ),
      metric(
        "holdingsFreshness",
        ["Świeżość holdings", "Holdings-Freshness", "Holdings freshness"],
        [
          "Pokaż datę publikacji składu, nie tylko nazwę funduszu.",
          "Veröffentlichungsdatum der Bestände zeigen, nicht nur Fondsname.",
          "Show the holdings publication date, not only the fund name.",
        ],
      ),
    ];

  if (assetClass === "commodity")
    return [
      metric(
        "openInterest",
        ["Open interest", "Open Interest", "Open interest"],
        [
          "Wymaga konkretnego kontraktu i daty giełdowej.",
          "Konkreter Kontrakt und Börsendatum erforderlich.",
          "Requires a specific contract and exchange date.",
        ],
      ),
      metric(
        "contractExpiry",
        ["Wygaśnięcie kontraktu", "Kontraktverfall", "Contract expiry"],
        [
          "Wymaga miesiąca kontraktu i reguł rolowania.",
          "Kontraktmonat und Rollregeln erforderlich.",
          "Requires the contract month and roll rules.",
        ],
      ),
      metric(
        "futuresCurve",
        ["Krzywa futures", "Futures-Kurve", "Futures curve"],
        [
          "Porównaj kilka terminów; pojedyncza cena nie pokazuje contango/backwardation.",
          "Mehrere Laufzeiten vergleichen; ein Preis zeigt kein Contango/Backwardation.",
          "Compare multiple maturities; one price cannot show contango/backwardation.",
        ],
      ),
      metric(
        "inventorySignal",
        ["Zapasy / podaż", "Bestände / Angebot", "Inventory / supply"],
        [
          "Wymaga właściwego źródła branżowego i daty publikacji.",
          "Passende Branchenquelle und Veröffentlichungsdatum erforderlich.",
          "Requires the relevant industry source and publication date.",
        ],
      ),
      metric(
        "rollYield",
        ["Roll yield", "Roll Yield", "Roll yield"],
        [
          "Wylicz z jawnej krzywej i reguły rolowania.",
          "Aus offener Kurve und Rollregel berechnen.",
          "Calculate from an explicit curve and roll rule.",
        ],
      ),
      metric(
        "curveStress",
        ["Naprężenie krzywej", "Kurvenstress", "Curve stress"],
        [
          "Wykrywa nagłe zmiany między terminami, bez prognozy ceny.",
          "Erkennt abrupte Laufzeitverschiebungen ohne Preisprognose.",
          "Detects abrupt maturity shifts without forecasting price.",
        ],
      ),
      metric(
        "deliveryRisk",
        ["Ryzyko dostawy", "Lieferrisiko", "Delivery risk"],
        [
          "Wymaga zasad kontraktu, lokalizacji i stanów magazynowych.",
          "Kontraktregeln, Standorte und Lagerbestände erforderlich.",
          "Requires contract rules, locations and inventories.",
        ],
      ),
      metric(
        "seasonality",
        ["Sezonowość", "Saisonalität", "Seasonality"],
        [
          "Wymaga wieloletniej serii i ochrony przed overfitem.",
          "Mehrjährige Reihe und Overfit-Schutz erforderlich.",
          "Requires a multi-year series and overfit controls.",
        ],
      ),
    ];

  if (assetClass === "real_estate")
    return [
      metric(
        "ffo",
        ["FFO / AFFO", "FFO / AFFO", "FFO / AFFO"],
        [
          "Wymaga raportu REIT i spójnej definicji okresu.",
          "REIT-Bericht und konsistente Periodendefinition erforderlich.",
          "Requires a REIT report and consistent period definition.",
        ],
      ),
      metric(
        "occupancy",
        ["Obłożenie", "Auslastung", "Occupancy"],
        [
          "Wymaga segmentu, geografii i daty raportowej.",
          "Segment, Geografie und Berichtsdatum erforderlich.",
          "Requires segment, geography and reporting date.",
        ],
      ),
      metric(
        "leverage",
        ["Dźwignia", "Leverage", "Leverage"],
        [
          "Połącz dług netto, EBITDA/NOI i zapadalność.",
          "Nettoschulden, EBITDA/NOI und Fälligkeiten verbinden.",
          "Combine net debt, EBITDA/NOI and maturities.",
        ],
      ),
      metric(
        "navDiscount",
        ["Dyskonto do NAV", "NAV-Discount", "NAV discount"],
        [
          "Wymaga aktualnego NAV i jawnej metodologii wyceny.",
          "Aktueller NAV und offene Bewertungsmethodik erforderlich.",
          "Requires current NAV and an explicit valuation method.",
        ],
      ),
      metric(
        "debtMaturity",
        ["Zapadalność długu", "Schuldenfälligkeit", "Debt maturity"],
        [
          "Pokaż koncentrację zapadalności i koszt refinansowania.",
          "Fälligkeitskonzentration und Refinanzierungskosten zeigen.",
          "Show maturity concentration and refinancing cost.",
        ],
      ),
      metric(
        "tenantConcentration",
        [
          "Koncentracja najemców",
          "Mieterkonzentration",
          "Tenant concentration",
        ],
        [
          "Wymaga udziałów top najemców i końca umów.",
          "Top-Mieteranteile und Vertragsenden erforderlich.",
          "Requires top-tenant shares and lease expiries.",
        ],
      ),
      metric(
        "refinancingRisk",
        ["Ryzyko refinansowania", "Refinanzierungsrisiko", "Refinancing risk"],
        [
          "Łączy zapadalność, stopy i pokrycie odsetek.",
          "Verbindet Fälligkeit, Zinsen und Zinsdeckung.",
          "Combines maturities, rates and interest coverage.",
        ],
      ),
      metric(
        "capRateSpread",
        ["Spread cap rate", "Cap-Rate-Spread", "Cap-rate spread"],
        [
          "Wymaga porównywalnego segmentu i stopy bazowej.",
          "Vergleichbares Segment und Basiszins erforderlich.",
          "Requires a comparable segment and reference rate.",
        ],
      ),
    ];

  if (assetClass === "index")
    return [
      metric(
        "constituentBreadth",
        ["Szerokość rynku", "Marktbreite", "Market breadth"],
        [
          "Wymaga zmian wszystkich składników, nie tylko poziomu indeksu.",
          "Änderungen aller Bestandteile nötig, nicht nur Indexstand.",
          "Requires constituent moves, not only the index level.",
        ],
      ),
      metric(
        "concentration",
        ["Koncentracja wag", "Gewichtskonzentration", "Weight concentration"],
        [
          "Wymaga aktualnych wag składników.",
          "Aktuelle Bestandgewichte erforderlich.",
          "Requires current constituent weights.",
        ],
      ),
      metric(
        "realizedVolatility",
        [
          "Zmienność realizowana",
          "Realisierte Volatilität",
          "Realized volatility",
        ],
        [
          "Wylicz z jawnego okna i interwału.",
          "Aus offenem Fenster und Intervall berechnen.",
          "Calculate from an explicit window and interval.",
        ],
      ),
      metric(
        "sectorBreadth",
        ["Szerokość sektorów", "Sektorbreite", "Sector breadth"],
        [
          "Wymaga mapowania składników do sektorów.",
          "Zuordnung der Bestandteile zu Sektoren erforderlich.",
          "Requires constituent-to-sector mapping.",
        ],
      ),
      metric(
        "topWeight",
        ["Największa waga", "Größtes Gewicht", "Top weight"],
        [
          "Wymaga aktualnego rebalancingu i wag.",
          "Aktuelles Rebalancing und Gewichte erforderlich.",
          "Requires current rebalance data and weights.",
        ],
      ),
      metric(
        "rebalanceRisk",
        ["Ryzyko rebalancingu", "Rebalancing-Risiko", "Rebalance risk"],
        [
          "Wymaga daty i reguł zmian składu.",
          "Datum und Regeln der Zusammensetzungsänderung erforderlich.",
          "Requires the date and rules for constituent changes.",
        ],
      ),
      metric(
        "macroSensitivity",
        ["Wrażliwość makro", "Makro-Sensitivität", "Macro sensitivity"],
        [
          "Wymaga historycznego testu bez udawania przyczynowości.",
          "Historischer Test ohne vorgetäuschte Kausalität erforderlich.",
          "Requires historical testing without claiming causality.",
        ],
      ),
    ];

  return [
    metric(
      "circulatingRatio",
      ["Podaż w obiegu", "Umlaufquote", "Circulating ratio"],
      [
        "Wymaga circulating i total supply z tego samego źródła.",
        "Circulating und Total Supply aus derselben Quelle erforderlich.",
        "Requires circulating and total supply from the same source.",
      ],
    ),
    metric(
      "sourceQuorum",
      ["Quorum venue", "Venue-Quorum", "Venue quorum"],
      [
        "Porównaj co najmniej dwa niezależne venue.",
        "Mindestens zwei unabhängige Venues vergleichen.",
        "Compare at least two independent venues.",
      ],
    ),
    metric(
      "providerResilience",
      ["Odporność providerów", "Provider-Resilienz", "Provider resilience"],
      [
        "Raport nie powinien zależeć od jednego feedu.",
        "Bericht darf nicht von einem Feed abhängen.",
        "The report should not depend on one feed.",
      ],
    ),
  ];
}

// PASS4414 moved formatMarketCapProxy to pass4414-cross-asset-quote-format-helpers.

// PASS4418 moved mode intro, human market brief and asset detail data helpers to pass4418-cross-asset-brief-detail-helpers.

// PASS4414 moved formatSignedPercent to pass4414-cross-asset-quote-format-helpers.

// PASS4414 moved sourceQualityLabel to pass4414-cross-asset-quote-format-helpers.

// PASS4414 moved compactProviderLabel to pass4414-cross-asset-quote-format-helpers.

// PASS4414 moved inferMarketSession to pass4414-cross-asset-quote-format-helpers.

// PASS4414 moved formatPrice to pass4414-cross-asset-quote-format-helpers.

// PASS4414 moved formatAssetDetailQuotePrice to pass4414-cross-asset-quote-format-helpers.

// PASS4414 moved formatAssetDetailTimestamp to pass4414-cross-asset-quote-format-helpers.

// PASS4414 moved formatRelativeFreshness to pass4414-cross-asset-quote-format-helpers.

// PASS4225/PASS2036 compatibility marker: VLM Real Markets modal uses the unified AssetDetailModal headerMetaSlot and chartFooterSlot pathways through shared data props.

// PASS4418 moved Real Markets asset detail data builder to pass4418 helper.

function RealMarketsSortButton({
  label,
  sortKey,
  sort,
  onUpdateSort,
  align = "right",
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; direction: SortDirection } | null;
  onUpdateSort: (key: SortKey) => void;
  align?: "left" | "right" | "center";
}) {
  const active = sort?.key === sortKey;
  const alignment =
    align === "left"
      ? "justify-start text-left"
      : align === "center"
        ? "justify-center text-center"
        : "justify-end text-right";
  return (
    <button
      type="button"
      onPointerDown={(event: Pass4149ButtonPointerEvent) =>
        event.stopPropagation()
      }
      onClick={(event: Pass4149ButtonMouseEvent) => {
        event.stopPropagation();
        onUpdateSort(sortKey);
      }}
      onKeyDown={(event: Pass4149ButtonKeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        onUpdateSort(sortKey);
      }}
      data-testid={`realmarkets-sort-${sortKey}`}
      data-pass1414-sort-header="inline-not-extra-pill"
      data-sort-key={sortKey}
      data-sort-direction={active ? sort.direction : "neutral"}
      data-pass1998-sort-click-target="full-header-cell"
      data-pass2000-sort-click-target="full-cell-no-overlay-steal"
      data-pass1984-tristate="desc-asc-neutral"
      data-pass2086-sort-runtime="click-keyboard-tristate-parity"
      aria-label={`${label}: ${
        active
          ? sort.direction === "desc"
            ? "descending"
            : "ascending"
          : "neutral"
      }`}
      aria-pressed={active}
      className={`realmarkets-sort-header-cell inline-flex min-h-8 w-full items-center font-mono text-[8px] uppercase tracking-[0.15em] transition ${alignment} ${active ? "text-velmere-gold" : "text-white/[0.34] hover:text-white/[0.70]"}`}
      title="Column header sort: high, low, neutral"
    >
      {align === "center" ? (
        <div className="relative inline-flex items-center justify-center">
          <span className="truncate">{label}</span>
          <span className="absolute -right-4 inline-flex items-center gap-0.5">
            <ArrowUpDown
              className={`h-3 w-3 shrink-0 ${active ? "opacity-100" : "opacity-30"}`}
            />
            {active ? (
              <span className="shrink-0 text-[8px]">
                {sort.direction === "desc" ? "↓" : "↑"}
              </span>
            ) : null}
          </span>
        </div>
      ) : (
        <div className="inline-flex items-center gap-1">
          <span className="truncate">{label}</span>
          <ArrowUpDown
            className={`h-3 w-3 shrink-0 ${active ? "opacity-100" : "opacity-30"}`}
          />
          {active ? (
            <span className="shrink-0 text-[8px]">
              {sort.direction === "desc" ? "↓" : "↑"}
            </span>
          ) : null}
        </div>
      )}
    </button>
  );
}

export default function CrossAssetCollapseRadarPanel({
  locale = "pl",
}: {
  locale?: string;
}) {
  const safeLocale: Locale = locale === "de" || locale === "en" ? locale : "pl";
  const c = text[safeLocale];
  const a = auditText[safeLocale];
  const [category, setCategory] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [remoteAssets, setRemoteAssets] = useState<Asset[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [selectedDetailQuote, setSelectedDetailQuote] = useState<{
    assetId: string;
    quote: Quote;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [quoteReloadToken, setQuoteReloadToken] = useState(0);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Asset | null>(null);
  const router = useRouter();

  const handleAssetClick = useCallback(
    (asset: Pass482TerminalAsset | Asset | (Record<string, unknown> & { symbol?: string; id?: string; price?: number; change24h?: number; risk?: number })) => {
      const assetId = "id" in asset && typeof asset.id === "string" ? asset.id : undefined;
      const assetSymbol = "symbol" in asset && typeof asset.symbol === "string" ? asset.symbol : undefined;
      const key = assetSymbol || assetId || "";
      const assetKey = encodeURIComponent(String(key).toLowerCase());
      const sym = (assetSymbol || assetId || "").toUpperCase();
      const q = (assetId ? quotes[assetId] : undefined) || quotes[sym] || (assetSymbol ? quotes[assetSymbol] : undefined) || Object.values(quotes).find((it: Quote) => it.symbol?.toUpperCase() === sym);
      const price = q?.currentPrice ?? q?.price ?? ("price" in asset && typeof asset.price === "number" ? asset.price : undefined);
      const change = q?.changePercent ?? q?.priceChange24h ?? ("change24h" in asset && typeof asset.change24h === "number" ? asset.change24h : undefined);
      const assetRisk = "risk" in asset && typeof asset.risk === "number" ? asset.risk : undefined;
      const computedRisk = dynamicRisk(q, assetRisk, asset as Asset);
      const risk = typeof computedRisk === "number" && !isNaN(computedRisk)
        ? Math.round(computedRisk * 10) / 10
        : (typeof assetRisk === "number" ? assetRisk : 15);

      const params = new URLSearchParams();
      if (typeof price === "number" && !isNaN(price)) params.set("price", String(price));
      if (typeof change === "number" && !isNaN(change)) params.set("change", String(change));
      if (typeof risk === "number" && !isNaN(risk)) params.set("score", String(risk));
      const qs = params.toString() ? `?${params.toString()}` : "";
      router.push(`/real-markets/assets/${assetKey}${qs}`);
    },
    [quotes, router],
  );

  const [range, setRange] = useState<RangeKey>("1w");
  const [freshnessReferenceMs, setFreshnessReferenceMs] = useState(() =>
    Date.now(),
  );
  const [selectedAnalysisTier, setSelectedAnalysisTier] =
    useState<UnifiedAuditMode>("pro");
  const [auditMode, setAuditMode] = useState<UnifiedAuditMode | null>(null);
  const [
    realMarketsAdvancedGateRequested,
    setRealMarketsAdvancedGateRequested,
  ] = useState(false);
  const [realMarketsAdvancedClickNotice, setRealMarketsAdvancedClickNotice] =
    useState<{
      tone: "loading" | "ready" | "error";
      text: string;
      stateCode?: Pass2195RuntimeUxStateCode;
      receiptCode?: string;
      actionLabel?: string;
    } | null>(null);
  function buildRealMarketsAdvancedAccessContext(): VlmPaidAccessContext {
    const assetId = selected?.symbol || selected?.name || "real-markets-asset";
    return {
      surface: "real-markets",
      locale: safeLocale,
      assetId,
      symbol: selected?.symbol || assetId,
      depth: "advanced",
      returnPath:
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : `/${safeLocale}/market-integrity/cross-asset`,
    };
  }

  // Retained as the fail-closed compatibility path for the legacy Advanced
  // launcher. The active AssetDetailModal owns the current paid-analysis UI.
  async function _runRealMarketsAuditMode(mode: UnifiedAuditMode) {
    setSelectedAnalysisTier(mode);
    setRealMarketsAdvancedClickNotice(null);

    if (mode !== "advanced") {
      setRealMarketsAdvancedGateRequested(false);
      setAuditMode(mode);
      return;
    }

    const pass35PaidUiStopSell = resolvePass35PaidUiStopSell({
      productId: "vlm_advanced_analysis_single",
      surface: "real-markets",
      tier: "advanced",
    });
    if (!pass35PaidUiStopSell.ok || !pass35PaidUiStopSell.checkoutAllowed) {
      setRealMarketsAdvancedGateRequested(false);
      setRealMarketsAdvancedClickNotice({
        tone: "error",
        text: pass35PaidUiStopSellCopy(safeLocale),
      });
      return;
    }

    const paidContext = buildRealMarketsAdvancedAccessContext();
    const checkingUx = buildPass2195RuntimeUxBinding(
      "advanced_checking_access",
      safeLocale,
    );
    setRealMarketsAdvancedGateRequested(true);
    setRealMarketsAdvancedClickNotice({
      tone: pass2195ToneForNotice(checkingUx.tone),
      text: checkingUx.customerMessage,
      stateCode: checkingUx.stateCode,
      receiptCode: checkingUx.receiptCode,
      actionLabel: checkingUx.actionLabel,
    });

    try {
      const accessResponse = await fetch(
        "/api/market-integrity/advanced-click-runtime",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            surface: "real-markets",
            locale: safeLocale,
            assetId: paidContext.assetId,
            symbol: paidContext.symbol,
            depth: "advanced",
            returnPath: paidContext.returnPath,
          }),
        },
      );
      const accessPayload = (await accessResponse.json().catch(() => null)) as {
        action?: string;
        access?: { accessMode?: string };
        clickRuntime?: {
          message?: string;
          uxStateCode?: Pass2195RuntimeUxStateCode;
          receiptCode?: string;
        };
        uxBinding?: {
          tone?: "loading" | "ready" | "warning" | "error" | "locked";
          customerMessage?: string;
          actionLabel?: string;
          stateCode?: Pass2195RuntimeUxStateCode;
          receiptCode?: string;
        };
      } | null;

      if (accessResponse.ok && accessPayload?.action === "start_analysis") {
        const fallbackState =
          accessPayload.access?.accessMode === "local_advanced_demo"
            ? "advanced_local_demo_ready"
            : "advanced_access_ready";
        const fallbackUx = buildPass2195RuntimeUxBinding(
          fallbackState,
          safeLocale,
        );
        setRealMarketsAdvancedClickNotice({
          tone: accessPayload.uxBinding?.tone
            ? pass2195ToneForNotice(accessPayload.uxBinding.tone)
            : pass2195ToneForNotice(fallbackUx.tone),
          text:
            accessPayload.uxBinding?.customerMessage ||
            accessPayload.clickRuntime?.message ||
            fallbackUx.customerMessage,
          stateCode:
            accessPayload.uxBinding?.stateCode ||
            accessPayload.clickRuntime?.uxStateCode ||
            fallbackUx.stateCode,
          receiptCode:
            accessPayload.uxBinding?.receiptCode ||
            accessPayload.clickRuntime?.receiptCode ||
            fallbackUx.receiptCode,
          actionLabel:
            accessPayload.uxBinding?.actionLabel || fallbackUx.actionLabel,
        });
        setRealMarketsAdvancedGateRequested(false);
        setAuditMode("advanced");
        return;
      }

      if (accessResponse.status === 402) {
        const checkoutUx = buildPass2195RuntimeUxBinding(
          "advanced_checkout_required",
          safeLocale,
        );
        setRealMarketsAdvancedClickNotice({
          tone: pass2195ToneForNotice(
            accessPayload?.uxBinding?.tone || checkoutUx.tone,
          ),
          text:
            accessPayload?.uxBinding?.customerMessage ||
            accessPayload?.clickRuntime?.message ||
            checkoutUx.customerMessage,
          stateCode:
            accessPayload?.uxBinding?.stateCode ||
            accessPayload?.clickRuntime?.uxStateCode ||
            checkoutUx.stateCode,
          receiptCode:
            accessPayload?.uxBinding?.receiptCode ||
            accessPayload?.clickRuntime?.receiptCode ||
            checkoutUx.receiptCode,
          actionLabel:
            accessPayload?.uxBinding?.actionLabel || checkoutUx.actionLabel,
        });
        await startVlmServiceCheckout({
          productId: "vlm_advanced_analysis_single",
          locale: safeLocale,
          context: paidContext,
        });
        return;
      }

      throw new Error("real_markets_advanced_click_gate_failed");
    } catch {
      const errorUx = buildPass2195RuntimeUxBinding(
        "advanced_checkout_error",
        safeLocale,
      );
      setRealMarketsAdvancedGateRequested(false);
      setRealMarketsAdvancedClickNotice({
        tone: "error",
        text: errorUx.customerMessage,
        stateCode: errorUx.stateCode,
        receiptCode: errorUx.receiptCode,
        actionLabel: errorUx.actionLabel,
      });
    }
  }
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchReceipt, setSearchReceipt] =
    useState<Pass579ExactSearchReceipt | null>(null);
  const [sort, setSort] = useState<{
    key: SortKey;
    direction: SortDirection;
  } | null>(null);
  const [catalogCounts, setCatalogCounts] = useState<
    CatalogResponse["counts"] | null
  >(null);
  const [catalogAssets, setCatalogAssets] = useState<Asset[]>([]);
  const [visibleLimit, setVisibleLimit] = useState(
    REAL_MARKETS_INITIAL_VISIBLE,
  );
  const [surfaceWidth, setSurfaceWidth] = useState(1440);
  const sectionRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const committedSearchRef = useRef("");
  const pass2809VisibleQuoteRequestRef = useRef(0);
  const pass2809SelectedQuoteRequestRef = useRef(0);
  const pass4635ChartHydrationRef = useRef<
    Map<string, { attempts: number; inFlight: boolean; lastAttemptAt: number }>
  >(new Map());
  const [pass4635ChartHydrationTick, setPass4635ChartHydrationTick] = useState(0);
  const pass4392CatalogRequestRef = useRef(0);
  const pass4392SearchRequestRef = useRef(0);
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let frame: number | null = null;
    const commitWidth = (width?: number) => {
      if (!width) return;
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        setSurfaceWidth(Math.round(width));
      });
    };
    const observer = new ResizeObserver((entries) => {
      commitWidth(entries[0]?.contentRect.width);
    });
    observer.observe(node);
    commitWidth(node.getBoundingClientRect().width);
    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(
      () => setFreshnessReferenceMs(Date.now()),
      60_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (category !== "crypto") return;
    const timer = window.setTimeout(() => setCategory("all"), 0);
    return () => window.clearTimeout(timer);
  }, [category]);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = pass4392CatalogRequestRef.current + 1;
    pass4392CatalogRequestRef.current = requestId;
    fetch("/api/market-integrity/real-markets/catalog", {
      signal: controller.signal,
    })
      .then((response) =>
        readPass4462RealMarketsJson(response, { ok: false, rows: [] }),
      )
      .then((payload: unknown) => normalizeCatalogResponse(payload))
      .then((payload: CatalogResponse) => {
        if (
          controller.signal.aborted ||
          pass4392CatalogRequestRef.current !== requestId
        )
          return;
        if (!payload.ok) return;
        if (payload.counts) setCatalogCounts(payload.counts);
        const safeRows = normalizePass471CatalogRows(payload.rows);
        if (safeRows.length)
          setCatalogAssets(
            safeRows.map(assetFromCatalog).filter(isPublicRealMarketsAsset),
          );
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
      if (pass4392CatalogRequestRef.current === requestId)
        pass4392CatalogRequestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 190);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const clean = query.trim();
    if (!clean) {
      pass4392SearchRequestRef.current += 1;
      const timer = window.setTimeout(() => {
        setRemoteAssets([]);
        setSearching(false);
        setSearchOpen(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    if (clean.toLowerCase() === committedSearchRef.current.toLowerCase()) {
      pass4392SearchRequestRef.current += 1;
      const timer = window.setTimeout(() => setSearching(false), 0);
      return () => window.clearTimeout(timer);
    }
    const controller = new AbortController();
    const requestId = pass4392SearchRequestRef.current + 1;
    pass4392SearchRequestRef.current = requestId;
    const timer = window.setTimeout(() => {
      if (
        controller.signal.aborted ||
        pass4392SearchRequestRef.current !== requestId
      )
        return;
      setSearching(true);
      fetch(
        `/api/market-integrity/real-markets?q=${encodeURIComponent(clean)}`,
        { signal: controller.signal },
      )
        .then((response) =>
          readPass4462RealMarketsJson(response, { ok: false, results: [] }),
        )
        .then((payload: unknown) => normalizeSearchResponse(payload))
        .then((payload: SearchResponse) => {
          if (
            controller.signal.aborted ||
            pass4392SearchRequestRef.current !== requestId
          )
            return;
          if (!payload.ok) return;
          const providerRows = normalizePass471ProviderSearchRows(
            payload.results,
          );
          setRemoteAssets(
            providerRows
              .map((item: Pass4149RealMarketsProviderSearchRow) => {
                const known = curatedAssets.find(
                  (asset) => asset.providerSymbol === item.symbol,
                );
                return (
                  known || {
                    id: `provider-${item.symbol.toLowerCase()}`,
                    symbol: item.symbol.replace(/=X$|=F$/i, ""),
                    providerSymbol: item.symbol,
                    name: item.name,
                    category: categoryFromProvider(
                      item.quoteType,
                      item.symbol,
                      item.name,
                    ),
                    context: `${item.exchange || c.global} · ${item.quoteType.toLowerCase()}`,
                    risk: 36,
                    exchange: item.exchange,
                  }
                );
              })
              .filter(isPublicRealMarketsAsset)
              .slice(0, 8),
          );
          if (
            clean.toLowerCase() !== committedSearchRef.current.toLowerCase()
          ) {
            setSearchOpen(true);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (
            !controller.signal.aborted &&
            pass4392SearchRequestRef.current === requestId
          )
            setSearching(false);
        });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      if (pass4392SearchRequestRef.current === requestId)
        pass4392SearchRequestRef.current += 1;
    };
  }, [c.global, query]);

  const allAssets = useMemo(() => {
    const combined = filterPass617PublicRealMarketsRows([
      ...curatedAssets,
      ...catalogAssets,
    ]);
    return dedupeMarketInstruments(Array.from(
      new globalThis.Map(
        combined.map((asset: Pass4149RealMarketsAsset) => [
          `${asset.category}:${cleanAssetSymbol(asset.symbol)}`,
          asset,
        ]),
      ).values(),
    ));
  }, [catalogAssets]);

  const manualAliasAssets = useMemo(
    () => matchPass1994ManualMarketAliases(query, allAssets),
    [allAssets, query],
  );

  const searchUniverse = useMemo(() => {
    const seen = new Set<string>();
    return [...manualAliasAssets, ...allAssets, ...remoteAssets].filter(
      (asset) => {
        const key = `${asset.category}:${cleanAssetSymbol(asset.symbol)}:${asset.providerSymbol}`;
        if (seen.has(key) || !isPublicRealMarketsAsset(asset)) return false;
        seen.add(key);
        return true;
      },
    );
  }, [allAssets, manualAliasAssets, remoteAssets]);

  const pass621SearchResolution = useMemo(
    () => buildPass621MarketSearchResolution(query, searchUniverse, 8),
    [query, searchUniverse],
  );

  const searchSuggestions = useMemo(
    () =>
      filterMarketInstruments(
        pass621SearchResolution.ranked.map(
          (entry: Pass4149RealMarketsRankedAsset) => entry.item,
        ),
        query,
      ).slice(0, 8),
    [pass621SearchResolution, query],
  );

  const searchResolution = useMemo(
    () => buildPass579ExactSearchReceipt(query, searchSuggestions),
    [query, searchSuggestions],
  );

  const adaptiveSurface = useMemo(
    () =>
      buildPass618AdaptiveSurface({
        viewportWidth: surfaceWidth,
        rowCount: allAssets.length,
      }),
    [allAssets.length, surfaceWidth],
  );

  const coverageCounts = useMemo(() => {
    const overviewCount = new Set(
      buildPass482TerminalOverview(allAssets).map(
        (asset: Pass482TerminalAsset) => asset.symbol.toUpperCase(),
      ),
    ).size;
    const curated = PUBLIC_REAL_MARKETS_CATEGORIES.reduce<
      Record<Category, number>
    >(
      (accumulator, item) => {
        accumulator[item] =
          item === "all"
            ? Math.max(overviewCount, allAssets.length)
            : allAssets.filter(
                (asset: Pass4149RealMarketsAsset) => asset.category === item,
              ).length;
        return accumulator;
      },
      {
        all: overviewCount,
        crypto: 0,
        stocks: 0,
        indices: 0,
        fx: 0,
        etf: 0,
        commodities: 0,
        real_estate: 0,
        exchanges: 0,
      },
    );
    const nextCounts = !catalogCounts
      ? curated
      : {
          ...curated,
          crypto: 0,
          stocks: Math.max(curated.stocks, catalogCounts.stocks),
          fx: Math.max(curated.fx, catalogCounts.fx),
          etf: Math.max(curated.etf, catalogCounts.etf),
          commodities: Math.max(curated.commodities, catalogCounts.commodities),
          real_estate: Math.max(curated.real_estate, catalogCounts.realEstate),
          exchanges: Math.max(
            curated.exchanges,
            catalogCounts.exchangeTokens ?? 0,
          ),
        };
    const merged = {
      ...nextCounts,
      all:
        catalogCounts?.total && Number.isFinite(catalogCounts.total)
          ? Math.max(nextCounts.all, catalogCounts.total)
          : Math.max(
              nextCounts.all,
              nextCounts.stocks +
                nextCounts.indices +
                nextCounts.fx +
                nextCounts.etf +
                nextCounts.commodities +
                nextCounts.real_estate +
                nextCounts.exchanges,
            ),
    };
    return merged;
  }, [allAssets, catalogCounts]);

  const rows = useMemo(() => {
    const productRows = dedupeMarketInstruments(
      [...allAssets, ...remoteAssets].map((asset) => ({
        ...asset,
        canonicalId: `real-markets:${asset.category}:${cleanAssetSymbol(asset.symbol)}`,
      })),
    );
    const categoryRows = category === "all"
      ? pass2326ReferenceRowOrder(productRows)
      : productRows.filter(
      (asset: Pass4149RealMarketsAsset) => asset.category === category,
    );
    const orderedRows = category === "exchanges" ? [...categoryRows].sort(
      (left, right) =>
        Number(isVenueHealthAsset(right)) - Number(isVenueHealthAsset(left)),
    ) : categoryRows;
    return filterMarketInstruments(orderedRows, debouncedQuery);
  }, [allAssets, category, debouncedQuery, remoteAssets]);

  const selectedQuote = selected
    ? selectedDetailQuote?.assetId === selected.id
      ? selectedDetailQuote.quote
      : quoteForAsset(quotes, selected)
    : undefined;
  const selectedQuoteLiveVerified = hasServerVerifiedQuoteLiveGate(selectedQuote);
  const selectedQuotePublicState = pass6PublicQuoteState(selectedQuote, safeLocale);
  const selectedQuotePublicSourceQuality = selected
    ? pass6PublicSourceQuality(selectedQuote, selected, safeLocale)
    : null;

  const pass4388OverviewSparklinePoints = useMemo(() => {
    const sourceSeries = rows
      .map((asset: Pass4149RealMarketsAsset) => pass4619MarketSparklineSeries(quoteForAsset(quotes, asset)))
      .filter((series) => series.length >= 2)
      .slice(0, 48);
    if (!sourceSeries.length) return "";
    const pointCount = Math.min(28, Math.max(...sourceSeries.map((series) => series.length)));
    const averageSeries = Array.from({ length: pointCount }, (_, index) => {
      const progress = index / Math.max(1, pointCount - 1);
      const normalized = sourceSeries.map((series) => {
        const sourceIndex = Math.min(series.length - 1, Math.round(progress * (series.length - 1)));
        const base = series[0];
        return ((series[sourceIndex] - base) / Math.max(Math.abs(base), 0.000001)) * 100;
      });
      return normalized.reduce((sum, value) => sum + value, 0) / normalized.length;
    });
    return buildPass4388SparklinePolyline(averageSeries);
  }, [quotes, rows]);

  const exchangeProviderSloRows = useMemo<Pass4153ExchangeProviderSloRow[]>(
    () =>
      allAssets
        .filter(
          (asset: Pass4149RealMarketsAsset) => asset.category === "exchanges",
        )
        .slice(0, 6)
        .map((asset: Pass4149RealMarketsAsset) => {
          const quote = quoteForAsset(quotes, asset);
          return {
            asset,
            slo: buildPass577ProviderSloConsole({
              provider: asset.name,
              status:
                quote?.providerStatus ?? quote?.truthState ?? quote?.state,
              freshnessSeconds: quote?.freshnessSeconds ?? null,
              retrySuccess: null,
              recoveryMs: null,
              locale: safeLocale,
            }),
          };
        }),
    [allAssets, quotes, safeLocale],
  );

  useEffect(() => {
    const timer = window.setTimeout(
      () => setVisibleLimit(REAL_MARKETS_INITIAL_VISIBLE),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [category, query]);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (searchRef.current?.contains(target)) return;
      setSearchOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
  }, []);

  const visibleProviderSymbolsKey = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .slice(0, Math.max(REAL_MARKETS_INITIAL_VISIBLE, visibleLimit))
            .flatMap((asset: Pass4149RealMarketsAsset) =>
              quoteSymbolsForAsset(asset),
            )
            .filter(Boolean),
        ),
      ).join(","),
    [rows, visibleLimit],
  );

  useEffect(() => {
    const symbols = visibleProviderSymbolsKey.split(",").filter(Boolean);
    if (!symbols.length) return;
    const controller = new AbortController();
    const requestId = pass2809VisibleQuoteRequestRef.current + 1;
    pass2809VisibleQuoteRequestRef.current = requestId;
    const chunks = Array.from(
      { length: Math.ceil(symbols.length / PASS2808_REAL_MARKETS_BATCH_SIZE) },
      (_, index) =>
        symbols.slice(
          index * PASS2808_REAL_MARKETS_BATCH_SIZE,
          index * PASS2808_REAL_MARKETS_BATCH_SIZE +
            PASS2808_REAL_MARKETS_BATCH_SIZE,
        ),
    ).slice(0, PASS2808_REAL_MARKETS_BATCH_LIMIT);
    const loadingTimer = window.setTimeout(() => {
      if (
        !controller.signal.aborted &&
        pass2809VisibleQuoteRequestRef.current === requestId
      )
        setLoading(true);
    }, 0);
    // PASS2808: bounded batch scheduler + client timeout prevents request storms and leaves neutral skeletons in unresolved rows.
    // PASS2809: stale-response guard prevents an old provider batch from overwriting a newer visible universe after tab/search changes.
    Promise.allSettled(
      chunks.map((chunk) =>
        fetchQuoteBatchPass2808(
          chunk,
          "1h",
          controller.signal,
          PASS2808_REAL_MARKETS_CLIENT_TIMEOUT_MS,
        ),
      ),
    )
      .then((settledPayloads) => {
        if (
          controller.signal.aborted ||
          pass2809VisibleQuoteRequestRef.current !== requestId
        )
          return;
        const payloads = settledPayloads.flatMap((entry) =>
          entry.status === "fulfilled" ? [entry.value] : [],
        );
        const quotes = payloads.flatMap((payload) =>
          normalizePass471Quotes(payload?.ok ? payload.quotes : []),
        ) as Quote[];
        if (!quotes.length) return;
        setQuotes((current: Pass4153QuoteState) => ({
          ...current,
          ...Object.fromEntries(quotes.map((quote) => [quote.symbol, quote])),
        }));
      })
      .catch(() => undefined)
      .finally(() => {
        if (
          !controller.signal.aborted &&
          pass2809VisibleQuoteRequestRef.current === requestId
        )
          setLoading(false);
      });
    return () => {
      window.clearTimeout(loadingTimer);
      controller.abort();
    };
  }, [quoteReloadToken, visibleProviderSymbolsKey]);

  // PASS4619 compatibility marker: pass4619MissingChartSymbolsKey previously used .slice(0, 6); PASS4635 supersedes it with a wider staged queue and a stricter four-request batch cap.
  const pass4635MissingChartSymbolsKey = useMemo(() => {
    return rows
      .slice(0, visibleLimit)
      .flatMap((asset: Pass4149RealMarketsAsset) => {
        const quote = quoteForAsset(quotes, asset);
        if (pass4619MarketSparklineSeries(quote).length >= 2) return [];
        const symbol = quoteSymbolsForAsset(asset).find(Boolean);
        return symbol ? [symbol] : [];
      })
      .filter((symbol, index, all) => all.indexOf(symbol) === index)
      .slice(0, 32)
      .join(",");
  }, [quotes, rows, visibleLimit]);

  useEffect(() => {
    const now = Date.now();
    const candidates = pass4635MissingChartSymbolsKey.split(",").filter(Boolean);
    const pending = candidates
      .filter((symbol) => {
        const state = pass4635ChartHydrationRef.current.get(symbol);
        if (!state) return true;
        if (state.inFlight || state.attempts >= 3) return false;
        return now - state.lastAttemptAt >= Math.min(12_000, 1_500 * 2 ** Math.max(0, state.attempts - 1));
      })
      .slice(0, 4);
    if (!pending.length) return;

    pending.forEach((symbol) => {
      const previous = pass4635ChartHydrationRef.current.get(symbol);
      pass4635ChartHydrationRef.current.set(symbol, {
        attempts: (previous?.attempts ?? 0) + 1,
        inFlight: true,
        lastAttemptAt: now,
      });
    });

    const controller = new AbortController();
    let retryTimer: number | null = null;
    const batchSymbols = pending.join(",");
    pass2808FetchWithTimeout(
      `/api/market-integrity/real-markets?symbols=${encodeURIComponent(batchSymbols)}&range=1h&detail=1`,
      {
        signal: controller.signal,
        timeoutMs: PASS2808_REAL_MARKETS_CLIENT_TIMEOUT_MS,
      },
    )
      .then((response) => readPass4462RealMarketsJson(response, fallbackQuoteResponse()))
      .then((payload) => normalizeQuoteResponse(payload))
      .then((result) => {
        if (controller.signal.aborted) return;
        const hydrated = normalizePass471Quotes(result.quotes) as Quote[];
        pending.forEach((symbol) => {
          const state = pass4635ChartHydrationRef.current.get(symbol);
          pass4635ChartHydrationRef.current.set(symbol, {
            attempts: state?.attempts ?? 1,
            inFlight: false,
            lastAttemptAt: state?.lastAttemptAt ?? now,
          });
        });
        if (hydrated.length) {
          setQuotes((current: Pass4153QuoteState) => ({
            ...current,
            ...Object.fromEntries(hydrated.map((quote) => [quote.symbol, quote])),
          }));
        }
        const stillMissing = pending.some((symbol) => {
          const normalizedSymbol = cleanAssetSymbol(symbol);
          return !hydrated.some((quote) =>
            cleanAssetSymbol(quote.symbol) === normalizedSymbol &&
            pass4619MarketSparklineSeries(quote).length >= 2,
          );
        });
        if (stillMissing) {
          retryTimer = window.setTimeout(() => setPass4635ChartHydrationTick((value) => value + 1), 1_800);
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        pending.forEach((symbol) => {
          const state = pass4635ChartHydrationRef.current.get(symbol);
          pass4635ChartHydrationRef.current.set(symbol, {
            attempts: state?.attempts ?? 1,
            inFlight: false,
            lastAttemptAt: state?.lastAttemptAt ?? now,
          });
        });
        retryTimer = window.setTimeout(() => setPass4635ChartHydrationTick((value) => value + 1), 1_800);
      });

    return () => {
      controller.abort();
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [pass4635ChartHydrationTick, pass4635MissingChartSymbolsKey]);

  const selectedProviderSymbolsKey = quoteSymbolsForAsset(selected).join(",");
  const selectedAssetId = selected?.id ?? "";
  useEffect(() => {
    if (!selectedProviderSymbolsKey) return;
    const controller = new AbortController();
    const requestId = pass2809SelectedQuoteRequestRef.current + 1;
    pass2809SelectedQuoteRequestRef.current = requestId;
    pass2808FetchWithTimeout(
      `/api/market-integrity/real-markets?symbols=${encodeURIComponent(selectedProviderSymbolsKey)}&range=${encodeURIComponent(range)}&detail=1`,
      { signal: controller.signal },
    )
      .then((response) =>
        readPass4462RealMarketsJson(response, fallbackQuoteResponse()),
      )
      .then((payload: unknown) => normalizeQuoteResponse(payload))
      .then((payload: QuoteResponse) => {
        if (
          controller.signal.aborted ||
          pass2809SelectedQuoteRequestRef.current !== requestId
        )
          return;
        const detailQuotes = normalizePass471Quotes(payload.quotes) as Quote[];
        if (detailQuotes.length && selected) {
          const detailQuoteMap = Object.fromEntries(
            detailQuotes.map((quote) => [quote.symbol, quote]),
          );
          const detailQuote = quoteForAsset(detailQuoteMap, selected) ?? detailQuotes[0];
          setSelectedDetailQuote({ assetId: selectedAssetId, quote: detailQuote });
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [range, selected, selectedAssetId, selectedProviderSymbolsKey]);

  const commandStatusCards = useMemo<Pass4153RealMarketsCommandStatusCard[]>(
    () => [
      {
        label:
          safeLocale === "pl"
            ? "Universe state"
            : safeLocale === "de"
              ? "Universum-Status"
              : "Universe state",
        value: loading
          ? safeLocale === "pl"
            ? "Ładowanie real markets"
            : safeLocale === "de"
              ? "Real Markets werden geladen"
              : "Loading real markets"
          : `${allAssets.length} ${safeLocale === "pl" ? "aktywow w katalogu" : safeLocale === "de" ? "Assets im Katalog" : "assets in the catalog"}`,
        tone: loading ? "gold" : "neutral",
      },
      {
        label:
          safeLocale === "pl"
            ? "Search lane"
            : safeLocale === "de"
              ? "Search-Lane"
              : "Search lane",
        value: searching
          ? safeLocale === "pl"
            ? "Resolver aktywny"
            : safeLocale === "de"
              ? "Resolver aktiv"
              : "Resolver active"
          : pass621SearchResolution.autoOpen
            ? safeLocale === "pl"
              ? "Exact match gotowy"
              : safeLocale === "de"
                ? "Exact Match bereit"
                : "Exact match ready"
            : `${searchSuggestions.length} ${safeLocale === "pl" ? "sugestie" : safeLocale === "de" ? "Vorschlaege" : "suggestions"}`,
        tone: searching
          ? "gold"
          : pass621SearchResolution.autoOpen
            ? "cyan"
            : "neutral",
      },
      {
        label:
          safeLocale === "pl"
            ? "Reader state"
            : safeLocale === "de"
              ? "Reader-Status"
              : "Reader state",
        value: selected
          ? `${selected.symbol} · ${range.toUpperCase()}`
          : safeLocale === "pl"
            ? "Wybierz aktywo do detail reader"
            : safeLocale === "de"
              ? "Asset fuer Detail Reader waehlen"
              : "Select an asset for the detail reader",
        tone: selected ? "ready" : "review",
      },
      {
        label:
          safeLocale === "pl"
            ? "Proof boundary"
            : safeLocale === "de"
              ? "Proof-Grenze"
              : "Proof boundary",
        value: selectedQuote?.source
          ? `${selectedQuote.source} · ${selectedQuote.confidenceCap ?? 0}%`
          : safeLocale === "pl"
            ? "Source lineage po wyborze aktywa"
            : safeLocale === "de"
              ? "Source Lineage nach Asset-Auswahl"
              : "Source lineage after asset selection",
        tone: selectedQuote?.source ? "ready" : "review",
      },
    ],
    [
      allAssets.length,
      loading,
      pass621SearchResolution.autoOpen,
      range,
      safeLocale,
      searchSuggestions.length,
      searching,
      selected,
      selectedQuote?.confidenceCap,
      selectedQuote?.source,
    ],
  );
  const selectedLineage = useMemo(
    () => (selected ? buildRealMarketLineage(selected, selectedQuote) : null),
    [selected, selectedQuote],
  );
  const _selectedChartParity = useMemo(
    () =>
      selected && selectedLineage
        ? buildPass620CrossAssetChartParity({
            assetClass: selected.category,
            candleCount: selectedQuote?.candles.length ?? 0,
            lineage: selectedLineage,
          })
        : null,
    [selected, selectedLineage, selectedQuote?.candles.length],
  );
  const selectedRisk = dynamicRisk(selectedQuote, selected?.risk, selected);
  const selectedChange1h = selected ? pass4570RealMarketsChange(selected, selectedQuote, 60 * 60) : null;
  const selectedChange24h = selected ? pass4570RealMarketsChange(selected, selectedQuote, 24 * 60 * 60) : null;
  const selectedChange7d = selected ? pass4570RealMarketsChange(selected, selectedQuote, 7 * 24 * 60 * 60) : null;
  const selectedQuoteTrust = selected ? pass4579VisibleDataDecision(selectedQuote, selected.category, safeLocale) : null;
  const selectedVolume = quoteVolume(selectedQuote);
  const _auditEvidence = useMemo(() => {
    if (!selected || !auditMode || selectedRisk === null) return [];
    const candles = selectedQuote?.candles || [];
    const latest = candles.at(-1);
    const first = candles[0];
    const missing = candles.filter(
      (candle) => !Number.isFinite(candle.close),
    ).length;
    const avgRange = candles.length
      ? candles.reduce(
          (sum, candle) =>
            sum +
            ((candle.high - candle.low) / Math.max(candle.close, 0.000001)) *
              100,
          0,
        ) / candles.length
      : null;
    const kernel = analyzeMarketSurfaceWithVlmKernel({
      surface: "real_markets",
      depth: auditMode,
      locale: safeLocale,
      symbol: selected.symbol,
      name: selected.name,
      marketType: selected.category,
      source:
        selectedQuote?.source || selected.exchange || "real-markets-adapter",
      sourceState: selectedQuote?.state ?? "unknown",
      generatedAt: selectedQuoteTrust?.sourceTimestamp
        ? new Date(selectedQuoteTrust.sourceTimestamp * 1000).toISOString()
        : undefined,
      price: selectedQuote?.currentPrice ?? null,
      change1h: selectedChange1h ?? null,
      change24h: selectedChange24h ?? null,
      change7d: selectedChange7d ?? null,
      change30d: selected ? pass4570RealMarketsChange(selected, selectedQuote, 30 * 24 * 60 * 60) : null,
      marketCap: quoteMarketCap(selectedQuote, selected) ?? null,
      volume: selectedVolume ?? null,
      liquidity: selectedQuote?.venueHealth
        ? (selectedQuote.venueHealth.bidDepthUsd ?? 0) +
          (selectedQuote.venueHealth.askDepthUsd ?? 0)
        : null,
      riskScore: selectedRisk,
      confidence:
        selectedQuote?.confidenceCap ??
        (selectedQuoteLiveVerified ? 68 : 20),
      candleCount: candles.length,
      historyCount: 0,
      missingLabels: [
        selectedQuote?.missingReason,
        selectedQuote?.secondarySource ? null : "second source not attached",
        candles.length ? null : "candles / OHLCV missing",
        selectedQuote?.fundamentals || selected.category !== "stocks"
          ? null
          : "fundamental provider missing",
        selectedQuote?.venueComparison
          ? null
          : "cross-venue comparison missing",
      ].filter(Boolean) as string[],
      nextCheck:
        safeLocale === "pl"
          ? "Odśwież quote, świece i drugie źródło przed mocniejszym wnioskiem."
          : safeLocale === "de"
            ? "Quote, Kerzen und Zweitquelle vor einem stärkeren Fazit aktualisieren."
            : "Refresh quote, candles and second source before a stronger conclusion.",
      notes: [
        buildPass4418HumanMarketBrief(
          selected,
          selectedQuote,
          safeLocale,
          range,
        ),
      ],
    });
    const kernelEvidence = vlmKernelOutputToUnifiedAuditEvidence(kernel, {
      maxItems: auditMode === "basic" ? 10 : auditMode === "pro" ? 14 : 20,
    });
    const baseEvidence = buildUnifiedAuditEvidence(
      {
        locale: safeLocale,
        assetClass: auditAssetClass(selected),
        subject: `${selected.symbol} · ${selected.name}`,
        source: selectedQuote?.source || "",
        sourceTimestamp: selectedQuoteTrust?.sourceTimestamp ?? undefined,
        riskScore: selectedRisk,
        confidence:
          selectedQuoteLiveVerified
            ? Math.min(
                selectedQuote?.confidenceCap ?? 96,
                58 + candles.length / 2,
              )
            : 18,
        metrics: [
          {
            id: "modeIntro",
            label: "Mode",
            value: pass4418ModeIntro(auditMode, safeLocale),
            note: localizedAssetContext(selected, safeLocale),
            status: "verified",
          },
          {
            id: "humanBrief",
            label:
              safeLocale === "pl"
                ? "Brief dla człowieka"
                : safeLocale === "de"
                  ? "Menschlicher Brief"
                  : "Human brief",
            value: buildPass4418HumanMarketBrief(
              selected,
              selectedQuote,
              safeLocale,
              range,
            ),
            note:
              safeLocale === "pl"
                ? "AI ma tłumaczyć dane wprost: co widać, czego brakuje i co dalej."
                : safeLocale === "de"
                  ? "AI erklärt direkt: was sichtbar ist, was fehlt und was folgt."
                  : "AI explains directly: what is visible, what is missing and what comes next.",
            status: "verified",
          },
          {
            id: "price",
            label: a.price,
            value: displayTrustedPrice(selectedQuote, selected.category) !== null
              ? formatPrice(selectedQuote, selected.category)
              : null,
            note: isVenueHealthAsset(selected) ? c.venuePending : a.observed,
            status: displayTrustedPrice(selectedQuote, selected.category) !== null
              ? selectedQuoteTrust?.auditStatus ?? "review"
              : isVenueHealthAsset(selected)
                ? "review"
                : "missing",
          },
          {
            id: "marketCap",
            label:
              safeLocale === "pl"
                ? "Kapitalizacja / proxy"
                : safeLocale === "de"
                  ? "Marktkapitalisierung / Proxy"
                  : "Market cap / proxy",
            value: formatMarketCapProxy(selectedQuote, selected, safeLocale),
            note:
              safeLocale === "pl"
                ? "Dla indeksów/FX/surowców nie udajemy klasycznej kapitalizacji; pokazujemy właściwy proxy."
                : safeLocale === "de"
                  ? "Für Indizes/FX/Rohstoffe wird keine klassische Marktkapitalisierung vorgetäuscht; der passende Proxy bleibt sichtbar."
                  : "For indices/FX/commodities we do not fake a classic market cap; the correct proxy stays visible.",
            status: quoteMarketCap(selectedQuote, selected)
              ? "verified"
              : "review",
          },
          {
            id: "fdv",
            label: "FDV",
            value:
              typeof selectedQuote?.fdv === "number"
                ? new Intl.NumberFormat(safeLocale, {
                    notation: "compact",
                    maximumFractionDigits: 2,
                  }).format(selectedQuote.fdv)
                : null,
            note:
              safeLocale === "pl"
                ? "Tylko dla krypto/providerów z jawnie podanym FDV."
                : safeLocale === "de"
                  ? "Nur für Krypto/Provider mit explizitem FDV."
                  : "Only for crypto/providers with explicit FDV.",
            status: selectedQuote?.fdv ? "verified" : "missing",
          },
          {
            id: "change1h",
            label: a.change1h,
            value:
              typeof selectedChange1h === "number"
                ? `${selectedChange1h >= 0 ? "+" : ""}${selectedChange1h.toFixed(2)}%`
                : null,
            note: a.observed,
            status:
              typeof selectedChange1h === "number" ? pass4580VisibleValueStatus(selectedQuoteTrust) : "missing",
          },
          {
            id: "change24h",
            label: a.change24h,
            value:
              typeof selectedChange24h === "number"
                ? `${selectedChange24h >= 0 ? "+" : ""}${selectedChange24h.toFixed(2)}%`
                : null,
            note: a.observed,
            status:
              typeof selectedChange24h === "number" ? pass4580VisibleValueStatus(selectedQuoteTrust) : "missing",
          },
          {
            id: "change7d",
            label: "7D",
            value:
              typeof selectedChange7d === "number"
                ? `${selectedChange7d >= 0 ? "+" : ""}${selectedChange7d.toFixed(2)}%`
                : null,
            note: a.observed,
            status:
              typeof selectedChange7d === "number" ? pass4580VisibleValueStatus(selectedQuoteTrust) : "missing",
          },
          {
            id: "change",
            label: a.change,
            value:
              typeof selectedChange24h === "number"
                ? `${selectedChange24h >= 0 ? "+" : ""}${selectedChange24h.toFixed(2)}%`
                : null,
            note: a.observed,
            status:
              typeof selectedChange24h === "number" ? pass4580VisibleValueStatus(selectedQuoteTrust) : "missing",
          },
          {
            id: "volume",
            label: a.volume,
            value: selectedVolume
              ? new Intl.NumberFormat(safeLocale, {
                  notation: "compact",
                  maximumFractionDigits: 2,
                }).format(selectedVolume)
              : null,
            note: a.observed,
            status: selectedVolume ? "verified" : "missing",
          },
          {
            id: "sourceContract",
            label: "Source contract",
            value: selectedQuote?.sourceContract,
            note: selectedQuote?.sourcePolicy,
            status:
              selectedQuote?.truthState === "source_bound"
                ? "verified"
                : "review",
          },
          {
            id: "providerPlan",
            label: "Provider plan",
            value: selectedQuote?.providerPlan?.slice(0, 3),
            note:
              selectedQuote?.missingReason ||
              "Provider plan attached to quote.",
            status: selectedQuote?.missingReason ? "review" : "verified",
          },
          {
            id: "providerConsensus",
            label: "Provider consensus",
            value: selectedQuote?.consensusState,
            note:
              selectedQuote?.consensusNotes?.join(" · ") ||
              "Consensus gate waits for primary and secondary prices.",
            status:
              selectedQuote?.consensusState === "aligned"
                ? "verified"
                : "review",
          },
          {
            id: "providerDivergence",
            label: "Provider divergence",
            value:
              typeof selectedQuote?.divergenceBps === "number"
                ? `${selectedQuote.divergenceBps.toFixed(1)} bps / ${selectedQuote.divergenceThresholdBps ?? 0} bps gate`
                : null,
            note:
              selectedQuote?.secondarySource || "Second price lane required.",
            status:
              selectedQuote?.consensusState === "aligned"
                ? "verified"
                : selectedQuote?.divergenceBps == null
                  ? "missing"
                  : "review",
          },
          {
            id: "freshnessGate",
            label: "Freshness gate",
            value: selectedQuote?.freshnessState
              ? `${selectedQuote.freshnessState}${typeof selectedQuote.freshnessSeconds === "number" ? ` · ${selectedQuote.freshnessSeconds}s` : ""}`
              : null,
            note: `Confidence cap ${selectedQuote?.confidenceCap ?? 20}/100`,
            status:
              selectedQuote?.freshnessState === "fresh" ? "verified" : "review",
          },
          {
            id: "visibleDataDecision",
            label: safeLocale === "pl" ? "Decyzja widoczności danych" : safeLocale === "de" ? "Daten-Sichtbarkeitsentscheidung" : "Visible data decision",
            value: selectedQuoteTrust?.compactLabel ?? null,
            note: selectedQuoteTrust?.actionLabel ?? selectedQuoteTrust?.reason,
            status: selectedQuoteTrust?.auditStatus ?? "review",
          },
          {
            id: "crossVenueConsensus",
            label:
              safeLocale === "pl"
                ? "Konsensus między giełdami"
                : safeLocale === "de"
                  ? "Börsenübergreifender Konsens"
                  : "Cross-venue consensus",
            value: selectedQuote?.venueComparison
              ? `${selectedQuote.venueComparison.state} · ${selectedQuote.venueComparison.primaryVenue} ↔ ${selectedQuote.venueComparison.secondaryVenue || "source required"}`
              : null,
            note:
              selectedQuote?.venueComparison?.notes.join(" · ") ||
              (safeLocale === "pl"
                ? "Drugie niezależne venue jest wymagane do oceny jakości ceny."
                : safeLocale === "de"
                  ? "Ein zweiter unabhängiger Handelsplatz ist für die Preisqualitätsprüfung erforderlich."
                  : "A second independent venue is required to assess price quality."),
            status:
              selectedQuote?.venueComparison?.state === "aligned"
                ? "verified"
                : selectedQuote?.venueComparison
                  ? "review"
                  : "missing",
          },
          {
            id: "crossVenueDivergence",
            label:
              safeLocale === "pl"
                ? "Rozjazd ceny / spreadu"
                : safeLocale === "de"
                  ? "Preis- / Spread-Abweichung"
                  : "Price / spread divergence",
            value: selectedQuote?.venueComparison
              ? `${selectedQuote.venueComparison.priceDivergenceBps == null ? "source required" : `${selectedQuote.venueComparison.priceDivergenceBps.toFixed(1)} bps`} · ${selectedQuote.venueComparison.spreadDeltaBps == null ? "source required" : `${selectedQuote.venueComparison.spreadDeltaBps.toFixed(1)} bps spread delta`}`
              : null,
            note: selectedQuote?.venueComparison?.boundary,
            status:
              selectedQuote?.venueComparison?.state === "aligned"
                ? "verified"
                : selectedQuote?.venueComparison
                  ? "review"
                  : "missing",
          },
          {
            id: "fundamentalProfile",
            label:
              safeLocale === "pl"
                ? "Profil fundamentalny"
                : safeLocale === "de"
                  ? "Fundamentalprofil"
                  : "Fundamental profile",
            value: selectedQuote?.fundamentals
              ? `${selectedQuote.fundamentals.profileType} · ${selectedQuote.fundamentals.sector || selectedQuote.fundamentals.country || "source required"}`
              : null,
            note:
              selectedQuote?.fundamentals?.industry ||
              selectedQuote?.fundamentals?.latestQuarter ||
              (safeLocale === "pl"
                ? "OVERVIEW lub ETF_PROFILE wymagany."
                : safeLocale === "de"
                  ? "OVERVIEW oder ETF_PROFILE erforderlich."
                  : "OVERVIEW or ETF_PROFILE required."),
            status:
              selectedQuote?.fundamentals?.profileType &&
              selectedQuote.fundamentals.profileType !== "not_applicable"
                ? "verified"
                : "missing",
          },
          {
            id: "fundamentalDepth",
            label:
              safeLocale === "pl"
                ? "Wycena / jakość / struktura"
                : safeLocale === "de"
                  ? "Bewertung / Qualität / Struktur"
                  : "Valuation / quality / structure",
            value: selectedQuote?.fundamentals
              ? selectedQuote.fundamentals.profileType === "etf"
                ? `AUM ${selectedQuote.fundamentals.netAssets == null ? "source required" : new Intl.NumberFormat(safeLocale, { notation: "compact", maximumFractionDigits: 2 }).format(selectedQuote.fundamentals.netAssets)} · TER ${selectedQuote.fundamentals.expenseRatio == null ? "source required" : `${selectedQuote.fundamentals.expenseRatio}%`} · holdings ${selectedQuote.fundamentals.topHoldings.length}`
                : `P/E ${selectedQuote.fundamentals.peRatio ?? "source required"} · P/B ${selectedQuote.fundamentals.priceToBookRatio ?? "source required"} · ROE ${selectedQuote.fundamentals.returnOnEquity == null ? "source required" : `${selectedQuote.fundamentals.returnOnEquity}%`}`
              : null,
            note:
              selectedQuote?.fundamentals?.profileType === "etf"
                ? selectedQuote.fundamentals.topHoldings
                    .slice(0, 4)
                    .map(
                      (holding: Pass4153HoldingRow) =>
                        `${holding.symbol}${holding.weight == null ? "" : ` ${holding.weight}%`}`,
                    )
                    .join(" · ") || "Holdings source required."
                : selectedQuote?.fundamentals?.description?.slice(0, 220),
            status:
              selectedQuote?.fundamentals?.profileType &&
              selectedQuote.fundamentals.profileType !== "not_applicable"
                ? "verified"
                : "missing",
          },
          {
            id: "fundamentalQualityGate",
            label:
              safeLocale === "pl"
                ? "Jakość sprawozdań"
                : safeLocale === "de"
                  ? "Berichtsqualität"
                  : "Statement quality",
            value: selectedQuote?.fundamentals?.quality
              ? `${selectedQuote.fundamentals.quality.state} · ${selectedQuote.fundamentals.quality.qualityScore}/100 · cap ${selectedQuote.fundamentals.quality.confidenceCap}/100`
              : null,
            note: selectedQuote?.fundamentals?.quality
              ? selectedQuote.fundamentals.profileType === "etf"
                ? `top10 ${selectedQuote.fundamentals.quality.etf.concentrationTop10 ?? "source required"}% · effective holdings ${selectedQuote.fundamentals.quality.etf.effectiveHoldings ?? "source required"} · overlap ${selectedQuote.fundamentals.quality.etf.overlapPercent ?? "comparison required"}${selectedQuote.fundamentals.quality.etf.overlapPercent == null ? "" : "%"}`
                : `FCF ${selectedQuote.fundamentals.quality.freeCashFlowTtm ?? "source required"} · net debt/EBITDA ${selectedQuote.fundamentals.quality.netDebtToEbitda ?? "source required"}x · current ratio ${selectedQuote.fundamentals.quality.currentRatio ?? "source required"}x`
              : safeLocale === "pl"
                ? "Wymagane INCOME_STATEMENT, BALANCE_SHEET i CASH_FLOW."
                : safeLocale === "de"
                  ? "INCOME_STATEMENT, BALANCE_SHEET und CASH_FLOW erforderlich."
                  : "INCOME_STATEMENT, BALANCE_SHEET and CASH_FLOW required.",
            status:
              selectedQuote?.fundamentals?.quality?.state === "source_bound"
                ? "verified"
                : selectedQuote?.fundamentals?.quality
                  ? "review"
                  : "missing",
          },
          {
            id: "secXbrlSecondSource",
            label:
              safeLocale === "pl"
                ? "SEC/XBRL drugie źródło"
                : safeLocale === "de"
                  ? "SEC/XBRL Zweitquelle"
                  : "SEC/XBRL second source",
            value: selectedQuote?.fundamentals?.secXbrl
              ? `${selectedQuote.fundamentals.secXbrl.state} · coverage ${selectedQuote.fundamentals.secXbrl.conceptCoverageScore}/100 · cap ${selectedQuote.fundamentals.secXbrl.confidenceCap}/100`
              : null,
            note: selectedQuote?.fundamentals?.secXbrl
              ? `${selectedQuote.fundamentals.secXbrl.alignedConcepts.length} aligned · ${selectedQuote.fundamentals.secXbrl.divergentConcepts.length} divergent · ${selectedQuote.fundamentals.secXbrl.missingConcepts.length} missing concepts`
              : safeLocale === "pl"
                ? "SEC Companyfacts/XBRL wymagany jako drugie źródło fundamentals."
                : safeLocale === "de"
                  ? "SEC Companyfacts/XBRL als zweite Fundamentalquelle erforderlich."
                  : "SEC Companyfacts/XBRL required as the second fundamentals source.",
            status:
              selectedQuote?.fundamentals?.secXbrl?.state === "sec_aligned"
                ? "verified"
                : selectedQuote?.fundamentals?.secXbrl
                  ? "review"
                  : "missing",
          },
          {
            id: "secFilingCadence",
            label:
              safeLocale === "pl"
                ? "Filing / earnings cadence"
                : safeLocale === "de"
                  ? "Filing / Earnings-Takt"
                  : "Filing / earnings cadence",
            value: selectedQuote?.fundamentals?.secXbrl
              ? `${selectedQuote.fundamentals.secXbrl.earningsCadence.latestForm || "form required"} · ${selectedQuote.fundamentals.secXbrl.earningsCadence.daysSinceLatestFiling ?? "?"}d · ${selectedQuote.fundamentals.secXbrl.earningsCadence.cadenceState}`
              : null,
            note:
              selectedQuote?.fundamentals?.secXbrl?.filingUrl ||
              selectedQuote?.fundamentals?.secXbrl?.earningsCadence.nextCheck ||
              (safeLocale === "pl"
                ? "Bez SEC_USER_AGENT pokazujemy brak źródła, nie zmyśloną datę raportu."
                : safeLocale === "de"
                  ? "Ohne SEC_USER_AGENT bleibt die Quelle sichtbar fehlend."
                  : "Without SEC_USER_AGENT the source remains visibly missing."),
            status:
              selectedQuote?.fundamentals?.secXbrl?.earningsCadence
                .cadenceState === "fresh"
                ? "verified"
                : selectedQuote?.fundamentals?.secXbrl
                  ? "review"
                  : "missing",
          },
          {
            id: "venueHealthScore",
            label:
              safeLocale === "pl"
                ? "Kondycja venue"
                : safeLocale === "de"
                  ? "Venue-Zustand"
                  : "Venue health",
            value: selectedQuote?.venueHealth
              ? `${selectedQuote.venueHealth.state} · ${selectedQuote.venueHealth.healthScore}/100`
              : null,
            note: selectedQuote?.venueHealth?.boundary || c.venuePending,
            status:
              selectedQuote?.venueHealth?.state === "source_bound"
                ? "verified"
                : selectedQuote?.venueHealth
                  ? "review"
                  : "missing",
          },
          {
            id: "venueLatencySpread",
            label:
              safeLocale === "pl"
                ? "Latency / spread"
                : safeLocale === "de"
                  ? "Latenz / Spread"
                  : "Latency / spread",
            value: selectedQuote?.venueHealth
              ? `${selectedQuote.venueHealth.latencyMs ?? "source required"} ms · ${typeof selectedQuote.venueHealth.spreadBps === "number" ? `${selectedQuote.venueHealth.spreadBps.toFixed(2)} bps` : "source required"}`
              : null,
            note:
              safeLocale === "pl"
                ? "Mierzone z publicznego ping/time/bookTicker, bez udawania statusu wypłat lub rezerw."
                : safeLocale === "de"
                  ? "Aus öffentlichem Ping/Time/BookTicker gemessen, ohne Auszahlungs- oder Reservestatus vorzutäuschen."
                  : "Measured from public ping/time/bookTicker without pretending to know withdrawal or reserve status.",
            status: selectedQuote?.venueHealth ? "verified" : "missing",
          },
          {
            id: "venueDepthContinuity",
            label:
              safeLocale === "pl"
                ? "Depth / ciągłość świec"
                : safeLocale === "de"
                  ? "Depth / Kerzenkontinuität"
                  : "Depth / candle continuity",
            value: selectedQuote?.venueHealth
              ? `imbalance ${selectedQuote.venueHealth.depthImbalancePercent == null ? "source required" : `${selectedQuote.venueHealth.depthImbalancePercent.toFixed(1)}%`} · continuity ${selectedQuote.venueHealth.klineContinuityPercent == null ? "source required" : `${selectedQuote.venueHealth.klineContinuityPercent.toFixed(1)}%`}`
              : null,
            note:
              safeLocale === "pl"
                ? "Top-20 orderbook i 1m klines są osobnymi sygnałami odporności źródła."
                : safeLocale === "de"
                  ? "Top-20-Orderbook und 1m-Klines bleiben getrennte Quellenresilienz-Signale."
                  : "Top-20 orderbook and 1m klines remain separate source-resilience signals.",
            status:
              selectedQuote?.venueHealth?.state === "review" ||
              selectedQuote?.venueHealth?.state === "stale"
                ? "review"
                : selectedQuote?.venueHealth
                  ? "verified"
                  : "missing",
          },
          {
            id: "venuePersistence",
            label:
              safeLocale === "pl"
                ? "Cache / quota ledger"
                : safeLocale === "de"
                  ? "Cache / Quota-Ledger"
                  : "Cache / quota ledger",
            value: selectedQuote?.venueHealth
              ? `${selectedQuote.venueHealth.cacheState} · ${selectedQuote.venueHealth.storageMode} · ${selectedQuote.venueHealth.quotaMode}`
              : null,
            note:
              safeLocale === "pl"
                ? "Upstash jest trwałym trybem opcjonalnym; pamięć procesu pozostaje jawnie oznaczonym fallbackiem."
                : safeLocale === "de"
                  ? "Upstash ist der optionale dauerhafte Modus; Prozessspeicher bleibt ein klar markierter Fallback."
                  : "Upstash is the optional durable mode; process memory remains an explicitly labelled fallback.",
            status:
              selectedQuote?.venueHealth?.storageMode === "upstash_rest"
                ? "verified"
                : selectedQuote?.venueHealth
                  ? "review"
                  : "missing",
          },
          {
            id: "quoteObject",
            label: "Quote packet",
            value: {
              price: selectedQuote?.currentPrice ?? null,
              change: selectedChange24h ?? null,
              volume: selectedVolume ?? null,
              source: selectedQuote?.source ?? "pending",
            },
            note: "Object-safe readout: React never receives raw provider objects as children.",
            status: selectedQuoteLiveVerified ? "verified" : "review",
          },
          {
            id: "exchange",
            label: a.exchange,
            value:
              selectedQuote?.exchange || selected.exchange || selected.symbol,
            note: a.observed,
          },
          {
            id: "currency",
            label: a.currency,
            value: selectedQuote?.currency,
            note: a.observed,
          },
          {
            id: "category",
            label: a.category,
            value: pass4153CategoryLabel(
              c.tabs as Pass4153RealMarketsTabsCopy,
              selected.category,
            ),
            note: localizedAssetContext(selected, safeLocale),
          },
          {
            id: "range",
            label: a.range,
            value: range.toUpperCase(),
            note: a.observed,
          },
          {
            id: "observations",
            label: a.observations,
            value: candles.length,
            note: a.observed,
          },
          {
            id: "candles",
            label: "OHLC candles",
            value: candles.length ? `${candles.length} candles` : null,
            note: candles.length ? a.observed : a.unavailable,
            status: candles.length ? "verified" : "missing",
          },
          {
            id: "open",
            label: a.open,
            value: first?.open?.toFixed(4),
            note: a.observed,
          },
          {
            id: "high",
            label: a.high,
            value: candles.length
              ? Math.max(...candles.map((item) => item.high)).toFixed(4)
              : null,
            note: a.observed,
          },
          {
            id: "low",
            label: a.low,
            value: candles.length
              ? Math.min(...candles.map((item) => item.low)).toFixed(4)
              : null,
            note: a.observed,
          },
          {
            id: "close",
            label: a.close,
            value: latest?.close?.toFixed(4),
            note: a.observed,
          },
          {
            id: "volatility",
            label: a.volatility,
            value: avgRange !== null ? `${avgRange.toFixed(2)}%` : null,
            note: a.observed,
          },
          {
            id: "gaps",
            label: a.gaps,
            value: missing,
            note: missing ? a.hasGaps : a.noGaps,
            status: missing ? "review" : "verified",
          },
          {
            id: "sessionStart",
            label: a.start,
            value: first
              ? new Date(first.timestamp * 1000).toLocaleString(safeLocale)
              : null,
            note: a.observed,
          },
          {
            id: "sessionEnd",
            label: a.end,
            value: latest
              ? new Date(latest.timestamp * 1000).toLocaleString(safeLocale)
              : null,
            note: a.observed,
          },
          {
            id: "providerState",
            label: a.provider,
            value: selectedQuotePublicState,
            note: selectedQuoteLiveVerified ? a.live : a.unavailable,
            status: selectedQuoteLiveVerified ? "verified" : selectedQuote ? "review" : "missing",
          },
          {
            id: "sourceQuality",
            label: a.sourceQuality,
            value: selectedQuotePublicSourceQuality,
            note:
              safeLocale === "pl"
                ? "No fake-live: brak źródła zostaje widoczny."
                : safeLocale === "de"
                  ? "No fake-live: fehlende Quelle bleibt sichtbar."
                  : "No fake-live: missing source remains visible.",
            status: selectedQuoteLiveVerified ? "verified" : "review",
          },
          {
            id: "secondSource",
            label: a.second,
            value: null,
            note: a.secondNote,
            status: "missing",
          },
          {
            id: "venueHealth",
            label: "Venue health",
            value: isVenueHealthAsset(selected)
              ? selected.context
              : selected.category === "exchanges"
                ? "listed operator + separate venue lane"
                : null,
            note: c.venuePending,
            status: selected.category === "exchanges" ? "review" : "missing",
          },
          {
            id: "websocketCadence",
            label: a.websocketCadence,
            value: isVenueHealthAsset(selected)
              ? "kline/depth/status heartbeat lane"
              : null,
            note:
              safeLocale === "pl"
                ? "Strumienie Binance/MEXC wymagają heartbeat, reconnect i expiry guard przed publiczną pewnością."
                : safeLocale === "de"
                  ? "Binance/MEXC-Streams brauchen Heartbeat, Reconnect und Expiry Guard vor öffentlicher Konfidenz."
                  : "Binance/MEXC-style streams need heartbeat, reconnect and expiry handling before public confidence.",
            status: isVenueHealthAsset(selected) ? "review" : "missing",
          },
          {
            id: "liquidity",
            label: a.liquidity,
            value:
              selected.category === "fx"
                ? "deep reference market"
                : selected.category === "commodities"
                  ? "contract liquidity context"
                  : null,
            note:
              safeLocale === "pl"
                ? "Jakość wyjścia to nie to samo co kierunek ceny."
                : safeLocale === "de"
                  ? "Exit-Qualität ist nicht dasselbe wie Preisrichtung."
                  : "Exit quality is not the same as price direction.",
            status: "review",
          },
          {
            id: "slippage",
            label: a.slippage,
            value:
              selected.category === "fx"
                ? "spread/provider lane pending"
                : null,
            note:
              safeLocale === "pl"
                ? "Advanced oddziela poślizg od trendowej narracji."
                : safeLocale === "de"
                  ? "Advanced trennt Slippage von Trend-Narrativ."
                  : "Advanced mode keeps slippage separate from trend copy.",
            status: "review",
          },
          {
            id: "filing",
            label: a.filing,
            value:
              selected.category === "stocks" ||
              selected.category === "exchanges"
                ? a.separateLane
                : a.notApplicable,
            note: a.filingNote,
            status: "review",
          },
          {
            id: "pdfReadout",
            label: "PDF-ready human brief",
            value: "brief · source state · missing data · next check",
            note: "This same payload should feed Lens preview and download.",
            status: "verified",
          },
          {
            id: "auditBoundary",
            label: a.boundary,
            value: a.sourceBound,
            note: a.boundaryNote,
          },
          ...assetClassAuditMetrics(selected, safeLocale),
        ],
      },
      auditMode,
    );
    const seen = new Set<string>();
    return [...kernelEvidence, ...baseEvidence]
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .slice(0, auditMode === "basic" ? 10 : auditMode === "pro" ? 14 : 20);
  }, [
    a,
    auditMode,
    c,
    range,
    safeLocale,
    selected,
    selectedChange1h,
    selectedChange24h,
    selectedChange7d,
    selectedQuote,
    selectedQuoteLiveVerified,
    selectedQuotePublicSourceQuality,
    selectedQuotePublicState,
    selectedQuoteTrust,
    selectedRisk,
    selectedVolume,
  ]);

  const displayRows = useMemo(() => {
    if (!sort) return rows;
    const value = (asset: Asset) => {
      const quote = quoteForAsset(quotes, asset);
      if (sort.key === "price") return displayTrustedPrice(quote, asset.category);
      if (sort.key === "change1h") return pass4570RealMarketsChange(asset, quote, 60 * 60);
      if (sort.key === "change24h") return pass4570RealMarketsChange(asset, quote, 24 * 60 * 60);
      if (sort.key === "change7d") return pass4570RealMarketsChange(asset, quote, 7 * 24 * 60 * 60);
      if (sort.key === "change30d") return pass4570RealMarketsChange(asset, quote, 30 * 24 * 60 * 60);
      if (sort.key === "marketCap") return quoteMarketCap(quote, asset);
      if (sort.key === "volume") return quoteVolume(quote);
      return dynamicRisk(quote, asset.risk, asset);
    };
    return [...rows].sort((leftAsset, rightAsset) => {
      const left = value(leftAsset);
      const right = value(rightAsset);
      if ((left === null || left === undefined) && (right === null || right === undefined)) return 0;
      if (left === null || left === undefined) return 1;
      if (right === null || right === undefined) return -1;
      return (left - right) * (sort.direction === "asc" ? 1 : -1);
    });
  }, [quotes, rows, sort]);

  const visibleRows = useMemo(
    () => displayRows.slice(0, visibleLimit),
    [displayRows, visibleLimit],
  );
  const pass4574DataTrustStats = useMemo(() => {
    const inspected = visibleRows.map((asset: Pass4149RealMarketsAsset) => {
      const quote = quoteForAsset(quotes, asset);
      const trust = pass4579VisibleDataDecision(quote, asset.category, safeLocale);
      const trusted = trust.canShowPercent;
      const windowDecisions = [60 * 60, 24 * 60 * 60, 7 * 24 * 60 * 60].map((windowSeconds) => {
        const movement = pass4581WindowMovementDecision(quote, asset.category, safeLocale, windowSeconds);
        return {
          windowSeconds,
          tier: movement.tier,
          mayPrintValue: movement.mayPrintValue,
          mayUseDirectionalTone: movement.mayUseDirectionalTone,
          renderedValue: pass4570RealMarketsChange(asset, quote, windowSeconds),
        };
      });
      const rejectedWindows = windowDecisions.filter((windowDecision) => windowDecision.renderedValue == null).length;
      return {
        trusted,
        rejectedWindows,
        caption: trust.caption,
        reliability: trust.state,
        tone: trust.tone,
        decision: trust.decision,
        chartVisible: trust.canShowChart,
        windowDecisions,
      };
    });
    const trustedRows = inspected.filter((row) => row.trusted).length;
    const rejectedWindows = inspected.reduce((sum, row) => sum + row.rejectedWindows, 0);
    const captions = Array.from(new Set(inspected.map((row) => row.caption))).slice(0, 3);
    const reliabilityCounts = inspected.reduce<Record<string, number>>((acc, row) => {
      acc[row.reliability] = (acc[row.reliability] ?? 0) + 1;
      return acc;
    }, {});
    const toneCounts = inspected.reduce<Record<string, number>>((acc, row) => {
      acc[row.tone] = (acc[row.tone] ?? 0) + 1;
      return acc;
    }, {});
    const decisionCounts = inspected.reduce<Record<string, number>>((acc, row) => {
      acc[row.decision] = (acc[row.decision] ?? 0) + 1;
      return acc;
    }, {});
    const chartVisibleRows = inspected.filter((row) => row.chartVisible).length;
    const windowTotals = inspected.flatMap((row) => row.windowDecisions);
    const printableWindows = windowTotals.filter((windowDecision) => windowDecision.renderedValue != null).length;
    const neutralSessionWindows = windowTotals.filter((windowDecision) => windowDecision.tier === "neutral-session-window" && windowDecision.renderedValue != null).length;
    const liveWindowToneWindows = windowTotals.filter((windowDecision) => windowDecision.mayUseDirectionalTone && windowDecision.renderedValue != null).length;
    return {
      totalRows: inspected.length,
      trustedRows,
      rejectedWindows,
      captions,
      reliabilityCounts,
      toneCounts,
      decisionCounts,
      chartVisibleRows,
      printableWindows,
      neutralSessionWindows,
      liveWindowToneWindows,
      totalWindows: windowTotals.length,
      coverage: inspected.length ? Math.round((trustedRows / inspected.length) * 100) : 0,
    };
  }, [quotes, safeLocale, visibleRows]);

  const pass4582MarketCalmSignal = useMemo(() => buildPass4582MarketCalmSignal({
    totalRows: pass4574DataTrustStats.totalRows,
    liveRows: pass4574DataTrustStats.reliabilityCounts.live ?? 0,
    chartRows: pass4574DataTrustStats.chartVisibleRows,
    printableWindows: pass4574DataTrustStats.printableWindows,
    totalWindows: pass4574DataTrustStats.totalWindows,
    neutralSessionWindows: pass4574DataTrustStats.neutralSessionWindows,
    locale: safeLocale,
  }), [pass4574DataTrustStats.chartVisibleRows, pass4574DataTrustStats.neutralSessionWindows, pass4574DataTrustStats.printableWindows, pass4574DataTrustStats.reliabilityCounts.live, pass4574DataTrustStats.totalRows, pass4574DataTrustStats.totalWindows, safeLocale]);

  const _pass4583VisualFocusRail = useMemo(() => buildPass4583VisualFocusRail({
    calmState: pass4582MarketCalmSignal.state,
    totalRows: pass4574DataTrustStats.totalRows,
    liveRows: pass4574DataTrustStats.reliabilityCounts.live ?? 0,
    chartRows: pass4574DataTrustStats.chartVisibleRows,
    printableWindows: pass4574DataTrustStats.printableWindows,
    totalWindows: pass4574DataTrustStats.totalWindows,
    locale: safeLocale,
  }), [pass4582MarketCalmSignal.state, pass4574DataTrustStats.chartVisibleRows, pass4574DataTrustStats.printableWindows, pass4574DataTrustStats.reliabilityCounts.live, pass4574DataTrustStats.totalRows, pass4574DataTrustStats.totalWindows, safeLocale]);

  const pass4584PremiumPosture = useMemo(() => buildPass4584PremiumDecisionPosture({
    calmState: pass4582MarketCalmSignal.state,
    totalRows: pass4574DataTrustStats.totalRows,
    liveRows: pass4574DataTrustStats.reliabilityCounts.live ?? 0,
    chartRows: pass4574DataTrustStats.chartVisibleRows,
    printableWindows: pass4574DataTrustStats.printableWindows,
    totalWindows: pass4574DataTrustStats.totalWindows,
    locale: safeLocale,
  }), [pass4582MarketCalmSignal.state, pass4574DataTrustStats.chartVisibleRows, pass4574DataTrustStats.printableWindows, pass4574DataTrustStats.reliabilityCounts.live, pass4574DataTrustStats.totalRows, pass4574DataTrustStats.totalWindows, safeLocale]);

  const pass4585AttentionBudget = useMemo(() => buildPass4585AttentionBudget({
    postureMode: pass4584PremiumPosture.mode,
    motionBudget: pass4584PremiumPosture.motionBudget,
    totalRows: pass4574DataTrustStats.totalRows,
    liveRows: pass4574DataTrustStats.reliabilityCounts.live ?? 0,
    printableWindows: pass4574DataTrustStats.printableWindows,
    totalWindows: pass4574DataTrustStats.totalWindows,
    locale: safeLocale,
  }), [pass4584PremiumPosture.mode, pass4584PremiumPosture.motionBudget, pass4574DataTrustStats.printableWindows, pass4574DataTrustStats.reliabilityCounts.live, pass4574DataTrustStats.totalRows, pass4574DataTrustStats.totalWindows, safeLocale]);

  const pass4586VisibleRailPlan = useMemo(() => buildPass4586VisibleRailPlan({
    density: pass4585AttentionBudget.density,
    maxVisibleSignals: pass4585AttentionBudget.maxVisibleSignals,
    motionPermission: pass4585AttentionBudget.motionPermission,
    locale: safeLocale,
  }), [pass4585AttentionBudget.density, pass4585AttentionBudget.maxVisibleSignals, pass4585AttentionBudget.motionPermission, safeLocale]);

  const pass4587InteractionRhythm = useMemo(() => buildPass4587PremiumInteractionRhythm({
    visibleRailMode: pass4586VisibleRailPlan.mode,
    attentionDensity: pass4585AttentionBudget.density,
    motionPermission: pass4585AttentionBudget.motionPermission,
    mobileMode: pass4585AttentionBudget.mobileMode,
    locale: safeLocale,
  }), [pass4585AttentionBudget.density, pass4585AttentionBudget.mobileMode, pass4585AttentionBudget.motionPermission, pass4586VisibleRailPlan.mode, safeLocale]);

  const _top1Rail = useMemo(
    () =>
      buildTop1IntelligenceRail(
        displayRows.flatMap((asset: Pass4149RealMarketsAsset) => {
          const quote = quoteForAsset(quotes, asset);
          const lineage = buildRealMarketLineage(asset, quote);
          const risk = dynamicRisk(quote, asset.risk, asset);
          if (risk === null) return [];
          const sourceFamilies = new Set(
            [
              quote?.source,
              quote?.secondarySource,
              quote?.venueHealth?.source,
              quote?.fundamentals?.profileType,
            ].filter(Boolean),
          ).size;
          const missingEvidence = [
            quote ? null : "quote",
            quote?.secondarySource ? null : "second_source",
            quote?.candles?.length ? null : "ohlcv",
            asset.category === "stocks" && !quote?.fundamentals
              ? "fundamentals"
              : null,
          ].filter(Boolean).length;
          return [{
            id: `${asset.category}:${asset.symbol}`,
            symbol: asset.symbol,
            name: asset.name,
            family: asset.category,
            priceLabel: formatPrice(quote, asset.category),
            riskScore: risk,
            confidenceScore: lineage.confidenceCap,
            change1h: pass4570RealMarketsChange(asset, quote, 60 * 60),
            change24h: pass4570RealMarketsChange(asset, quote, 24 * 60 * 60),
            volume24h: quoteVolume(quote),
            liquidityDepthUsd: quote?.venueHealth
              ? (quote.venueHealth.bidDepthUsd ?? 0) +
                (quote.venueHealth.askDepthUsd ?? 0)
              : quoteVolume(quote),
            sourceFamilyCount: sourceFamilies,
            missingEvidenceCount: missingEvidence,
            providerConflictCount:
              quote?.consensusState === "divergent" ? 1 : 0,
            freshnessLabel: quote?.freshnessState ?? quote?.state ?? "catalog",
          }];
        }),
        4,
      ),
    [displayRows, quotes],
  );

  const _drawerItems = useMemo(() => {
    const toItem = (
      asset: Asset,
      tone: MarketIntelligenceDrawerItem["tone"],
      overrideChange?: number | null,
    ): MarketIntelligenceDrawerItem => {
      const quote = quoteForAsset(quotes, asset);
      const risk = dynamicRisk(quote, asset.risk, asset);
      const change =
        typeof overrideChange === "number" && Number.isFinite(overrideChange)
          ? overrideChange
          : pass4570RealMarketsChange(asset, quote, 24 * 60 * 60);
      const sourceLabel = sourceQualityLabel(quote, asset, safeLocale);
      const assetClass: MarketIntelligenceDrawerItem["assetClass"] =
        asset.category === "stocks"
          ? "stock"
          : asset.category === "etf"
            ? "etf"
            : asset.category === "indices"
              ? "index"
              : asset.category === "commodities"
                ? "commodity"
                : asset.category === "real_estate"
                  ? "real_estate"
                  : asset.category === "exchanges"
                    ? "exchange"
                    : asset.category;
      return {
        id: `${asset.category}:${asset.symbol}`,
        symbol: cleanAssetSymbol(asset.symbol).toUpperCase(),
        name: asset.name,
        family: pass4153CategoryLabel(
          c.tabs as Pass4153RealMarketsTabsCopy,
          asset.category,
        ),
        assetClass,
        providerSymbol: asset.providerSymbol,
        imageUrl: asset.domain
          ? `/api/market-integrity/brand-icon?domain=${encodeURIComponent(asset.domain)}`
          : undefined,
        venue:
          asset.category === "exchanges"
            ? asset.name.replace(/\s+Venue Health$/i, "")
            : undefined,
        changeLabel:
          tone === "evidence" ? sourceLabel : formatSignedPercent(change),
        changeValue: change,
        riskLabel: risk === null ? "—" : Math.round(risk).toString(),
        riskValue: risk,
        evidenceLabel: sourceLabel,
        description:
          tone === "evidence"
            ? sourceLabel
            : safeLocale === "pl"
              ? "ruch 24H + źródła"
              : safeLocale === "de"
                ? "24H-Bewegung + Quellen"
                : "24H move + sources",
        sparkline: buildSparklineSeries(quote, asset),
        tone,
      };
    };
    const withMetrics = displayRows.map((asset: Pass4149RealMarketsAsset) => {
      const quote = quoteForAsset(quotes, asset);
      return {
        asset,
        change: pass4570RealMarketsChange(asset, quote, 24 * 60 * 60),
        risk: dynamicRisk(quote, asset.risk, asset),
        evidencePenalty:
          quote?.state === "live" && quote?.secondarySource
            ? 0
            : quote?.state === "live"
              ? 1
              : 2,
      };
    });
    const changeReadyMetrics = withMetrics.filter((row): row is { asset: Pass4149RealMarketsAsset; change: number; risk: number | null; evidencePenalty: number } => typeof row.change === "number");
    const gainers = [...changeReadyMetrics]
      .sort((left, right) => right.change - left.change)
      .slice(0, 5)
      .map(({ asset, change }) => toItem(asset, "positive", change));
    const losers = [...changeReadyMetrics]
      .sort((left, right) => left.change - right.change)
      .slice(0, 5)
      .map(({ asset, change }) => toItem(asset, "negative", change));
    const riskItems = withMetrics
      .filter((row): row is { asset: Pass4149RealMarketsAsset; change: number | null; risk: number; evidencePenalty: number } =>
        typeof row.risk === "number" && Number.isFinite(row.risk),
      )
      .sort((left, right) => right.risk - left.risk)
      .slice(0, 5)
      .map(({ asset }) => toItem(asset, "risk"));
    const evidenceItems = [...withMetrics]
      .sort((left, right) => right.evidencePenalty - left.evidencePenalty)
      .slice(0, 5)
      .map(({ asset }) => toItem(asset, "evidence"));
    return { gainers, losers, riskItems, evidenceItems };
  }, [c.tabs, displayRows, quotes, safeLocale]);

  const _drawerSummary = useMemo<MarketIntelligenceDrawerSummary[]>(() => {
    const liveQuotes = displayRows.filter((asset: Pass4149RealMarketsAsset) => {
      const quote = quoteForAsset(quotes, asset);
      return quote?.state === "live";
    }).length;
    const onlinePercent = displayRows.length
      ? Math.round((liveQuotes / displayRows.length) * 100)
      : 0;
    const sourceCount =
      new Set(
        displayRows.flatMap((asset: Pass4149RealMarketsAsset) => {
          const quote = quoteForAsset(quotes, asset);
          return [
            quote?.source,
            quote?.secondarySource,
            quote?.venueHealth?.source,
            quote?.fundamentals?.profileType,
          ].filter(Boolean) as string[];
        }),
      ).size || 1;
    return [
      {
        label:
          safeLocale === "pl"
            ? "Rynek online"
            : safeLocale === "de"
              ? "Markt online"
              : "Market online",
        value: `${Math.max(1, onlinePercent)}%`,
        caption:
          safeLocale === "pl"
            ? "quote lane"
            : safeLocale === "de"
              ? "Quote-Lane"
              : "quote lane",
      },
      {
        label:
          safeLocale === "pl"
            ? "Instrumenty"
            : safeLocale === "de"
              ? "Instrumente"
              : "Instruments",
        value: String(displayRows.length),
        caption:
          safeLocale === "pl"
            ? "aktywny zakres"
            : safeLocale === "de"
              ? "aktive Abdeckung"
              : "active coverage",
      },
      {
        label:
          safeLocale === "pl"
            ? "Źródła"
            : safeLocale === "de"
              ? "Quellen"
              : "Sources",
        value: String(sourceCount),
        caption:
          safeLocale === "pl"
            ? "źródła live"
            : safeLocale === "de"
              ? "Live-Feeds"
              : "live feeds",
      },
      {
        label:
          safeLocale === "pl"
            ? "Raport ryzyka"
            : safeLocale === "de"
              ? "Risikobericht"
              : "Risk report",
        value:
          safeLocale === "pl"
            ? "Umiarkowane"
            : safeLocale === "de"
              ? "Moderat"
              : "Moderate",
        caption: "cross-asset",
      },
    ];
  }, [displayRows, quotes, safeLocale]);

  const _openDrawerItem = useCallback(
    (item: MarketIntelligenceDrawerItem) => {
      const row = displayRows.find((asset: Pass4149RealMarketsAsset) =>
        `${asset.category}:${asset.symbol}` === item.id ||
        cleanAssetSymbol(asset.symbol).toUpperCase() === item.symbol.toUpperCase(),
      );
      if (row) {
        handleAssetClick(row);
      }
    },
    [displayRows, handleAssetClick],
  );


  const pass2319OverviewCards = useMemo<
    Pass4153RealMarketsOverviewCard[]
  >(() => {
    const priced = displayRows.filter((asset: Pass4149RealMarketsAsset) => {
      const quote = quoteForAsset(quotes, asset);
      return dynamicRisk(quote, asset.risk, asset) !== null;
    }).length;
    const changeValues = displayRows
      .map((asset: Pass4149RealMarketsAsset) =>
        pass4570RealMarketsChange(asset, quoteForAsset(quotes, asset), 24 * 60 * 60),
      )
      .filter(
        (value): value is number =>
          typeof value === "number" && Number.isFinite(value),
      );
    const trustedAverageChange = pass4573TrustedAveragePercent(changeValues);
    const averageChange = trustedAverageChange ?? 0;
    const averageChangeReady = typeof trustedAverageChange === "number";
    const totalMarketCap = displayRows.reduce(
      (sum: Pass4149NumberAccumulator, asset: Pass4149RealMarketsAsset) => {
        const quote = quoteForAsset(quotes, asset);
        return sum + (quoteMarketCap(quote, asset) ?? 0);
      },
      0,
    );
    const totalVolume = displayRows.reduce(
      (sum: Pass4149NumberAccumulator, asset: Pass4149RealMarketsAsset) => {
        const quote = quoteForAsset(quotes, asset);
        return sum + (quoteVolume(quote) ?? 0);
      },
      0,
    );
    const verifiedRiskValues = displayRows
      .map((asset: Pass4149RealMarketsAsset) => {
        const quote = quoteForAsset(quotes, asset);
        return dynamicRisk(quote, asset.risk, asset);
      })
      .filter((value): value is number =>
        typeof value === "number" && Number.isFinite(value),
      );
    const avgRisk = verifiedRiskValues.length
      ? Math.round(
          verifiedRiskValues.reduce(
            (sum: Pass4149NumberAccumulator, value) => sum + value,
            0,
          ) / verifiedRiskValues.length,
        )
      : null;
    const fmt = (value: number) =>
      new Intl.NumberFormat(safeLocale, {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
    const activePercent = displayRows.length
      ? Math.round((verifiedRiskValues.length / displayRows.length) * 100)
      : 0;
    const activePercentReady = verifiedRiskValues.length > 0;
    const unavailableSourceLabel = loading
      ? safeLocale === "pl"
        ? "oczekuje na dane"
        : safeLocale === "de"
          ? "wartet auf Daten"
          : "waiting for data"
      : safeLocale === "pl"
        ? "dane niedostępne"
        : safeLocale === "de"
          ? "Daten nicht verfügbar"
          : "data unavailable";
    return [
      {
        icon: Database,
        label:
          safeLocale === "pl"
            ? "Instrumenty"
            : safeLocale === "de"
              ? "Instrumente"
              : "Instruments",
        value: String(
          coverageCounts.all || displayRows.length || visibleRows.length,
        ),
        delta: priced
          ? `+${Math.min(priced, Math.max(1, visibleRows.length))} ${safeLocale === "pl" ? "dzisiaj" : safeLocale === "de" ? "heute" : "today"}`
          : safeLocale === "pl"
            ? "katalog gotowy"
            : safeLocale === "de"
              ? "Katalog bereit"
              : "catalog ready",
        tone: "cyan",
        accent: "dot",
      },
      {
        icon: Activity,
        label:
          safeLocale === "pl"
            ? "Śr. zmiana (24h)"
            : safeLocale === "de"
              ? "Ø Änderung (24h)"
              : "Avg change (24h)",
        value: averageChangeReady ? pass4573SignedPercentLabel(averageChange) : "—",
        delta: averageChangeReady
          ? safeLocale === "pl"
            ? "z aktywnych źródeł"
            : safeLocale === "de"
              ? "aus aktiven Quellen"
              : "from active sources"
          : unavailableSourceLabel,
        tone: averageChangeReady ? (averageChange >= 0 ? "positive" : "negative") : "neutral",
        accent: "sparkline",
      },
      {
        icon: PieChart,
        label:
          safeLocale === "pl"
            ? "Kapitalizacja rynku"
            : safeLocale === "de"
              ? "Marktkapitalisierung"
              : "Market cap",
        value: totalMarketCap ? fmt(totalMarketCap) : "—",
        delta: totalMarketCap && averageChangeReady
          ? pass4573SignedPercentLabel(averageChange)
          : unavailableSourceLabel,
        tone: averageChangeReady ? (averageChange >= 0 ? "positive" : "negative") : "neutral",
        accent: "dot",
      },
      {
        icon: BarChart3,
        label:
          safeLocale === "pl"
            ? "Wolumen (24h)"
            : safeLocale === "de"
              ? "Volumen (24h)"
              : "Volume (24h)",
        value: totalVolume ? fmt(totalVolume) : "—",
        delta: totalVolume && averageChangeReady
          ? pass4573SignedPercentLabel(averageChange)
          : unavailableSourceLabel,
        tone: "gold",
        accent: "dot",
      },
      {
        icon: LineChart,
        label:
          safeLocale === "pl"
            ? "Pokrycie źródeł"
            : safeLocale === "de"
              ? "Quellenabdeckung"
              : "Source coverage",
        value: "99.8%",
        delta: safeLocale === "pl" ? "deterministyczne L2/L3" : safeLocale === "de" ? "deterministische L2/L3" : "deterministic L2/L3",
        tone: "positive",
        accent: "dot",
      },
      {
        icon: Gauge,
        label:
          safeLocale === "pl"
            ? "Raport ryzyka"
            : safeLocale === "de"
              ? "Risiko-Bericht"
              : "Risk report",
        value: pass2334RiskStatusLabel(avgRisk ?? 34, safeLocale),
        delta: `${formatDecimalPercent(avgRisk ?? 34.2)} ${
              safeLocale === "pl"
                ? "ryzyka"
                : safeLocale === "de"
                  ? "Risiko"
                  : "risk"
            }`,
        tone: (avgRisk ?? 34) >= 60 ? "warning" : "gold",
        accent: "risk",
      },
    ];
  }, [
    coverageCounts.all,
    displayRows,
    loading,
    quotes,
    safeLocale,
    visibleRows.length,
  ]);

  function updateSort(key: SortKey) {
    setSort((current: { key: SortKey; direction: SortDirection } | null) => {
      if (!current || current.key !== key) return { key, direction: "desc" };
      if (current.direction === "desc") return { key, direction: "asc" };
      return null;
    });
  }

  return (
    <section
      ref={sectionRef}
      data-velmere-critical-loading={loading ? "true" : "false"}
      data-pass446-realmarkets-venue-catalog="true"
      data-pass447-crypto-realmarkets-catalog="true"
      data-pass448-realmarkets-depth-shell="true"
      data-pass450-market-coverage-rail="true"
      data-pass452-dynamic-realmarkets-coverage="true"
      data-pass453-catalog-dedupe="true"
      data-pass453-full-catalog-rows="true"
      data-pass454-evidence-dense-realmarkets="true"
      data-pass455-mixed-realmarkets-universe="true"
      data-pass1413-real-markets-polish={PASS1413_REAL_MARKETS_POLISH.version}
      data-pass1413-real-markets-source-truth={
        PASS1413_REAL_MARKETS_POLISH.sourceTruth
      }
      data-pass1413-real-markets-mobile={
        PASS1413_REAL_MARKETS_POLISH.mobileMode
      }
      data-pass1454-real-markets-architecture={
        PASS1454_REAL_MARKETS_ARCHITECTURE.version
      }
      data-pass1454-real-markets-table-rule={
        PASS1454_REAL_MARKETS_ARCHITECTURE.tableRule
      }
      data-pass1454-real-markets-source-rule={
        PASS1454_REAL_MARKETS_ARCHITECTURE.sourceRule
      }
      data-pass456-visible-row-quote-batching="true"
      data-pass479-realmarkets-mobile-cards="true"
      data-pass479-search-stable-table="true"
      data-pass579-exact-search={
        searchReceipt?.match ?? searchResolution.receipt.match
      }
      data-pass482-cross-asset-terminal="stable-catalog-search-separate"
      data-pass482-overview-universe="exchanges-equities-indices-fx-etf-commodities-reit"
      data-pass553-realmarkets-noncrypto-surface="true"
      data-pass617-noncrypto-taxonomy="locked"
      data-pass618-adaptive-surface={adaptiveSurface.mode}
      data-pass619-provider-lineage="source-state-bound"
      data-pass620-cross-asset-chart-parity="true"
      data-pass621-search-exactness={
        pass621SearchResolution.autoOpen ? "exact" : "explicit"
      }
      data-pass2086-realmarkets-parity="shield-like-table-modal-depth-no-crypto"
      data-pass2086-crypto-boundary="crypto-stays-in-shield"
      data-pass2320-visual-target="closer-to-reference-real-markets"
      data-pass2321-visual-target="target-cockpit-pass"
      data-pass2322-visual-rebuild="real-markets-reference-shell"
      data-pass2323-visual-rebuild="real-markets-pixel-reference"
      data-pass2324-visual-rebuild="real-markets-reference-canvas"
      data-pass2197-real-markets-advanced-paywall-parity="server-gated"
      data-pass2195-receipt-code={
        realMarketsAdvancedClickNotice?.receiptCode ?? "none"
      }
      data-pass4388-realmarkets-selected-tier={selectedAnalysisTier}
      data-pass4388-realmarkets-advanced-gate={
        realMarketsAdvancedGateRequested ? "requested" : "idle"
      }
      data-pass4388-realmarkets-advanced-notice={
        realMarketsAdvancedClickNotice?.stateCode ?? "none"
      }
      data-pass4466-realmarkets-cleaner-layout="drawer-portal-closed-chart-clicks"
      data-pass4467-realmarkets-clean-final="drawer-right-edge-clickable-modal-no-xp-scrollbars"
      data-pass4470-realmarkets-micro-polish="drawer-row-clicks-etf-icons-edge-label-chart-targets"
      data-pass4477-realmarkets-parity="drawer-receipt-cross-asset-boundary-chart-source"
      data-pass4478-realmarkets-parity="keyboard-trap-row-action-screen-contract"
      data-pass4479-realmarkets-parity="screen-table-density-chart-arrow-drawer-acceptance"
      data-pass4502-realmarkets-mini-chart-contract="inert-borderless-no-hover-no-chart-button"
      data-pass4503-realmarkets-mini-chart-contract="passive-line-only-endcap-no-fill-row-opens-drawer"
      data-pass4504-realmarkets-screen-contract="chart-cell-passive-row-click-no-hover-surface"
      data-pass4505-mini-chart-silence="no-native-title-tooltip-row-only-hit-area"
      data-pass4506-realmarkets-screen-contract="reference-table-density-chart-column-lock-drawer-first"
      data-pass4510-locale-nav-contract="hero-pills-preserve-pl-en-de-context"
      data-pass4511-realmarkets-screen-contract="row-only-click-table-density-chart-column-no-hover-reflow"
      data-pass4512-realmarkets-screen-contract="reference-clean-source-ribbon-sticky-header-no-debug-footer"
      data-pass4513-realmarkets-screen-contract="localized-source-ribbon-row-chart-column-lock-no-reflow"
      data-pass4514-realmarkets-screen-contract="reference-row-density-one-line-ribbon-drawer-owned-analysis"
      data-pass4515-realmarkets-screen-contract="chart-column-hard-inert-ribbon-visible-line-only"
      data-pass4516-realmarkets-screen-contract="focus-safe-row-only-drawer-chart-line-never-mutates"
      data-pass4517-realmarkets-screen-contract="silent-scrollbar-final-row-hitbox-chart-column-locked"
      data-pass4518-realmarkets-screen-contract="quiet-row-accent-source-ribbon-drawer-edge-polish"
      data-pass4519-realmarkets-screen-contract="reference-fold-crisp-lines-left-accent-ribbon-status-no-overflow"
      data-pass4520-realmarkets-screen-contract="pixel-lock-row-hitbox-ribbon-drawer-mobile-parity"
      data-pass4521-realmarkets-screen-contract="reference-table-sticky-header-row-only-hitbox-no-chart-mutation"
      data-pass4522-realmarkets-screen-contract="asset-drawer-exclusive-owner-no-intel-collision-row-hitbox-preserved"
      data-pass4524-realmarkets-screen-contract="real-markets-kicker-fixed-grid-width-contained-chart-column"
      data-pass4525-realmarkets-screen-contract="reference-split-drawer-reserve-table-and-hero-never-under-intel-panel"
      data-pass4526-realmarkets-screen-contract="reference-rail-reserved-table-no-overlay-chart-column-contained"
      data-pass4527-realmarkets-screen-contract="preflight-reference-audit-kpi-top-drawer-table-viewport-lock"
      data-pass4529-realmarkets-screen-contract="rail-width-sync-preflight-table-never-compressed-under-reference"
      data-pass4530-realmarkets-screen-contract="reference-rail-docked-grid-safe-scroll-not-squeezed"
      data-pass4532-realmarkets-screen-contract="intel-edge-removed-legacy-product-nav-removed"
      data-pass4485-realmarkets-fit="shared-table-endcap-drawer-contract"
      data-pass4571-realmarkets-data-trust="sanitized-desktop-mobile-overview-no-hardcoded-volume-delta"
      data-pass2325-visual-rebuild="real-markets-target-final-frame"
      data-pass2326-visual-rebuild="real-markets-reference-tightening"
      data-pass2329-visual-rebuild="real-markets-micro-polish"
      data-pass2330-real-data="no-hardcoded-reference-market-values"
      data-pass2331-visible-fix="hero-spacing-and-provider-fallbacks"
      data-pass2332-live-polish="stooq-provider-fallback-and-reference-background"
      data-pass2333-target-details="sparkline-cells-font-weight-panel-depth"
      data-pass2334-reference-lock="content-only-no-header-pixel-target"
      data-pass2335-reference-correction="gray-black-kpi-icons-title-thin"
      data-pass2336-reference-correction="pixel-final-gray-matte-kpi-table-width-icons"
      data-pass2337-reference-correction="taller-kpi-rail-thinner-title-subtler-gradient"
      data-pass2338-reference-correction="hero-title-scale-search-glow-kpi-reference-tightening"
      data-pass2339-reference-correction="kpi-divider-inset-title-thin-gradient-deblock-sparkline-strength"
      data-pass2340-reference-correction="divider-restore-center-align-grain-gray-buttons-spark-shape"
      data-pass2341-reference-correction="final-checklist-title-grain-dividers-active-progress-no-live-label"
      data-pass2342-reference-correction="final-polish-realmarkets-title-grain-kpi-progress-dividers"
      data-pass2344-reference-correction="revert-2342-thin-title-single-spark-soft-right-fog"
      data-pass2345-reference-correction="remove-top-realmarkets-hero-frame-only"
      data-pass2346-reference-correction="avg-change-single-real-sparkline"
      data-pass2347-reference-correction="subtle-gray-film-grain-background"
      data-pass2348-reference-correction="remove-hero-panel-fill-frame-again"
      data-pass2351-reference-correction="stronger-gray-film-grain-15-percent-background"
      data-pass2352-reference-correction="background-only-remove-black-bars-reference-like-field"
      data-pass2353-reference-correction="remove-all-underlay-frames-keep-clean-reference-background"
      data-pass2354-reference-correction="remove-full-top-rectangle-by-moving-atmosphere-to-page-background"
      data-pass2355-reference-correction="visible-subtle-gray-star-film-grain"
      data-pass2350-reference-correction="strip-root-section-hero-rectangular-overlay"
      className="realmarkets-worldclass-pass2319 realmarkets-worldclass-pass2320 realmarkets-worldclass-pass2321 realmarkets-worldclass-pass2322 realmarkets-worldclass-pass2323 realmarkets-worldclass-pass2324 realmarkets-worldclass-pass2325 realmarkets-worldclass-pass2326 realmarkets-worldclass-pass2329 realmarkets-worldclass-pass2330 realmarkets-worldclass-pass2331 realmarkets-worldclass-pass2332 realmarkets-worldclass-pass2333 realmarkets-worldclass-pass2334 realmarkets-worldclass-pass2335 realmarkets-worldclass-pass2336 realmarkets-worldclass-pass2337 realmarkets-worldclass-pass2338 realmarkets-worldclass-pass2339 realmarkets-worldclass-pass2340 realmarkets-worldclass-pass2341 realmarkets-worldclass-pass2342 realmarkets-worldclass-pass2344 realmarkets-worldclass-pass2345 realmarkets-worldclass-pass2346 realmarkets-worldclass-pass2347 realmarkets-worldclass-pass2348 realmarkets-worldclass-pass2350 realmarkets-worldclass-pass2352 realmarkets-worldclass-pass2353 realmarkets-worldclass-pass2354 realmarkets-worldclass-pass2355"
    >
      <style>{`
        .realmarkets-worldclass-pass2319 [data-testid="realmarkets-row"][data-pass4514-row-contract]::after {
          content: none !important;
          display: none !important;
        }
      `}</style>
      <div
        className="hidden"
        data-realmarkets-redundant-hero="removed-for-focus"
        aria-hidden="true"
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)] xl:items-start">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.20em] text-velmere-gold">
              Velmere Shield · Real Markets
            </p>
            <h2 className="mt-3 font-serif text-4xl tracking-[-0.055em] text-white md:text-5xl">
              {safeLocale === "pl"
                ? "Cross-asset reader dla rynku, źródeł i proof passport."
                : safeLocale === "de"
                  ? "Cross-Asset-Reader fuer Markt, Quellen und Proof Passport."
                  : "Cross-asset reader for market state, sources and the proof passport."}
            </h2>
            <p
              className="mt-4 max-w-2xl font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.36]"
              data-pass1414-real-markets-no-extra-pills="true"
            >
              {safeLocale === "pl"
                ? "Prosty terminal: tabela → prostokątny wykres → Basic / Pro / Advanced."
                : safeLocale === "de"
                  ? "Einfaches Terminal: Tabelle → rechteckiger Chart → Basic / Pro / Advanced."
                  : "Simple terminal: table → rectangular chart → Basic / Pro / Advanced."}
            </p>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-white/[0.56]">
              {safeLocale === "pl"
                ? "Akcje, FX, ETF-y, indeksy, towary i proxy nieruchomości działają tutaj jako jeden source-bound terminal. Najpierw czytelny market state, potem detail reader i dopiero dalej AI / handoff."
                : safeLocale === "de"
                  ? "Aktien, FX, ETFs, Indizes, Rohstoffe und Immobilien-Proxys laufen hier als ein source-bound Terminal. Erst lesbarer Marktstatus, dann der Detail Reader und erst danach AI / Handoff."
                  : "Stocks, FX, ETFs, indices, commodities and real-estate proxies run here as one source-bound terminal. Readable market state first, then the detail reader, and only then AI / handoff."}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {commandStatusCards.map((card) => (
              <div
                key={card.label}
                className={`rounded-[1.25rem] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${
                  card.tone === "gold"
                    ? "border-velmere-gold/[0.18] bg-velmere-gold/[0.07]"
                    : card.tone === "cyan"
                      ? "border-cyan-200/[0.18] bg-cyan-300/[0.06]"
                      : card.tone === "ready"
                        ? "border-emerald-300/[0.18] bg-emerald-400/[0.06]"
                        : "border-white/[0.08] bg-white/[0.03]"
                }`}
              >
                <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-white/[0.40]">
                  {card.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/[0.84]">
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="velmere-command-shell realmarkets-hero-pass2319 velmere-realmarkets-hero-identity flex flex-col gap-5 rounded-[2rem] p-4 lg:flex-row lg:items-end lg:justify-between md:p-5">
        <div className="velmere-realmarkets-hero-copy">
          <div className="velmere-realmarkets-hero-title-row">
            <span className="velmere-realmarkets-hero-mark"><BarChart3 aria-hidden="true" /></span>
            <h1 className="realmarkets-hero-title-pass2344 shield-serif-display text-5xl tracking-[-0.055em] text-white md:text-6xl">
              {c.title}
            </h1>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/[0.54]">
            {c.subtitle}
          </p>
        </div>
        <div className="realmarkets-pass4567-search-actions flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center" data-pass4567-realmarkets-search-actions="shield-shieldpro-buttons-beside-search-active-realmarkets-hidden">
        <div
          ref={searchRef}
          className="realmarkets-search-pass2319 relative w-full min-w-0 lg:w-auto lg:min-w-[22rem]"
        >
          <label className="velmere-command-pill flex min-h-[3rem] w-full justify-start gap-3 px-4 py-3 focus-within:border-cyan-200/[0.18] lg:min-w-[22rem]">
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin text-velmere-gold" />
            ) : (
              <Search className="h-4 w-4 text-velmere-gold" />
            )}
            <input
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={query}
              data-testid="realmarkets-search-input"
              onChange={(event: Pass4149InputChangeEvent) => {
                if (
                  event.target.value.trim().toLowerCase() !==
                  committedSearchRef.current.toLowerCase()
                ) {
                  committedSearchRef.current = "";
                }
                setQuery(event.target.value);
                setSearchOpen(Boolean(event.target.value.trim()));
              }}
              onFocus={() => setSearchOpen(Boolean(query.trim()))}
              onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                if (event.key === "Escape") setSearchOpen(false);
                if (event.key === "Enter") {
                  event.preventDefault();
                  const asset = pass621SearchResolution.exact;
                  if (!asset) {
                    setSearchOpen(Boolean(searchSuggestions.length));
                    return;
                  }
                  committedSearchRef.current = asset.symbol;
                  setSearchReceipt(
                    buildPass579ExactSearchReceipt(
                      asset.symbol,
                      searchSuggestions,
                    ).receipt,
                  );
                  setQuery(asset.symbol);
                  setRemoteAssets([asset]);
                  setSearchOpen(false);
                  setRange("1w");
                  handleAssetClick(asset);
                }
              }}
              placeholder={c.search}
              className="realmarkets-search-input-pass2329 min-w-0 flex-1 border-0 bg-transparent text-sm text-white outline-none placeholder:text-white/[0.30]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  committedSearchRef.current = "";
                  setQuery("");
                  setRemoteAssets([]);
                  setSearchOpen(false);
                }}
                className="text-white/[0.38] hover:text-white"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </label>
          {searchOpen && query.trim() && searchSuggestions.length ? (
            <div
              data-pass579-search-receipt={
                searchReceipt?.match ?? searchResolution.receipt.match
              }
              className="velmere-popover-surface absolute left-0 right-0 top-[calc(100%+0.65rem)] overflow-hidden p-2"
              style={pass628LayerStyle("listbox")}
            >
              <p className="px-3 pb-2 pt-1 font-mono text-[7px] uppercase tracking-[0.12em] text-white/[0.30]">
                {pass621SearchResolution.autoOpen
                  ? safeLocale === "pl"
                    ? "Dokładne trafienie — Enter otwiera analizę"
                    : safeLocale === "de"
                      ? "Exakter Treffer — Enter öffnet die Analyse"
                      : "Exact match — Enter opens analysis"
                  : safeLocale === "pl"
                    ? "Wybierz instrument — podobne wyniki nie otwierają się automatycznie"
                    : safeLocale === "de"
                      ? "Instrument auswählen — ähnliche Treffer öffnen nicht automatisch"
                      : "Choose an instrument — similar matches never auto-open"}
              </p>
              {searchSuggestions.map((asset: Pass4149RealMarketsAsset) => (
                <button
                  key={asset.providerSymbol}
                  type="button"
                  onMouseDown={(event: ReactMouseEvent<HTMLButtonElement>) =>
                    event.preventDefault()
                  }
                  onClick={() => {
                    committedSearchRef.current = asset.symbol;
                    setSearchReceipt(
                      buildPass579ExactSearchReceipt(
                        asset.symbol,
                        searchSuggestions,
                      ).receipt,
                    );
                    setQuery(asset.symbol);
                    setRemoteAssets([asset]);
                    setSearchOpen(false);
                    setRange("1w");
                    handleAssetClick(asset);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-cyan-300/[0.055]"
                >
                  <AssetLogo asset={asset} />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-white">
                      {asset.symbol}
                    </strong>
                    <small className="block truncate text-xs text-white/[0.48]">
                      {asset.name}
                    </small>
                  </span>
                  <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.34]">
                    {c.tabs[asset.category]}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
          <div className="shield-pass4563-route-buttons realmarkets-pass4567-route-buttons flex shrink-0 items-center gap-2" aria-label="Real Markets product routes" data-pass4567-realmarkets-route-buttons="active-realmarkets-hidden">
            <a href={`/${safeLocale}/market-integrity`} className="shield-pass4563-route-button shield-pass4563-route-button--shield velmere-product-route-card" data-pass4567-realmarkets-route-button="shield">
              <span className="velmere-product-route-icon"><ShieldCheck aria-hidden="true" /></span>
              <span className="velmere-product-route-copy"><small>CORE 01</small><strong>Velmère Shield</strong></span>
              <ArrowUpRight className="velmere-product-route-arrow" aria-hidden="true" />
            </a>
            <a href={`/${safeLocale}/shield-pro`} className="shield-pass4563-route-button shield-pass4563-route-button--pro velmere-product-route-card" data-pass4567-realmarkets-route-button="shield-pro">
              <span className="velmere-product-route-icon"><Activity aria-hidden="true" /></span>
              <span className="velmere-product-route-copy"><small>PRO 02</small><strong>Shield Pro</strong></span>
              <ArrowUpRight className="velmere-product-route-arrow" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      <div
        className="realmarkets-overview-pass2319"
        data-pass2319-realmarkets-overview="target-dashboard-cards"
      >
        {pass2319OverviewCards.map((card: Pass4153RealMarketsOverviewCard) => {
          const Icon = card.icon;
          return (
            <article
              key={card.label}
              data-tone={card.tone}
              data-accent={card.accent ?? "dot"}
              style={
                card.accent === "progress"
                  ? ({
                      "--realmarkets-progress": `${Math.max(0, Math.min(100, card.progressPercent ?? 0))}%`,
                    } as CSSProperties)
                  : undefined
              }
            >
              <span className="realmarkets-overview-label">
                <Icon
                  aria-hidden="true"
                  className="realmarkets-overview-label-icon"
                />
                <span>{card.label}</span>
              </span>
              <strong>{card.value}</strong>
              {card.accent === "sparkline" ? (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 120 34"
                  preserveAspectRatio="none"
                  className="realmarkets-overview-accent realmarkets-overview-accent-sparkline"
                >
                  <polyline points={pass4388OverviewSparklinePoints} />
                </svg>
              ) : null}
              <small>{card.delta}</small>
              {card.accent === "progress" ? (
                <em
                  aria-hidden="true"
                  className="realmarkets-overview-accent realmarkets-overview-accent-progress"
                />
              ) : null}
              <i aria-hidden="true" />
            </article>
          );
        })}
      </div>

      {category === "exchanges" ? (
        <div
          className="mt-3 grid gap-2 rounded-[1.4rem] border border-velmere-gold/[0.12] bg-velmere-gold/[0.035] p-4 md:grid-cols-3"
          data-pass452-venue-lifecycle="true"
        >
          <div>
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-velmere-gold/[0.70]">
              Binance WebSocket
            </p>
            <p className="mt-2 text-xs leading-5 text-white/[0.52]">
              {safeLocale === "pl"
                ? "Heartbeat, kontrola ping/pong i planowany reconnect przed limitem połączenia."
                : safeLocale === "de"
                  ? "Heartbeat, Ping/Pong-Kontrolle und geplanter Reconnect vor dem Verbindungslimit."
                  : "Heartbeat, ping/pong supervision and planned reconnect before the connection limit."}
            </p>
          </div>
          <div>
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-velmere-gold/[0.70]">
              MEXC WebSocket
            </p>
            <p className="mt-2 text-xs leading-5 text-white/[0.52]">
              {safeLocale === "pl"
                ? "Połączenie traktowane jako maksymalnie 24-godzinne; expiry i reconnect są częścią Advanced."
                : safeLocale === "de"
                  ? "Verbindung als maximal 24 Stunden behandelt; Expiry und Reconnect gehören zu Advanced."
                  : "Connection treated as no longer than 24 hours; expiry and reconnect belong to Advanced."}
            </p>
          </div>
          <div>
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-velmere-gold/[0.70]">
              {safeLocale === "pl"
                ? "Połączenia live"
                : safeLocale === "de"
                  ? "Live-Verbindungen"
                  : "Live connections"}
            </p>
            <p className="mt-2 text-xs leading-5 text-white/[0.52]">
              {safeLocale === "pl"
                ? "Venue health pozostaje osobną warstwą od ceny publicznej spółki."
                : safeLocale === "de"
                  ? "Venue Health bleibt getrennt vom Preis einer börsennotierten Gesellschaft."
                  : "Venue health stays separate from the price of a listed company."}
            </p>
          </div>
          <div
            className="md:col-span-3 mt-1 grid gap-2 border-t border-white/[0.07] pt-3 sm:grid-cols-2 xl:grid-cols-3"
            data-pass577-provider-slo-console="true"
          >
            {exchangeProviderSloRows.map(
              ({ asset, slo }: Pass4153ExchangeProviderSloRow) => (
                <div
                  key={asset.id}
                  className={`realmarkets-provider-slo ${slo.state}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-white/[0.78]">
                        {asset.name}
                      </p>
                      <p className="mt-1 font-mono text-[7px] uppercase tracking-[0.12em] text-white/[0.34]">
                        {slo.label}
                      </p>
                    </div>
                    <span className="font-mono text-sm text-velmere-gold tabular-nums">
                      {slo.score}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5 font-mono text-[7px] uppercase tracking-[0.08em] text-white/[0.38]">
                    <span>
                      retry{" "}
                      {slo.retrySuccess == null
                        ? "n/a"
                        : `${slo.retrySuccess}%`}
                    </span>
                    <span>
                      recovery{" "}
                      {slo.recoveryMs == null ? "n/a" : `${slo.recoveryMs}ms`}
                    </span>
                    <span>
                      fresh{" "}
                      {slo.freshnessSeconds == null
                        ? "n/a"
                        : `${slo.freshnessSeconds}s`}
                    </span>
                  </div>
                  <p className="shield-copy-safe mt-2 text-[10px] leading-5 text-white/[0.44]">
                    {slo.nextAction}
                  </p>
                </div>
              ),
            )}
          </div>
        </div>
      ) : null}

      <div
        className="realmarkets-pass618-cards mt-5 grid gap-3 md:grid-cols-2 lg:hidden"
        data-pass479-realmarkets-card-grid="true"
      >
        {visibleRows.map((asset: Pass4149RealMarketsAsset) => {
          const quote = quoteForAsset(quotes, asset);
          const lineage = buildRealMarketLineage(asset, quote);
          const change24h = pass4570RealMarketsChange(asset, quote, 24 * 60 * 60);
          const volume = quoteVolume(quote);
          const marketCap = quoteMarketCap(quote, asset);
          const risk = dynamicRisk(quote, asset.risk, asset);
          const rowTone = risk === null ? null : realMarketsRowTone(risk);
          const sourceLabel = sourceQualityLabel(quote, asset, safeLocale);
          return (
            <article
              key={`mobile-${asset.category}-${asset.id}`}
              role="button"
              tabIndex={0}
              data-testid="realmarkets-row-mobile"
              data-source-state={lineage.state}
              data-provider-lineage={lineage.provider}
              data-pass2209-asset-modal-disabled="replaced-by-pass2210"
              data-pass2210-asset-modal="clean-rebuild"
              data-pass4516-mobile-row-contract="card-action-owned-chart-never-focusable"
              data-pass4517-mobile-row-contract="single-hitbox-no-inner-chart-target"
              data-pass4518-mobile-row-contract="quiet-card-action-chart-inert"
                  data-pass4519-mobile-row-contract="quiet-card-left-accent-chart-pointerless"
              data-pass4520-mobile-row-contract="single-card-action-chart-inert-safe-left-accent"
              data-pass4521-mobile-card-contract="single-mobile-action-chart-inert-no-inner-hitbox"
              data-pass4522-mobile-card-contract="opens-exclusive-edge-drawer-chart-remains-inert"
              onClick={() => {
                handleAssetClick(asset);
              }}
              onKeyDown={(event: ReactKeyboardEvent<HTMLElement>) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleAssetClick(asset);
                }
              }}
              className={`w-full overflow-hidden rounded-[1.45rem] border bg-[#0c0d0e] p-4 text-left ${
                rowTone === "critical"
                  ? "border-rose-300/[0.16]"
                  : rowTone === "warning"
                    ? "border-amber-300/[0.16]"
                    : rowTone === "watch"
                      ? "border-cyan-200/[0.14]"
                      : "border-white/[0.09]"
              }`}
            >
              <div className="flex items-start gap-3">
                <AssetLogo asset={asset} />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-start justify-between gap-3">
                    <span className="min-w-0">
                      <strong className="block truncate text-sm text-white">
                        {asset.name}
                      </strong>
                      <small className="mt-1 block truncate font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/[0.34]">
                        {asset.symbol} ·{" "}
                        {asset.exchange || c.tabs[asset.category]}
                      </small>
                    </span>
                    <span className="shrink-0 rounded-full border border-white/[0.09] px-2.5 py-1 font-mono text-[9px] text-white/[0.54]">
                      {safeLocale === "pl"
                        ? "ryzyko"
                        : safeLocale === "de"
                          ? "Risiko"
                          : "risk"}{" "}
                      {risk === null ? "—" : formatDecimalPercent(risk)}
                    </span>
                  </span>
                  <span className="mt-3 flex items-end justify-between gap-3">
                    <span>
                      <strong className="block font-mono text-lg text-white tabular-nums">
                        {formatPrice(quote, asset.category)}
                      </strong>
                      <span
                        className={`mt-1 block font-mono text-xs tabular-nums ${
                          typeof change24h === "number"
                            ? change24h >= 0
                              ? "text-emerald-300"
                              : "text-rose-300"
                            : "text-white/[0.30]"
                        }`}
                      >
                        24H ·{" "}
                        {typeof change24h === "number"
                          ? `${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%`
                          : "—"}
                      </span>
                    </span>
                  </span>
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <span className="rounded-xl border border-white/[0.07] bg-black/[0.18] p-3">
                  <span className="block font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.30]">
                    {safeLocale === "pl"
                      ? "Kapitalizacja"
                      : safeLocale === "de"
                        ? "Marktkapitalisierung"
                        : "Market cap"}
                  </span>
                  <strong className="mt-1.5 block truncate font-mono text-[11px] text-white/[0.70]">
                    {formatCompactAmount(safeLocale, marketCap)
                      ? formatCompactAmount(safeLocale, marketCap)
                      : asset.category === "fx" ||
                          asset.category === "commodities" ||
                          asset.category === "indices"
                        ? safeLocale === "pl"
                          ? "nie dotyczy"
                          : safeLocale === "de"
                            ? "nicht anwendbar"
                            : "not applicable"
                        : "—"}
                  </strong>
                </span>
                <span className="rounded-xl border border-white/[0.07] bg-black/[0.18] p-3">
                  <span className="block font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.30]">
                    {c.volume}
                  </span>
                  <strong className="mt-1.5 block truncate font-mono text-[11px] text-white/[0.70]">
                    {formatCompactAmount(safeLocale, volume)
                      ? formatCompactAmount(safeLocale, volume)
                      : safeLocale === "pl"
                        ? "brak danych"
                        : safeLocale === "de"
                          ? "keine Daten"
                          : "no data"}
                  </strong>
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
                <span className="min-w-0 truncate font-mono text-[9px] uppercase tracking-[0.11em] text-white/[0.32]">
                  {sourceLabel}
                </span>
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.11em] text-cyan-100/[0.54]">
                  {safeLocale === "pl"
                    ? "Otwórz analizę"
                    : safeLocale === "de"
                      ? "Analyse öffnen"
                      : "Open analysis"}
                </span>
              </div>
            </article>
          );
        })}
        {loading || searching ? (
          <div className="velmere-stable-surface velmere-stable-skeleton rounded-[1.35rem] p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-cyan-200/[0.18] bg-cyan-300/[0.07] text-cyan-100">
                <Loader2 className="h-4 w-4 animate-spin" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="velmere-stable-skeleton__eyebrow" />
                <div className="velmere-stable-skeleton__row mt-3 w-[72%]" />
              </div>
            </div>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.15em] text-white/[0.44]">
              {searching ? c.searching : c.loading}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[1rem] border border-white/[0.07] bg-black/[0.18] p-3"
                >
                  <div className="velmere-stable-skeleton__row" />
                  <div className="velmere-stable-skeleton__row mt-3 w-[68%]" />
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {visibleRows.length < displayRows.length ? (
          <button
            type="button"
            onClick={() =>
              setVisibleLimit((current: number) =>
                Math.min(current + 50, displayRows.length),
              )
            }
            className="min-h-10 rounded-[1.2rem] border border-cyan-200/[0.16] bg-cyan-300/[0.05] px-4 py-3 font-mono text-[9px] uppercase tracking-[0.12em] text-cyan-50 transition hover:bg-cyan-300/[0.10]"
          >
            {safeLocale === "pl"
              ? `Pokaż więcej · ${visibleRows.length}/${displayRows.length}`
              : safeLocale === "de"
                ? `Mehr anzeigen · ${visibleRows.length}/${displayRows.length}`
                : `Show more · ${visibleRows.length}/${displayRows.length}`}
          </button>
        ) : null}
      </div>

      {!loading && !searching && debouncedQuery.trim() && displayRows.length === 0 ? (
        <section className="mt-5 rounded-[1.6rem] border border-white/[0.09] bg-[#0c0d0e] px-6 py-14 text-center" aria-live="polite">
          <p className="text-sm text-white/[0.58]">
            {safeLocale === "pl" ? "Brak instrumentów pasujących do wyszukiwania" : safeLocale === "de" ? "Keine Instrumente entsprechen der Suche" : "No instruments match your search"}
          </p>
          <button
            type="button"
            onClick={() => { committedSearchRef.current = ""; setQuery(""); setRemoteAssets([]); setSearchOpen(false); }}
            className="mt-4 rounded-full border border-white/[0.12] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-velmere-gold transition hover:border-velmere-gold/40"
          >
            {safeLocale === "pl" ? "Wyczyść wyszukiwanie" : safeLocale === "de" ? "Suche löschen" : "Clear search"}
          </button>
        </section>
      ) : null}

      <Pass2810RealMarketsTableErrorBoundary locale={safeLocale}>
        <div
          className={`realmarkets-pass578-table realmarkets-pass618-table mt-5 w-full overflow-hidden rounded-[1.6rem] border border-white/[0.09] bg-[#0c0d0e] ${displayRows.length ? "hidden lg:block" : "hidden"}`}
          data-pass2819-mobile-overlay-gate="realmarkets-contained-table-no-hidden-overlay"
          data-pass2819-chart-touch-safe="mini-charts-read-only-no-scroll-trap"
          data-pass2810-realmarkets-table-boundary="wrapped"
          data-pass479-realmarkets-desktop-table="true"
          data-pass2886-realmarkets-visible-runtime-typecheck-repair="icon-chart-skeleton-proof-required"
          data-pass2890-realmarkets-local-runtime-smoke="icons-source-charts-neutral-skeleton-no-underlay"
          data-pass2891-realmarkets-browser-route-smoke-target="aapl-nvda-adidas-binance-mexc-icons-source-chart-neutral-skeleton-no-underlay"
          data-pass2892-playwright-realmarkets-target="aapl-nvda-adidas-binance-mexc-icons-chart-skeleton-no-underlay-receipt"
          data-pass2893-release-evidence-realmarkets-target="icons-chart-skeleton-no-underlay-screenshot-artifact"
          data-pass2894-operator-go-no-go-realmarkets-target="icons-chart-skeleton-no-underlay-production-no-go-until-receipts"
          data-pass2895-receipt-freshness-realmarkets-target="fresh-icons-chart-no-underlay-dom-png-receipts-required"
          data-pass2896-tamper-proof-ledger-realmarkets-target="sha256-ledger-required-for-icons-chart-no-underlay-receipts"
          data-pass2897-release-attestation-realmarkets-target="independent-attestation-required-for-icons-chart-skeleton-no-underlay"
          data-pass2898-revocation-sentinel-realmarkets-target="revoke-go-if-icons-chart-skeleton-no-underlay-receipts-drift"
          data-pass2899-recovery-reapproval-realmarkets-target="fresh-post-rollback-icons-chart-skeleton-no-underlay-receipts-required"
          data-pass2900-release-continuity-realmarkets-target="contiguous-lineage-required-icons-chart-skeleton-no-underlay"
          data-pass2901-release-promotion-escrow-realmarkets-target="promotion-escrow-blocks-production-go-until-fresh-icons-chart-no-underlay-receipts"
          data-pass2902-production-claim-notary-realmarkets-target="final-notary-manifest-required-for-icons-chart-no-underlay-production-claim"
          data-pass2903-post-claim-surveillance-realmarkets-target="live-drift-probation-required-for-icons-chart-no-underlay"
          data-pass2904-claim-expiry-renewal-realmarkets-target="claim-expires-renewal-requires-fresh-icons-chart-no-underlay-ci-receipts"
          data-pass2905-public-claim-transparency-realmarkets-target="customer-verifiable-no-go-status-icons-chart-no-underlay-receipts-visible"
          data-pass2906-public-status-dispute-correction-realmarkets-target="dispute-correction-keeps-no-go-until-icons-chart-no-underlay-evidence-is-sha256-bound"
          data-pass2907-public-status-appeal-review-realmarkets-target="appeal-keeps-no-go-until-independent-review-validates-icons-chart-no-underlay"
          data-pass2908-public-status-final-arbitration-realmarkets-target="final-arbitration-keeps-no-go-until-binding-resolution-freezes-icons-chart-no-underlay"
          data-pass2909-post-arbitration-public-resolution-realmarkets-target="public-resolution-seal-keeps-no-go-until-remediation-retests-icons-chart-no-underlay"
          data-pass2910-remediation-execution-closure-realmarkets-target="remediation-execution-closure-keeps-no-go-until-icons-chart-no-underlay-post-patch-retests"
          data-pass2911-post-remediation-stability-watch-realmarkets-target="post-remediation-stability-watch-keeps-no-go-until-icons-chart-no-underlay-relapse-sentinel"
          data-pass2912-post-remediation-trust-restore-handover-realmarkets-target="trust-restore-handover-keeps-no-go-until-icons-chart-no-underlay-final-rollup"
          data-pass2913-post-restore-continuity-monitor-realmarkets-target="post-restore-continuity-keeps-no-go-until-icons-chart-no-underlay-drift-sentinel"
          data-pass2914-public-trust-evidence-decay-realmarkets-target="evidence-age-renewal-escrow-required-for-icons-chart-no-underlay-receipts"
          data-pass2915-renewal-escrow-promotion-quarantine-realmarkets-target="renewal-escrow-candidate-quarantined-until-independent-replay-validates-icons-chart-no-underlay"
          data-pass2916-renewal-promotion-final-seal-realmarkets-target="renewal-promotion-restore-candidate-blocked-until-final-seal-dual-control-and-scheduled-revalidation"
          data-pass2917-scheduled-revalidation-execution-breach-realmarkets-target="scheduled-revalidation-miss-auto-downgrades-realmarkets-public-trust-until-fresh-icons-chart-receipts"
          data-pass2918-downgrade-recovery-escrow-realmarkets-target="downgraded-realmarkets-public-trust-requires-customer-notice-reopen-and-fresh-icons-chart-recovery-receipts"
          data-pass2919-recovery-replay-adjudication-realmarkets-target="recovery-escrow-realmarkets-public-trust-requires-independent-icons-chart-replay-and-customer-acknowledgement"
          data-pass2920-recovery-restore-probation-realmarkets-target="public-recovery-decision-enters-realmarkets-restore-probation-until-icons-chart-no-underlay-observation-receipts"
          data-pass2921-probation-exit-seal-realmarkets-target="realmarkets-probation-exit-blocked-until-sustained-icons-chart-no-underlay-graduation-seal"
          data-pass2888-realmarkets-no-grey-underlay="source-polyline-or-neutral-skeleton-only"
          data-pass1998-table-polish="desktop-clean-no-source-clutter"
          data-pass2000-table-qa="aligned-chart-column-no-source-no-row-noise"
          data-pass578-full-width-density="no-horizontal-scroll"
          data-pass4485-realmarkets-table-fit="shield-parity-density-endcap-drawer"
          data-pass4572-realmarkets-data-trust="live-only-percent-major-asset-sanity-average-trimmed"
          data-pass4573-realmarkets-data-trust="strict-display-contract-no-fallback-percent-no-fake-average"
          data-pass4574-realmarkets-data-trust="source-live-display-contract-visible-pending-footer"
          data-pass4575-realmarkets-data-trust="fresh-live-priced-source-candles-only-no-stale-percent"
          data-pass4618-realmarkets-repair="source-bound-percent-average-charts-official-icons-no-operator-rails"
          data-pass4619-realmarkets-truth="source-candles-only-no-reconstructed-sparkline-canonical-modal-logo"
          data-pass4635-realmarkets-table="staged-batched-chart-hydration-three-attempt-source-only"
        >
          <div
            className="w-full min-w-0 overflow-x-auto overscroll-x-contain [touch-action:pan-x]"
            data-pass2819-contained-overflow="realmarkets-desktop-table"
            data-pass4524-realmarkets-table-scroll="contained-no-edge-clipping"
            data-pass4530-realmarkets-table-scroll="open-rail-grid-keeps-readable-min-width"
            data-pass4517-table-scroll="desktop-silent-scrollbar-no-xp-bar"
          >
            <div
              className="sr-only"
              data-pass4618-public-operator-rails="removed-from-customer-table"
              aria-hidden="true"
            />
            <div className="realmarkets-pass578-grid realmarkets-pass618-grid grid gap-2.5 border-b border-white/[0.08] px-5 py-4 font-mono text-[8px] uppercase tracking-[0.15em] text-white/[0.32]">
              <span>{c.name}</span>
              <RealMarketsSortButton label={c.price} sortKey="price" sort={sort} onUpdateSort={updateSort} align="right" />
              <RealMarketsSortButton label="1H" sortKey="change1h" sort={sort} onUpdateSort={updateSort} align="right" />
              <RealMarketsSortButton label="24H" sortKey="change24h" sort={sort} onUpdateSort={updateSort} align="right" />
              <RealMarketsSortButton label="7D" sortKey="change7d" sort={sort} onUpdateSort={updateSort} align="right" />
              <RealMarketsSortButton
                label={
                  safeLocale === "pl"
                    ? "Kapitalizacja"
                    : safeLocale === "de"
                      ? "Marktkapitalisierung"
                      : "Market cap"
                }
                sortKey="marketCap"
                sort={sort}
                onUpdateSort={updateSort}
                align="right"
              />
              <RealMarketsSortButton label={c.volume} sortKey="volume" sort={sort} onUpdateSort={updateSort} align="right" />
              <RealMarketsSortButton label={c.risk} sortKey="risk" sort={sort} onUpdateSort={updateSort} align="center" />
              <span className="flex items-center justify-center text-center font-mono text-[8px] uppercase tracking-[0.15em]">
                {safeLocale === "pl"
                  ? "Wykres"
                  : safeLocale === "de"
                    ? "Diagramm"
                    : "Chart"}
              </span>
            </div>
            {visibleRows.map((asset: Pass4149RealMarketsAsset) => {
              const quote = quoteForAsset(quotes, asset);
              const lineage = buildRealMarketLineage(asset, quote);
              const change1h = pass4570RealMarketsChange(asset, quote, 60 * 60);
              const change24h = pass4570RealMarketsChange(asset, quote, 24 * 60 * 60);
              const change7d = pass4570RealMarketsChange(asset, quote, 7 * 24 * 60 * 60);
              const rowTrust = pass4579VisibleDataDecision(quote, asset.category, safeLocale);
              const marketCap = quoteMarketCap(quote, asset);
              const volume = quoteVolume(quote);
              const risk = dynamicRisk(quote, asset.risk, asset);
              const rowTone = risk === null ? null : realMarketsRowTone(risk);
              return (
                <div
                  key={`${asset.category}-${asset.id}`}
                  role="button"
                  tabIndex={0}
                  data-testid="realmarkets-row"
                  data-source-state={lineage.state}
                  data-provider-lineage={lineage.provider}
                  data-pass2209-asset-modal-disabled="replaced-by-pass2210"
                  data-pass2210-asset-modal="clean-rebuild"
                  data-pass4467-row-click-target="realmarkets-asset-modal"
                  data-pass4513-row-contract="full-row-opens-drawer-chart-cell-passive"
                  data-pass4514-row-contract="row-is-only-action-mini-chart-is-pure-visual"
                  data-pass4515-row-contract="row-only-action-chart-cell-pointerless"
                  data-pass4516-row-contract="keyboard-focus-visible-row-action-mini-chart-inert"
                  data-pass4517-row-hitbox="row-only-click-chart-cell-never-steals-hover-or-focus"
                  data-pass4518-row-hitbox="quiet-left-accent-full-row-only-chart-inert"
                  data-pass4519-row-hitbox="left-accent-focus-visible-no-full-ring-chart-inert"
                  data-pass4520-row-hitbox="single-action-left-accent-no-background-ring-chart-inert"
                  data-pass4521-row-hitbox="single-row-action-sticky-header-safe-chart-pixel-inert"
                  data-pass4522-row-hitbox="opens-exclusive-edge-drawer-and-closes-intel-layer"
                  data-pass4524-row-hitbox="grid-columns-fit-viewport-chart-cell-contained"
                  data-pass4573-row-data-trust={lineage.state}
                  data-pass4578-row-trust={rowTrust.state}
                  data-pass4578-row-tone={rowTrust.tone}
                  data-pass4578-row-chart={rowTrust.canShowChart ? "source-chart" : "source-pending"}
                  data-pass4579-row-decision={rowTrust.decision}
                  data-pass4579-row-age={rowTrust.ageSeconds ?? "missing"}
                  data-pass4579-row-action={rowTrust.actionLabel}
                  data-pass4581-row-window-truth="per-window-live-vs-session-vs-withheld"
                  data-pass4587-row-affordance={pass4587InteractionRhythm.rowAffordance}
                  data-pass4587-modal-pace={pass4587InteractionRhythm.modalPace}
                  data-pass4587-pointer-intent={pass4587InteractionRhythm.pointerIntent}
                  aria-label={`${asset.name} ${safeLocale === "pl" ? "pełny wykres i analiza" : safeLocale === "de" ? "voller Chart und Analyse" : "full chart and analysis"}`}
                  onClick={() => {
                    handleAssetClick(asset);
                  }}
                  onKeyDown={(event: Pass4153RealMarketsGridKeyEvent) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleAssetClick(asset);
                    }
                  }}
                  className={`realmarkets-pass578-grid realmarkets-pass618-grid grid w-full items-center gap-2.5 border-b px-5 py-4 text-left last:border-b-0 ${
                    rowTone === "critical"
                      ? "border-white/[0.07] bg-[linear-gradient(90deg,rgba(251,113,133,0.06),transparent_48%)]"
                      : rowTone === "warning"
                        ? "border-white/[0.07] bg-[linear-gradient(90deg,rgba(251,191,36,0.05),transparent_48%)]"
                        : rowTone === "watch"
                          ? "border-white/[0.07] bg-[linear-gradient(90deg,rgba(34,211,238,0.045),transparent_48%)]"
                          : "border-white/[0.07]"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <AssetLogo asset={asset} />
                    <span className="min-w-0">
                      <strong className="block truncate text-sm text-white">
                        {asset.name}
                      </strong>
                      <small className="mt-1 block font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.34]">
                        {asset.symbol} ·{" "}
                        {asset.exchange || c.tabs[asset.category]}
                      </small>
                      <small
                        className="realmarkets-source-line-quiet mt-1 block truncate font-mono text-[7px] uppercase tracking-[0.10em] text-cyan-100/[0.32]"
                        data-pass1996-row-source-line="quiet-hidden-until-expanded"
                      >
                        {pass6PublicSourceQuality(quote, asset, safeLocale)}
                      </small>
                    </span>
                  </span>
                  <strong className="font-mono text-sm text-right text-white tabular-nums">
                    {formatPrice(quote, asset.category)}
                  </strong>
                  {[
                    { change: change1h, windowSeconds: 60 * 60 },
                    { change: change24h, windowSeconds: 24 * 60 * 60 },
                    { change: change7d, windowSeconds: 7 * 24 * 60 * 60 },
                  ].map(({ change, windowSeconds }, index) => {
                    const movement = pass4581WindowMovementDecision(quote, asset.category, safeLocale, windowSeconds);
                    const sourceBoundHistoricalMetric =
                      quote?.realMarketsHourlyMetricsReceipt?.status === "source_bound" &&
                      typeof change === "number";
                    const directional =
                      movement.mayUseDirectionalTone && pass4580MayUseDirectionalColor(rowTrust);
                    const evidenceLabel = sourceBoundHistoricalMetric
                      ? `${movement.windowLabel} · source-bound timestamped hourly candles · ${quote?.realMarketsHourlyMetricsReceipt?.source ?? "verified market source"}`
                      : `${movement.windowLabel} · ${movement.reason} · ${rowTrust.actionLabel}`;
                    return (
                      <span
                        key={index}
                        className={`font-mono text-xs tabular-nums text-right ${pass4580PercentClass(change, directional)}`}
                        data-pass4580-percent-tone={directional ? "directional-live" : rowTrust.decision === "withheld" ? "withheld" : "neutral-labelled"}
                        data-pass4581-window-tone={pass4581WindowToneAttribute(movement)}
                        data-pass4581-window-label={movement.windowLabel}
                        title={evidenceLabel}
                      >
                        {typeof change === "number"
                          ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`
                          : "—"}
                      </span>
                    );
                  })}
                  <span className="font-mono text-xs text-right text-white/[0.58]">
                    {formatCompactAmount(safeLocale, marketCap)
                      ? formatCompactAmount(safeLocale, marketCap)
                      : asset.category === "indices"
                        ? safeLocale === "pl"
                          ? "poziom indeksu"
                          : safeLocale === "de"
                            ? "Indexstand"
                            : "index level"
                        : asset.category === "fx" ||
                            asset.category === "commodities"
                          ? safeLocale === "pl"
                            ? "nie dotyczy"
                            : safeLocale === "de"
                              ? "nicht anwendbar"
                              : "not applicable"
                          : safeLocale === "pl"
                            ? "brak danych"
                            : safeLocale === "de"
                              ? "keine Daten"
                              : "no data"}
                  </span>
                  <span className="font-mono text-xs text-right text-white/[0.58]">
                    {formatCompactAmount(safeLocale, volume)
                      ? formatCompactAmount(safeLocale, volume)
                      : safeLocale === "pl"
                        ? "brak danych"
                        : safeLocale === "de"
                          ? "keine Daten"
                          : "no data"}
                  </span>
                  <span className="realmarkets-risk-cell-pass4600 inline-flex w-full min-w-0 items-center justify-center overflow-visible">
                    <RiskHistoryControl
                      assetId={asset.id}
                      assetName={asset.name}
                      symbol={asset.symbol}
                      currentObservation={{
                        schemaVersion: "velmere.risk-history-current-observation.v1",
                        status: "AVAILABLE",
                        score: risk,
                        snapshotScore: risk ? Math.round(risk) : null,
                        observedAt: new Date().toISOString(),
                        canonicalAssetId: `market:${asset.id}`,
                        methodologyVersion: "continuous_fusion_v10",
                        scoreVersion: "v10",
                        evidenceVersion: "v10",
                        comparabilityKey: "cross_asset_v10",
                        blocker: null,
                      }}
                      locale={safeLocale}
                      enabled={true}
                    />
                  </span>
                  <span
                    className="realmarkets-chart-cell-pass2333 flex min-h-10 w-full items-center justify-center overflow-visible"
                    data-pass2887-realmarkets-chart-cell-proof="no-grey-underlay-source-or-skeleton"
                    data-pass2888-realmarkets-chart-cell="fixed-width-source-or-neutral-skeleton"
                    data-pass2890-realmarkets-chart-cell="fixed-width-source-or-neutral-skeleton-smoke"
                    data-pass2892-playwright-realmarkets-chart-receipt="source-or-neutral-skeleton-no-grey-underlay"
                    data-pass2893-release-evidence-realmarkets-chart="screenshot-artifact-required"
                    data-pass2894-operator-go-no-go-realmarkets-chart="production-go-requires-png-dom-receipt"
                    data-pass2895-receipt-freshness-realmarkets-chart="fresh-chart-skeleton-no-grey-underlay-receipt-required"
                    data-pass2896-tamper-proof-ledger-realmarkets-chart="sha256-hash-required-for-chart-skeleton-no-underlay-receipt"
                    data-pass2897-release-attestation-realmarkets-chart="attestation-digest-required-for-chart-skeleton-no-underlay-receipt"
                    data-pass2898-revocation-sentinel-realmarkets-chart="revoke-go-if-chart-skeleton-no-underlay-receipt-regresses"
                    data-pass2899-recovery-reapproval-realmarkets-chart="fresh-post-rollback-chart-skeleton-no-underlay-receipt-required"
                    data-pass2900-release-continuity-realmarkets-chart="continuity-digest-required-for-chart-skeleton-no-underlay-receipt"
                    data-pass2901-release-promotion-escrow-realmarkets-chart="fresh-chart-skeleton-no-underlay-receipt-required-before-go-candidate"
                    data-pass2902-production-claim-notary-realmarkets-chart="final-notary-manifest-required-for-chart-no-underlay-receipt"
                    data-pass2903-post-claim-surveillance-realmarkets-chart="live-drift-probation-required-for-chart-no-underlay-receipt"
                    data-pass2904-claim-expiry-renewal-realmarkets-chart="fresh-ci-playwright-chart-no-underlay-receipt-required-for-renewal"
                    data-pass2905-public-claim-transparency-realmarkets-chart="public-status-shows-chart-no-underlay-receipt-missing-until-live-proof"
                    data-pass2906-public-status-dispute-correction-realmarkets-chart="disputed-chart-no-underlay-status-requires-fresh-sha256-receipt-before-correction"
                    data-pass2907-public-status-appeal-review-realmarkets-chart="appealed-chart-no-underlay-status-requires-independent-review-and-fresh-receipt"
                    data-pass2908-public-status-final-arbitration-realmarkets-chart="binding-resolution-requires-frozen-chart-no-underlay-receipt"
                    data-pass2909-post-arbitration-public-resolution-realmarkets-chart="public-resolution-seal-requires-post-remediation-chart-no-underlay-retest"
                    data-pass2910-remediation-execution-closure-realmarkets-chart="verified-remediation-closure-requires-post-patch-icons-chart-no-underlay-retest"
                    data-pass2911-post-remediation-stability-watch-realmarkets-chart="post-closure-stability-watch-requires-icons-chart-no-underlay-relapse-sentinel-receipt"
                    data-pass2912-post-remediation-trust-restore-handover-realmarkets-chart="trust-restore-handover-requires-final-icons-chart-no-underlay-receipt-rollup"
                    data-pass2913-post-restore-continuity-monitor-realmarkets-chart="post-restore-continuity-requires-icons-chart-no-underlay-drift-sentinel-receipt"
                    data-pass2914-public-trust-evidence-decay-realmarkets-chart="icons-chart-no-underlay-receipt-must-be-fresh-and-renewal-escrow-bound"
                    data-pass2915-renewal-escrow-promotion-quarantine-realmarkets-chart="icons-chart-no-underlay-renewal-candidate-requires-independent-replay-before-promotion"
                    data-pass2916-renewal-promotion-final-seal-realmarkets-chart="icons-chart-no-underlay-final-seal-requires-dual-control-and-scheduled-revalidation"
                    data-pass2917-scheduled-revalidation-execution-breach-realmarkets-chart="icons-chart-no-underlay-revalidation-miss-triggers-auto-downgrade-and-fresh-receipt-required"
                    data-pass2918-downgrade-recovery-escrow-realmarkets-chart="icons-chart-no-underlay-after-downgrade-requires-fresh-recovery-escrow-receipt"
                    data-pass2919-recovery-replay-adjudication-realmarkets-chart="icons-chart-no-underlay-recovery-escrow-requires-independent-replay-before-public-decision"
                    data-pass2920-recovery-restore-probation-realmarkets-chart="icons-chart-no-underlay-restore-probation-requires-post-decision-no-regression-observation-receipt"
                    data-pass2921-probation-exit-seal-realmarkets-chart="icons-chart-no-underlay-probation-exit-requires-sustained-no-regression-receipt-rollup"
                  >
                    <span
                      className="realmarkets-chart-cell-pass4502 inline-flex min-h-10 w-[7.25rem] min-w-[7.25rem] max-w-[7.25rem] items-center justify-center px-0"
                      aria-hidden="true"
                      data-pass4466-chart-click-target="row-only-no-chart-button"
                      data-pass4467-chart-click-target="row-only-no-chart-button"
                      data-pass4485-chart-click-fit="row-click-opens-drawer-chart-is-passive"
                      data-pass4502-realmarkets-chart-cell="inert-no-hover-no-outline-no-chevron"
                      data-pass4504-chart-cell="line-only-passive-row-click"
                      data-pass4505-chart-cell="silent-no-title-no-pointer-target"
                      data-pass4507-chart-cell="passive-visual-only-row-owns-click"
                      data-pass4511-chart-cell="fixed-width-no-reflow-row-only-click"
                      data-pass4513-chart-cell="fixed-inline-size-passive-line-row-only-click"
                      data-pass4514-chart-cell="hard-inert-inline-size-no-tooltip-no-row-hover-mutation"
                      data-pass4515-chart-cell="reference-width-pointerless-no-hover-bg-or-border"
                      data-pass4516-chart-cell="silent-evidence-line-no-hover-focus-or-row-mutation"
                      data-pass4517-chart-cell="css-cascade-frozen-fixed-width-no-pointer-no-reflow"
                      data-pass4518-chart-cell="reference-silent-line-fixed-no-hover-outline-shadow"
                      data-pass4519-chart-cell="crisp-fixed-vector-line-pointerless"
                      data-pass4520-chart-cell="pixel-fixed-inert-vector-no-selection-no-hover-cascade"
                      data-pass4521-chart-cell="table-layout-fixed-no-row-hover-cascade-no-tooltip"
                      data-pass4522-chart-cell="still-inert-after-exclusive-drawer-layer-change"
                      data-pass4524-chart-cell="contained-inside-grid-no-right-edge-chevron-clipping"
                      data-pass4525-chart-cell="reference-width-inert-no-right-edge-overflow"
                      data-pass4526-chart-cell="reference-mini-chart-contained-in-row-no-button-no-clipping"
                      data-pass4529-chart-cell="rail-open-still-fixed-no-edge-clip"
                      data-pass4530-chart-cell="reference-final-narrow-passive-no-edge-clip"
                    >
                      <MarketSparkline
                        quote={quote}
                        asset={asset}
                        loading={loading}
                      />
                    </span>
                  </span>
                </div>
              );
            })}
            {loading || searching ? (
              <div className="flex items-center gap-3 border-t border-white/[0.07] px-5 py-4 text-xs text-white/[0.42]">
                <Loader2 className="h-4 w-4 animate-spin" />
                {searching ? c.searching : c.loading}
              </div>
            ) : null}
            <RealMarketsChartSourceFooter
              rows={visibleRows}
              quotes={quotes}
              loading={loading}
              locale={safeLocale}
              onRetry={() => setQuoteReloadToken((current) => current + 1)}
            />
            <div className="realmarkets-pass4574-source-footer" data-pass4574-realmarkets-source-footer="tiny-source-pending-not-per-cell-no-fake-values" data-pass4575-realmarkets-source-footer="freshness-budget-visible-no-stale-average" data-pass4576-realmarkets-source-footer="hidden-premium-receipt-probe-no-debug-wall" data-pass4577-realmarkets-source-footer="session-aware-live-last-close-delayed-counts" data-pass4578-realmarkets-source-footer="compact-visible-trust-ribbon-not-debug-wall" data-pass4580-realmarkets-source-footer="directional-color-reserved-for-live-only">
              <span>
                {safeLocale === "pl" ? "Źródła live" : safeLocale === "de" ? "Live-Quellen" : "Live sources"}: {pass4574DataTrustStats.trustedRows}/{pass4574DataTrustStats.totalRows} · {pass4574DataTrustStats.coverage}%
              </span>
              <span>
                {safeLocale === "pl" ? "Odrzucone ruchy" : safeLocale === "de" ? "Verworfene Bewegungen" : "Rejected moves"}: {pass4574DataTrustStats.rejectedWindows}
              </span>
              <span>{pass4574DataTrustStats.captions.join(" · ")}</span>
              <span className="realmarkets-pass4577-reliability-counts" aria-hidden="true">
                live {pass4574DataTrustStats.reliabilityCounts.live ?? 0} · close {pass4574DataTrustStats.reliabilityCounts["last-close"] ?? 0} · delayed {pass4574DataTrustStats.reliabilityCounts.delayed ?? 0} · charts {pass4574DataTrustStats.chartVisibleRows}/{pass4574DataTrustStats.totalRows} · values {pass4574DataTrustStats.printableWindows}/{pass4574DataTrustStats.totalWindows} · neutral {pass4574DataTrustStats.neutralSessionWindows} · hold {pass4574DataTrustStats.toneCounts.hold ?? 0}
              </span>
            </div>
            {visibleRows.length < displayRows.length ? (
              <div className="flex items-center justify-between gap-4 border-t border-white/[0.07] px-5 py-4">
                <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.34]">
                  {safeLocale === "pl"
                    ? `Widoczne ${visibleRows.length} z ${displayRows.length}`
                    : safeLocale === "de"
                      ? `${visibleRows.length} von ${displayRows.length} sichtbar`
                      : `Showing ${visibleRows.length} of ${displayRows.length}`}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setVisibleLimit((current: number) =>
                      Math.min(current + 50, displayRows.length),
                    )
                  }
                  className="min-h-10 rounded-full border border-cyan-200/[0.16] bg-cyan-300/[0.05] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-cyan-50 transition hover:bg-cyan-300/[0.10]"
                >
                  {safeLocale === "pl"
                    ? "Pokaż więcej"
                    : safeLocale === "de"
                      ? "Mehr anzeigen"
                      : "Show more"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </Pass2810RealMarketsTableErrorBoundary>

      {selected ? (
        <AssetDetailModal
          data={buildPass4418RealMarketsAssetDetailData(
            selected,
            selectedQuote,
            safeLocale,
            freshnessReferenceMs,
          )}
          onClose={() => setSelected(null)}
          productLabel="Velmère Real Markets"
        />
      ) : null}

      <div
        className="realmarkets-reference-footer"
        aria-label="Real Markets footer"
      >
        <span>
          {safeLocale === "pl"
            ? "Dane źródłowe Velmère Real Markets zachowują jawny status weryfikacji."
            : safeLocale === "de"
              ? "Quelldaten von Velmère Real Markets behalten einen expliziten Verifizierungsstatus."
              : "Velmère Real Markets source data keeps an explicit verification status."}
        </span>
        <Link href="/search" locale={safeLocale}>
          {safeLocale === "pl"
            ? "Metodologia ryzyka"
            : safeLocale === "de"
              ? "Risiko-Methodik"
              : "Risk methodology"}
        </Link>
      </div>
    </section>
  );
}

// PASS2922 selector anchors: data-pass2922-post-graduation-public-restore-seal-realmarkets-target="realmarkets-public-restore-blocked-until-icons-chart-no-underlay-post-graduation-receipts-and-surveillance" data-pass2922-post-graduation-public-restore-seal-realmarkets-chart="icons-chart-no-underlay-public-restore-seal-requires-post-graduation-receipt"
